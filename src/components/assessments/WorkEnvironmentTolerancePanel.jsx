/**
 * Work Environment Tolerance Assessment — Panel
 *
 * Uses useAssessmentDraftSave for all save logic.
 * Draft save on exit/cancel; completed save on "Save Assessment".
 *
 * Props:
 *   clientId           - string
 *   existingAssessment - existing Assessment record or null
 *   onSaved            - () => void
 *   onCancel           - () => void
 *   draftSaveRef       - ref exposed to parent for dialog-close draft save
 *   responsesRef       - ref exposed to parent so it always has latest responses
 */

import React, { useCallback } from "react";
import StructuredAssessmentForm from "./StructuredAssessmentForm";
import {
  WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
  WORK_ENVIRONMENT_TOLERANCE_META,
} from "@/lib/assessments/workEnvironmentToleranceDefinition";
import {
  extractEvidenceFromResponses,
  buildSourceMetadata,
} from "@/lib/assessments/structuredAssessmentHelpers";
import { base44 } from "@/api/base44Client";
import { useAssessmentDraftSave } from "@/lib/assessments/useAssessmentDraftSave";

export default function WorkEnvironmentTolerancePanel({
  clientId,
  existingAssessment,
  onSaved,
  onCancel,
  draftSaveRef,
  responsesRef,
}) {
  const buildExtraPayload = useCallback(async (responses, status) => {
    const user = await base44.auth.me();
    const completedAt = new Date().toISOString();

    let structured_evidence = [];
    let source_metadata = {};

    try {
      structured_evidence = extractEvidenceFromResponses(
        WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
        responses,
        { completedBy: user?.email, completedAt, source: "staff_observed" }
      );
    } catch (e) {
      console.warn("WET buildExtraPayload: extractEvidenceFromResponses failed (non-fatal)", e);
    }

    try {
      source_metadata = buildSourceMetadata({
        assessmentType: WORK_ENVIRONMENT_TOLERANCE_META.assessment_type,
        completedBy: user?.email,
        completedAt,
        source: "staff_observed",
        clientId,
      });
    } catch (e) {
      console.warn("WET buildExtraPayload: buildSourceMetadata failed (non-fatal)", e);
    }

    return { structured_evidence, source_metadata };
  }, [clientId]);

  const { saveDraft, handleSave } = useAssessmentDraftSave({
    clientId,
    assessmentType: WORK_ENVIRONMENT_TOLERANCE_META.assessment_type,
    existingAssessment,
    buildExtraPayload,
    onSaved,
  });

  // Expose saveDraft to parent for dialog-close trigger
  if (draftSaveRef) draftSaveRef.current = saveDraft;

  const handleCancel = useCallback(async (currentResponses) => {
    await saveDraft(currentResponses);
    onCancel?.();
  }, [saveDraft, onCancel]);

  const initialResponses = existingAssessment?.responses || {};
  console.log("STRUCTURED OPEN EXISTING ASSESSMENT", {
    id: existingAssessment?.id,
    status: existingAssessment?.status,
    responseCount: Object.keys(initialResponses).length,
    sample: Object.keys(initialResponses).slice(0, 3),
  });

  return (
    <StructuredAssessmentForm
      key={existingAssessment?.id || "new"}
      sections={WORK_ENVIRONMENT_TOLERANCE_SECTIONS}
      assessmentType={WORK_ENVIRONMENT_TOLERANCE_META.assessment_type}
      assessmentLabel={WORK_ENVIRONMENT_TOLERANCE_META.label}
      initialResponses={initialResponses}
      onSave={handleSave}
      onCancel={handleCancel}
      responsesRef={responsesRef}
    />
  );
}