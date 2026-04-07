import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Authorization Panel
 * Displays client's active service authorizations with hours tracking
 */

export default function AuthorizationPanel({ clientId, onAuthorizationSelect }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAuthorizationSummary();
  }, [clientId]);

  const loadAuthorizationSummary = async () => {
    try {
      setLoading(true);
      const result = await base44.functions.invoke('validateTimeEntryAuthorization', {
        action: 'get_summary',
        client_id: clientId
      });
      setSummary(result.data.summary);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-slate-500">Loading authorizations...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Service Authorizations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-slate-600">No service authorizations</p>
            <Button size="sm" variant="outline" onClick={() => window.location.href = '/ServiceAuthorization'}>
              <Plus className="w-4 h-4 mr-1" />
              Create Authorization
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Authorizations */}
      {summary.active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Active Authorizations</h3>
          <div className="space-y-3">
            {summary.active.map(auth => (
              <AuthorizationCard
                key={auth.id}
                auth={auth}
                onSelect={() => onAuthorizationSelect?.(auth.id)}
                variant="active"
              />
            ))}
          </div>
        </div>
      )}

      {/* Exhausted Authorizations */}
      {summary.exhausted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Exhausted</h3>
          <div className="space-y-2">
            {summary.exhausted.map(auth => (
              <AuthorizationCard
                key={auth.id}
                auth={auth}
                onSelect={() => onAuthorizationSelect?.(auth.id)}
                variant="exhausted"
              />
            ))}
          </div>
        </div>
      )}

      {/* Expired Authorizations */}
      {summary.expired.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Expired</h3>
          <div className="space-y-2">
            {summary.expired.map(auth => (
              <AuthorizationCard
                key={auth.id}
                auth={auth}
                onSelect={() => onAuthorizationSelect?.(auth.id)}
                variant="expired"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Authorization Card
 */
function AuthorizationCard({ auth, onSelect, variant = 'active' }) {
  const getVariantConfig = () => {
    switch (variant) {
      case 'exhausted':
        return {
          bgClass: 'bg-red-50 border-red-200',
          badgeVariant: 'destructive',
          icon: AlertCircle,
          statusText: 'Exhausted'
        };
      case 'expired':
        return {
          bgClass: 'bg-slate-50 border-slate-200',
          badgeVariant: 'secondary',
          icon: Clock,
          statusText: 'Expired'
        };
      case 'active':
      default:
        return {
          bgClass: 'bg-blue-50 border-blue-200',
          badgeVariant: 'default',
          icon: CheckCircle,
          statusText: 'Active'
        };
    }
  };

  const config = getVariantConfig();
  const StatusIcon = config.icon;

  return (
    <Card className={cn('border', config.bgClass)}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <StatusIcon className={cn(
                'w-4 h-4 mt-0.5 shrink-0',
                variant === 'active' && 'text-green-600',
                variant === 'exhausted' && 'text-red-600',
                variant === 'expired' && 'text-slate-400'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{auth.number}</p>
                <p className="text-xs text-slate-600 capitalize">{auth.serviceType.replace('_', ' ')}</p>
              </div>
            </div>
            <Badge variant={config.badgeVariant} className="shrink-0">
              {config.statusText}
            </Badge>
          </div>

          {/* Hours Progress */}
          {variant === 'active' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Hours Used</span>
                  <span className="font-semibold text-slate-900">
                    {auth.hoursUsed.toFixed(1)} / {auth.totalHours.toFixed(1)} hrs
                  </span>
                </div>
                <Progress
                  value={parseFloat(auth.percentUsed)}
                  className="h-2"
                />
                <div className="text-xs text-slate-500">
                  {auth.hoursRemaining.toFixed(1)} hrs remaining
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Start:</span>
                  <p className="font-medium text-slate-900">{auth.startDate}</p>
                </div>
                <div>
                  <span className="text-slate-500">End:</span>
                  <p className="font-medium text-slate-900">{auth.endDate}</p>
                </div>
              </div>

              {/* Action */}
              <Button
                size="sm"
                variant="outline"
                onClick={onSelect}
                className="w-full text-xs"
              >
                Use This Authorization
              </Button>
            </>
          )}

          {/* Exhausted/Expired Summary */}
          {(variant === 'exhausted' || variant === 'expired') && (
            <div className="text-xs text-slate-600">
              {variant === 'exhausted'
                ? `All ${auth.totalHours.toFixed(1)} hours used`
                : `Expired on ${auth.endDate}`
              }
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}