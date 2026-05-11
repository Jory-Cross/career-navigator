/**
 * AssessmentWorkspace
 *
 * Intake-style layout for structured assessments:
 * - Left panel: assessment cards with status/progress
 * - Right panel: the selected assessment's form
 *
 * Handles: Work Environment Tolerance + future structured assessments.
 * Non-structured assessments (Interest Profiler, WSA, etc.) remain in AssessmentSection modal.
 */

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import StructuredAssessmentWorkspacePanel from "./StructuredAssessmentWorkspacePanel";

import {
  WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
  WORK_ENVIRONMENT_TOLERANCE_META,
} from "@/lib/assessments/workEnvironmentToleranceDefinition";

// Registry of all structured assessments
const STRUCTURED_ASSESSMENTS = [
  {
    key: "work_environment_tolerance",
    label: "Work Environment Tolerance",
    description: "Physical setting, sensory tolerance, social interaction, pace, stress recovery",
    sections: WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
    meta: WORK_ENVIRONMENT_TOLERANCE_META,
    available: true,
  },
  {
    key: "barriers_to_employment",
    label: "Barriers to Employment",
    description: "Identify practical and situational barriers affecting job search",
    sections: [],
    meta: { assessment_type: "barriers_to_employment", label: "Barriers to Employment" },
    available: false,
  },
  {
    key: "transportation",
    label: "Transportation",
    description: "Transportation options, reliability, and barriers",
    sections: [],
    meta: { assessment_type: "transportation", label: "Transportation" },
    available: false,
  },
  {
    key: "support_and_accommodation",
    label: "Support & Accommodation",
    description: "Workplace accommodation needs and support planning",
    sections: [],
    meta: { assessment_type: "support_and_accommodation", label: "Support & Accommodation" },
    available: false,
  },
  {
    key: "work_values",
    label: "Work Values",
    description: "What the client values most in employment",
    sections: [],
    meta: { assessment_type: "work_values", label: "Work Values" },
    available: false,
  },
];

function countTotalQuestions(sections) {
  let total = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      total++;
      if (q.conditionals) {
        for (const c of q.conditionals) {
          total++; // count conditional questions too
        }
      }
    }
  }
  return total;
}

function countAnsweredQuestions(sections, responses) {
  let answered = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      const v = responses[q.id];
      const hasValue = v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
      if (hasValue) answered++;
    }
  }
  return answered;
}

function AssessmentCard({ assessment, record, isSelected, onClick }) {
  const { key, label, description, sections, available } = assessment;

  const totalQ = sections.length > 0 ? countTotalQuestions(sections) : 0;
  const answeredQ = record && sections.length > 0 ? countAnsweredQuestions(sections, record.responses || {}) : 0;
  const pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

  const status = !record
    ? "not_started"
    : record.status === "completed"
    ? "completed"
    : "in_progress";

  const statusConfig = {
    not_started: { label: "Not Started", color: "text-slate-400", icon: Circle },
    in_progress: { label: "In Progress", color: "text-amber-600", icon: Clock },
    completed: { label: "Completed", color: "text-green-600", icon: CheckCircle2 },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <button
      type="button"
      disabled={!available}
      onClick={available ? onClick : undefined}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        available ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "opacity-50 cursor-not-allowed",
        isSelected
          ? "border-indigo-500 bg-indigo-50 shadow-md"
          : "border-slate-200 bg-white hover:border-indigo-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
            {!available && (
              <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
        </div>
        {isSelected && <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />}
      </div>

      {available && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-1 text-xs font-medium", statusConfig.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </div>
            {totalQ > 0 && (
              <span className="text-xs text-slate-400">
                {answeredQ} / {totalQ} fields
              </span>
            )}
          </div>
          {totalQ > 0 && (
            <Progress
              value={pct}
              className="h-1.5"
            />
          )}
        </div>
      )}
    </button>
  );
}

export default function AssessmentWorkspace({ clientId, initialAssessmentKey = null, onBack }) {
  const [selectedKey, setSelectedKey] = useState(initialAssessmentKey || "work_environment_tolerance");
  const queryClient = useQueryClient();

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["client-assessments", clientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const getRecord = (key) => assessments.find((a) => a.assessment_type === key) || null;

  const selectedAssessment = STRUCTURED_ASSESSMENTS.find((a) => a.key === selectedKey);
  const selectedRecord = selectedKey ? getRecord(selectedKey) : null;

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["client-assessments", clientId] });
  }, [queryClient, clientId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <div>
          <h2 className="text-base font-semibold text-slate-900">Structured Assessments</h2>
          <p className="text-xs text-slate-500">Answers are automatically saved as drafts</p>
        </div>
      </div>

      {/* Workspace layout */}
      <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
        {/* Left: Assessment cards */}
        <div className="lg:w-72 shrink-0 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            STRUCTURED_ASSESSMENTS.map((assessment) => (
              <AssessmentCard
                key={assessment.key}
                assessment={assessment}
                record={getRecord(assessment.key)}
                isSelected={selectedKey === assessment.key}
                onClick={() => setSelectedKey(assessment.key)}
              />
            ))
          )}
        </div>

        {/* Right: Active assessment form */}
        <div className="flex-1 min-w-0">
          {selectedAssessment && selectedAssessment.available ? (
            <StructuredAssessmentWorkspacePanel
              key={selectedKey + (selectedRecord?.id || "new")}
              clientId={clientId}
              assessment={selectedAssessment}
              existingRecord={selectedRecord}
              onSaved={handleSaved}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center space-y-2">
                <Circle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400">Select an assessment to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}