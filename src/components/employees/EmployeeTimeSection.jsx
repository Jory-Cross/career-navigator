import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { getDisplayPayrollPeriod, parseDateOnly } from "@/lib/payrollDisplayPeriod";

const statusColors = {
  draft: "bg-slate-100 text-slate-500",
  submitted: "bg-blue-50 text-blue-600",
  approved: "bg-emerald-50 text-emerald-600",
  locked: "bg-amber-50 text-amber-700",
  void: "bg-red-50 text-red-500",
};

export default function EmployeeTimeSection({ entries, clientsById, isLoading, error }) {
  const period = getDisplayPayrollPeriod();

  const periodHours = isLoading
    ? null
    : Math.round(
        entries
          .filter(t => {
            const d = parseDateOnly(t.date);
            return d && d >= period.start && d <= period.end;
          })
          .reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10
      ) / 10;

  const recent = [...entries]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 8);

  const clientName = (id) => {
    const c = id ? clientsById.get(id) : null;
    return c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : null;
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock className="w-4 h-4 text-slate-400" /> Time Entries
        </h3>
        <Badge className="bg-blue-50 text-blue-700 border-0 text-xs">
          {periodHours === null ? "…" : `${periodHours}h · ${period.label}`}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 py-2">Loading time entries…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">{error.message || "Time entries could not be loaded."}</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">No time entries recorded for this employee.</p>
      ) : (
        <div className="space-y-1.5">
          {recent.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {clientName(entry.client_id) || entry.entry_type_code || "Time entry"}
                </p>
                <p className="text-xs text-slate-400">{entry.date}</p>
              </div>
              <span className="text-sm font-semibold text-slate-600 shrink-0">
                {Math.round((entry.duration_minutes || 0) / 6) / 10}h
              </span>
              {entry.status && (
                <Badge className={`border-0 text-[10px] shrink-0 ${statusColors[entry.status] || "bg-slate-100 text-slate-500"}`}>
                  {entry.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}