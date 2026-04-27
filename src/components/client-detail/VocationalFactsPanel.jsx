import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Sparkles, FileText, Clock, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

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
      }
    } catch (e) {
      console.error("VFP EXTRACT ERROR:", e);
      toast.error("Extraction failed: " + (e?.response?.data?.error || e.message));
    } finally {
      setExtracting(false);
    }
  };

  const totalFacts = vfp
    ? CATEGORY_CONFIG.reduce((sum, c) => sum + (vfp[c.key]?.length || 0), 0)
    : 0;

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

      {/* Extraction metadata */}
      {vfp ? (
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
            {CATEGORY_CONFIG.map(config => (
              <CategoryCard
                key={config.key}
                config={config}
                items={vfp[config.key] || []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
