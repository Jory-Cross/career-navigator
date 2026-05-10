import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Info, Search, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import ConstraintFitPanel from "@/components/client-detail/ConstraintFitPanel";

/**
 * Compact, expandable grounding evidence panel.
 * Renders inside a RecommendationReviewCard without taking over the layout.
 */

const CONFIDENCE_STYLE = {
  high:   "bg-green-50 border-green-200 text-green-800",
  medium: "bg-blue-50 border-blue-200 text-blue-800",
  low:    "bg-amber-50 border-amber-200 text-amber-800",
};

const CONFIDENCE_DOT = {
  high:   "bg-green-500",
  medium: "bg-blue-400",
  low:    "bg-amber-400",
};

function EvidenceRow({ icon: Icon, iconClass, text }) {
  return (
    <li className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
      <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", iconClass)} />
      <span>{text}</span>
    </li>
  );
}

function Section({ title, items, icon: Icon, iconClass, emptyText, colorClass }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1", colorClass)}>
        <Icon className="w-3 h-3" />
        {title}
      </p>
      <ul className="space-y-1 pl-0.5">
        {items.map((item, i) => (
          <EvidenceRow key={i} icon={Icon} iconClass={iconClass} text={item} />
        ))}
      </ul>
    </div>
  );
}

export default function RecommendationGroundingPanel({ grounding, confidenceLevel, constraintFit }) {
  const [open, setOpen] = useState(false);

  if (!grounding) {
    // Fallback: show minimal panel if constraintFit exists
    if (constraintFit) {
      return (
        <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden bg-slate-50/60">
          <ConstraintFitPanel constraintFit={constraintFit} />
        </div>
      );
    }
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-400 italic">
        Grounding not available for this recommendation.
      </div>
    );
  }

  const {
    supported_by = [],
    supporting_sources = [],
    confidence_factors = [],
    concern_factors = [],
    missing_data_factors = [],
    staff_review_flags = [],
    grounding_summary = "",
  } = grounding;

  // Normalize supporting_sources: may be strings or {label, detail, type} objects
  const normalizedSources = supporting_sources.map(s =>
    typeof s === "string" ? s : (s?.label || "")
  ).filter(Boolean);

  const hasContent =
    supported_by.length > 0 ||
    concern_factors.length > 0 ||
    missing_data_factors.length > 0 ||
    staff_review_flags.length > 0 ||
    grounding_summary;

  const level = confidenceLevel || "medium";
  const confStyle = CONFIDENCE_STYLE[level] || CONFIDENCE_STYLE.medium;
  const confDot = CONFIDENCE_DOT[level] || CONFIDENCE_DOT.medium;

  return (
    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden bg-slate-50/60">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Lightbulb className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-700">Why this recommendation?</span>
          {/* Mini source pills */}
          {normalizedSources.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {normalizedSources.slice(0, 3).map((src, i) => (
                <span key={i} className="text-[9px] bg-violet-50 border border-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                  {src}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {concern_factors.length > 0 && (
            <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
              {concern_factors.length} concern{concern_factors.length !== 1 ? "s" : ""}
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {/* Constraint Fit panel sits outside the toggle, always visible summary */}
      <ConstraintFitPanel constraintFit={constraintFit} />

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-200 px-3 py-3 space-y-3">
          {/* Confidence summary banner */}
          {grounding_summary && (
            <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-1.5", confStyle)}>
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", confDot)} />
              <p className="text-[11px] leading-relaxed font-medium">{grounding_summary}</p>
            </div>
          )}

          {/* Supporting evidence */}
          <Section
            title="Supporting Evidence"
            items={supported_by}
            icon={CheckCircle2}
            iconClass="text-green-500"
            colorClass="text-green-700"
          />

          {/* Confidence factors */}
          {confidence_factors.length > 0 && (
            <Section
              title="Confidence Factors"
              items={confidence_factors}
              icon={Info}
              iconClass="text-blue-500"
              colorClass="text-blue-700"
            />
          )}

          {/* Concerns */}
          {concern_factors.length > 0 && (
            <Section
              title="Concerns / Barriers"
              items={concern_factors}
              icon={AlertTriangle}
              iconClass="text-amber-500"
              colorClass="text-amber-700"
            />
          )}

          {/* Missing data */}
          {missing_data_factors.length > 0 && (
            <Section
              title="Missing Data"
              items={missing_data_factors}
              icon={Search}
              iconClass="text-slate-400"
              colorClass="text-slate-500"
            />
          )}

          {/* Staff review items */}
          {staff_review_flags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-purple-700 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Staff Should Verify
              </p>
              <ul className="space-y-1 pl-0.5">
                {staff_review_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                    <span className="shrink-0 text-purple-400 font-bold mt-0.5">→</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}