/**
 * WorkPerformanceSupportObservationPanel
 *
 * Observation-specific workspace for repeatable structured observations.
 *
 * Design rules:
 * - Each new observation begins with existingRecord={null}.
 * - The shared StructuredAssessmentWorkspacePanel creates a new Assessment
 *   record on the first save of a new observation.
 * - Opening a prior observation passes that specific record back into the
 *   shared workspace so only that observation is edited.
 * - Prior observation records must never be overwritten by starting a new one.
 *
 * This component is intentionally isolated from AssessmentSection until it has
 * been created and verified without editor errors.
 */

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardPlus,
  Clock,
  Eye,
  MapPin,
} from "lucide-react";
import StructuredAssessmentWorkspacePanel from "./StructuredAssessmentWorkspacePanel";

import {
  WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS,
  WORK_PERFORMANCE_SUPPORT_OBSERVATION_META,
} from "@/lib/assessments/workPerformanceSupportObservationDefinition";

function formatObservationDate(value) {
  if (!value) return "Date not entered";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusConfig(status) {
  if (status === "completed") {
    return {
      label: "Completed",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Draft",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function sortObservationRecords(records) {
  return [...records].sort((a, b) => {
    const aDate =
      a?.responses?.observation_date ||
      a?.updated_date ||
      a?.created_date ||
      "";
    const bDate =
      b?.responses?.observation_date ||
      b?.updated_date ||
      b?.created_date ||
      "";

    return String(bDate).localeCompare(String(aDate));
  });
}

export default function WorkPerformanceSupportObservationPanel({
  clientId,
  records = [],
  onSaved,
}) {
  const [view, setView] = useState("history");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [newObservationSession, setNewObservationSession] = useState(0);

  const observationDefinition = {
    key: WORK_PERFORMANCE_SUPPORT_OBSERVATION_META.assessment_type,
    label: WORK_PERFORMANCE_SUPPORT_OBSERVATION_META.label,
    type: "structured",
    available: true,
    sections: WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS,
    meta: WORK_PERFORMANCE_SUPPORT_OBSERVATION_META,
  };

  const sortedRecords = useMemo(
    () => sortObservationRecords(records),
    [records]
  );

  const selectedRecord =
    selectedRecordId !== null
      ? sortedRecords.find((record) => record.id === selectedRecordId) || null
      : null;

  const handleStartNewObservation = () => {
    setSelectedRecordId(null);
    setNewObservationSession((previous) => previous + 1);
    setView("new");
  };

  const handleOpenObservation = (recordId) => {
    setSelectedRecordId(recordId);
    setView("existing");
  };

  const handleReturnToHistory = () => {
    setSelectedRecordId(null);
    setView("history");
  };

  const handleSaved = async () => {
    await onSaved?.();
  };

  if (view === "new") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReturnToHistory}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Observation History
          </Button>

          <Badge
            variant="outline"
            className="border-indigo-200 bg-indigo-50 text-indigo-700"
          >
            New Observation
          </Badge>
        </div>

        <StructuredAssessmentWorkspacePanel
          key={`new-observation-${newObservationSession}`}
          clientId={clientId}
          assessment={observationDefinition}
          existingRecord={null}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  if (view === "existing" && selectedRecord) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReturnToHistory}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Observation History
          </Button>

          <Badge
            variant="outline"
            className={getStatusConfig(selectedRecord.status).className}
          >
            {getStatusConfig(selectedRecord.status).label}
          </Badge>
        </div>

        <StructuredAssessmentWorkspacePanel
          key={selectedRecord.id}
          clientId={clientId}
          assessment={observationDefinition}
          existingRecord={selectedRecord}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Work Performance &amp; Support Observation
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Repeatable observations for discovery, trial work, job coaching,
            retention, and ongoing support review.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleStartNewObservation}
          className="gap-2 shrink-0"
        >
          <ClipboardPlus className="h-4 w-4" />
          New Observation
        </Button>
      </div>

      <div className="pt-4">
        <h4 className="text-sm font-semibold text-slate-800">
          Prior Observation History
        </h4>

        {sortedRecords.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              No observations recorded yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Select New Observation to create the first dated work performance
              record for this client.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {sortedRecords.map((record) => {
              const responses = record?.responses || {};
              const statusConfig = getStatusConfig(record.status);

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <CalendarDays className="h-4 w-4 text-slate-500" />
                          {formatObservationDate(responses.observation_date)}
                        </div>

                        <Badge
                          variant="outline"
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <p>
                          <span className="font-medium text-slate-700">
                            Purpose:
                          </span>{" "}
                          {responses.observation_purpose || "Not entered"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-700">
                            Job/task:
                          </span>{" "}
                          {responses.job_role_observed || "Not entered"}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {responses.worksite_name || "Worksite not entered"}
                          </p>

                          <p className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {responses.observation_duration_minutes
                              ? `${responses.observation_duration_minutes} minutes`
                              : "Duration not entered"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenObservation(record.id)}
                      className="gap-2 shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                      Open / Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
