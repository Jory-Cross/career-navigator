import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AuthorizationPanel({ clientId, onAuthorizationSelect }) {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAuthorizations();
  }, [clientId]);

  const loadAuthorizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const auths = await base44.entities.ServiceAuthorization.filter({
        client_id: clientId
      });
      setAuthorizations(auths || []);
    } catch (err) {
      console.error('Error loading authorizations:', err);
      setError('Failed to load authorizations');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-300',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      expired: 'bg-red-100 text-red-800 border-red-300',
      exhausted: 'bg-orange-100 text-orange-800 border-orange-300',
      cancelled: 'bg-slate-100 text-slate-800 border-slate-300'
    };
    return colors[status] || 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: <CheckCircle2 className="w-4 h-4" />,
      pending: <Clock className="w-4 h-4" />,
      expired: <AlertCircle className="w-4 h-4" />,
      exhausted: <AlertCircle className="w-4 h-4" />,
      cancelled: <AlertCircle className="w-4 h-4" />
    };
    return icons[status] || <Clock className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading authorizations...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-sm text-red-700">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (authorizations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Service Authorizations</CardTitle>
          <CardDescription>No authorizations found</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Authorization
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeAuth = authorizations.find(a => a.status === 'active');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Service Authorizations ({authorizations.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {authorizations.map(auth => (
          <AuthorizationCard
            key={auth.id}
            authorization={auth}
            isActive={auth.id === activeAuth?.id}
            statusColor={getStatusColor(auth.status)}
            statusIcon={getStatusIcon(auth.status)}
            onSelect={() => onAuthorizationSelect?.(auth)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AuthorizationCard({ authorization, isActive, statusColor, statusIcon, onSelect }) {
  const hoursPercent = (authorization.used_hours / authorization.total_authorized_hours) * 100;
  const isLowOnHours = authorization.remaining_hours < 5 && authorization.remaining_hours > 0;
  const isExhausted = authorization.remaining_hours <= 0;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md",
        isActive ? "bg-blue-50 border-blue-300" : "bg-white border-slate-200",
        isExhausted && "border-red-300 bg-red-50"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-slate-900">
              {authorization.authorization_number}
            </h4>
            <Badge className={cn('text-xs font-medium border', statusColor)}>
              {statusIcon}
              <span className="ml-1">{authorization.status}</span>
            </Badge>
          </div>
          {authorization.vr_counselor_name && (
            <p className="text-xs text-slate-500 mt-1">VR Counselor: {authorization.vr_counselor_name}</p>
          )}
        </div>
      </div>

      {/* Service Details */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        {authorization.service_type_code && (
          <div>
            <span className="text-slate-500">Service Type</span>
            <p className="font-medium text-slate-900 capitalize">{authorization.service_type_code.replace(/_/g, ' ')}</p>
          </div>
        )}
        {authorization.job_goal && (
          <div>
            <span className="text-slate-500">Job Goal</span>
            <p className="font-medium text-slate-900">{authorization.job_goal}</p>
          </div>
        )}
        {authorization.employer_name && (
          <div className="col-span-2">
            <span className="text-slate-500">Employer</span>
            <p className="font-medium text-slate-900">{authorization.employer_name}</p>
          </div>
        )}
      </div>

      {/* Hours Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Hours Used</span>
          <span className={cn(
            "font-semibold",
            isExhausted && "text-red-600",
            isLowOnHours && "text-orange-600",
            !isLowOnHours && !isExhausted && "text-slate-900"
          )}>
            {authorization.used_hours?.toFixed(1) || 0} / {authorization.total_authorized_hours} hours
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              hoursPercent >= 100 ? "bg-red-500" :
              hoursPercent >= 80 ? "bg-orange-500" :
              "bg-green-500"
            )}
            style={{ width: `${Math.min(hoursPercent, 100)}%` }}
          />
        </div>
        <div className="text-xs text-slate-500">
          {authorization.remaining_hours?.toFixed(1) || 0} hours remaining
          {isExhausted && <span className="text-red-600 font-medium"> (Exhausted)</span>}
        </div>
      </div>

      {/* Date Range */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>{authorization.authorization_start_date} to {authorization.authorization_end_date}</span>
        {isActive && <Badge variant="outline" className="text-blue-600">Active</Badge>}
      </div>
    </div>
  );
}