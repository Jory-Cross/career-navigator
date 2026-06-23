/**
 * StructuredAssessmentWorkspacePanel
 *
 * Follows the same save lifecycle as IntakeSectionForm:
 * - Local state for responses while editing
 * - Refs track latest responses + dirty flag (never stale on async save)
 * - doSave() is the single save function used by manual save, unmount, and cancel
 * - On unmount (card switch / clicking away): saves if dirty, no debounce
 * - No key/remount tricks — stable component, no flashing
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, CheckCheck } from "lucide-react";
import StructuredAssessmentForm from "./StructuredAssessmentForm";
import {
  extractEvidenceFromResponses,
  buildSourceMetadata,
  extractStaffReviewFlags,
} from "@/lib/assessments/structuredAssessmentHelpers";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function StructuredAssessmentWorkspacePanel({
  clientId,
  assessment,
  existingRecord,
  initialResponses,
  onSaved,
  onClose,
}) {
  const { sections, meta } = assessment;

  // Seed from existingRecord, then overlay any initialResponses (e.g. pre-selected purpose)
  const baseResponses = existingRecord?.responses || {};
  const seedResponses = initialResponses ? { ...baseResponses, ...initialResponses } : baseResponses;

  // Local state — mirrors IntakeSectionForm pattern
  const [responses, setResponses] = useState(seedResponses);
  const [isDirty, setIsDirty] = useState(!!initialResponses);
  const [saving, setSaving] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [recordStatus, setRecordStatus] = useState(existingRecord?.status || null);

  // Always-current refs so async save reads latest values (never stale)
  const responsesRef = useRef(responses);
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Track the DB record id so we update rather than create a duplicate
  const recordIdRef = useRef(existingRecord?.id || null);

  // Reset when switching to a different assessment (existingRecord changes)
 useEffect(() => {
  const baseResponses = existingRecord?.responses || {};
  const nextResponses = initialResponses
    ? { ...baseResponses, ...initialResponses }
    : baseResponses;

  setIsDirty(!!initialResponses);
  recordIdRef.current = existingRecord?.id || null;
  setResponses(nextResponses);
  setRecordStatus(existingRecord?.status || null);
}, [existingRecord?.id, initialResponses]);

  // Field change handler — mark dirty, update state, and immediately update refs
  const handleChange = useCallback((id, value) => {
    setIsDirty(true);
    isDirtyRef.current = true;

    setResponses((prev) => {
      const next = { ...prev, [id]: value };

      // Barriers to Employment: if sensory/environmental barriers are marked "No",
      // clear hidden follow-up answers so stale data does not continue feeding FACTS.
      if (id === "sensory_barrier_present" && value === "no") {
        delete next.sensory_barrier_types;
        delete next.sensory_barrier_severity;
        delete next.sensory_barrier_history;
        delete next.sensory_accommodation_tried;
        delete next.sensory_accommodation_outcome;
      }

      // If accommodations were not tried, clear the hidden accommodation outcome.
      if (id === "sensory_accommodation_tried" && value === "no") {
        delete next.sensory_accommodation_outcome;
      }

      responsesRef.current = next;
      return next;
    });
  }, []);

  // ── Core save (mirrors doSave in IntakeSectionForm) ───────────────────────
  const doSave = useCallback(async (latestResponses, showToast = false) => {
    const hasAny = Object.values(latestResponses).some(
      (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );
    if (!hasAny) return;

    const user = await base44.auth.me();
    const completedAt = new Date().toISOString();

    let structured_evidence = [];
    let source_metadata = {};
    let staff_review_flags = [];

    try {
      structured_evidence = extractEvidenceFromResponses(sections, latestResponses, {
        completedBy: user?.email,
        completedAt,
        source: "staff_observed",
      });
    } catch (e) {
      console.warn("StructuredWorkspacePanel: extractEvidence failed (non-fatal)", e);
    }

    try {
      source_metadata = buildSourceMetadata({
        assessmentType: meta.assessment_type,
        completedBy: user?.email,
        completedAt,
        source: "staff_observed",
        clientId,
      });
    } catch (e) {
      console.warn("StructuredWorkspacePanel: buildSourceMetadata failed (non-fatal)", e);
    }

    try {
      staff_review_flags = extractStaffReviewFlags(sections, latestResponses);
    } catch (e) {
      console.warn("StructuredWorkspacePanel: extractStaffReviewFlags failed (non-fatal)", e);
    }

    const payload = {
      client_id: clientId,
      assessment_type: meta.assessment_type,
      // Never downgrade a completed assessment via auto-save
      status: recordIdRef.current && recordStatus === "completed" ? "completed" : "in_progress",
      responses: latestResponses,
      completed_by: user?.email || "",
      structured_evidence,
      source_metadata,
      staff_review_flags,
    };

    if (recordIdRef.current) {
      await base44.entities.Assessment.update(recordIdRef.current, payload);
    } else {
      const result = await base44.entities.Assessment.create(payload);
      recordIdRef.current = result?.id || null;
    }

    if (showToast) toast.success("Progress saved");
    if (onSaved) onSaved();
  }, [clientId, meta.assessment_type, sections, onSaved]);

  // Keep a stable ref to doSave so the unmount effect is never stale
  const doSaveRef = useRef(doSave);
  useEffect(() => { doSaveRef.current = doSave; }, [doSave]);

  // ── beforeunload: show native browser warning when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // React unmount (card switch within the SPA): async doSave is fine here
      if (isDirtyRef.current) {
        doSaveRef.current(responsesRef.current).catch(() => {});
      }
    };
  }, []);

  // ── Manual "Save Progress" button handler
    const handleSave = useCallback(async () => {
    console.log("STRUCTURED SAVE CLICKED", {
      assessmentType: meta.assessment_type,
      responses: responsesRef.current,
    });

    toast.message("Save button clicked");

    setSaving(true);
    try {
      await doSave(responsesRef.current, true);
      setIsDirty(false);
    } catch (err) {
      console.error("STRUCTURED SAVE ERROR", err);
      toast.error("Failed to save: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }, [doSave, meta.assessment_type]);
  // ── "Mark Assessment Complete" — staff-controlled status change
  const handleMarkComplete = useCallback(async () => {
    setMarkingComplete(true);
    try {
      const user = await base44.auth.me();
      const completedAt = new Date().toISOString();
      const latestResponses = responsesRef.current;

      let structured_evidence = [];
      let source_metadata = {};
      let staff_review_flags = [];

      try {
        structured_evidence = extractEvidenceFromResponses(sections, latestResponses, {
          completedBy: user?.email, completedAt, source: "staff_observed",
        });
      } catch (e) { /* non-fatal */ }

      try {
        source_metadata = buildSourceMetadata({
          assessmentType: meta.assessment_type, completedBy: user?.email,
          completedAt, source: "staff_observed", clientId,
        });
      } catch (e) { /* non-fatal */ }

      try {
        staff_review_flags = extractStaffReviewFlags(sections, latestResponses);
      } catch (e) { /* non-fatal */ }

      const payload = {
        client_id: clientId,
        assessment_type: meta.assessment_type,
        status: "completed",
        responses: latestResponses,
        completed_by: user?.email || "",
        completed_at: completedAt,
        structured_evidence,
        source_metadata,
        staff_review_flags,
      };

      if (recordIdRef.current) {
        await base44.entities.Assessment.update(recordIdRef.current, payload);
      } else {
        const result = await base44.entities.Assessment.create(payload);
        recordIdRef.current = result?.id || null;
      }

      setRecordStatus("completed");
      setIsDirty(false);
      toast.success("Assessment marked as complete");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error("Failed to mark complete: " + (err?.message || "Unknown error"));
    } finally {
      setMarkingComplete(false);
    }
  }, [clientId, meta.assessment_type, sections, onSaved]);

  // ── "Save & Close" button (cancel) — save then notify parent
   const handleCancel = useCallback(async () => {
    if (isDirtyRef.current) {
      await doSave(responsesRef.current, false).catch(() => {});
      setIsDirty(false);
    }
    await onSaved?.();
    onClose?.();
  }, [doSave, onSaved, onClose]);

  const status = recordStatus === "completed" ? "completed"
    : (existingRecord || recordIdRef.current) ? "in_progress"
    : "draft";

  const statusBadge = {
    draft: (
      <Badge variant="outline" className="text-slate-500 border-slate-200 bg-slate-50 gap-1">
        <Clock className="w-3 h-3" /> Draft
      </Badge>
    ),
    in_progress: (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
        <Clock className="w-3 h-3" /> In Progress
      </Badge>
    ),
    completed: (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Completed
      </Badge>
    ),
  }[status];

  return (
    <Card className="border border-slate-200 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
         <div>
  <h3 className="text-base font-semibold text-slate-900">
    {meta.label}
  </h3>

  {responses?.interview_type && (
    <p className="text-sm font-medium text-indigo-700 mt-1">
      {responses.interview_type}
    </p>
  )}

  {meta.description && (
    <p className="text-xs text-slate-500 mt-0.5">
      {meta.description}
    </p>
  )}
</div>
          <div className="flex items-center gap-2">
            {statusBadge}
            {status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-300 hover:bg-green-50 gap-1.5"
                onClick={handleMarkComplete}
                disabled={markingComplete}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {markingComplete ? "Saving..." : "Mark Complete"}
              </Button>
            )}
            {status === "completed" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-500 text-xs"
                onClick={() => {
                  setRecordStatus("in_progress");
                  // Persist the reopen
                  if (recordIdRef.current) {
                    base44.entities.Assessment.update(recordIdRef.current, { status: "in_progress" })
                      .then(() => onSaved?.()).catch(() => {});
                  }
                }}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pt-4">
        <StructuredAssessmentForm
          sections={sections}
          assessmentType={meta.assessment_type}
          responses={responses}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          isDirty={isDirty}
        />
      </CardContent>
    </Card>
  );
}
