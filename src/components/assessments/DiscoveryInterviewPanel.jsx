import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardPlus,
  Clock,
  Eye,
  MessageSquare,
  UserRound,
} from "lucide-react";
import StructuredAssessmentWorkspacePanel from "./StructuredAssessmentWorkspacePanel";

import {
  DISCOVERY_INTERVIEW_SECTIONS,
  DISCOVERY_INTERVIEW_META,
} from "@/lib/assessments/discoveryInterviewDefinition";

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

function sortInterviewRecords(records) {
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

const INTERVIEW_TYPE_OPTIONS = [
  "Parent Interview",
  "Sibling Interview",
  "Other Family Interview",
  "Friend Interview",
  "Roommate Interview",
  "Teacher Interview",
  "DSPD Staff Interview",
  "Provider Interview",
  "Former Employer Interview",
  "Current Employer Interview",
  "Job Coach Interview",
  "Neighbor Interview",
  "Other Interview",
];

function relationshipFromInterviewType(interviewType) {
  const mapping = {
    "Parent Interview": "Parent",
    "Sibling Interview": "Sibling",
    "Other Family Interview": "Other Family Member",
    "Friend Interview": "Friend",
    "Roommate Interview": "Roommate",
    "Teacher Interview": "Teacher",
    "DSPD Staff Interview": "DSPD Staff",
    "Provider Interview": "Provider",
    "Former Employer Interview": "Former Employer",
    "Current Employer Interview": "Current Employer",
    "Job Coach Interview": "Job Coach",
    "Neighbor Interview": "Neighbor",
    "Other Interview": "Other",
  };

  return mapping[interviewType] || "";
}

export default function DiscoveryInterviewPanel({
  clientId,
  records = [],
  onSaved,
}) {
  const [view, setView] = useState("history");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [newInterviewSession, setNewInterviewSession] = useState(0);
  const [selectedInterviewType, setSelectedInterviewType] = useState(null);
  const [initialResponses, setInitialResponses] = useState(null);

  const interviewDefinition = {
    key: DISCOVERY_INTERVIEW_META.assessment_type,
    label: DISCOVERY_INTERVIEW_META.label,
    type: "structured",
    available: true,
    sections: DISCOVERY_INTERVIEW_SECTIONS,
    meta: DISCOVERY_INTERVIEW_META,
  };

  const sortedRecords = useMemo(
    () => sortInterviewRecords(records),
    [records]
  );

  const selectedRecord =
    selectedRecordId !== null
      ? sortedRecords.find((record) => record.id === selectedRecordId) || null
      : null;

  const handleStartNewInterview = () => {
    setSelectedRecordId(null);
    setSelectedInterviewType(null);
    setInitialResponses(null);
    setView("select_type");
  };

  const handleInterviewTypeConfirm = () => {
    if (!selectedInterviewType) return;

   setInitialResponses({
  interview_type: selectedInterviewType,
  relationship_to_client: relationshipFromInterviewType(selectedInterviewType),
});

    setNewInterviewSession((previous) => previous + 1);
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

  if (view === "select_type") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
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

          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            New Interview
          </Badge>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            Select Interview Type
          </h3>
          <p className="text-sm text-slate-500">
            Choose who is being interviewed before beginning the Discovery Interview record.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INTERVIEW_TYPE_OPTIONS.map((interviewType) => (
            <button
              key={interviewType}
              type="button"
              onClick={() => setSelectedInterviewType(interviewType)}
              className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                selectedInterviewType === interviewType
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
            >
              {interviewType}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleInterviewTypeConfirm}
            disabled={!selectedInterviewType}
            className="gap-2"
          >
            <ClipboardPlus className="h-4 w-4" />
            Begin Interview
          </Button>
        </div>
      </div>
    );
  }

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
            New Interview — {selectedInterviewType}
          </Badge>
        </div>

        <StructuredAssessmentWorkspacePanel
          key={`new-discovery-interview-${newInterviewSession}`}
          clientId={clientId}
          assessment={interviewDefinition}
          existingRecord={null}
          initialResponses={initialResponses}
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
            Discovery Interview
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Repeatable interviews with family, friends, providers, employers, staff, and other people who know the client well.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleStartNewInterview}
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
              No Discovery interviews recorded yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Select New Interview to create the first interview record for this client.
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
                          {formatInterviewDate(responses.interview_date)}
                        </div>

                        <Badge
                          variant="outline"
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            Person:
                          </span>{" "}
                          {responses.person_interviewed || "Not entered"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-700">
                            Relationship:
                          </span>{" "}
                          {responses.relationship_to_client || "Not entered"}
                        </p>

                        <p className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            Key takeaway:
                          </span>{" "}
                          {responses.most_important_information || "Not entered"}
                        </p>

                        <p className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {responses.time_to_complete_interview || "Time not entered"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenInterview(record.id)}
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
