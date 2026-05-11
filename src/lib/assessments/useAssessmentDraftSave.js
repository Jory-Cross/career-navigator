/**
 * useAssessmentDraftSave — Shared draft-save hook for all structured assessments.
 *
 * Handles:
 * - Deduplication via recordIdRef (never creates two drafts for the same assessment)
 * - Concurrency guard via savingRef
 * - in_progress draft save (silent, no toast)
 * - completed final save (with toast)
 * - Skips save if no responses entered
 * - Exposes saveDraft for dialog-close / exit triggers
 *
 * Usage:
 *   const { saveDraft, handleSave, recordIdRef } = useAssessmentDraftSave({
 *     clientId,
 *     assessmentType,
 *     existingAssessment,
 *     buildExtraPayload,   // optional async (responses, status) => { structured_evidence, ... }
 *     onSaved,
 *   });
 */

import { useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export function useAssessmentDraftSave({
  clientId,
  assessmentType,
  existingAssessment,
  buildExtraPayload = null,
  onSaved,
}) {
  // Track live record ID — prevents duplicate creates
  const recordIdRef = useRef(existingAssessment?.id || null);
  // Keep recordIdRef current if existingAssessment arrives after initial mount
  if (existingAssessment?.id && !recordIdRef.current) {
    recordIdRef.current = existingAssessment.id;
  }
  // Concurrency guard
  const savingRef = useRef(false);

  console.log("STRUCTURED INITIAL RESPONSES", {
    assessmentType,
    clientId,
    existingId: existingAssessment?.id || null,
    recordIdRefCurrent: recordIdRef.current,
    responseCount: Object.keys(existingAssessment?.responses || {}).length,
  });

  const hasAnyResponse = (responses) =>
    Object.values(responses).some(
      (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );

  // ── Draft Save (in_progress, silent) ──────────────────────────────────────

  const saveDraft = useCallback(async (responses) => {
    if (savingRef.current) {
      console.log("STRUCTURED DRAFT SAVE START: skipped — already saving");
      return;
    }
    if (!hasAnyResponse(responses)) {
      console.log("STRUCTURED DRAFT SAVE START: skipped — no responses");
      return;
    }

    savingRef.current = true;
    console.log("STRUCTURED DRAFT SAVE START", {
      assessmentType,
      clientId,
      recordId: recordIdRef.current,
      responseCount: Object.keys(responses).length,
    });

    try {
      const user = await base44.auth.me();
      const extra = buildExtraPayload ? await buildExtraPayload(responses, "in_progress") : {};

      const payload = {
        client_id: clientId,
        assessment_type: assessmentType,
        status: "in_progress",
        responses,
        completed_by: user?.email || "",
        ...extra,
      };

      console.log("STRUCTURED DRAFT PAYLOAD", { ...payload, responses: `{${Object.keys(responses).length} keys}` });
      console.log("STRUCTURED DRAFT SAVED RESPONSES", responses);

      let result;
      if (recordIdRef.current) {
        result = await base44.entities.Assessment.update(recordIdRef.current, payload);
      } else {
        result = await base44.entities.Assessment.create(payload);
        recordIdRef.current = result?.id || null;
      }

      console.log("STRUCTURED DRAFT SAVE RESULT", { id: recordIdRef.current, status: "in_progress" });
    } catch (err) {
      console.error("STRUCTURED DRAFT SAVE ERROR", err);
      // Don't show toast for background draft saves — only throw so callers can handle
      throw err;
    } finally {
      savingRef.current = false;
    }
  }, [clientId, assessmentType, buildExtraPayload]);

  // ── Final Save (in_progress — saving never auto-completes) ────────────────

  const handleSave = useCallback(async (responses, meta = {}) => {
    const user = await base44.auth.me();
    const extra = buildExtraPayload ? await buildExtraPayload(responses, "in_progress") : {};

    const payload = {
      client_id: clientId,
      assessment_type: assessmentType,
      status: "in_progress",
      responses,
      completed_by: user?.email || "",
      ...extra,
    };

    let result;
    if (recordIdRef.current) {
      result = await base44.entities.Assessment.update(recordIdRef.current, payload);
    } else {
      result = await base44.entities.Assessment.create(payload);
      recordIdRef.current = result?.id || null;
    }

    toast.success(`Progress saved`);
    onSaved?.();
    return result;
  }, [clientId, assessmentType, buildExtraPayload, onSaved]);

  return { saveDraft, handleSave, recordIdRef };
}