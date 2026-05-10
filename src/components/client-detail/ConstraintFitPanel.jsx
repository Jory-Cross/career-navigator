import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, AlertTriangle, Info, HelpCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact, expandable Constraint Fit panel.
 * Shows the environmental fit level + severity-classified constraint evidence.
 */

/**
 * Safely extract a readable string from a constraint item.
 * Handles plain strings and structured objects.
 */
function formatConstraintItem(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item ?? "");
  // Try common readable fields in priority order
  return (
    item.label ||
    item.summary ||
    item.reason ||
    item.detail ||
    item.evidence ||
    item.source ||
    item.text ||
    item.description ||
    Object.values(item).find((v) => typeof v === "string") ||
    ""
  );
}

const FIT_LEVEL_CONFIG = {
  strong_fit:   { label: "Strong Fit",   color: "bg-green-50 border-green-200 text-green-800",  dot: "bg-green-500",  icon: ShieldCheck },
  possible_fit: { label: "Possible Fit", color: "bg-blue-50 border-blue-200 text-blue-800",     dot: "bg-blue-400",   icon: ShieldCheck },
  caution:      { label: "Caution",      color: "bg-amber-50 border-amber-200 text-amber-800",  dot: "bg-amber-400",  icon: AlertTriangle },
  poor_fit:     { label: "Poor Fit",     color: "bg-red-50 border-red-200 text-red-800",        dot: "bg-red-500",    icon: ShieldAlert },
  unknown:      { label: "Unknown",      color: "bg-slate-50 border-slate-200 text-slate-700",  dot: "bg-slate-400",  icon: HelpCircle },
};

function ConstraintRow({ icon: Icon, iconClass, text }) {
  return (
    <li className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
      <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", iconClass)} />
      <span>{text}</span>
    </li>
  );
}

function ConstraintSection({ title, items, icon: Icon, iconClass, headerClass }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1", headerClass)}>
        <Icon className="w-3 h-3" />
        {title}
      </p>
      <ul className="space-y-1 pl-0.5">
        {items.map((item, i) => (
          <ConstraintRow key={i} icon={Icon} iconClass={iconClass} text={formatConstraintItem(item)} />
        ))}
      </ul>
    </div>
  );
}

export default function ConstraintFitPanel({ constraintFit }) {
  const [open, setOpen] = useState(false);

  if (!constraintFit) return null;

  const {
    overall_fit_level = "unknown",
    hard_constraints = [],
    moderate_constraints = [],
    soft_preferences = [],
    unknowns = [],
    environmental_fit_summary = "",
    staff_verification_needed = [],
    occupation_notes = [],
    occupation_profile_label = null,
  } = constraintFit;

  const config = FIT_LEVEL_CONFIG[overall_fit_level] || FIT_LEVEL_CONFIG.unknown;
  const FitIcon = config.icon;

  const totalIssues = hard_constraints.length + moderate_constraints.length + unknowns.length;
  const hasContent = totalIssues > 0 || soft_preferences.length > 0 || staff_verification_needed.length > 0 || occupation_notes.length > 0;

  if (!hasContent && !environmental_fit_summary) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-slate-200 overflow-hidden bg-slate-50/40">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FitIcon className={cn(
            "w-3.5 h-3.5 shrink-0",
            overall_fit_level === "strong_fit" ? "text-green-500" :
            overall_fit_level === "possible_fit" ? "text-blue-500" :
            overall_fit_level === "caution" ? "text-amber-500" :
            overall_fit_level === "poor_fit" ? "text-red-500" :
            "text-slate-400"
          )} />
          <span className="text-[11px] font-semibold text-slate-700">Environmental Fit</span>
          {/* Fit level badge */}
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-semibold border",
            config.color
          )}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {hard_constraints.length > 0 && (
            <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">
              {hard_constraints.length} hard
            </span>
          )}
          {moderate_constraints.length > 0 && (
            <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
              {moderate_constraints.length} moderate
            </span>
          )}
          {unknowns.length > 0 && (
            <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full font-medium">
              {unknowns.length} unknown
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-200 px-3 py-3 space-y-3">
          {/* Summary banner */}
          {environmental_fit_summary && (
            <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-1.5", config.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", config.dot)} />
              <p className="text-[11px] leading-relaxed font-medium">{environmental_fit_summary}</p>
            </div>
          )}

          {/* Occupation context notes */}
          {occupation_notes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-slate-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Occupational Context{occupation_profile_label ? ` — ${occupation_profile_label}` : ""}
              </p>
              <ul className="space-y-1 pl-0.5">
                {occupation_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                    <span className="shrink-0 text-slate-400 font-bold mt-0.5">◦</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hard constraints */}
          <ConstraintSection
            title="Hard Constraints"
            items={hard_constraints}
            icon={ShieldAlert}
            iconClass="text-red-500"
            headerClass="text-red-700"
          />

          {/* Moderate constraints */}
          <ConstraintSection
            title="Moderate Concerns"
            items={moderate_constraints}
            icon={AlertTriangle}
            iconClass="text-amber-500"
            headerClass="text-amber-700"
          />

          {/* Soft preferences */}
          <ConstraintSection
            title="Soft Preferences"
            items={soft_preferences}
            icon={Star}
            iconClass="text-violet-400"
            headerClass="text-violet-700"
          />

          {/* Unknowns */}
          <ConstraintSection
            title="Missing / Unknown"
            items={unknowns}
            icon={HelpCircle}
            iconClass="text-slate-400"
            headerClass="text-slate-500"
          />

          {/* Staff verification */}
          {staff_verification_needed.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-purple-700 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Staff Should Verify
              </p>
              <ul className="space-y-1 pl-0.5">
                {staff_verification_needed.map((flag, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                    <span className="shrink-0 text-purple-400 font-bold mt-0.5">→</span>
                    <span>{formatConstraintItem(flag)}</span>
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