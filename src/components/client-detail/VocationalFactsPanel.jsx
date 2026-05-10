import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Sparkles, FileText, Clock, Info, ShieldCheck, ShieldAlert, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { evaluateVFPMaturity } from "@/lib/vfpMaturity";

const CATEGORY_CONFIG = [
  { key: "skills",                    label: "Skills",                      emoji: "🛠️",  color: "blue" },
  { key: "interests",                 label: "Interests",                   emoji: "💡",  color: "yellow" },
  { key: "preferred_tasks",           label: "Preferred Tasks",             emoji: "✅",  color: "green" },
  { key: "work_environment_preferences", label: "Work Environment",         emoji: "🏢",  color: "purple" },
  { key: "schedule_availability",     label: "Schedule Availability",       emoji: "📅",  color: "indigo" },
  { key: "transportation",            label: "Transportation",              emoji: "🚌",  color: "orange" },
  { key: "social_communication_needs", label: "Social / Communication",     emoji: "💬",  color: "teal" },
  { key: "sensory_environmental_needs", label: "Sensory / Environment",     emoji: "👁️",  color: "pink" },
  { key: "physical_restrictions",     label: "Physical Restrictions",       emoji: "🦽",  color: "red" },
  { key: "support_needs",             label: "Support Needs",               emoji: "🤝",  color: "blue" },
  { key: "job_readiness_level",       label: "Job Readiness",               emoji: "📊",  color: "green" },
  { key: "employer_preferences",      label: "Employer Preferences",        emoji: "🏭",  color: "slate" },
  { key: "barriers",                  label: "Barriers",                    emoji: "⚠️",  color: "amber" },
  { key: "goals",                     label: "Goals",                       emoji: "🎯",  color: "violet" },
];

const COLOR_MAP = {
  blue: "bg-blue-50 border-blue-100 text-blue-800",
  yellow: "bg-yellow-50 border-yellow-100 text-yellow-800",
  green: "bg-green-50 border-green-100 text-green-800",
  purple: "bg-purple-50 border-purple-100 text-purple-800",
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
  orange: "bg-orange-50 border-orange-100 text-orange-800",
  teal: "bg-teal-50 border-teal-100 text-teal-800",
  pink: "bg-pink-50 border-pink-100 text-pink-800",
  red: "bg-red-50 border-red-100 text-red-800",
  amber: "bg-amber-50 border-amber-100 text-amber-800",
  violet: "bg-violet-50 border-violet-100 text-violet-800",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
};

// ── DISPLAY LABEL MAPS ──────────────────────────────────────────────────────
// Maps internal snake_case tags → staff-friendly readable labels, per category.
// Unknown tags fall back to: replace underscores, title-case.

