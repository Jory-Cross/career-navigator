import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase, MapPin, DollarSign, Clock, AlertCircle, CheckCircle,
  User, Calendar, Edit2, Save, X, Loader2, TrendingUp, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// ============================================================
// RECOMMENDATION STATUS WORKFLOW (JOB FIELD / OCCUPATION LEVEL)
// ============================================================
//
// These statuses DO NOT represent job applications.
// They represent a structured workflow for evaluating
// and progressing job-field / occupation recommendations.
//
// Each status is intended to eventually have its own
// required actions / tasks before progressing to the next stage.
//
// FUTURE DESIGN INTENT:
//
// suggested
//   → AI-generated recommendation
//   → Awaiting staff review
//
// staff_reviewed
//   → Staff has reviewed fit, barriers, and supports
//   → Staff may add notes or refine understanding
//
// shared_with_client
//   → Recommendation has been presented to client
//   → Client discussion should occur
//
// client_interested
//   → Client expresses interest in this job field
//   → Begin deeper exploration / planning
//
// client_not_interested
//   → Client declines this job field
//   → Capture reasoning for future refinement
//
// job_search_target
//   → Selected as an ACTIVE job search direction
//   → FUTURE: Trigger market research workflow
//       - Generate ~20 local businesses in this job theme
//       - Staff/client validate and refine list
//       - Used for outreach, not just job postings
//
// not_a_fit
//   → Determined not appropriate based on constraints
//   → Retained for audit / learning
//
// archived
//   → No longer active, but retained for history
//
// ------------------------------------------------------------
// IMPORTANT:
// Task systems, client portal interactions, and automation
// (including market research generation) will be tied to
// these statuses in future phases.
// ============================================================

const STATUS_CONFIG = {
  suggested: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Suggested", icon: "✓" },

  staff_reviewed: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Staff Reviewed", icon: "👁" },

  shared_with_client: { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Shared with Client", icon: "📤" },

  client_interested: { color: "bg-green-100 text-green-700 border-green-200", label: "Client Interested", icon: "👍" },

  client_not_interested: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Client Not Interested", icon: "👎" },

  job_search_target: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "Job Search Target", icon: "🎯" },

  not_a_fit: { color: "bg-red-100 text-red-700 border-red-200", label: "Not a Good Fit", icon: "✗" },

  archived: { color: "bg-slate-200 text-slate-600 border-slate-300", label: "Archived", icon: "📁" }
};

export default function RecommendationReviewCard({ 
  recommendation, 
  clientId,
  onStatusChange,
  onRefresh
}) {
  const [editing, setEditing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(recommendation.status);
  const [reviewNotes, setReviewNotes] = useState(recommendation.review_notes || "");
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const statusConfig = STATUS_CONFIG[recommendation.status] || STATUS_CONFIG.suggested;

    const handleStatusUpdate = async () => {
    setUpdatingStatus(true);

    try {
      console.log("STATUS CHANGE - LOCAL ONLY:", {
        id: recommendation.id,
        newStatus,
        reviewNotes,
      });

      toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);

      setEditing(false);

      if (onStatusChange) {
        onStatusChange(recommendation.id, newStatus);
      }
    } catch (e) {
      toast.error("Failed to update recommendation: " + e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };
  return (
    <>
      <Card className="border-l-4" style={{ borderLeftColor: statusConfig.color.includes('green') ? '#22c55e' : statusConfig.color.includes('red') ? '#ef4444' : '#94a3b8' }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-slate-600" />
                {recommendation.job_title}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                <span className="font-medium">{recommendation.employer}</span>
                {recommendation.location && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {recommendation.location}
                    </div>
                  </>
                )}
                {recommendation.pay && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {recommendation.pay}
                    </div>
                  </>
                )}
              </div>
            </div>
            <Badge className={cn("shrink-0 text-xs font-medium border", statusConfig.color)}>
              {statusConfig.icon} {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Fit Score */}
          {recommendation.fit_score && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-medium">Fit Score</p>
                <p className="text-sm font-bold text-slate-900">{recommendation.fit_score}% Match</p>
              </div>
            </div>
          )}

          {/* Fit Reason */}
          {recommendation.fit_reason && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Why This Fits</p>
              <p className="text-sm text-slate-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                {recommendation.fit_reason}
              </p>
            </div>
          )}

          {/* Support Strategy */}
          {recommendation.support_strategy && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-green-600" /> Support Strategy
              </p>
              <p className="text-sm text-slate-700 bg-green-50 border border-green-100 rounded-lg p-3">
                {recommendation.support_strategy}
              </p>
            </div>
          )}

          {/* Concerns */}
          {recommendation.concerns && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Potential Barriers
              </p>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                {recommendation.concerns}
              </p>
            </div>
          )}

          {/* Review Status */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            {recommendation.reviewed_by_staff ? (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-slate-600">
                    Reviewed by <span className="font-medium">{recommendation.reviewed_by}</span>
                  </span>
                </div>
                {recommendation.reviewed_at && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(recommendation.reviewed_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
                {recommendation.review_notes && (
                  <div className="bg-slate-50 rounded-lg p-2.5 mt-2">
                    <p className="text-[11px] text-slate-500 font-medium mb-1">Review Notes</p>
                    <p className="text-xs text-slate-700">{recommendation.review_notes}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 italic">Not yet reviewed by staff</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 flex-1"
              onClick={() => setEditing(true)}
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Review & Update
            </Button>
            {recommendation.source_url && (
              <a href={recommendation.source_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="text-xs h-8">
                  View Source
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Recommendation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Status */}
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Current Status</p>
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs font-medium border", statusConfig.color)}>
                  {statusConfig.icon} {statusConfig.label}
                </Badge>
              </div>
            </div>

            {/* New Status Selector */}
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Update Status</p>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
               <SelectContent>
  <SelectItem value="suggested">✓ Suggested</SelectItem>
  <SelectItem value="staff_reviewed">👁 Staff Reviewed</SelectItem>
  <SelectItem value="shared_with_client">📤 Shared with Client</SelectItem>
  <SelectItem value="client_interested">👍 Client Interested</SelectItem>
  <SelectItem value="client_not_interested">👎 Client Not Interested</SelectItem>
  <SelectItem value="job_search_target">🎯 Use as Job Search Target</SelectItem>
  <SelectItem value="not_a_fit">✗ Not a Good Fit</SelectItem>
  <SelectItem value="archived">📁 Archive</SelectItem>
</SelectContent>
              </Select>
            </div>

            {/* Review Notes */}
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Staff Review Notes</p>
              <Textarea
                placeholder="Add notes about this recommendation, barriers discussed, next steps, etc."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="text-sm min-h-[100px] resize-none"
              />
            </div>

            {/* Original Data (read-only summary) */}
            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
              <p className="font-semibold text-slate-600">Original Recommendation Data</p>
              {recommendation.fit_reason && (
                <div className="bg-slate-50 rounded p-2">
                  <p className="font-medium text-slate-600 mb-1">Why This Fits:</p>
                  <p className="text-slate-700">{recommendation.fit_reason}</p>
                </div>
              )}
              {recommendation.support_strategy && (
                <div className="bg-slate-50 rounded p-2">
                  <p className="font-medium text-slate-600 mb-1">Support Strategy:</p>
                  <p className="text-slate-700">{recommendation.support_strategy}</p>
                </div>
              )}
              {recommendation.concerns && (
                <div className="bg-slate-50 rounded p-2">
                  <p className="font-medium text-slate-600 mb-1">Barriers:</p>
                  <p className="text-slate-700">{recommendation.concerns}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={updatingStatus}
              className="gap-2"
            >
              {updatingStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
