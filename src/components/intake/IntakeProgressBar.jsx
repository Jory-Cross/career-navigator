import React from "react";
import { cn } from "@/lib/utils";
import { calculateIntakeProgress } from "@/lib/intakeSections";

export default function IntakeProgressBar({ sections }) {
  const { total, completed, percent } = calculateIntakeProgress(sections);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Intake Progress</span>
        <span className="text-sm font-bold text-indigo-600">{percent}%</span>
      </div>

      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            percent === 100 ? "bg-emerald-500" : "bg-indigo-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{completed} of {total} sections complete</span>
        {percent === 100 && (
          <span className="text-emerald-600 font-semibold">✓ All sections complete</span>
        )}
      </div>

      {/* Section status summary */}
      <div className="flex flex-wrap gap-2 pt-1">
        {[
          { key: "reviewed", label: "Reviewed", color: "bg-purple-100 text-purple-700" },
          { key: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-700" },
          { key: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
          { key: "assigned", label: "Assigned", color: "bg-amber-100 text-amber-700" },
          { key: "not_started", label: "Not Started", color: "bg-slate-100 text-slate-600" },
        ].map(({ key, label, color }) => {
          const count = sections.filter((s) => s.status === key).length;
          if (count === 0) return null;
          return (
            <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
              {count} {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}