const DISPLAY_MAPS = {
  skills: {
    computer_literate: "Computer literate",
    email_skills: "Email communication",
    social_media_skills: "Social media skills",
    customer_service_capable: "Customer service capable",
    reliability: "Reliable / dependable",
    attention_to_detail: "Attention to detail",
    teamwork: "Teamwork / collaboration",
    leadership: "Leadership experience",
    communication: "Strong communication skills",
    problem_solving: "Problem-solving ability",
    creativity: "Creative thinking",
    academic_achievement: "Academic achievement",
    specialization: "Specialized training or expertise",
  },

  interests: {
    helping_people: "Helping others / people-oriented",
    teamwork: "Teamwork and collaboration",
    autonomy: "Independent work / autonomy",
    problem_solving: "Problem-solving",
    attention_to_detail: "Detail-oriented work",
    creativity: "Creative or artistic interests",
    technology: "Technology and computers",
    healthcare: "Healthcare and caregiving",
    education: "Education / teaching",
    skilled_trades: "Skilled trades",
    finance: "Finance / accounting",
    sales: "Sales / retail",
    outdoor: "Outdoor or physical work",
  },

  preferred_tasks: {
    hands_on: "Hands-on work",
    customer_facing: "Customer-facing tasks",
    structured_tasks: "Structured, routine tasks",
    independent_work: "Independent work",
    teamwork: "Team-based tasks",
    data_entry: "Data entry",
    filing_organizing: "Filing and organizing",
    physical_labor: "Physical labor",
    computer_work: "Computer / desk work",
  },

  avoided_tasks: {
    public_facing: "Prefers to avoid public-facing roles",
    high_pressure: "Avoids high-pressure or deadline-heavy work",
    repetitive_tasks: "Prefers variety over repetitive tasks",
    chaotic_environment: "Avoids chaotic or disorganized environments",
  },

  work_environment_preferences: {
    low_noise: "Low-noise / quiet environment",
    structured: "Structured work environment",
    flexible: "Flexible work environment",
    team_oriented: "Team-oriented setting",
    independent: "Prefers independent work setting",
    outdoor: "Outdoor work environment",
    indoor: "Indoor work environment",
    remote: "Remote / work-from-home",
    hybrid: "Hybrid work preferred",
    small_team: "Small team preferred",
    large_organization: "Open to large organization",
  },

  schedule_availability: {
    full_time: "Full-time availability",
    part_time: "Part-time availability",
    weekdays_only: "Weekdays only",
    weekends_only: "Weekends only",
    morning_preferred: "Morning hours preferred",
    afternoon_preferred: "Afternoon hours preferred",
    evening_preferred: "Evening hours preferred",
    no_overnight_shifts: "No overnight shifts",
    childcare_hours: "Schedule limited by childcare",
    flexible: "Flexible schedule",
  },

  transportation: {
    reliable_personal_vehicle: "Has reliable personal vehicle",
    relies_on_public_transit: "Relies on public transit",
    requires_scheduled_transportation: "Requires scheduled transportation (e.g. paratransit)",
    no_personal_vehicle: "No personal vehicle",
    no_driver_license: "No driver's license",
    vehicle_without_license: "Has vehicle but no license",
    relies_on_alternative_transport: "Relies on alternative transportation",
    mobility_access_needed: "Mobility/accessibility needs for transit",
    cost_prohibitive: "Transportation costs are a barrier",
    distance_barrier: "Distance is a transportation barrier",
    transportation_scheduling_support: "Needs help scheduling transportation",
    transportation_planning: "Needs transportation planning support",
    route_learning_support: "Needs support learning transit routes",
    ride_coordination: "Needs ride coordination support",
    carpool_coordination: "Open to / needs carpool coordination",
    rural_location: "Lives in a rural area",
    urban_location: "Lives in an urban area",
    suburban_location: "Lives in a suburban area",
  },

  social_communication_needs: {
    slower_processing_time: "Additional processing / responding time",
    needs_processing_time: "Needs extra processing time",
    capable_customer_interaction: "Capable of appropriate customer interaction",
    prefers_written_communication: "Prefers written communication",
    prefers_verbal_communication: "Prefers verbal / phone communication",
    learns_by_demonstration: "Learns best through demonstration",
    primary_language_spanish: "Primary language: Spanish",
    primary_language_french: "Primary language: French",
    communication_support: "Communication / task adaptation support",
    social_tolerance: "Social interaction tolerance noted",
    social_supports: "Has social support network",
    family: "Family support network",
    friends: "Friend / peer support network",
    professional: "Professional counselor or case manager support",
    faith_community: "Faith community support",
    support_group: "Participates in support group",
  },

  sensory_environmental_needs: {
    low_noise: "Low-noise / quiet workspace needed",
    low_distraction_workspace: "Low-distraction workspace needed",
    sensory_sensitivity: "Sensory sensitivity noted",
    lighting_sensitivity: "Lighting sensitivity",
    temperature_sensitivity: "Temperature sensitivity",
    scent_sensitivity: "Scent / chemical sensitivity",
    tactile_sensitivity: "Tactile sensitivity",
    mobility_access_needed: "Mobility / physical access needed",
  },

  physical_restrictions: {
    wheelchair_accessibility: "Wheelchair-accessible workplace/restroom",
    accessible_restroom: "Accessible restroom required",
    accessible_parking: "Accessible parking required",
    magnification_or_large_print: "Large print or magnification support",
    assistive_technology: "Assistive technology needed",
    extended_training_time: "Additional training time for learning routines",
    routine_repetition_support: "Routine repetition / reinforcement support",
    written_instructions: "Written instructions preferred",
    low_distraction_workspace: "Low-distraction workspace",
    flexible_schedule: "Flexible schedule accommodation",
    frequent_breaks: "Frequent break accommodation needed",
    mobility_limitations: "Mobility limitations noted",
    visual_impairment: "Visual impairment noted",
    hearing_impairment: "Hearing impairment noted",
    chronic_pain_fatigue: "Chronic pain or fatigue affects work",
  },

  support_needs: {
    moderate_support_needs: "Moderate ongoing support needs",
    high_support_needs: "High level of ongoing support needed",
    job_coaching_required: "Job coaching support",
    on_the_job_support: "On-the-job support",
    mentoring_needed: "Mentoring / peer support",
    routine_learning_support: "Additional training time for learning routines",
    extended_training_support: "Extended training / support for task learning",
    slower_processing_support: "Additional processing / responding time",
    task_breakdown_support: "Task breakdown and step-by-step guidance",
    task_prompting: "Task prompting support",
    communication_support: "Communication / task adaptation support",
    written_instructions: "Written instructions preferred",
    schedule_support: "Schedule structure support",
    supervision_support: "Supervisor check-ins needed",
    accessibility_support: "Accessibility accommodation support",
    wheelchair_accessibility: "Wheelchair-accessible workplace/restroom",
    sensory_support: "Sensory accommodation support",
    transportation_support: "Transportation support needed",
    benefits_counseling: "Benefits counseling needed",
    work_incentive_planning: "Work incentive planning support",
    healthcare_coordination: "Healthcare coordination support",
    veteran_services: "Veteran services support",
  },

  job_readiness_level: {
    ready_to_start: "Ready to start job search",
    developing: "Developing job readiness",
    exploring: "Exploring career options",
    fully_documented: "Fully documented profile",
    mostly_ready: "Mostly ready — some documents pending",
    documents_complete: "All required documents complete",
    documents_partial: "Some documents still needed",
    documents_minimal: "Minimal documentation available",
    documents_missing: "Key documents missing",
    good_endurance: "Good stamina / work endurance",
    low_endurance: "Low stamina — may need part-time start",
  },

  employer_preferences: {
    ssi_recipient: "Receives SSI",
    ssdi_recipient: "Receives SSDI",
    medicare_coverage: "Has Medicare coverage",
    medicaid_coverage: "Has Medicaid coverage",
    snap_recipient: "Receives SNAP benefits",
    ticket_to_work_enrolled: "Enrolled in Ticket to Work",
    no_current_benefits: "No current benefits reported",
    ticket_to_work_available: "Ticket to Work available",
    work_incentive_planning: "Work incentive planning recommended",
    healthcare_coordination: "Healthcare coordination recommended",
  },

  barriers: {
    mobility_limitations: "Mobility limitations",
    visual_impairment: "Visual impairment",
    hearing_impairment: "Hearing impairment",
    cognitive_processing: "Cognitive processing differences",
    learning_difference: "Learning difference / dyslexia",
    mental_health_condition: "Mental health condition",
    chronic_pain_fatigue: "Chronic pain or fatigue",
    routine_change_difficulty: "Difficulty adapting to routine changes",
    physical_disability: "Physical disability",
    cognitive_disability: "Cognitive disability",
    mental_health_disability: "Mental health disability",
    developmental_disability: "Developmental disability",
    sensory_disability: "Sensory disability",
  },

  goals: {
    employment: "Gain / maintain employment",
    daily_living: "Improve daily living skills",
    social_skills: "Build social skills",
    communication: "Improve communication skills",
    job_retention: "Job retention",
    education: "Pursue further education",
    other: "Other personal / vocational goal",
    helping_people: "Career goal: helping others",
    problem_solving: "Career goal: problem-solving role",
    teamwork: "Career goal: collaborative environment",
    autonomy: "Career goal: independent / autonomous work",
  },
};

