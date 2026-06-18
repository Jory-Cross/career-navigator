import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardPlus,
  Clock,
  Eye,
  Building2,
  UserRound,
} from "lucide-react";

import StructuredAssessmentWorkspacePanel from "./StructuredAssessmentWorkspacePanel";

import {
  INFORMATIONAL_INTERVIEW_SECTIONS,
  INFORMATIONAL_INTERVIEW_META,
} from "@/lib/assessments/informationalInterviewDefinition";

function formatInterviewDate(value) {
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

function sortRecords(records) {
  return [...records].sort((a, b) => {
    const aDate =
      a?.responses?.interview_date ||
      a?.updated_date ||
      a?.created_date ||
      "";

    const bDate =
      b?.responses?.interview_date ||
      b?.updated_date ||
      b?.created_date ||
      "";

    return String(bDate).localeCompare(String(aDate));
  });
}

export default function InformationalInterviewPanel({
  clientId,
  records = [],
  onSaved,
}) {
  const [view, setView] = useState("history");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [newSession, setNewSession] = useState(0);

  const interviewDefinition = {
    key: INFORMATIONAL_INTERVIEW_META.assessment_type,
    label: INFORMATIONAL_INTERVIEW_META.label,
    type: "structured",
    available: true,
    sections: INFORMATIONAL_INTERVIEW_SECTIONS,
    meta: INFORMATIONAL_INTERVIEW_META,
  };

  const sortedRecords = useMemo(
    () => sortRecords(records),
    [records]
  );

  const selectedRecord =
    selectedRecordId !== null
      ? sortedRecords.find((record) => record.id === selectedRecordId) || null
      : null;

  const handleNewInterview = () => {
    setSelectedRecordId(null);
    setNewSession((previous) => previous + 1);
    setView("new");
  };

  const handleOpenInterview = (recordId) => {
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
            Interview History
          </Button>

          <Badge
            variant="outline"
            className="border-indigo-200 bg-indigo-50 text-indigo-700"
          >
            New Informational Interview
          </Badge>
        </div>

        <StructuredAssessmentWorkspacePanel
          key={`new-informational-interview-${newSession}`}
          clientId={clientId}
          assessment={interviewDefinition}
          existingRecord={null}
          onSaved={handleSaved}
          onClose={handleReturnToHistory}
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
            Interview History
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
          assessment={interviewDefinition}
          existingRecord={selectedRecord}
          onSaved={handleSaved}
          onClose={handleReturnToHistory}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Informational Interviews
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Repeatable interviews with employers, business owners, managers,
            supervisors, workers, and community contacts.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleNewInterview}
          className="gap-2 shrink-0"
        >
          <ClipboardPlus className="h-4 w-4" />
          New Interview
        </Button>
      </div>

      <div className="pt-4">
        <h4 className="text-sm font-semibold text-slate-800">
          Prior Interview History
        </h4>

        {sortedRecords.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              No informational interviews recorded yet.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Select New Interview to create the first informational interview.
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
                          {formatInterviewDate(
                            responses.interview_date
                          )}
                        </div>

                        <Badge
                          variant="outline"
                          className="border-indigo-200 bg-indigo-50 text-indigo-700"
                        >
                          Informational Interview
                        </Badge>

                        <Badge
                          variant="outline"
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {responses.business_organization ||
                            "Business not entered"}
                        </p>

                        <p className="flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5 text-slate-400" />
                          {responses.person_interviewed ||
                            "Person not entered"}
                        </p>

                        <p>
                          {responses.person_job_title ||
                            "Job title not entered"}
                        </p>

                        <p className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {responses.time_spent ||
                            "Time not entered"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleOpenInterview(record.id)
                      }
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
