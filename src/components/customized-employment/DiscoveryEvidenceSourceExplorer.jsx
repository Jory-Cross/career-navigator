import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function groupBySource(items) {
  const map = {};
  items.forEach((item) => {
    const src = item.source || "Unknown";
    if (!map[src]) map[src] = [];
    map[src].push(item);
  });
  // Sort sources by count descending
  return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
}

function SourceGroup({ source, entries }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span className="text-sm text-slate-700 truncate">{source}</span>
        </div>
        <Badge variant="outline" className="ml-2 shrink-0 text-xs border-slate-300 text-slate-600">
          {entries.length}
        </Badge>
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1.5 bg-white">
          {entries.map((item, i) => (
            <li key={i} className="text-xs text-slate-600">
              • {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategorySection({ label, items }) {
  const [open, setOpen] = useState(false);
  const sourceGroups = groupBySource(items);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-800">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
            {items.length} items
          </Badge>
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
            {sourceGroups.length} source{sourceGroups.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No evidence recorded for this category.</p>
          ) : (
            sourceGroups.map(([source, entries]) => (
              <SourceGroup key={source} source={source} entries={entries} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DiscoveryEvidenceSourceExplorer({
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
    { label: "Potential Business Settings", items: potentialBusinessSettings },
    { label: "Relationships / Natural Supports", items: relationshipsAndNaturalSupports },
    { label: "Community Connections", items: communityConnections },
    { label: "Employer Leads", items: employerLeads },
    { label: "Benefits & Financial Considerations", items: benefitsAndFinancialConsiderations },
    { label: "Assistive Technology & Accommodations", items: assistiveTechnologyAndAccommodations },
    { label: "Discovery Hypotheses", items: discoveryHypotheses },
    { label: "Vocational Themes Evidence", items: vocationalThemesEvidence },
  ];

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-sm font-semibold text-slate-900">Discovery Evidence Source Explorer</h5>
        <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
          {totalItems} categorized evidence entries
        </Badge>
      </div>

      <p className="text-xs text-slate-500">
        Expand a category to see evidence by source. Expand a source to inspect individual entries.
      </p>

      <div className="space-y-2">
        {categories.map((cat) => (
          <CategorySection key={cat.label} label={cat.label} items={cat.items} />
        ))}
      </div>
    </div>
  );
}