// Phrase-level collapse rules: if the raw fact (lowercased) includes any of these
// substrings, map to the canonical readable label.
const PHRASE_COLLAPSE_RULES = [
  // Support Needs phrases
  { match: ["job coaching", "assist in adapting to work tasks", "job coach"], label: "Job coaching support" },
  { match: ["additional time and training", "learning job task routines", "learning routines"], label: "Additional training time for learning routines" },
  { match: ["wheelchair accessibility", "workplace and restroom"], label: "Wheelchair-accessible workplace/restroom" },
  { match: ["communication scenarios", "communication support", "assist with communication"], label: "Communication / task adaptation support" },
  { match: ["slower processing", "additional processing", "processing time"], label: "Additional processing / responding time" },
  { match: ["provide additional time"], label: "Additional processing / responding time" },
  { match: ["extended training", "additional training"], label: "Extended training / support for task learning" },
  // Transportation phrases
  { match: ["help scheduling transportation", "scheduling transportation"], label: "Needs help scheduling transportation" },
  { match: ["route learning", "learn transit routes"], label: "Needs support learning transit routes" },
  // Physical / Accommodation phrases
  { match: ["large print", "magnification"], label: "Large print or magnification support" },
  { match: ["assistive technology", "screen reader"], label: "Assistive technology needed" },
  { match: ["written instruction", "written direction"], label: "Written instructions preferred" },
  { match: ["frequent break", "rest break"], label: "Frequent break accommodation needed" },
];

