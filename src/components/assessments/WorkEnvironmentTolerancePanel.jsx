/**
 * Work Environment Tolerance Assessment — Panel
 *
 * Owns all save logic including:
 * - Manual Save Assessment (marks completed)
 * - Draft save on exit / cancel (marks in_progress, no toast)
 * - Deduplication via recordIdRef — never creates duplicates
 *
 * Props:
 *   clientId           - string
 *   existingAssessment - existing Assessment record or null
 *   onSaved            - () => void  — called after manual completed save
 *   onCancel           - () => void  — called after cancel (draft saved silently)
 */

import React, { useRef, useCallback } from "react";
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

export default function WorkEnvironmentTolerancePanel({ clientId, existingAssessment, onSaved, onCancel, onDraftSaveRef, onResponsesRef }) {
  const initialResponses = existingAssessment?.responses || {};

  // Track the live record ID so draft saves never duplicate
  const recordIdRef = useRef(existingAssessment?.id || null);
  // Track whether a save is in-flight to prevent concurrent saves
  const savingRef = useRef(false);

  const buildPayload = useCallback(async (responses, { staffReviewFlags } = {}, status = "completed") => {
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
      console.warn("WET buildPayload: extractEvidenceFromResponses failed (non-fatal)", e);
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
      console.warn("WET buildPayload: buildSourceMetadata failed (non-fatal)", e);
    }

    return {
      client_id: clientId,
      assessment_type: WORK_ENVIRONMENT_TOLERANCE_META.assessment_type,
      responses,
      structured_evidence,
      staff_review_flags: staffReviewFlags || [],
      source_metadata,
      completed_by: user.email,
      notes: status === "in_progress" ? "Draft — in progress" : undefined,
    };
  }, [clientId]);

  // ── Manual Save (completed) ───────────────────────────────────────────────

  const handleSave = useCallback(async (responses, meta) => {
    console.log("WET SAVE CLICKED", { clientId, recordId: recordIdRef.current });

    const payload = await buildPayload(responses, meta, "completed");
    console.log("WET PAYLOAD", payload);

    let result;
    if (recordIdRef.current) {
      result = await base44.entities.Assessment.update(recordIdRef.current, payload);
      console.log("WET SAVE RESULT (update)", result);
      toast.success("Work Environment Tolerance Assessment saved");
    } else {
      result = await base44.entities.Assessment.create(payload);
      recordIdRef.current = result?.id || result?.data?.id || null;
      console.log("WET SAVE RESULT (create)", result, "→ recordId:", recordIdRef.current);
      toast.success("Work Environment Tolerance Assessment saved");
    }

    onSaved?.();
  }, [buildPayload, clientId, onSaved]);

  // ── Draft Save (in_progress, silent) ─────────────────────────────────────

  const saveDraft = useCallback(async (responses) => {
    if (savingRef.current) return;
    // Don't save a draft if there are no responses at all
    const hasAny = Object.values(responses).some(v =>
      v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );
    if (!hasAny) {
      console.log("WET DRAFT SAVE: skipped — no responses");
      return;
    }

    savingRef.current = true;
    console.log("WET DRAFT SAVE", { recordId: recordIdRef.current, responseCount: Object.keys(responses).length });

    try {
      const payload = await buildPayload(responses, {}, "in_progress");
      console.log("WET PAYLOAD (draft)", payload);

      let result;
      if (recordIdRef.current) {
        result = await base44.entities.Assessment.update(recordIdRef.current, payload);
        console.log("WET SAVE RESULT (draft update)", result);
      } else {
        result = await base44.entities.Assessment.create(payload);
        recordIdRef.current = result?.id || result?.data?.id || null;
        console.log("WET SAVE RESULT (draft create)", result, "→ recordId:", recordIdRef.current);
      }
    } catch (e) {
      console.error("WET SAVE ERROR (draft)", e);
    } finally {
      savingRef.current = false;
    }
  }, [buildPayload]);

  // ── Cancel handler — save draft then close ────────────────────────────────

  const handleCancel = useCallback(async (currentResponses) => {
    await saveDraft(currentResponses);
    onCancel?.();
  }, [saveDraft, onCancel]);

  // ── Expose refs to parent (AssessmentSection) for dialog-close draft save ─

  if (onDraftSaveRef) onDraftSaveRef.current = saveDraft;

  return (
    <StructuredAssessmentForm
      sections={WORK_ENVIRONMENT_TOLERANCE_SECTIONS}
      assessmentType={WORK_ENVIRONMENT_TOLERANCE_META.assessment_type}
      assessmentLabel={WORK_ENVIRONMENT_TOLERANCE_META.label}
      initialResponses={initialResponses}
      onSave={handleSave}
      onDraftSave={saveDraft}
      onCancel={handleCancel}
      onResponsesRef={onResponsesRef}
    />
  );
}