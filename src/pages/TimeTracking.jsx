import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, Calendar, Filter, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'management'),
  });

  // Employees = users with role employee (or management for admin view)
  const filterableEmployees = allUsers.filter(u =>
    user?.role === 'admin'
      ? (u.role === 'employee' || u.role === 'management')
      : u.role === 'employee'
  );

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", user?.role],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      if (!user) return all;
      if (user.role === 'admin' || user.role === 'management') return all;
      if (user.role === 'employee') {
        return all.filter(c => c.assigned_employee_id === user.id || c.created_by === user.email);
      }
      return all;
    },
    enabled: !!user
  });

  // Clients visible after employee filter (for admin/management)
  const clients = (user?.role === 'admin' || user?.role === 'management') && employeeFilter !== 'all'
    ? allClients.filter(c => {
        const emp = filterableEmployees.find(e => e.id === employeeFilter);
        return emp && (c.assigned_employee_id === emp.id || c.created_by === emp.email);
      })
    : allClients;

  const clientIds = allClients.map(c => c.id);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", user?.role],
    queryFn: async () => {
      const allEntries = await base44.entities.TimeEntry.list("-created_date");
      if (!user) return allEntries;
      if (user.role === 'admin' || user.role === 'management') return allEntries;
      if (user.role === 'employee') {
        return allEntries.filter(e => clientIds.includes(e.client_id));
      }
      return allEntries;
    },
    enabled: !!user && allClients.length >= 0
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  };

  const getClientName = (id) => {
    const c = allClients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const payroll1Start = new Date(nowYear, nowMonth, 1);
  const payroll1End = new Date(nowYear, nowMonth, 15, 23, 59, 59);
  const payroll2Start = new Date(nowYear, nowMonth, 16);
  const payroll2End = new Date(nowYear, nowMonth + 1, 0, 23, 59, 59);

  // IDs of clients belonging to the selected employee
  const filteredClientIds = clients.map(c => c.id);

  const filtered = timeEntries.filter(e => {
    if ((user?.role === 'admin' || user?.role === 'management') && employeeFilter !== 'all' && !filteredClientIds.includes(e.client_id)) return false;
    if (clientFilter !== "all" && e.client_id !== clientFilter) return false;
    if (!e.date) return periodFilter === "all";
    const d = new Date(e.date);
    if (periodFilter === "payroll1") return d >= payroll1Start && d <= payroll1End;
    if (periodFilter === "payroll2") return d >= payroll2Start && d <= payroll2End;
    if (periodFilter === "week") return isWithinInterval(d, { start: startOfWeek(now), end: endOfWeek(now) });
    if (periodFilter === "month") return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    return true;
  });

  // Find duplicates: same client_id + date + start_time (or date if no start_time)
  const duplicateIds = new Set();
  const seen = {};
  timeEntries.forEach(e => {
    const key = `${e.client_id}__${e.date}__${e.start_time || "notime"}`;
    if (seen[key]) {
      duplicateIds.add(e.id);
      duplicateIds.add(seen[key]);
    } else {
      seen[key] = e.id;
    }
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
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-36 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="payroll1">This Month 1–15</SelectItem>
                <SelectItem value="payroll2">This Month 16–End</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            {(user?.role === 'admin' || user?.role === 'management') && filterableEmployees.length > 0 && (
              <Select value={employeeFilter} onValueChange={v => { setEmployeeFilter(v); setClientFilter("all"); }}>
                <SelectTrigger className="w-44 border-slate-200 text-sm"><SelectValue placeholder="All Employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {filterableEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-44 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Duplicate warning banner */}
          {duplicateIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span><strong>{duplicateIds.size} duplicate entries detected</strong> — entries with the same client, date, and time are highlighted below.</span>
            </div>
          )}

          {/* Entries list */}
          <Card className="border-0 shadow-sm">
            <div className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No time entries found</div>
              ) : filtered.map(entry => {
                const isDuplicate = duplicateIds.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className={cn("p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors", isDuplicate && "bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-400")}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="text-right shrink-0 w-16">
                      <p className="text-sm font-bold text-slate-800">{entry.duration_minutes}min</p>
                      {entry.start_time && <p className="text-[10px] text-slate-400">{entry.start_time} - {entry.end_time}</p>}
                    </div>
                    <div className="w-px h-10 bg-slate-100" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">{entry.description || "Session"}</p>
                        {isDuplicate && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" />{getClientName(entry.client_id)}</span>
                        <Badge className={cn("text-[10px] border-0", catColors[entry.category])}>{entry.category?.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">
                      {entry.date && format(new Date(entry.date), "MMM d")}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <ActiveTimer clients={allClients} onTimeSaved={handleRefresh} />
          <QuickTimeLog clients={allClients} onTimeSaved={handleRefresh} />
        </div>
      </div>
      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Time Entry Details
              {selectedEntry && duplicateIds.has(selectedEntry.id) && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Duplicate
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Client</p>
                  <p className="font-medium text-slate-800">{getClientName(selectedEntry.client_id)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Date</p>
                  <p className="font-medium text-slate-800">{selectedEntry.date ? format(new Date(selectedEntry.date), "MMM d, yyyy") : "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Duration</p>
                  <p className="font-medium text-slate-800">{selectedEntry.duration_minutes} minutes</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Time</p>
                  <p className="font-medium text-slate-800">{selectedEntry.start_time || "—"}{selectedEntry.end_time ? ` - ${selectedEntry.end_time}` : ""}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Category</p>
                  <Badge className={cn("text-xs border-0", catColors[selectedEntry.category])}>{selectedEntry.category?.replace(/_/g, " ")}</Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Logged</p>
                  <p className="font-medium text-slate-800">{selectedEntry.created_date ? format(new Date(selectedEntry.created_date), "MMM d, h:mm a") : "—"}</p>
                </div>
              </div>
              {selectedEntry.description && (
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selectedEntry.description}</p>
                </div>
              )}
              {duplicateIds.has(selectedEntry.id) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>This entry appears to be a duplicate. Another entry exists for the same client, date, and time. Please review and delete one.</span>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={async () => {
                    await base44.entities.TimeEntry.delete(selectedEntry.id);
                    toast.success("Entry deleted");
                    setSelectedEntry(null);
                    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Entry
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}