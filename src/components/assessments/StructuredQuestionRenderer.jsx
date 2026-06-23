/**
 * Structured Assessment Framework — Question Renderer
 *
 * Renders a single question (any type) from a structured assessment definition.
 * Handles all QUESTION_TYPES including conditional follow-ups.
 *
 * Props:
 *   question   - defineQuestion() result
 *   responses  - current { id: value } response map
 *   onChange   - (id, value) => void
 *   disabled   - optional boolean
 */

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { QUESTION_TYPES } from "@/lib/assessments/structuredAssessmentTypes";
import { isConditionalVisible, normalizeResponse } from "@/lib/assessments/structuredAssessmentHelpers";
import { Info, HelpCircle } from "lucide-react";
// ── Sub-renderers ─────────────────────────────────────────────────────────────

function MultipleChoice({ question, value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      {question.options.map((opt) => (
        <label
          key={opt}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors",
            value === opt
              ? "bg-blue-50 border-blue-300 text-blue-900 font-medium"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="radio"
            name={question.id}
            value={opt}
            checked={value === opt}
            onChange={() => !disabled && onChange(question.id, opt)}
            className="hidden"
            disabled={disabled}
          />
          <span
            className={cn(
              "w-3.5 h-3.5 rounded-full border-2 shrink-0",
              value === opt ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
            )}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function SelectAll({ question, value = [], onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (opt) => {
    if (disabled) return;
    const next = selected.includes(opt)
      ? selected.filter((v) => v !== opt)
      : [...selected, opt];
    onChange(question.id, next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {question.options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors",
              checked
                ? "bg-blue-50 border-blue-300 text-blue-900 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              className="hidden"
              disabled={disabled}
            />
            <span
              className={cn(
                "w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0",
                checked ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
              )}
            >
              {checked && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
            </span>
            {opt}
          </label>
        );
      })}
    </div>
  );
}

function YesNo({ question, value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      {["yes", "no"].map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(question.id, opt)}
          className={cn(
            "px-5 py-2 rounded-lg border text-sm font-medium transition-colors",
            value === opt
              ? opt === "yes"
                ? "bg-green-600 border-green-600 text-white"
                : "bg-red-500 border-red-500 text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function Scale({ question, value, onChange, disabled }) {
  const cfg = question.scaleConfig || { min: 1, max: 5, minLabel: "", maxLabel: "" };
  const steps = [];
  for (let i = cfg.min; i <= cfg.max; i++) steps.push(i);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(question.id, n)}
            className={cn(
              "w-9 h-9 rounded-lg border text-sm font-semibold transition-colors",
              value === n
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(cfg.minLabel || cfg.maxLabel) && (
        <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
          <span>{cfg.minLabel}</span>
          <span>{cfg.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function ShortTextField({ question, value, onChange, disabled }) {
  return (
    <Input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(question.id, e.target.value)}
      placeholder={question.placeholder || ""}
      disabled={disabled}
      className="text-sm"
    />
  );
}

function DateField({ question, value, onChange, disabled }) {
  return (
    <Input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(question.id, e.target.value)}
      disabled={disabled}
      className="text-sm max-w-[240px]"
    />
  );
}

function NumberField({ question, value, onChange, disabled }) {
  return (
    <Input
      type="number"
      value={value ?? ""}
      onChange={(e) =>
        onChange(
          question.id,
          e.target.value === "" ? "" : Number(e.target.value)
        )
      }
      placeholder={question.placeholder || ""}
      disabled={disabled}
      className="text-sm max-w-[240px]"
    />
  );
}

function NarrativeField({ question, value, onChange, disabled }) {
  return (
    <Textarea
      value={value || ""}
      onChange={(e) => onChange(question.id, e.target.value)}
      placeholder={question.placeholder || "Describe in detail…"}
      disabled={disabled}
      className="min-h-[90px] text-sm"
    />
  );
}

function ExamplesField({ question, value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      {question.examplePrompts?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {question.examplePrompts.map((prompt, i) => (
            <span
              key={i}
              className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
            >
              e.g. {prompt}
            </span>
          ))}
        </div>
      )}
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(question.id, e.target.value)}
        placeholder={question.placeholder || "Provide specific examples…"}
        disabled={disabled}
        className="min-h-[80px] text-sm"
      />
    </div>
  );
}

// ── Guidance Note ─────────────────────────────────────────────────────────────

function GuidanceNote({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
      <Info className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
      <span>{text}</span>
    </div>
  );
}

function HelpTooltip({ text, guidance }) {
  const [open, setOpen] = useState(false);

  if (!text && !guidance) return null;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-blue-600 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-6 left-0 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs text-slate-700">
            {/* Plain helpText (existing pattern) */}
            {text && !guidance && <p>{text}</p>}

            {/* Structured guidance */}
            {guidance && (
              <div className="space-y-2.5">
                {guidance.purpose && (
                  <div>
                    <p className="font-semibold text-slate-800 mb-0.5">Why we collect this</p>
                    <p className="text-slate-600">{guidance.purpose}</p>
                  </div>
                )}
                {guidance.include?.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-800 mb-0.5">What belongs here</p>
                    <ul className="space-y-0.5">
                      {guidance.include.map((item, i) => (
                        <li key={i} className="flex gap-1.5 text-slate-600">
                          <span className="text-emerald-500 shrink-0">✓</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {guidance.exclude?.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-800 mb-0.5">What does not belong here</p>
                    <ul className="space-y-0.5">
                      {guidance.exclude.map((item, i) => (
                        <li key={i} className="flex gap-1.5 text-slate-600">
                          <span className="text-red-400 shrink-0">✗</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {guidance.usedFor?.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-800 mb-1.5">How this is used</p>
                    <ul className="space-y-0.5">
                      {guidance.usedFor.map((item, i) => (
                        <li key={i} className="text-slate-600 flex gap-2">
                          <span className="shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Question Renderer ────────────────────────────────────────────────────

function QuestionInput({ question, value, onChange, disabled }) {
  switch (question.type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return <MultipleChoice question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.SELECT_ALL:
      return <SelectAll question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.YES_NO:
      return <YesNo question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.SCALE:
      return <Scale question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.SHORT_TEXT:
      return <ShortTextField question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.DATE:
      return <DateField question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.NUMBER:
      return <NumberField question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.EXAMPLES:
      return <ExamplesField question={question} value={value} onChange={onChange} disabled={disabled} />;
    case QUESTION_TYPES.NARRATIVE:
    default:
      return <NarrativeField question={question} value={value} onChange={onChange} disabled={disabled} />;
  }
}

/**
 * Renders a single structured question, including:
 * - Label with optional guidance note
 * - Appropriate input for the question type
 * - Any visible conditional follow-ups (recursive)
 */
export default function StructuredQuestionRenderer({
  question,
  responses,
  onChange,
  disabled = false,
  depth = 0,
}) {
  if (question.type === QUESTION_TYPES.SECTION_HEADER) {
    return (
      <div className={cn("pt-3", depth === 0 && "border-t border-slate-200 first:border-0 first:pt-0")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {question.label}
        </p>
      </div>
    );
  }

  const value = responses[question.id] ?? null;

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-4 pl-3 border-l-2 border-blue-100")}>
     <div className="space-y-1">
  <div className="flex items-center gap-2">
    <Label
      className={cn(
        "text-sm font-medium text-slate-800",
        question.narrativeRequired &&
          "after:content-['*'] after:text-red-500 after:ml-0.5"
      )}
    >
      {question.label}
    </Label>

    {(question.helpText || question.guidance) && (
      <HelpTooltip text={question.helpText} guidance={question.guidance} />
    )}
  </div>
</div>

      <QuestionInput
        question={question}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {/* Conditional follow-ups */}
      {question.conditionals?.map((conditional, idx) => {
        if (!isConditionalVisible(conditional, responses, question.id)) return null;
        return (
          <StructuredQuestionRenderer
            key={`${question.id}-cond-${idx}`}
            question={conditional.question}
            responses={responses}
            onChange={onChange}
            disabled={disabled}
            depth={depth + 1}
          />
        );
      })}
    </div>
  );
}