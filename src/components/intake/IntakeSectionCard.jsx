import React from "react";
import { cn } from "@/lib/utils";
import { SECTION_STATUS_COLORS, SECTION_STATUS_LABELS } from "@/lib/intakeSections";
import { UserCheck, ChevronRight } from "lucide-react";

export default function IntakeSectionCard({ sectionDef, sectionRecord, onClick, isActive }) {
  const status = sectionRecord?.status || "not_started";
  const isAssigned = sectionRecord?.assigned_to_client;

  const answerCount = sectionRecord?.answers
    ? Object.values(sectionRecord.answers).filter((v) => v !== null && v !== undefined && v !== "").length
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all hover:shadow-md group",
        isActive
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-300"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{sectionDef.emoji}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{sectionDef.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {answerCount} / {sectionDef.fields.length} fields
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAssigned && (
            <span title="Assigned to client">
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            </span>
          )}
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", SECTION_STATUS_COLORS[status])}>
            {SECTION_STATUS_LABELS[status]}
          </span>
          <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", isActive && "rotate-90")} />
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            status === "completed" || status === "reviewed" ? "bg-emerald-500" :
            status === "in_progress" ? "bg-blue-500" :
            status === "assigned" ? "bg-amber-400" : "bg-slate-200"
          )}
          style={{ width: `${sectionDef.fields.length > 0 ? Math.min(100, Math.round((answerCount / sectionDef.fields.length) * 100)) : 0}%` }}
        />
      </div>
    </button>
  );
}