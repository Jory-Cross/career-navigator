/**
 * Structured Assessment Framework — Assessment Form Container
 *
 * Props (controlled — parent owns state):
 *   sections     - Array of defineSection() results
 *   assessmentType  - string key (for logging)
 *   responses    - current response map { questionId: value } (controlled by parent)
 *   onChange     - (id, value) => void — called on every field change
 *   onSave       - async () => void   — manual Save Progress
 *   onCancel     - async () => void   — Save & Close
 *   saving       - boolean — external saving state
 *   isDirty      - boolean — unsaved changes indicator
 *   disabled     - optional boolean
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import StructuredQuestionRenderer from "./StructuredQuestionRenderer";
import { QUESTION_TYPES } from "@/lib/assessments/structuredAssessmentTypes";

// ── Section Panel ─────────────────────────────────────────────────────────────

function SectionPanel({ section, responses, onChange, disabled, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  const answerable = section.questions.filter(
    (q) => q.type !== QUESTION_TYPES.SECTION_HEADER
  );
  const answered = answerable.filter((q) => {
    const v = responses[q.id];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-800">{section.label}</span>
          {answered.length > 0 && (
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
              {answered.length}/{answerable.length}
            </span>
          )}
          {answered.length === answerable.length && answerable.length > 0 && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-5 bg-white">
          {section.description && (
            <p className="text-xs text-slate-500 italic">{section.description}</p>
          )}
          {section.questions.map((question) => (
            <StructuredQuestionRenderer
              key={question.id}
              question={question}
              responses={responses}
              onChange={onChange}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export default function StructuredAssessmentForm({
  sections = [],
  assessmentType,
  responses = {},
  onChange,
  onSave,
  onCancel,
  saving = false,
  isDirty = false,
  disabled = false,
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {sections.map((section, i) => (
          <SectionPanel
            key={section.id}
            section={section}
            responses={responses}
            onChange={onChange}
            disabled={disabled || saving}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      {/* Unsaved changes indicator — mirrors IntakeSectionForm */}
      {isDirty && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Unsaved changes — will save when you leave this assessment
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Save & Close
        </Button>
        <Button onClick={onSave} disabled={saving || disabled}>
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Saving…</>
          ) : (
            "Save Progress"
          )}
        </Button>
      </div>
    </div>
  );
}