/** Fallback: convert snake_case or dash-case to Title Case readable string */
function toReadable(str) {
  return str
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Main display formatter. Given a category key and a raw fact string,
 * returns a staff-friendly readable label.
 */
function formatFactForDisplay(categoryKey, fact) {
  if (!fact || typeof fact !== "string") return fact;

  const normalized = fact.trim().toLowerCase();

  // 1. Try exact canonical map for the given category
  const catMap = DISPLAY_MAPS[categoryKey];
  if (catMap && catMap[normalized]) {
    return catMap[normalized];
  }

  // 2. Try exact canonical map in support_needs as a cross-category fallback
  //    (many tags overlap across categories)
  for (const map of Object.values(DISPLAY_MAPS)) {
    if (map[normalized]) return map[normalized];
  }

  // 3. Phrase-level collapse rules (substring matching)
  for (const rule of PHRASE_COLLAPSE_RULES) {
    if (rule.match.some(phrase => normalized.includes(phrase))) {
      return rule.label;
    }
  }

  // 4. Fallback: readable title-case
  return toReadable(fact);
}

// ── MATURITY + CONFIDENCE DISPLAY ────────────────────────────────────────────

const MATURITY_CONFIG = {
  "Early Intake Profile":          { color: "bg-slate-100 text-slate-600 border-slate-200",      dot: "bg-slate-400" },
  "Foundational Profile":          { color: "bg-blue-50 text-blue-700 border-blue-200",           dot: "bg-blue-400" },
  "Multi-Source Profile":          { color: "bg-indigo-50 text-indigo-700 border-indigo-200",     dot: "bg-indigo-500" },
  "Comprehensive Vocational Profile": { color: "bg-green-50 text-green-700 border-green-200",    dot: "bg-green-500" },
};

const CONFIDENCE_CONFIG = {
  Low:      { color: "bg-red-50 text-red-600 border-red-200",       icon: ShieldAlert },
  Moderate: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Shield },
  High:     { color: "bg-green-50 text-green-700 border-green-200", icon: ShieldCheck },
};

