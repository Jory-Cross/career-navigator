import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Maps the source label (set by getAssessmentSourceLabel in CustomizedEmploymentPanel)
// to the assessment key used by AssessmentSection
const SOURCE_TO_ASSESSMENT_KEY = {
  "Home & Community Discovery": "home_community_discovery",
  "Discovery Interview": "discovery_interview",
  "Discovery Activity": "discovery_activity",
  "Informational Interview": "informational_interview",
  "Benefits & Resources Assessment": "benefits_resources",
  "Assistive Technology Assessment": "assistive_technology",
};

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

function SourceGroup({ source, entries, onOpenAssessment }) {
  const [open, setOpen] = useState(false);
  const assessmentKey = SOURCE_TO_ASSESSMENT_KEY[source];

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2 gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span className="text-sm text-slate-700 truncate">{source}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
            {entries.length}
          </Badge>
          {assessmentKey && onOpenAssessment && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssessment(assessmentKey);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          )}
        </div>
      </div>
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

function CategorySection({ label, items, onOpenAssessment }) {
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
              <SourceGroup key={source} source={source} entries={entries} onOpenAssessment={onOpenAssessment} />
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
  onOpenAssessment,
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
          <CategorySection key={cat.label} label={cat.label} items={cat.items} onOpenAssessment={onOpenAssessment} />
        ))}
      </div>
    </div>
  );
}