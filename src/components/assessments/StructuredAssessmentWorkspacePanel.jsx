/**
 * StructuredAssessmentWorkspacePanel
 *
 * Wraps StructuredAssessmentForm in a workspace-style panel.
 * - Auto-saves as draft on every section change (debounced)
 * - Final save marks as completed
 * - Reuses existing record to prevent duplicates
 * - No dialog — no close race conditions
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle } from "lucide-react";
import StructuredAssessmentForm from "./StructuredAssessmentForm";
import {
  extractEvidenceFromResponses,
  buildSourceMetadata,
} from "@/lib/assessments/structuredAssessmentHelpers";
import { base44 } from "@/api/base44Client";
import { useAssessmentDraftSave } from "@/lib/assessments/useAssessmentDraftSave";

export default function StructuredAssessmentWorkspacePanel({
  clientId,
  assessment,
  existingRecord,
  onSaved,
}) {
  const { sections, meta } = assessment;
  // Always seed from existingRecord; update when it changes
  const responsesRef = useRef(existingRecord?.responses || {});
  const draftSaveRef = useRef(null);

  // Keep responsesRef seeded when existingRecord changes (e.g. after query refetch)
  useEffect(() => {
    if (existingRecord?.responses && Object.keys(existingRecord.responses).length > 0) {
      responsesRef.current = existingRecord.responses;
    }
  }, [existingRecord?.id, existingRecord?.responses]);

  // Build extra payload (evidence + metadata) for VFP integration
  const buildExtraPayload = useCallback(async (responses, status) => {
    const user = await base44.auth.me();
    const completedAt = new Date().toISOString();

    let structured_evidence = [];
    let source_metadata = {};

    try {
      structured_evidence = extractEvidenceFromResponses(sections, responses, {
        completedBy: user?.email,
        completedAt,
        source: "staff_observed",
      });
    } catch (e) {
      console.warn("WorkspacePanel buildExtraPayload: extractEvidence failed (non-fatal)", e);
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
      console.warn("WorkspacePanel buildExtraPayload: buildSourceMetadata failed (non-fatal)", e);
    }

    return { structured_evidence, source_metadata };
  }, [sections, meta.assessment_type, clientId]);

  const { saveDraft, handleSave } = useAssessmentDraftSave({
    clientId,
    assessmentType: meta.assessment_type,
    existingAssessment: existingRecord,
    buildExtraPayload,
    onSaved,
  });

  // Expose saveDraft on ref so parent could call it if ever needed
  draftSaveRef.current = saveDraft;

  // Track dirty state — true after any response change, false after any save
  const isDirtyRef = useRef(false);
  // Keep stable refs so unmount effect always has latest values
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  // Debounced auto-save — fires 2s after last change
  const autoSaveTimer = useRef(null);
  const handleAutoSave = useCallback((responses) => {
    responsesRef.current = responses;
    isDirtyRef.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraftRef.current(responses).catch(() => {});
      isDirtyRef.current = false;
    }, 2000);
  }, []);

  // On unmount: flush any pending save immediately
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (isDirtyRef.current && Object.keys(responsesRef.current).length > 0) {
        saveDraftRef.current(responsesRef.current)
          .then(() => onSavedRef.current?.())
          .catch(() => {});
      }
    };
  }, []);

  // Cancel button: save draft and clear selection (parent handles UI)
  const handleCancel = useCallback(async (currentResponses) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await saveDraft(currentResponses).catch(() => {});
    onSaved?.(); // refresh parent list
  }, [saveDraft, onSaved]);

  const status = !existingRecord
    ? "not_started"
    : existingRecord.status === "completed"
    ? "completed"
    : "in_progress";

  const statusBadge = {
    not_started: null,
    in_progress: (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
        <Clock className="w-3 h-3" /> Draft — auto-saving
      </Badge>
    ),
    completed: (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Completed
      </Badge>
    ),
  }[status];

  const initialResponses = existingRecord?.responses || {};

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
          key={existingRecord?.id || "new-" + meta.assessment_type}
          sections={sections}
          assessmentType={meta.assessment_type}
          assessmentLabel={null} /* label shown in header above */
          initialResponses={initialResponses}
          onSave={handleSave}
          onCancel={handleCancel}
          responsesRef={responsesRef}
          onChangeDebounced={handleAutoSave}
        />
      </CardContent>
    </Card>
  );
}