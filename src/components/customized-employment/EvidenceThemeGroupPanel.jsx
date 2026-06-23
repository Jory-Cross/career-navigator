import React, { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Users, FileText, Layers, Compass, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildEvidenceThemes, createEvidenceConcepts, getThemeInsightSummary, buildEmergingVocationalThemes } from "@/lib/customized-employment/evidenceNormalizer";

// Strength-key → tailwind classes for the always-visible strength chip.
const STRENGTH_CHIP_CLASSES = {
  strong: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  emerging: "bg-sky-50 text-sky-700 border-sky-200",
  none: "bg-slate-50 text-slate-500 border-slate-200",
  insufficient: "bg-slate-50 text-slate-500 border-slate-200",
};

function ThemeRow({ theme }) {
  const [open, setOpen] = useState(false);
  const insight = getThemeInsightSummary(theme);
  const chipClass = STRENGTH_CHIP_CLASSES[insight.strengthKey] || STRENGTH_CHIP_CLASSES.none;

  return (
    <div className="rounded-lg border border-indigo-100 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50/40 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <Folder className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-medium text-slate-800 truncate">
            {theme.themeName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2 flex-wrap justify-end">
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
            <FileText className="h-3 w-3 mr-1" />
            {theme.entryCount} {theme.entryCount === 1 ? "entry" : "entries"}
          </Badge>
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
            <Users className="h-3 w-3 mr-1" />
            {theme.sourceCount} {theme.sourceCount === 1 ? "source" : "sources"}
          </Badge>
          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">
            <Layers className="h-3 w-3 mr-1" />
            {theme.concepts.length} {theme.concepts.length === 1 ? "concept" : "concepts"}
          </Badge>
        </div>
      </button>

      {/* Always-visible Theme Intelligence summary */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${chipClass}`}>
            {insight.strengthLabel}
          </span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{insight.entryCount}</span> supporting entries
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{insight.sourceCount}</span> supporting sources
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{insight.conceptCount}</span> supporting concepts
          </span>
        </div>

        {insight.observedAcrossCount > 0 && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Observed across:</span>
            <span className="text-xs text-slate-700">
              {insight.primarySources.join(", ")}
            </span>
          </div>
        )}

        {insight.strengthReason && (
          <p className="mt-1.5 text-xs text-slate-600 italic leading-relaxed">
            {insight.strengthReason}
          </p>
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-slate-50/50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
            Supporting Concepts
          </p>
          <ul className="space-y-1">
            {theme.concepts.map((concept, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>{concept}</span>
              </li>
            ))}
          </ul>

          {theme.entries.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
                Supporting Entries
              </p>
              <ul className="space-y-1">
                {theme.entries.map((entry, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>
                      {entry.text}
                      <span className="text-slate-400 ml-1">— {entry.source}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VocationalThemeCandidateCard({ candidate }) {
  const chipClass = STRENGTH_CHIP_CLASSES[candidate.confidenceKey] || STRENGTH_CHIP_CLASSES.insufficient;

  return (
    <div className="rounded-lg border border-violet-200 bg-white overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 bg-violet-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-violet-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">
            {candidate.themeName}
          </span>
        </div>
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold shrink-0 ${chipClass}`}>
          {candidate.confidenceLabel}
        </span>
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* Supporting Themes */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Supporting Themes
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {candidate.supportingThemes.map((name) => (
              <Badge key={name} variant="outline" className="text-xs border-violet-200 text-violet-700 bg-violet-50/40">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Supporting Concepts */}
        {candidate.supportingConcepts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Supporting Concepts
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {candidate.supportingConcepts.map((concept) => (
                <span key={concept} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                  {concept}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Supporting Sources */}
        {candidate.supportingSources.length > 0 && (
          <div className="flex items-start gap-1.5">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Supporting Sources:</span>
            <span className="text-xs text-slate-700">
              {candidate.supportingSources.join(", ")}
            </span>
          </div>
        )}

        {/* Supporting Entry Count */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{candidate.supportingEntries}</span> supporting entries
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{candidate.supportingThemeCount}</span> supporting themes
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{candidate.supportingConceptCount}</span> supporting concepts
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{candidate.supportingSourceCount}</span> supporting sources
          </span>
        </div>

        <p className="text-xs text-slate-400 italic">
          Candidate only — provisional synthesis of discovery evidence, not an employment recommendation.
        </p>
      </div>
    </div>
  );
}

function VocationalThemeCandidatesBlock({ candidates }) {
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-violet-600" />
          <h6 className="text-sm font-semibold text-slate-800">
            Vocational Theme Candidates
          </h6>
        </div>
        <Badge variant="outline" className="text-xs border-violet-200 text-violet-600">
          {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
        </Badge>
      </div>

      <p className="text-xs text-slate-500">
        Provisional synthesis of discovery themes into higher-level vocational candidates. Candidates are not conclusions, not established vocational themes, and not employment recommendations.
      </p>

      <div className="space-y-1.5">
        {candidates.map((candidate) => (
          <VocationalThemeCandidateCard key={candidate.themeName} candidate={candidate} />
        ))}
      </div>
    </div>
  );
}

export default function EvidenceThemeGroupPanel({ items, label }) {
  const concepts = createEvidenceConcepts(items);
  const themes = buildEvidenceThemes(concepts);
  const vocationalCandidates = buildEmergingVocationalThemes(themes);

  if (themes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-slate-400" />
          <h6 className="text-sm font-semibold text-slate-700">
            Theme Groups{label ? ` — ${label}` : ""}
          </h6>
        </div>
        <p className="text-xs text-slate-400 mt-1 ml-6">
          No theme groups identified for this category yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-indigo-600" />
          <h6 className="text-sm font-semibold text-slate-800">
            Theme Groups{label ? ` — ${label}` : ""}
          </h6>
        </div>
        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">
          {themes.length} {themes.length === 1 ? "theme" : "themes"}
        </Badge>
      </div>

      {vocationalCandidates.length > 0 && (
        <VocationalThemeCandidatesBlock candidates={vocationalCandidates} />
      )}

      <div className="space-y-1.5">
        {themes.map((theme) => (
          <ThemeRow key={theme.themeName} theme={theme} />
        ))}
      </div>
    </div>
  );
}