function MaturityCard({ maturity }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!maturity?.maturity_level) return null;

  const mCfg = MATURITY_CONFIG[maturity.maturity_level] || MATURITY_CONFIG["Foundational Profile"];
  const cCfg = CONFIDENCE_CONFIG[maturity.confidence_level] || CONFIDENCE_CONFIG["Low"];
  const ConfIcon = cCfg.icon;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Top row: badges */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Maturity badge */}
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border", mCfg.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", mCfg.dot)} />
            {maturity.maturity_level}
          </span>
          {/* Confidence badge */}
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border", cCfg.color)}>
            <ConfIcon className="w-3 h-3 shrink-0" />
            {maturity.confidence_level} Confidence
            <span className="opacity-60 ml-0.5">({maturity.confidence_score})</span>
          </span>
        </div>
        <button
          onClick={() => setShowDetails(v => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 shrink-0"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showDetails ? "Less" : "Details"}
        </button>
      </div>

      {/* Primary reason(s) — always visible, just the first 1-2 */}
      {maturity.reasons?.length > 0 && (
        <div className="px-3 pb-2 text-[11px] text-slate-500 leading-relaxed">
          {maturity.reasons.slice(0, 2).join(" ")}
        </div>
      )}

      {/* Expanded details */}
      {showDetails && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3">
          {/* Source coverage */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source Coverage</p>
            <div className="flex flex-wrap gap-1.5">
              {maturity.source_coverage.map((s, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    s.present
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                  )}
                >
                  {s.present ? "✓ " : ""}{s.label}
                </span>
              ))}
            </div>
          </div>

          {/* All reasons */}
          {maturity.reasons?.length > 2 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Profile Notes</p>
              <ul className="space-y-0.5">
                {maturity.reasons.map((r, i) => (
                  <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                    <span className="shrink-0 text-slate-300 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {maturity.next_steps?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Suggested Next Steps</p>
              <ul className="space-y-0.5">
                {maturity.next_steps.map((s, i) => (
                  <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                    <span className="shrink-0 text-blue-400 mt-0.5">→</span>
                    {s}
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

function FactItem({ fact, source }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-50 last:border-0">
      <span className="shrink-0 mt-0.5 text-slate-400">•</span>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700">{fact}</span>
        {source && (
          <span className="ml-1.5 text-[10px] text-slate-400 italic">[{source}]</span>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ config, items }) {
  const [open, setOpen] = useState(items.length > 0);
  const colorClass = COLOR_MAP[config.color] || COLOR_MAP.slate;
  const hasData = items.length > 0;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      hasData ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50/50 opacity-60"
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.emoji}</span>
          <span className="text-xs font-semibold text-slate-700">{config.label}</span>
          {hasData ? (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", colorClass)}>
              {items.length}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 italic">no data</span>
          )}
        </div>
        {hasData && (open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />)}
      </button>
      {open && hasData && (
        <div className="px-3 pb-2.5 border-t border-slate-100">
          {items.map((item, i) => (
            <FactItem key={i} fact={item.fact} source={item.source} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictBanner({ conflicts }) {
  const [expanded, setExpanded] = useState(true);
  if (!conflicts?.length) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-amber-100/50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-amber-800">
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Flagged for Staff Review
          </span>
          <p className="text-xs text-amber-700 mt-0.5">
            Assessment sources disagree on these topics. Do not assume either answer — review with the client.
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-amber-200">
          {conflicts.map((c, i) => (
            <div key={i} className="bg-white rounded-lg border border-amber-100 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-amber-900">📌 {c.topic}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 rounded p-2">
                  <p className="text-[10px] font-medium text-amber-700 mb-1">{c.source_a}</p>
                  <p className="text-slate-700">"{c.value_a}"</p>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <p className="text-[10px] font-medium text-amber-700 mb-1">{c.source_b}</p>
                  <p className="text-slate-700">"{c.value_b}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VocationalFactsPanel({ clientId, client, onFactsUpdated }) {
  const [localProfile, setLocalProfile] = useState(client?.vocational_facts_profile || null);
  const [isOutdated, setIsOutdated] = useState(false);
  const [localMetadata, setLocalMetadata] = useState(client?.vocational_facts_metadata || {});
  const [extracting, setExtracting] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

useEffect(() => {
  if (!clientId) return;

  async function loadSavedFacts() {
    try {
      const res = await base44.functions.invoke("processAssessmentDocuments", {
        action: "get_vocational_facts",
        clientId,
      });

      if (res?.data?.profile) {
        setLocalProfile(res.data.profile);
        setLocalMetadata(res.data.metadata || {});
      }
    } catch (err) {
      console.error("Failed to load saved VFP:", err);
    } finally {
      setLoadingFacts(false);
    }
  }

  loadSavedFacts();
}, [clientId]);
  
  const [loadingFacts, setLoadingFacts] = useState(true);

const vfp = localProfile || client?.vocational_facts_profile || null;
  const metadata = localMetadata || client?.vocational_facts_metadata || {};
  const extractedAt =
    client?.vocational_facts_extracted_at ||
    metadata.extracted_at ||
    client?.vocational_facts_last_updated_at ||
    null;

  const extractedBy =
    client?.vocational_facts_extracted_by ||
    metadata.extracted_by ||
    "";

    const docCount =
    client?.vocational_facts_document_count > 0
      ? client.vocational_facts_document_count
      : metadata.source_document_ids?.length > 0
        ? metadata.source_document_ids.length
        : client?.vocational_facts_profile?.documents_processed || 0;

  const assessCount =
    client?.vocational_facts_assessment_count > 0
      ? client.vocational_facts_assessment_count
      : metadata.source_assessment_ids?.length > 0
        ? metadata.source_assessment_ids.length
        : client?.vocational_facts_profile?.assessments_processed || 0;

  // Compute maturity whenever vfp / client / documents / assessments change
  const maturity = useMemo(() => evaluateVFPMaturity({
    vfp,
    client,
    documents: client?.documents || [],
    assessments: client?.assessments || [],
  }), [vfp, client]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const res = await base44.functions.invoke("processAssessmentDocuments", {
        action: "extract_from_documents",
        clientId,
      });

      console.log("VFP EXTRACT RESPONSE:", res);

      const extractedProfile = res?.data?.profile || null;
      const extractedMetadata = res?.data?.metadata || {};

      if (extractedProfile) {
        setLocalProfile(extractedProfile);
        setLocalMetadata(extractedMetadata);
      }

      toast.success("Vocational facts extracted successfully");

     if (onFactsUpdated) {
  await onFactsUpdated();
} else {
  window.location.reload();
}
    } catch (e) {
      console.error("VFP EXTRACT ERROR:", e);
      toast.error("Extraction failed: " + (e?.response?.data?.error || e.message));
    } finally {
      setExtracting(false);
    }
  };

  const totalFacts = vfp
    ? CATEGORY_CONFIG.reduce((sum, c) => {
        let count = (vfp[c.key]?.length || 0);
        
        // Add aliases for each category
        if (c.key === "work_environment_preferences") {
          count += (vfp.preferred_work_environment?.length || 0);
        } else if (c.key === "schedule_availability") {
          count += (vfp.schedule_constraints?.length || 0);
        } else if (c.key === "transportation") {
          count += (vfp.transportation_reliability?.length || 0) + 
                   (vfp.transportation_limitations?.length || 0);
        } else if (c.key === "social_communication_needs") {
          count += (vfp.communication_style?.length || 0) + 
                   (vfp.social_tolerance?.length || 0) + 
                   (vfp.social_supports?.length || 0);
        } else if (c.key === "sensory_environmental_needs") {
          count += (vfp.sensory_limitations?.length || 0);
        } else if (c.key === "physical_restrictions") {
          count += (vfp.accommodation_needs?.length || 0);
        } else if (c.key === "support_needs") {
          count += (vfp.medication_side_effect_flags?.length || 0) + 
                   (vfp.safety_risk_flags?.length || 0);
        } else if (c.key === "job_readiness_level") {
          count += (vfp.stamina_endurance_concerns?.length || 0);
        } else if (c.key === "employer_preferences") {
          count += (vfp.benefits_considerations?.length || 0);
        } else if (c.key === "goals") {
          count += (vfp.work_goal_themes?.length || 0);
        }
        
        return sum + count;
      }, 0)
    : 0;

  useEffect(() => {
    if (!client) {
      setIsOutdated(false);
      return;
    }

    const lastExtracted =
      metadata?.extracted_at ||
      client?.vocational_facts_extracted_at ||
      client?.vocational_facts_last_updated_at ||
      null;

    if (!lastExtracted) {
      setIsOutdated(false);
      return;
    }

    const extractedTime = new Date(lastExtracted).getTime();

    const newestDataTime = Math.max(
      0,
      ...(client?.documents || []).map((d) =>
        new Date(d.updated_date || d.created_date || 0).getTime()
      ),
      ...(client?.assessments || []).map((a) =>
        new Date(a.updated_date || a.created_date || 0).getTime()
      )
    );

    setIsOutdated(newestDataTime > extractedTime);
  }, [client, metadata]);
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-600" />
            Vocational Facts Profile
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Structured employment facts extracted from all assessments & documents
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs shrink-0"
          onClick={handleExtract}
          disabled={extracting}
        >
          {extracting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Extracting...</>
            : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> {vfp ? 'Re-extract' : 'Extract Facts'}</>
          }
        </Button>
      </div>

{isOutdated && (
  <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
    <div className="flex-1">
      <p className="text-xs font-semibold text-amber-900">
        Vocational Facts Profile may be outdated
      </p>
      <p className="mt-0.5 text-xs text-amber-800">
        New assessments or documents have been added. Click <strong>Re-extract</strong> to refresh.
      </p>
    </div>
  </div>
)}
      
      {/* Extraction metadata */}
     {loadingFacts ? (
  <div className="text-xs text-slate-400 p-4">Loading vocational facts...</div>
) : vfp ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last extracted {extractedAt ? format(new Date(extractedAt), 'MMM d, yyyy') : 'unknown'}
            {extractedBy && ` by ${extractedBy}`}
          </span>
          <span className="text-slate-300">|</span>
          <span>{docCount} doc{docCount !== 1 ? 's' : ''} + {assessCount} assessment{assessCount !== 1 ? 's' : ''} analyzed</span>
          {vfp.data_quality_score != null && (
            <>
              <span className="text-slate-300">|</span>
              <span className={cn("font-medium",
                vfp.data_quality_score >= 70 ? "text-green-600" :
                vfp.data_quality_score >= 40 ? "text-amber-600" : "text-red-500"
              )}>
                {vfp.data_quality_score}% data quality
              </span>
            </>
          )}
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-medium">{totalFacts} facts extracted</span>
        </div>
      ) : (
        <Card className="border-dashed border-slate-300 p-5 text-center bg-slate-50/50 shadow-none">
          <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No vocational facts extracted yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Extract Facts" to analyze all assessments and uploaded documents.
            This powers grounded, cited job recommendations.
          </p>
        </Card>
      )}

      {/* Maturity + Confidence */}
      {vfp && <MaturityCard maturity={maturity} />}

      {/* Conflicts */}
      {vfp?.conflicts?.length > 0 && (
        <ConflictBanner conflicts={vfp.conflicts} />
      )}

      {/* Missing critical data */}
      {vfp?.missing_critical_data?.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs font-semibold text-blue-800">Missing Critical Data</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vfp.missing_critical_data.map((m, i) => (
              <span key={i} className="text-[10px] bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Document types found */}
      {vfp?.document_types_found?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-slate-400 self-center">Documents analyzed:</span>
          {vfp.document_types_found.map((t, i) => (
            <span key={i} className="text-[10px] bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Category grid */}
      {vfp && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{CATEGORY_CONFIG.length} categories</span>
            <button
              onClick={() => setExpandAll(e => !e)}
              className="text-[11px] text-blue-600 hover:underline"
            >
              {expandAll ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CATEGORY_CONFIG.map(config => {
              // Map VFP fields to category keys, expanding aliases
              let items = [];

              if (config.key === "skills") {
                items = vfp.skills || [];
              } else if (config.key === "interests") {
                items = vfp.interests || [];
              } else if (config.key === "preferred_tasks") {
                items = vfp.preferred_tasks || [];
              } else if (config.key === "work_environment_preferences") {
                items = (vfp.work_environment_preferences || []).concat(vfp.preferred_work_environment || []);
              } else if (config.key === "schedule_availability") {
                items = (vfp.schedule_availability || []).concat(vfp.schedule_constraints || []);
              } else if (config.key === "transportation") {
                items = (vfp.transportation || [])
                  .concat(vfp.transportation_reliability || [])
                  .concat(vfp.transportation_limitations || []);
              } else if (config.key === "social_communication_needs") {
                items = (vfp.social_communication_needs || [])
                  .concat(vfp.communication_style || [])
                  .concat(vfp.social_tolerance || [])
                  .concat(vfp.social_supports || []);
              } else if (config.key === "sensory_environmental_needs") {
                items = (vfp.sensory_environmental_needs || [])
                  .concat(vfp.sensory_limitations || []);
              } else if (config.key === "physical_restrictions") {
                items = (vfp.physical_restrictions || [])
                  .concat(vfp.accommodation_needs || []);
              } else if (config.key === "support_needs") {
                items = (vfp.support_needs || [])
                  .concat(vfp.medication_side_effect_flags || [])
                  .concat(vfp.safety_risk_flags || []);
              } else if (config.key === "job_readiness_level") {
                items = (vfp.job_readiness_level || [])
                  .concat(vfp.stamina_endurance_concerns || []);
              } else if (config.key === "employer_preferences") {
                items = (vfp.employer_preferences || [])
                  .concat(vfp.benefits_considerations || []);
              } else if (config.key === "barriers") {
                items = vfp.barriers || [];
              } else if (config.key === "goals") {
                items = (vfp.goals || [])
                  .concat(vfp.work_goal_themes || []);
              }

              // Convert strings/objects to display-ready objects, format for display
              items = items.map(item => {
                const rawFact =
                  typeof item === "string"
                    ? item
                    : item?.fact || item?.value || item?.label || item?.name || "";

                const normalizedItem =
                  typeof item === "string"
                    ? { fact: rawFact, source: null }
                    : { ...item, fact: rawFact };

                return {
                  ...normalizedItem,
                  fact: formatFactForDisplay(config.key, rawFact),
                };
              });

              // Deduplicate all categories after formatting (same logic as support_needs)
              {
                const seen = new Set();
                items = items.filter((item) => {
                  const key = String(item.fact || "").trim().toLowerCase();
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              }

              return (
                <CategoryCard
                  key={config.key}
                  config={config}
                  items={items}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}