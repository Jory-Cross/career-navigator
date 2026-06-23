import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  untested: {
    label: 'Untested',
    icon: Clock,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  emerging: {
    label: 'Emerging',
    icon: AlertCircle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  supported: {
    label: 'Supported',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  needs_validation: {
    label: 'Needs Validation',
    icon: AlertCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  refuted: {
    label: 'Refuted',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  archived: {
    label: 'Archived',
    icon: XCircle,
    color: 'text-slate-400',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
};

export default function VocationalThemeCandidateStatusPanel({
  client,
  candidate,
  currentUser,
}) {
  const [status, setStatus] = useState('untested');
  const [statusNotes, setStatusNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch current status on mount
  useEffect(() => {
    fetchStatus();
  }, [client?.id, candidate?.themeName]);

  const fetchStatus = async () => {
    try {
      if (!client?.id || !candidate?.themeName) {
        return;
      }
      
      setLoading(true);
      const getPayload = {
        client_id: client.id,
        candidate_theme_name: candidate.themeName,
      };

      const response = await base44.functions.invoke(
        'getVocationalThemeCandidateStatus',
        getPayload
      );

      if (response.data) {
        setStatus(response.data.status || 'untested');
        setStatusNotes(response.data.status_notes || '');
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('Failed to load validation status');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStatus = async () => {
    try {
      setSaving(true);
      
      const clientId = client?.id || client?._id;
      if (!clientId || !candidate?.themeName) {
        toast.error('Missing client or candidate information');
        setSaving(false);
        return;
      }
      
      const savePayload = {
        client_id: clientId,
        candidate_theme_name: candidate.themeName,
        category_label: candidate.categoryLabel || 'Emerging Interests',
        status,
        status_notes: statusNotes,
      };

      const response = await base44.functions.invoke(
        'saveVocationalThemeCandidateStatus',
        savePayload
      );

      // Check for success indicators (handle various response shapes from SDK wrapper vs direct)
      const successResponse = response.data || response;
      const isSaved = 
        successResponse?.success === true ||
        successResponse?.ok === true ||
        successResponse?.status_id ||
        successResponse?.status;

      if (isSaved) {
        toast.success(`Status updated to "${STATUS_CONFIG[status].label}"`);
        await fetchStatus(); // Refresh displayed status
        setIsEditing(false); // Close editor and return to display mode
      } else {
        toast.error('Failed to save status');
      }
    } catch (error) {
      console.error('Error saving status:', error);
      toast.error('Error saving status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading status...</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      {/* Current Status Display */}
      {!isEditing && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            <Badge
              variant="outline"
              className={`${config.bg} ${config.border} ${config.color} text-xs font-semibold`}
            >
              {config.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 text-xs"
          >
            Update Status
          </Button>
        </div>
      )}

      {statusNotes && !isEditing && (
        <p className="text-xs text-slate-600 italic leading-relaxed">
          "{statusNotes}"
        </p>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Validation Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="untested">Untested</SelectItem>
                <SelectItem value="emerging">Emerging</SelectItem>
                <SelectItem value="supported">Supported</SelectItem>
                <SelectItem value="needs_validation">Needs Validation</SelectItem>
                <SelectItem value="refuted">Refuted</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Notes (optional)
            </label>
            <Textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="e.g., 'Confirmed by Discovery Activity. Strong interest expressed.'"
              className="h-16 text-xs resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveStatus}
              disabled={saving}
              className="h-7 text-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Status'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}