import React, { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Users, FileText, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildEvidenceThemes, createEvidenceConcepts } from "@/lib/customized-employment/evidenceNormalizer";

function ThemeRow({ theme }) {
  const [open, setOpen] = useState(false);

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