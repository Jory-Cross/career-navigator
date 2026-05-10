import React, { useState } from "react";
import {
  ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Info, Search,
  Lightbulb, ShieldAlert, ShieldCheck, HelpCircle, Star, ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractKeyTopics,
  ExpandableEvidenceList,
  SummaryChips,
  deduplicateEvidence,
} from "./RecommendationCardHelper";

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

const CONF_COLORS = {
  high:   "bg-green-50 border-green-200 text-green-800",
  medium: "bg-blue-50 border-blue-200 text-blue-800",
  low:    "bg-amber-50 border-amber-200 text-amber-800",
};
const CONF_DOTS = { high: "bg-green-500", medium: "bg-blue-400", low: "bg-amber-400" };

function WhySection({ grounding, confidenceLevel }) {
  const [open, setOpen] = useState(false);

  const supported_by = grounding?.supported_by || [];
  const supporting_sources = grounding?.supporting_sources || [];
  const confidence_factors = grounding?.confidence_factors || [];
  const concern_factors = grounding?.concern_factors || [];
  const missing_data_factors = grounding?.missing_data_factors || [];
  const grounding_summary = grounding?.grounding_summary || "";

  const hasEvidence = supported_by.length || confidence_factors.length ||
    concern_factors.length || missing_data_factors.length || grounding_summary;

  const normalizedSources = supporting_sources
    .map(s => typeof s === "string" ? s : (s?.label || ""))
    .filter(Boolean);

  const level = confidenceLevel || "medium";

  // Extract key topics for summary chips
  const keyTopics = extractKeyTopics({
    supported: supported_by,
    concerns: concern_factors,
    missing: missing_data_factors,
  });

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
      {!hasEvidence ? (
        <p className="text-[11px] text-slate-400 italic">Limited grounding evidence currently available.</p>
      ) : (
        <>
          {grounding_summary && (
            <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-2", CONF_COLORS[level] || CONF_COLORS.medium)}>
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", CONF_DOTS[level] || CONF_DOTS.medium)} />
              <p className="text-[11px] leading-relaxed font-medium">{grounding_summary}</p>
            </div>
          )}
          {keyTopics.length > 0 && <SummaryChips topics={keyTopics} />}
          <div className="space-y-2">
            <ExpandableEvidenceList items={supported_by} icon={CheckCircle2} iconClass="text-green-500" showCount={2} />
            <ExpandableEvidenceList items={confidence_factors} icon={Info} iconClass="text-blue-500" showCount={2} />
            {(concern_factors.length > 0 || missing_data_factors.length > 0) && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Concerns / Missing Data
                </p>
                <ExpandableEvidenceList
                  items={[...concern_factors, ...missing_data_factors]}
                  icon={AlertTriangle}
                  iconClass="text-amber-500"
                  showCount={2}
                />
              </div>
            )}
          </div>
        </>
      )}
    </SectionToggle>
  );
}

// ── Section 2: Environmental Fit ──────────────────────────────────────────────

function EnvFitSection({ constraintFit }) {
  const [open, setOpen] = useState(false);

  const {
    overall_fit_level = "unknown",
    hard_constraints = [],
    moderate_constraints = [],
    soft_preferences = [],
    unknowns = [],
    environmental_fit_summary = "",
    occupation_notes = [],
    occupation_profile_label = null,
  } = constraintFit || {};

  console.log("OCC CONTEXT", occupation_profile_label, occupation_notes);

  const cfg = FIT_LEVEL[overall_fit_level] || FIT_LEVEL.unknown;
  const FitIcon = cfg.icon;

  const hasContent = hard_constraints.length || moderate_constraints.length ||
    soft_preferences.length || unknowns.length || environmental_fit_summary ||
    occupation_notes?.length > 0 || occupation_profile_label;

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
      {!hasContent ? (
        <p className="text-[11px] text-slate-400 italic">No environmental fit data available.</p>
      ) : (
        <>
          {environmental_fit_summary && (
            <div className={cn("rounded-md border px-2.5 py-2 flex items-start gap-2", cfg.summary)}>
              <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", cfg.dot)} />
              <p className="text-[11px] leading-relaxed font-medium">{environmental_fit_summary}</p>
            </div>
          )}
          {(occupation_notes?.length > 0 || occupation_profile_label) && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 text-slate-600">
                <Info className="w-3 h-3" />
                Occupational Context{occupation_profile_label ? ` — ${occupation_profile_label}` : ""}
              </p>
              {occupation_notes?.length > 0 && (
                <ul className="space-y-1">
                  {occupation_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                      <span className="shrink-0 text-slate-400 font-bold mt-0.5">◦</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-y-2">
            {hard_constraints.length > 0 && (
              <ExpandableEvidenceList items={hard_constraints} icon={ShieldAlert} iconClass="text-red-500" showCount={2} />
            )}
            {moderate_constraints.length > 0 && (
              <ExpandableEvidenceList items={moderate_constraints} icon={AlertTriangle} iconClass="text-amber-500" showCount={2} />
            )}
            {soft_preferences.length > 0 && (
              <ExpandableEvidenceList items={soft_preferences} icon={Star} iconClass="text-violet-400" showCount={2} />
            )}
            {unknowns.length > 0 && (
              <ExpandableEvidenceList items={unknowns} icon={HelpCircle} iconClass="text-slate-400" showCount={2} />
            )}
          </div>
        </>
      )}
    </SectionToggle>
  );
}

// ── Section 3: Staff Should Verify ───────────────────────────────────────────

function StaffVerifySection({ grounding, constraintFit }) {
  const [open, setOpen] = useState(false);

  const groundingFlags = grounding?.staff_review_flags || [];
  const constraintFlags = constraintFit?.staff_verification_needed || [];
  const dedupedFlags = deduplicateEvidence({ grounding: groundingFlags, constraint: constraintFlags });

  const badges = dedupedFlags.length > 0 && (
    <span className="text-[9px] bg-purple-100 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
      {dedupedFlags.length} item{dedupedFlags.length !== 1 ? "s" : ""}
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
      {dedupedFlags.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No major staff verification flags currently detected.</p>
      ) : (
        <ExpandableEvidenceList items={dedupedFlags} icon={Info} iconClass="text-purple-500" showCount={3} />
      )}
    </SectionToggle>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecommendationCardPanels({ grounding, confidenceLevel, constraintFit }) {
  return (
    <div className="mt-3 space-y-1.5">
      <WhySection grounding={grounding} confidenceLevel={confidenceLevel} />
      <EnvFitSection constraintFit={constraintFit} />
      <StaffVerifySection grounding={grounding} constraintFit={constraintFit} />
    </div>
  );
}