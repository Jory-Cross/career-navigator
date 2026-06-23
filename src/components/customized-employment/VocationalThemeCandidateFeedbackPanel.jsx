import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const STATUS_BADGES = {
  supported: { label: "Supported", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  needs_more_discovery: { label: "Needs More Discovery", color: "bg-amber-50 text-amber-700 border-amber-200" },
  not_relevant: { label: "Not Relevant", color: "bg-red-50 text-red-700 border-red-200" },
  sufficient_evidence: { label: "Sufficient Evidence", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  more_evidence_needed: { label: "More Evidence Needed", color: "bg-amber-50 text-amber-700 border-amber-200" },
  weak_evidence_base: { label: "Weak Evidence Base", color: "bg-red-50 text-red-700 border-red-200" },
  yes: { label: "Yes", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  no: { label: "No", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

export default function VocationalThemeCandidateFeedbackPanel({
  client,
  candidate,
  currentUser,
  canEdit = true,
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    staff_validation: "",
    evidence_quality: "",
    use_for_future_discovery: "",
    notes: "",
  });

  // Load existing feedback on mount
  useEffect(() => {
    if (!client?.id || !candidate?.themeName || !currentUser?.id) return;

    const loadFeedback = async () => {
      setLoading(true);
      try {
        const result = await base44.functions.invoke("getVocationalThemeCandidateFeedback", {
          client_id: client.id,
          candidate_theme_name: candidate.themeName,
          reviewer_user_id: currentUser.id,
        });

        if (result?.data?.feedback) {
          const fb = result.data.feedback;
          setFeedback(fb);
          setForm({
            staff_validation: fb.staff_validation || "",
            evidence_quality: fb.evidence_quality || "",
            use_for_future_discovery: fb.use_for_future_discovery || "",
            notes: fb.notes || "",
          });
        }
      } catch (error) {
        console.error("Failed to load feedback", error);
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();
  }, [client?.id, candidate?.themeName, currentUser?.id]);

  const handleSave = async () => {
    if (!form.staff_validation || !form.evidence_quality || form.use_for_future_discovery === "") {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const result = await base44.functions.invoke("saveVocationalThemeCandidateFeedback", {
        client_id: client.id,
        candidate_theme_name: candidate.themeName,
        category_label: candidate.categoryLabel || "Vocational Themes",
        cohort_id: currentUser?.cohort_id || null,
        staff_validation: form.staff_validation,
        evidence_quality: form.evidence_quality,
        use_for_future_discovery: form.use_for_future_discovery,
        notes: form.notes,
      });

      if (result?.data?.ok) {
        setFeedback(result.data);
        toast.success(result.data.message === "Feedback created" ? "Feedback saved" : "Feedback updated");
        setExpanded(false);
      }
    } catch (error) {
      console.error("Failed to save feedback", error);
      toast.error("Failed to save feedback");
    } finally {
      setSaving(false);
    }
  };

  // Visibility check
  const isAdmin = currentUser?.role === "admin";
  const isCohortManager = currentUser?.cohort_role === "manager";
  const isOwnFeedback = feedback?.reviewer_user_id === currentUser?.id || !feedback;

  const hasAccess = isAdmin || isCohortManager || (canEdit && isOwnFeedback);

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="rounded-lg border border-violet-100 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-violet-50/40 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <span className="text-xs font-medium text-slate-700">Staff Feedback</span>
        </div>

        {feedback && !expanded && (
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Badge variant="outline" className={`text-xs border ${STATUS_BADGES[feedback.staff_validation]?.color || "border-slate-200"}`}>
              {STATUS_BADGES[feedback.staff_validation]?.label || "—"}
            </Badge>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3 py-3 border-t border-violet-50 bg-violet-50/20 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading feedback...
            </div>
          ) : (
            <>
              {/* Staff Validation */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Staff Validation *
                </label>
                <Select value={form.staff_validation} onValueChange={(val) => setForm((f) => ({ ...f, staff_validation: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supported">Supported</SelectItem>
                    <SelectItem value="needs_more_discovery">Needs More Discovery</SelectItem>
                    <SelectItem value="not_relevant">Not Relevant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Evidence Quality */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Evidence Quality *
                </label>
                <Select value={form.evidence_quality} onValueChange={(val) => setForm((f) => ({ ...f, evidence_quality: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sufficient_evidence">Sufficient Evidence</SelectItem>
                    <SelectItem value="more_evidence_needed">More Evidence Needed</SelectItem>
                    <SelectItem value="weak_evidence_base">Weak Evidence Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Use For Future Discovery */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Use For Future Discovery *
                </label>
                <Select value={form.use_for_future_discovery} onValueChange={(val) => setForm((f) => ({ ...f, use_for_future_discovery: val }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Notes
                </label>
                <Textarea
                  placeholder="Optional notes or reasoning..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="min-h-20 text-xs resize-none"
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving || !canEdit}
                className="w-full h-8 text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : feedback ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Update Feedback
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Save Feedback
                  </>
                )}
              </Button>

              {/* Feedback status summary */}
              {feedback && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-emerald-800">Feedback saved by {feedback.reviewer_role || "staff"}</p>
                      <p className="text-emerald-700 mt-0.5">
                        {STATUS_BADGES[feedback.staff_validation]?.label} — {STATUS_BADGES[feedback.evidence_quality]?.label}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}