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
  const baseResponses = existingRecord?.responses || {};
  const seedResponses = initialResponses
    ? { ...baseResponses, ...initialResponses }
    : baseResponses;

  const [responses, setResponses] = useState(seedResponses);
  const [isDirty, setIsDirty] = useState(!!initialResponses);
  const [saving, setSaving] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [recordStatus, setRecordStatus] = useState(
    existingRecord?.status || null
  );

  const responsesRef = useRef(responses);
  const isDirtyRef = useRef(isDirty);
  const recordIdRef = useRef(existingRecord?.id || null);
  const recordStatusRef = useRef(recordStatus);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    recordStatusRef.current = recordStatus;
  }, [recordStatus]);

  useEffect(() => {
    const nextBaseResponses = existingRecord?.responses || {};
    const nextResponses = initialResponses
      ? { ...nextBaseResponses, ...initialResponses }
      : nextBaseResponses;

    recordIdRef.current = existingRecord?.id || null;
    setResponses(nextResponses);
    responsesRef.current = nextResponses;
    setIsDirty(!!initialResponses);
    isDirtyRef.current = !!initialResponses;
    setRecordStatus(existingRecord?.status || null);
    recordStatusRef.current = existingRecord?.status || null;
  }, [existingRecord?.id, initialResponses]);

  const handleChange = useCallback((id, value) => {
    setIsDirty(true);
    isDirtyRef.current = true;

    setResponses((previous) => {
      const next = { ...previous, [id]: value };

      if (id === "sensory_barrier_present" && value === "no") {
        delete next.sensory_barrier_types;
        delete next.sensory_barrier_severity;
        delete next.sensory_barrier_history;
        delete next.sensory_accommodation_tried;
        delete next.sensory_accommodation_outcome;
      }

      if (id === "sensory_accommodation_tried" && value === "no") {
        delete next.sensory_accommodation_outcome;
      }

      responsesRef.current = next;
      return next;
    });
  }, []);

  const buildAuthorizedPayload = useCallback(
    async (latestResponses, status) => {
      const user = await base44.auth.me();
      const completedAt = new Date().toISOString();
      let structuredEvidence = [];
      let sourceMetadata = {};
      let staffReviewFlags = [];

      try {
        structuredEvidence = extractEvidenceFromResponses(
          sections,
          latestResponses,
          {
            completedBy: user?.email,
            completedAt,
            source: "staff_observed",
          }
        );
      } catch (error) {
        console.warn(
          "StructuredAssessmentWorkspacePanel: evidence extraction failed",
          error
        );
      }

      try {
        sourceMetadata = buildSourceMetadata({
          assessmentType: meta.assessment_type,
          completedBy: user?.email,
          completedAt,
          source: "staff_observed",
          clientId,
        });
      } catch (error) {
        console.warn(
          "StructuredAssessmentWorkspacePanel: source metadata failed",
          error
        );
      }

      try {
        staffReviewFlags = extractStaffReviewFlags(sections, latestResponses);
      } catch (error) {
        console.warn(
          "StructuredAssessmentWorkspacePanel: review-flag extraction failed",
          error
        );
      }

      return {
        action: "upsert",
        assessment_id: recordIdRef.current || "",
        client_id: clientId,
        assessment_type: meta.assessment_type,
        status,
        responses: latestResponses,
        structured_evidence: structuredEvidence,
        source_metadata: sourceMetadata,
        staff_review_flags: staffReviewFlags,
      };
    },
    [clientId, meta.assessment_type, sections]
  );

  const persistAssessment = useCallback(
    async (latestResponses, status) => {
      const request = await buildAuthorizedPayload(latestResponses, status);
      const response = await base44.functions.invoke(
        "manageAuthorizedAssessment",
        request
      );
      const data = response?.data || {};

      if (!data.ok || !data.assessment?.id) {
        throw new Error(data.error || "Assessment progress could not be saved.");
      }

      recordIdRef.current = data.assessment.id;
      setRecordStatus(data.assessment.status || status);
      recordStatusRef.current = data.assessment.status || status;
      return data.assessment;
    },
    [buildAuthorizedPayload]
  );

  const doSave = useCallback(
    async (latestResponses, showToast = false) => {
      const hasAnyResponse = Object.values(latestResponses).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
      );

      if (!hasAnyResponse) return;

      const status =
        recordIdRef.current && recordStatusRef.current === "completed"
          ? "completed"
          : "in_progress";

      await persistAssessment(latestResponses, status);

      if (showToast) toast.success("Progress saved");
      await onSaved?.();
    },
    [onSaved, persistAssessment]
  );

  const doSaveRef = useRef(doSave);

  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isDirtyRef.current) {
        doSaveRef.current(responsesRef.current).catch(() => {});
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      await doSave(responsesRef.current, true);
      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (error) {
      console.error("Structured assessment save error", error);
      toast.error(
        `Failed to save: ${error?.message || "Unable to save assessment progress."}`
      );
    } finally {
      setSaving(false);
    }
  }, [doSave]);

  const handleMarkComplete = useCallback(async () => {
    setMarkingComplete(true);

    try {
      await persistAssessment(responsesRef.current, "completed");
      setRecordStatus("completed");
      recordStatusRef.current = "completed";
      setIsDirty(false);
      isDirtyRef.current = false;
      toast.success("Assessment marked as complete");
      await onSaved?.();
    } catch (error) {
      toast.error(
        `Failed to mark complete: ${error?.message || "Unable to complete assessment."}`
      );
    } finally {
      setMarkingComplete(false);
    }
  }, [onSaved, persistAssessment]);

  const handleReopen = useCallback(async () => {
    try {
      await persistAssessment(responsesRef.current, "in_progress");
      setRecordStatus("in_progress");
      recordStatusRef.current = "in_progress";
      toast.success("Assessment reopened");
      await onSaved?.();
    } catch (error) {
      toast.error(
        `Failed to reopen: ${error?.message || "Unable to reopen assessment."}`
      );
    }
  }, [onSaved, persistAssessment]);

  const handleCancel = useCallback(async () => {
    if (isDirtyRef.current) {
      await doSave(responsesRef.current, false).catch(() => {});
      setIsDirty(false);
      isDirtyRef.current = false;
    }

    await onSaved?.();
    onClose?.();
  }, [doSave, onClose, onSaved]);

  const status =
    recordStatus === "completed"
      ? "completed"
      : existingRecord || recordIdRef.current
        ? "in_progress"
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
                onClick={handleReopen}
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