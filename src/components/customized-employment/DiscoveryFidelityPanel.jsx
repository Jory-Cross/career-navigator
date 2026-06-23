import React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MIN_EVIDENCE_THRESHOLD = 3;
const MIN_SOURCE_THRESHOLD = 2;

function getFidelityStatus(count, sourceCount, singleSource = false) {
  if (count === 0) return "missing";
  if (singleSource) return count >= MIN_EVIDENCE_THRESHOLD ? "ok" : "weak";
  if (count < MIN_EVIDENCE_THRESHOLD || sourceCount < MIN_SOURCE_THRESHOLD) return "weak";
  return "ok";
}

function FidelityRow({ label, items, singleSource = false }) {
  const count = items.length;
  const sourceCount = new Set(items.map((i) => i.source).filter(Boolean)).size;
  const sources = [...new Set(items.map((i) => i.source).filter(Boolean))];
  const status = getFidelityStatus(count, sourceCount, singleSource);

  return (
    <div
      className={`rounded-lg border p-3 ${
        status === "missing"
          ? "border-red-200 bg-red-50"
          : status === "weak"
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {status === "missing" ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          ) : status === "weak" ? (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <span
            className={`text-sm font-medium ${
              status === "missing"
                ? "text-red-800"
                : status === "weak"
                ? "text-amber-800"
                : "text-emerald-800"
            }`}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <Badge
            variant="outline"
            className={
              count === 0
                ? "border-red-300 text-red-700 bg-white"
                : count < MIN_EVIDENCE_THRESHOLD
                ? "border-amber-300 text-amber-700 bg-white"
                : "border-emerald-300 text-emerald-700 bg-white"
            }
          >
            {count} item{count === 1 ? "" : "s"}
          </Badge>
          <Badge
            variant="outline"
            className={
              sourceCount === 0
                ? "border-red-300 text-red-700 bg-white"
                : sourceCount < MIN_SOURCE_THRESHOLD
                ? "border-amber-300 text-amber-700 bg-white"
                : "border-emerald-300 text-emerald-700 bg-white"
            }
          >
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {sources.length > 0 && (
        <p className="text-xs text-slate-500 mt-1.5 ml-6">
          {sources.join(" · ")}
        </p>
      )}
    </div>
  );
}

export default function DiscoveryFidelityPanel({
  emergingInterests,
  observedSkills,
  conditionsForSuccess,
  potentialBusinessSettings,
  relationshipsAndNaturalSupports,
  communityConnections,
  employerLeads,
  benefitsAndFinancialConsiderations,
  assistiveTechnologyAndAccommodations,
  discoveryHypotheses,
  vocationalThemesEvidence,
}) {
  const categories = [
    { label: "Emerging Interests", items: emergingInterests },
    { label: "Observed Skills", items: observedSkills },
    { label: "Conditions for Success", items: conditionsForSuccess },
    { label: "Business Settings", items: potentialBusinessSettings },
    { label: "Relationships / Natural Supports", items: relationshipsAndNaturalSupports },
    { label: "Community Connections", items: communityConnections },
    { label: "Employer Leads", items: employerLeads },
    { label: "Benefits & Financial Considerations", items: benefitsAndFinancialConsiderations, singleSource: true },
    { label: "Assistive Technology & Accommodations", items: assistiveTechnologyAndAccommodations, singleSource: true },
    { label: "Discovery Hypotheses", items: discoveryHypotheses },
    { label: "Vocational Themes Evidence", items: vocationalThemesEvidence },
  ];

  const missingCount = categories.filter((c) => c.items.length === 0).length;
  const weakCount = categories.filter(
    (c) =>
      c.items.length > 0 &&
      (c.items.length < MIN_EVIDENCE_THRESHOLD ||
        new Set(c.items.map((i) => i.source).filter(Boolean)).size < MIN_SOURCE_THRESHOLD)
  ).length;
  const strongCount = categories.length - missingCount - weakCount;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-sm font-semibold text-slate-900">
          Discovery Fidelity & Evidence Gap Analysis
        </h5>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
            {strongCount} strong
          </Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            {weakCount} weak
          </Badge>
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
            {missingCount} missing
          </Badge>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Categories with fewer than {MIN_EVIDENCE_THRESHOLD} items or fewer than {MIN_SOURCE_THRESHOLD} sources are flagged for additional discovery.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        {categories.map((cat) => (
          <FidelityRow key={cat.label} label={cat.label} items={cat.items} singleSource={cat.singleSource} />
        ))}
      </div>
    </div>
  );
}