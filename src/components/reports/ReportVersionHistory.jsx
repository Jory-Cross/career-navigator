import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Lock,
  Unlock,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReportVersionHistory({
  clientId,
  reportType,
  periodStart,
  periodEnd,
  onVersionSelect
}) {
  const [versions, setVersions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    loadVersions();
    loadHistory();
  }, [clientId, reportType, periodStart, periodEnd]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const result = await base44.functions.invoke('generateVersionedReport', {
        action: 'get_versions',
        params: {
          client_id: clientId,
          report_type: reportType,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd
        }
      });
      setVersions(result.data.versions || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const result = await base44.functions.invoke('generateVersionedReport', {
        action: 'get_history',
        params: {
          client_id: clientId,
          report_type: reportType,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd
        }
      });
      setHistory(result.data.history || []);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const handleLockPeriod = async () => {
    setLocking(true);
    try {
      const result = await base44.functions.invoke('generateVersionedReport', {
        action: 'lock_period',
        params: {
          client_id: clientId,
          report_type: reportType,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          reason: lockReason
        }
      });

      if (result.data.success) {
        toast.success('Reporting period locked');
        loadVersions();
        setShowLockDialog(false);
        setLockReason('');
      } else {
        toast.error(result.data.error);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocking(false);
    }
  };

  const handleUnlockPeriod = async () => {
    try {
      const result = await base44.functions.invoke('generateVersionedReport', {
        action: 'unlock_period',
        params: {
          client_id: clientId,
          report_type: reportType,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd
        }
      });

      if (result.data.success) {
        toast.success('Reporting period unlocked');
        loadVersions();
      } else {
        toast.error(result.data.error);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmitVersion = async (versionId) => {
    try {
      const result = await base44.functions.invoke('generateVersionedReport', {
        action: 'submit_version',
        params: {
          version_id: versionId
        }
      });

      if (result.data.success) {
        toast.success('Report submitted');
        loadVersions();
      } else {
        toast.error(result.data.error);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading versions...
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const isPeriodLocked = versions.some(v => v.isLocked);

  return (
    <div className="space-y-4">
      {/* Period Lock Status */}
      <Card className={cn(
        isPeriodLocked && 'border-amber-200 bg-amber-50'
      )}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPeriodLocked ? (
                <>
                  <Lock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-slate-900">Reporting Period Locked</p>
                    <p className="text-xs text-slate-600">
                      Time entries cannot be modified for this period
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-900">Reporting Period Open</p>
                    <p className="text-xs text-slate-600">
                      Time entries can be added or modified
                    </p>
                  </div>
                </>
              )}
            </div>

            {isPeriodLocked ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnlockPeriod}
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
              >
                <Unlock className="w-4 h-4 mr-1" />
                Unlock
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLockDialog(true)}
                className="text-slate-700 border-slate-200"
              >
                <Lock className="w-4 h-4 mr-1" />
                Lock Period
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Versions */}
      {versions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-500">
            No report versions generated yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              isExpanded={expandedVersion === version.id}
              onToggleExpand={() => setExpandedVersion(
                expandedVersion === version.id ? null : version.id
              )}
              onSelect={() => onVersionSelect?.(version)}
              onSubmit={() => handleSubmitVersion(version.id)}
              history={history.find(h => h.versionNumber === version.versionNumber)}
            />
          ))}
        </div>
      )}

      {/* Lock Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Reporting Period</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Locking this reporting period prevents any changes to time entries within:
              </p>
              <div className="bg-slate-100 rounded p-3 text-sm text-slate-900 font-medium">
                {periodStart} to {periodEnd}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Lock Reason (Optional)</Label>
              <Textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="e.g., Submitted to VR agency, Q2 2024 final report"
                className="text-xs h-20"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>⚠️ Note:</strong> You can unlock the period later if needed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLockPeriod}
              disabled={locking}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {locking ? 'Locking...' : 'Lock Period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Individual Version Card
 */
function VersionCard({ version, isExpanded, onToggleExpand, onSelect, onSubmit, history }) {
  const getStatusIcon = () => {
    if (version.isFinal) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (version.isLocked) return <Lock className="w-5 h-5 text-amber-600" />;
    return <FileText className="w-5 h-5 text-blue-600" />;
  };

  const getStatusBadge = () => {
    if (version.isFinal) return <Badge className="bg-green-100 text-green-800">Submitted</Badge>;
    if (version.isLocked) return <Badge className="bg-amber-100 text-amber-800">Locked</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">Draft</Badge>;
  };

  return (
    <Card className={cn('cursor-pointer transition-all', isExpanded && 'ring-2 ring-blue-400')}>
      <CardContent className="pt-4">
        {/* Header */}
        <div
          onClick={onToggleExpand}
          className="flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-3 flex-1">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900">
                  Version {version.versionNumber}
                </h4>
                {version.isLatest && (
                  <Badge variant="secondary" className="text-xs">Latest</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Generated {new Date(version.generatedAt).toLocaleString()} by {version.generatedBy}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <ChevronRight className={cn(
              'w-5 h-5 text-slate-400 transition-transform',
              isExpanded && 'rotate-90'
            )} />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-slate-500">Entries:</span>
            <p className="font-semibold text-slate-900">{version.timeEntryCount}</p>
          </div>
          <div>
            <span className="text-slate-500">Hours:</span>
            <p className="font-semibold text-slate-900">{version.totalHours}</p>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>
            <p className="font-semibold text-slate-900">
              {version.isFinal ? 'Final' : 'Draft'}
            </p>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            {history && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Changes from Previous:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {history.entriesAdded > 0 && (
                    <div className="text-green-700">
                      +{history.entriesAdded} entries
                    </div>
                  )}
                  {history.entriesRemoved > 0 && (
                    <div className="text-red-700">
                      -{history.entriesRemoved} entries
                    </div>
                  )}
                  {history.hoursChanged !== '0' && (
                    <div className={history.hoursChanged > 0 ? 'text-green-700' : 'text-red-700'}>
                      {history.hoursChanged > 0 ? '+' : ''}{history.hoursChanged} hours
                    </div>
                  )}
                </div>
              </div>
            )}

            {version.isLocked && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                <div className="flex gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Period Locked</p>
                    <p className="text-amber-800 text-xs">
                      {new Date(version.lockedAt).toLocaleString()} by {version.lockedBy}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {version.isFinal && (
              <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
                <div className="flex gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Submitted</p>
                    <p className="text-green-800 text-xs">
                      {new Date(version.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(version.pdfUrl, '_blank')}
                className="flex-1 text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download PDF
              </Button>

              {!version.isFinal && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSubmit()}
                  className="flex-1 text-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Submit
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => onSelect()}
                className="flex-1 text-xs"
              >
                View Details
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}