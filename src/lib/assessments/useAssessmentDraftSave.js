/**
 * useAssessmentDraftSave — Shared draft-save hook for structured assessments.
 *
 * Uses the authorized assessment route so client, organization, and caller
 * scope are resolved server-side before any assessment record is created or
 * updated.
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
  const recordIdRef = useRef(existingAssessment?.id || null);

  if (existingAssessment?.id && !recordIdRef.current) {
    recordIdRef.current = existingAssessment.id;
  }

  const savingRef = useRef(false);

  const hasAnyResponse = (responses) =>
    Object.values(responses).some(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0)
    );

  const saveAuthorizedAssessment = useCallback(
    async (responses, status) => {
      const extra = buildExtraPayload
        ? await buildExtraPayload(responses, status)
        : {};

      const response = await base44.functions.invoke(
        "manageAuthorizedAssessment",
        {
          action: "upsert",
          assessment_id: recordIdRef.current || "",
          client_id: clientId,
          assessment_type: assessmentType,
          status,
          responses,
          structured_evidence: extra?.structured_evidence || [],
          source_metadata: extra?.source_metadata || {},
          staff_review_flags: extra?.staff_review_flags || [],
        }
      );

      const data = response?.data || {};

      if (!data.ok || !data.assessment?.id) {
        throw new Error(
          data.error || "Assessment progress could not be saved."
        );
      }

      recordIdRef.current = data.assessment.id;
      return data.assessment;
    },
    [assessmentType, buildExtraPayload, clientId]
  );

  const saveDraft = useCallback(
    async (responses) => {
      if (savingRef.current) return;
      if (!hasAnyResponse(responses)) return;

      savingRef.current = true;

      try {
        await saveAuthorizedAssessment(responses, "in_progress");
      } finally {
        savingRef.current = false;
      }
    },
    [saveAuthorizedAssessment]
  );

  const handleSave = useCallback(
    async (responses) => {
      const result = await saveAuthorizedAssessment(responses, "in_progress");
      toast.success("Progress saved");
      await onSaved?.();
      return result;
    },
    [onSaved, saveAuthorizedAssessment]
  );

  return { saveDraft, handleSave, recordIdRef };
}