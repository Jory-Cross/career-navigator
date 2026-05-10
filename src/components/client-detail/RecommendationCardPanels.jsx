import React, { useState } from "react";
import {
  ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Info, Search,
  Lightbulb, ShieldAlert, ShieldCheck, HelpCircle, Star, ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function readableItem(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item ?? "");
  return (
    item.label || item.summary || item.reason || item.detail ||
    item.evidence || item.source || item.text || item.description ||
    Object.values(item).find((v) => typeof v === "string") || ""
  );
}

// ── small shared pieces ───────────────────────────────────────────────────────

function EvidenceList({ items, icon: Icon, iconClass }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
          <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", iconClass)} />
          <span>{readableItem(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function SubSection({ label, labelClass, items, icon, iconClass }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className={cn("text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1", labelClass)}>
        {React.createElement(icon, { className: "w-3 h-3" })}
        {label}
      </p>
      <EvidenceList items={items} icon={icon} iconClass={iconClass} />
    </div>
  );
}

function SectionToggle({ open, onToggle, icon: Icon, iconClass, title, badges, children }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("w-3.5 h-3.5 shrink-0", iconClass)} />
          <span className="text-[12px] font-semibold text-slate-800">{title}</span>
          {badges}
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3 bg-slate-50/40">
          {children}
        </div>
      )}
    </div>
  );
}

// ── FIT_LEVEL config ──────────────────────────────────────────────────────────

const FIT_LEVEL = {
  strong_fit:   { label: "Strong Fit",   badge: "bg-green-100 border-green-300 text-green-800",  icon: ShieldCheck, iconClass: "text-green-500",  summary: "bg-green-50 border-green-200 text-green-800",  dot: "bg-green-500" },
  possible_fit: { label: "Possible Fit", badge: "bg-blue-100 border-blue-300 text-blue-800",     icon: ShieldCheck, iconClass: "text-blue-500",   summary: "bg-blue-50 border-blue-200 text-blue-800",    dot: "bg-blue-400" },
  caution:      { label: "Caution",      badge: "bg-amber-100 border-amber-300 text-amber-800",  icon: AlertTriangle, iconClass: "text-amber-500", summary: "bg-amber-50 border-amber-200 text-amber-800", dot: "bg-amber-400" },
  poor_fit:     { label: "Poor Fit",     badge: "bg-red-100 border-red-300 text-red-800",        icon: ShieldAlert, iconClass: "text-red-500",    summary: "bg-red-50 border-red-200 text-red-800",       dot: "bg-red-500" },
  unknown:      { label: "Unknown",      badge: "bg-slate-100 border-slate-300 text-slate-700",  icon: HelpCircle,  iconClass: "text-slate-400",  summary: "bg-slate-50 border-slate-200 text-slate-700",  dot: "bg-slate-400" },
};

// ── Section 1: Why this recommendation? ──────────────────────────────────────

function WhySection({ grounding, confidenceLevel }) {
  const [open, setOpen] = useState(false);

  if (!grounding) return null;

  const {
    supported_by = [],
    supporting_sources = [],
    confidence_factors = [],
    concern_factors = [],
    missing_data_factors = [],
    grounding_summary = "",
  } = grounding;

  const normalizedSources = supporting_sources
    .map(s => typeof s === "string" ? s : (s?.label || ""))
    .filter(Boolean);

  const hasContent = supported_by.length || confidence_factors.length ||
    concern_factors.length || missing_data_factors.length || grounding_summary;

  if (!hasContent) return null;

  const CONF_COLORS = {
    high:   "bg-green-50 border-green-200 text-green-800",
    medium: "bg-blue-50 border-blue-200 text-blue-800",
    low:    "bg-amber-50 border-amber-200 text-amber-800",
  };
  const CONF_DOTS = { high: "bg-green-500", medium: "bg-blue-400", low: "bg-amber-400" };
  const level = confidenceLevel || "medium";

  const badges = normalizedSources.length > 0 && (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {normalizedSources.slice(0, 3).map((src, i) => (
        <span key={i} className="text-[9px] bg-violet-50 border border-violet-200 text-violet-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
          {src}
        </span>
      ))}
      {normalizedSources.length > 3 && (
        <span className="text-[9px] text-slate-400">+{normalizedSources.length - 3}</span>
      )}
    </div>
  );

  return (
    <SectionToggle
      open={open}
      onToggle={() => setOpen(v => !v)}
      icon={Lightbulb}
      iconClass="text-violet-500"
      title="Why this recommendation?"
      badges={badges}
    >
      {grounding_summary && (
        <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-2", CONF_COLORS[level] || CONF_COLORS.medium)}>
          <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", CONF_DOTS[level] || CONF_DOTS.medium)} />
          <p className="text-[11px] leading-relaxed font-medium">{grounding_summary}</p>
        </div>
      )}
      <SubSection label="Supporting Evidence" labelClass="text-green-700" items={supported_by} icon={CheckCircle2} iconClass="text-green-500" />
      <SubSection label="Confidence Factors" labelClass="text-blue-700" items={confidence_factors} icon={Info} iconClass="text-blue-500" />
      <SubSection label="Concerns / Barriers" labelClass="text-amber-700" items={concern_factors} icon={AlertTriangle} iconClass="text-amber-500" />
      <SubSection label="Missing Data" labelClass="text-slate-500" items={missing_data_factors} icon={Search} iconClass="text-slate-400" />
    </SectionToggle>
  );
}

