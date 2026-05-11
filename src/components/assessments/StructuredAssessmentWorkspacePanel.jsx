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
import { CheckCircle2, Clock } from "lucide-react";
import StructuredAssessmentForm from "./StructuredAssessmentForm";
import {
  extractEvidenceFromResponses,
  buildSourceMetadata,
} from "@/lib/assessments/structuredAssessmentHelpers";
import { extractStaffReviewFlags } from "@/lib/assessments/structuredAssessmentHelpers";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function StructuredAssessmentWorkspacePanel({
  clientId,
  assessment,
  existingRecord,
  onSaved,
}) {
  const { sections, meta } = assessment;

  // Local state — mirrors IntakeSectionForm pattern
  const [responses, setResponses] = useState(existingRecord?.responses || {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Always-current refs so async save reads latest values (never stale)
  const responsesRef = useRef(responses);
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Track the DB record id so we update rather than create a duplicate
  const recordIdRef = useRef(existingRecord?.id || null);

  // Reset when switching to a different assessment (existingRecord changes)
  useEffect(() => {
    setIsDirty(false);
    recordIdRef.current = existingRecord?.id || null;
    setResponses(existingRecord?.responses || {});
  }, [existingRecord?.id]);

  // Field change handler — mark dirty, update state
  const handleChange = useCallback((id, value) => {
    setIsDirty(true);
    setResponses((prev) => ({ ...prev, [id]: value }));
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
      status: "in_progress",
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

  // ── Save-on-exit: fires when component unmounts (card switch / clicking away)
  // Mirrors the exact pattern in IntakeSectionForm
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        doSaveRef.current(responsesRef.current).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Save on unmount (card switch)
      if (isDirtyRef.current) {
        doSaveRef.current(responsesRef.current).catch(() => {});
      }
    };
  }, []); // empty deps — intentional, reads everything via stable refs

  // ── Manual "Save Progress" button handler
  const handleSave = useCallback(async () => {
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
  }, [doSave]);

  // ── "Save & Close" button (cancel) — save then notify parent
  const handleCancel = useCallback(async () => {
    if (isDirtyRef.current) {
      await doSave(responsesRef.current, false).catch(() => {});
      setIsDirty(false);
    }
    onSaved?.();
  }, [doSave, onSaved]);

  const status = !existingRecord
    ? "not_started"
    : existingRecord.status === "completed"
    ? "completed"
    : "in_progress";

  const statusBadge = {
    not_started: null,
    in_progress: (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
        <Clock className="w-3 h-3" /> Draft
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{meta.label}</h3>
            {meta.description && (
              <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
            )}
          </div>
          {statusBadge}
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