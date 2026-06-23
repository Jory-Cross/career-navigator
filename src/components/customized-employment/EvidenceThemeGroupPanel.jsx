import React, { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Users, FileText, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildEvidenceThemes, createEvidenceConcepts, getThemeInsightSummary } from "@/lib/customized-employment/evidenceNormalizer";

// Strength-key → tailwind classes for the always-visible strength chip.
const STRENGTH_CHIP_CLASSES = {
  strong: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  emerging: "bg-sky-50 text-sky-700 border-sky-200",
  none: "bg-slate-50 text-slate-500 border-slate-200",
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

export default function EvidenceThemeGroupPanel({ items, label }) {
  const concepts = createEvidenceConcepts(items);
  const themes = buildEvidenceThemes(concepts);

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

      <div className="space-y-1.5">
        {themes.map((theme) => (
          <ThemeRow key={theme.themeName} theme={theme} />
        ))}
      </div>
    </div>
  );
}