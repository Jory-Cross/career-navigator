import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const catColors = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600"
};

export default function TimeLogSection({ timeEntries }) {
  const totalMinutes = timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  const sorted = [...timeEntries].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Time Log</h3>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <Clock className="w-4 h-4" />
          {totalHours}h total
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No time logged yet</div>
        ) : sorted.map(entry => (
          <div key={entry.id} className="p-4 flex items-center gap-3">
            <div className="text-right shrink-0 w-14">
              <p className="text-sm font-semibold text-slate-800">{entry.duration_minutes}m</p>
              {entry.start_time && <p className="text-[10px] text-slate-400">{entry.start_time}</p>}
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 truncate">{entry.description || "Session"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={cn("text-[10px] border-0", catColors[entry.category])}>{entry.category?.replace(/_/g, " ")}</Badge>
                {entry.date && <span className="text-[10px] text-slate-400">{format(new Date(entry.date), "MMM d")}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}