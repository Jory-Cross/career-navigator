/**
 * Work Environment Tolerance Assessment — Panel
 *
 * Integrates the assessment definition with StructuredAssessmentForm.
 * Handles save: stores responses, structured_evidence, staff_review_flags,
 * and source_metadata on the Assessment entity.
 *
 * Props:
 *   clientId          - string
 *   existingAssessment - existing Assessment record (for edit), or null
 *   onSaved           - () => void
 *   onCancel          - () => void
 */

import React from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import StructuredAssessmentForm from "./StructuredAssessmentForm";
import {
  WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
  WORK_ENVIRONMENT_TOLERANCE_META,
} from "@/lib/assessments/workEnvironmentToleranceDefinition";
import {
  extractEvidenceFromResponses,
  buildSourceMetadata,
} from "@/lib/assessments/structuredAssessmentHelpers";

export default function WorkEnvironmentTolerancePanel({ clientId, existingAssessment, onSaved, onCancel }) {
  const initialResponses = existingAssessment?.responses || {};

  const handleSave = async (responses, { staffReviewFlags }) => {
    console.log("WET SAVE CLICKED", { clientId, existingId: existingAssessment?.id });

    const user = await base44.auth.me();
    const completedAt = new Date().toISOString();

    let structured_evidence = [];
    let source_metadata = {};

    try {
      structured_evidence = extractEvidenceFromResponses(
        WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
        responses,
        { completedBy: user.email, completedAt, source: "staff_observed" }
      );
    } catch (e) {
      console.warn("WET SAVE: extractEvidenceFromResponses failed (non-fatal)", e);
    }

    try {
      source_metadata = buildSourceMetadata({
        assessmentType: WORK_ENVIRONMENT_TOLERANCE_META.assessment_type,
        completedBy: user.email,
        completedAt,
        source: "staff_observed",
        clientId,
      });
    } catch (e) {
      console.warn("WET SAVE: buildSourceMetadata failed (non-fatal)", e);
    }

    const payload = {
      client_id: clientId,
      assessment_type: WORK_ENVIRONMENT_TOLERANCE_META.assessment_type,
      responses,
      structured_evidence,
      staff_review_flags: staffReviewFlags || [],
      source_metadata,
      completed_by: user.email,
    };

    console.log("WET PAYLOAD", payload);

    let result;
    if (existingAssessment?.id) {
      result = await base44.entities.Assessment.update(existingAssessment.id, payload);
      console.log("WET SAVE RESULT (update)", result);
      toast.success("Work Environment Tolerance Assessment updated");
    } else {
      result = await base44.entities.Assessment.create(payload);
      console.log("WET SAVE RESULT (create)", result);
      toast.success("Work Environment Tolerance Assessment saved");
    }

    onSaved?.();
  };

  return (
    <StructuredAssessmentForm
      sections={WORK_ENVIRONMENT_TOLERANCE_SECTIONS}
      assessmentType={WORK_ENVIRONMENT_TOLERANCE_META.assessment_type}
      assessmentLabel={WORK_ENVIRONMENT_TOLERANCE_META.label}
      initialResponses={initialResponses}
      onSave={handleSave}
      onCancel={onCancel}
    />
  );
}