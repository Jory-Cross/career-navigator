import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, User, Calendar, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import ActiveTimer from "@/components/dashboard/ActiveTimer";
import QuickTimeLog from "@/components/dashboard/QuickTimeLog";

const catColors = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600"
};

export default function TimeTracking() {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list("-created_date")
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  };

  const getClientName = (id) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  const now = new Date();
  const filtered = timeEntries.filter(e => {
    if (clientFilter !== "all" && e.client_id !== clientFilter) return false;
    if (periodFilter === "week" && e.date) {
      return isWithinInterval(new Date(e.date), { start: startOfWeek(now), end: endOfWeek(now) });
    }
    if (periodFilter === "month" && e.date) {
      return isWithinInterval(new Date(e.date), { start: startOfMonth(now), end: endOfMonth(now) });
    }
    return true;
  });

  const totalMinutes = filtered.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Group by client
  const byClient = {};
  filtered.forEach(e => {
    if (!byClient[e.client_id]) byClient[e.client_id] = { minutes: 0, entries: 0 };
    byClient[e.client_id].minutes += (e.duration_minutes || 0);
    byClient[e.client_id].entries += 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Time Tracking</h1>
        <p className="text-sm text-slate-500 mt-1">Log and review time spent with clients</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm p-5 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Hours</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{totalHours}h</p>
            </Card>
            <Card className="border-0 shadow-sm p-5 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Sessions</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{filtered.length}</p>
            </Card>
            <Card className="border-0 shadow-sm p-5 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Clients</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{Object.keys(byClient).length}</p>
            </Card>
          </div>

          {/* Client breakdown */}
          {Object.keys(byClient).length > 0 && (
            <Card className="border-0 shadow-sm">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Hours by Client</h3>
              </div>
              <div className="p-5 space-y-3">
                {Object.entries(byClient)
                  .sort(([, a], [, b]) => b.minutes - a.minutes)
                  .map(([cId, data]) => {
                    const pct = totalMinutes > 0 ? (data.minutes / totalMinutes) * 100 : 0;
                    return (
                      <div key={cId} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-slate-700">{getClientName(cId)}</span>
                          <span className="text-slate-500">{Math.round(data.minutes / 60 * 10) / 10}h · {data.entries} sessions</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-slate-700 to-slate-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Filters */}
          <div className="flex gap-3 items-center">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-36 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Entries list */}
          <Card className="border-0 shadow-sm">
            <div className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No time entries found</div>
              ) : filtered.map(entry => (
                <div key={entry.id} className="p-4 flex items-center gap-4">
                  <div className="text-right shrink-0 w-16">
                    <p className="text-sm font-bold text-slate-800">{entry.duration_minutes}min</p>
                    {entry.start_time && <p className="text-[10px] text-slate-400">{entry.start_time} - {entry.end_time}</p>}
                  </div>
                  <div className="w-px h-10 bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{entry.description || "Session"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" />{getClientName(entry.client_id)}</span>
                      <Badge className={cn("text-[10px] border-0", catColors[entry.category])}>{entry.category?.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">
                    {entry.date && format(new Date(entry.date), "MMM d")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <ActiveTimer clients={clients} onTimeSaved={handleRefresh} />
          <QuickTimeLog clients={clients} onTimeSaved={handleRefresh} />
        </div>
      </div>
    </div>
  );
}