// ── Section 2: Environmental Fit ──────────────────────────────────────────────

function EnvFitSection({ constraintFit }) {
  const [open, setOpen] = useState(false);

  if (!constraintFit) return null;

  const {
    overall_fit_level = "unknown",
    hard_constraints = [],
    moderate_constraints = [],
    soft_preferences = [],
    unknowns = [],
    environmental_fit_summary = "",
  } = constraintFit;

  const cfg = FIT_LEVEL[overall_fit_level] || FIT_LEVEL.unknown;
  const FitIcon = cfg.icon;

  const hasContent = hard_constraints.length || moderate_constraints.length ||
    soft_preferences.length || unknowns.length || environmental_fit_summary;

  if (!hasContent) return null;

  const badges = (
    <div className="flex items-center gap-1 flex-wrap">
      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold border", cfg.badge)}>
        {cfg.label}
      </span>
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
    </div>
  );

  return (
    <SectionToggle
      open={open}
      onToggle={() => setOpen(v => !v)}
      icon={FitIcon}
      iconClass={cfg.iconClass}
      title="Environmental Fit"
      badges={badges}
    >
      {environmental_fit_summary && (
        <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-2", cfg.summary)}>
          <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", cfg.dot)} />
          <p className="text-[11px] leading-relaxed font-medium">{environmental_fit_summary}</p>
        </div>
      )}
      <SubSection label="Hard Constraints" labelClass="text-red-700" items={hard_constraints} icon={ShieldAlert} iconClass="text-red-500" />
      <SubSection label="Moderate Concerns" labelClass="text-amber-700" items={moderate_constraints} icon={AlertTriangle} iconClass="text-amber-500" />
      <SubSection label="Soft Preferences" labelClass="text-violet-700" items={soft_preferences} icon={Star} iconClass="text-violet-400" />
      <SubSection label="Missing / Unknown" labelClass="text-slate-500" items={unknowns} icon={HelpCircle} iconClass="text-slate-400" />
    </SectionToggle>
  );
}

// ── Section 3: Staff Should Verify ───────────────────────────────────────────

function StaffVerifySection({ grounding, constraintFit }) {
  const [open, setOpen] = useState(false);

  const groundingFlags = grounding?.staff_review_flags || [];
  const constraintFlags = constraintFit?.staff_verification_needed || [];
  const allFlags = [...new Set([...groundingFlags, ...constraintFlags].map(readableItem))].filter(Boolean);

  if (!allFlags.length) return null;

  const badges = (
    <span className="text-[9px] bg-purple-100 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
      {allFlags.length} item{allFlags.length !== 1 ? "s" : ""}
    </span>
  );

  return (
    <SectionToggle
      open={open}
      onToggle={() => setOpen(v => !v)}
      icon={ClipboardList}
      iconClass="text-purple-500"
      title="Staff Should Verify"
      badges={badges}
    >
      <ul className="space-y-1.5">
        {allFlags.map((flag, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700 leading-relaxed">
            <span className="shrink-0 text-purple-400 font-bold mt-0.5">→</span>
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </SectionToggle>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecommendationCardPanels({ grounding, confidenceLevel, constraintFit }) {
  const hasAny = grounding || constraintFit;
  if (!hasAny) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <WhySection grounding={grounding} confidenceLevel={confidenceLevel} />
      <EnvFitSection constraintFit={constraintFit} />
      <StaffVerifySection grounding={grounding} constraintFit={constraintFit} />
    </div>
  );
}