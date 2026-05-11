/**
 * Structured Assessment Framework — Assessment Form Container
 *
 * Props:
 *   sections         - Array of defineSection() results
 *   assessmentType   - string key
 *   assessmentLabel  - Display name
 *   initialResponses - optional existing response map
 *   onSave           - async (responses, meta) => void  — manual completed save
 *   onCancel         - async (responses) => void        — called with current responses so panel can draft-save
 *   responsesRef     - optional ref; kept in sync with latest responses for parent/dialog-close use
 *   disabled         - optional boolean
 */

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import StructuredQuestionRenderer from "./StructuredQuestionRenderer";
import { QUESTION_TYPES } from "@/lib/assessments/structuredAssessmentTypes";
import {
  findUnansweredRequired,
  extractStaffReviewFlags,
} from "@/lib/assessments/structuredAssessmentHelpers";
import { toast } from "sonner";

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
  assessmentLabel,
  initialResponses = {},
  onSave,
  onCancel,
  responsesRef,
  onChangeDebounced,
  disabled = false,
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [saving, setSaving] = useState(false);

  // Internal ref — always synchronously in sync (never stale on close)
  const internalRef = useRef(initialResponses);
  // Seed parent ref immediately at mount so close handler has data even before any change
  if (responsesRef && Object.keys(responsesRef.current || {}).length === 0 && Object.keys(initialResponses).length > 0) {
    responsesRef.current = initialResponses;
  }

  // Sync from initialResponses if they arrive after mount (e.g. async existingAssessment load)
  useEffect(() => {
    if (!initialResponses || Object.keys(initialResponses).length === 0) return;
    console.log("STRUCTURED FORM RESPONSES SYNC", { assessmentType, count: Object.keys(initialResponses).length, sample: Object.keys(initialResponses).slice(0, 3) });
    console.log("STRUCTURED REOPEN RESPONSES", initialResponses);
    internalRef.current = initialResponses;
    if (responsesRef) responsesRef.current = initialResponses;
    setResponses(initialResponses);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialResponses)]);

  // Fallback effect sync (only needed for edge cases — primary sync is in handleChange)
  useEffect(() => {
    console.log("STRUCTURED RESPONSE CHANGE", { assessmentType, count: Object.keys(responses).length });
  }, [responses, assessmentType]);

  const handleChange = (id, value) => {
    setResponses((prev) => {
      const next = { ...prev, [id]: value };
      // Sync refs synchronously so dialog-close always sees the latest value
      internalRef.current = next;
      if (responsesRef) responsesRef.current = next;
      // Notify workspace panel for debounced auto-save
      if (onChangeDebounced) onChangeDebounced(next);
      return next;
    });
  };

  const handleSave = async () => {
    // Save Progress never requires completion — no required-field gate here
    setSaving(true);
    try {
      const staffReviewFlags = extractStaffReviewFlags(sections, responses);
      await onSave(responses, { staffReviewFlags, assessmentType });
    } catch (err) {
      console.error("STRUCTURED SAVE ERROR", err);
      toast.error("Failed to save: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    console.log("STRUCTURED CLOSE REQUESTED", { assessmentType, responseCount: Object.keys(internalRef.current).length });
    if (onCancel) {
      await onCancel(internalRef.current);
    }
  };

  return (
    <div className="space-y-4">
      {assessmentLabel && (
        <div className="pb-2 border-b border-slate-100">
          <p className="text-base font-semibold text-slate-900">{assessmentLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Progress is auto-saved as a draft when you close.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section, i) => (
          <SectionPanel
            key={section.id}
            section={section}
            responses={responses}
            onChange={handleChange}
            disabled={disabled || saving}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Save & Close
        </Button>
        <Button onClick={handleSave} disabled={saving || disabled}>
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