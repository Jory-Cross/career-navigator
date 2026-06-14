import React, { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, CheckSquare, Link as LinkIcon, Filter, ChevronDown, ChevronRight, Camera, Loader2, UserX, RotateCcw } from "lucide-react";
import EmployeeAccessActions from "@/components/employees/EmployeeAccessActions";
import EmployeeOffboardingDialog from "@/components/employees/EmployeeOffboardingDialog";
import EmployeeReactivationDialog from "@/components/employees/EmployeeReactivationDialog";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isWithinInterval } from "date-fns";

function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]), month = Number(parts[1]), day = Number(parts[2]);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function getPeriodRange(periodFilter, selectedMonth) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const lastMonth = subMonths(now, 1);
  const ly = lastMonth.getFullYear(), lm = lastMonth.getMonth();

  if (periodFilter === "this_first") return { start: new Date(y, m, 1), end: new Date(y, m, 15) };
  if (periodFilter === "this_second") return { start: new Date(y, m, 16), end: endOfMonth(now) };
  if (periodFilter === "last_first") return { start: new Date(ly, lm, 1), end: new Date(ly, lm, 15) };
  if (periodFilter === "last_second") return { start: new Date(ly, lm, 16), end: endOfMonth(lastMonth) };
  if (periodFilter === "this_month") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (periodFilter === "last_month") return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
  if (periodFilter === "custom_month" && selectedMonth) {
    const [cy, cm] = selectedMonth.split("-").map(Number);
    const base = new Date(cy, cm - 1, 1);
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  return null; // all time
}

function isInPeriod(dateStr, range) {
  if (!range) return true;
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return false;
  return isWithinInterval(parsed, { start: range.start, end: range.end });
}

const catColors = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600"
};

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700",
};

const activityIcons = {
  email_sent: "📧",
  task_created: "✅",
  task_completed: "✅",
  application_created: "📋",
  application_updated: "📋",
  document_uploaded: "📄",
  meeting_scheduled: "📅",
  time_logged: "⏱️",
  note_added: "📝",
  status_changed: "🔄",
  onboarding_step: "🚀",
};

function TimeEntriesDrillDown({ timeEntries, clients, timePeriod, setTimePeriod, timeClientFilter, setTimeClientFilter, expandedClient, setExpandedClient, getClientName }) {
  const now = new Date();

  const filtered = timeEntries.filter(e => {
    if (timeClientFilter !== "all" && e.client_id !== timeClientFilter) return false;
    if (timePeriod === "week" && e.date) {
      return isWithinInterval(new Date(e.date), { start: startOfWeek(now), end: endOfWeek(now) });
    }
    if (timePeriod === "month" && e.date) {
      return isWithinInterval(new Date(e.date), { start: startOfMonth(now), end: endOfMonth(now) });
    }
    return true;
  });

  const totalMinutes = filtered.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Group by client
  const byClient = {};
  filtered.forEach(e => {
    if (!byClient[e.client_id]) byClient[e.client_id] = { minutes: 0, entries: [] };
    byClient[e.client_id].minutes += (e.duration_minutes || 0);
    byClient[e.client_id].entries.push(e);
  });

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalHours}h</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Sessions</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{filtered.length}</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Clients</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{Object.keys(byClient).length}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-36 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeClientFilter} onValueChange={setTimeClientFilter}>
          <SelectTrigger className="w-44 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-8 text-center text-sm text-slate-400">No time entries found</Card>
      ) : (
        <Card className="border-0 shadow-sm divide-y divide-slate-100">
          {Object.entries(byClient)
            .sort(([, a], [, b]) => b.minutes - a.minutes)
            .map(([clientId, data]) => {
              const pct = totalMinutes > 0 ? (data.minutes / totalMinutes) * 100 : 0;
              const isExpanded = expandedClient === clientId;
              const clientHours = Math.round(data.minutes / 60 * 10) / 10;

              return (
                <div key={clientId}>
                  {/* Client row — clickable to drill down */}
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedClient(isExpanded ? null : clientId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {(() => { const c = clients.find(c => c.id === clientId); return c ? `${c.first_name?.[0]}${c.last_name?.[0]}` : clientId ? '?' : 'A'; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-slate-800">{getClientName(clientId)}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700">{clientHours}h</span>
                            <span className="text-xs text-slate-400">{data.entries.length} sessions</span>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Drill-down: individual entries */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100">
                      {data.entries
                        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                        .map(entry => (
                          <div key={entry.id} className="px-5 py-3 border-b border-slate-100 last:border-0 flex items-start gap-4">
                            <div className="text-right shrink-0 w-14">
                              <p className="text-sm font-bold text-slate-800">{entry.duration_minutes}m</p>
                              <p className="text-[10px] text-slate-400">{Math.round((entry.duration_minutes || 0) / 60 * 10) / 10}h</p>
                            </div>
                            <div className="w-px h-10 bg-slate-200 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 font-medium">{entry.description || "Session"}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge className={cn("text-[10px] border-0", catColors[entry.category] || "bg-slate-100 text-slate-600")}>
                                  {entry.category?.replace(/_/g, " ")}
                                </Badge>
                                {entry.start_time && (
                                  <span className="text-[10px] text-slate-400">{entry.start_time}{entry.end_time ? ` – ${entry.end_time}` : ""}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 shrink-0 text-right">
                              {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : ""}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </Card>
      )}
    </div>
  );
}

export default function EmployeeDetail({ employee, currentUser, onOffboarded }) {
  const [periodFilter, setPeriodFilter] = useState("this_first");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [timePeriod, setTimePeriod] = useState("all");
  const [timeClientFilter, setTimeClientFilter] = useState("all");
  const [expandedClient, setExpandedClient] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(employee.avatar_url || null);
  const [showOffboarding, setShowOffboarding] = useState(false);
  const [showReactivation, setShowReactivation] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const initials = `${employee.full_name?.split(' ')[0]?.[0] || ''}${employee.full_name?.split(' ')[1]?.[0] || ''}`;
  const isInactive = employee.is_active === false || !employee.access_level || employee.access_level === '' || employee.status === 'inactive';

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.User.update(employee.id, { avatar_url: file_url });
    setAvatarUrl(file_url);
    queryClient.invalidateQueries(["users"]);
    setUploadingPhoto(false);
  };

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => c.assigned_employee_id === employee.id && !c.is_archived);
    }
  });

  const clientIds = clients.map(c => c.id);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-for-employee-detail", employee.id],
    queryFn: async () => {
      const all = await base44.entities.TimeEntry.list("-created_date");
      return all.filter(t => t.employee_id === employee.id || t.created_by_id === employee.id);
    }
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activity-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Activity.list("-created_date", 100);
      return all.filter(a => clientIds.includes(a.client_id));
    },
    enabled: clientIds.length > 0
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Task.list("-created_date");
      return all.filter(t => t.client_ids?.some(id => clientIds.includes(id)));
    },
    enabled: clientIds.length > 0
  });

  const periodRange = useMemo(() => getPeriodRange(periodFilter, selectedMonth), [periodFilter, selectedMonth]);

  const filteredTimeEntries = useMemo(() =>
    timeEntries.filter(e => isInPeriod(e.date, periodRange)), [timeEntries, periodRange]);

  const filteredActivities = useMemo(() =>
    activities.filter(a => isInPeriod(a.created_date, periodRange)), [activities, periodRange]);

  const filteredTasks = useMemo(() =>
    tasks.filter(t => {
      if (!periodRange) return true;
      // Use due_date if available, else created_date
      const dateStr = t.due_date || t.created_date;
      return isInPeriod(dateStr, periodRange);
    }), [tasks, periodRange]);

  const periodLabel = useMemo(() => {
    if (!periodRange) return "All Time";
    return `${format(periodRange.start, "MMM d")} – ${format(periodRange.end, "MMM d, yyyy")}`;
  }, [periodRange]);

  const totalHours = Math.round(filteredTimeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10) / 10;
  const activeClients = clients.filter(c => !c.is_archived).length;
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  const getClientName = (clientId) => {
    if (!clientId) return "Admin / No Client";
    const c = clients.find(c => c.id === clientId);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown Client";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0 group">
            <div className="w-16 h-16 rounded-xl overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={employee.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  {initials || '?'}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {uploadingPhoto ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{employee.full_name || employee.email}</h2>
            <p className="text-sm text-slate-500">{employee.email}</p>
            <Badge className="mt-1 text-xs bg-purple-100 text-purple-700 border-0">{employee.role}</Badge>
            <p className="text-xs text-slate-400 mt-1">Hover photo to change</p>
          </div>
        </div>

        {/* Access Actions */}
        <div className="mt-5 flex items-start justify-between gap-3 flex-wrap">
          <EmployeeAccessActions employee={employee} currentUser={currentUser} />
          {(currentUser?.role === 'admin' || currentUser?.role === 'management') && (
            <>
              {isInactive ? (
                <button
                  onClick={() => setShowReactivation(true)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 rounded-lg px-3 py-1.5 transition-colors bg-emerald-50 hover:bg-emerald-100 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reactivate Employee
                </button>
              ) : (
                <button
                  onClick={() => setShowOffboarding(true)}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors bg-red-50 hover:bg-red-100 shrink-0"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Offboard Employee
                </button>
              )}
            </>
          )}
        </div>

        {isInactive ? (
          <EmployeeReactivationDialog
            open={showReactivation}
            onOpenChange={setShowReactivation}
            employee={employee}
            currentUser={currentUser}
            onComplete={() => {
              queryClient.invalidateQueries(["clients-for-employee", employee.id]);
              queryClient.invalidateQueries(["all-users"]);
              onOffboarded?.();
            }}
          />
        ) : (
          <EmployeeOffboardingDialog
            open={showOffboarding}
            onOpenChange={setShowOffboarding}
            employee={employee}
            currentUser={currentUser}
            onComplete={() => {
              queryClient.invalidateQueries(["clients-for-employee", employee.id]);
              queryClient.invalidateQueries(["all-users"]);
              onOffboarded?.();
            }}
          />
        )}

        {/* Period Filter */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40 text-sm border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_first">This Month: 1st–15th</SelectItem>
                <SelectItem value="this_second">This Month: 16th–End</SelectItem>
                <SelectItem value="last_first">Last Month: 1st–15th</SelectItem>
                <SelectItem value="last_second">Last Month: 16th–End</SelectItem>
                <SelectItem value="this_month">This Month (Full)</SelectItem>
                <SelectItem value="last_month">Last Month (Full)</SelectItem>
                <SelectItem value="custom_month">Custom Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            {periodFilter === "custom_month" && (
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
            <span className="text-xs text-slate-400">{periodLabel}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { label: "Active Clients", value: activeClients, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Clients", value: clients.length, icon: Users, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Hours Logged", value: `${totalHours}h`, icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending Tasks", value: pendingTasks, icon: CheckSquare, color: "text-orange-600", bg: "bg-orange-50" },
          ].map(stat => (
            <div key={stat.label} className={cn("rounded-xl p-4", stat.bg)}>
              <stat.icon className={cn("w-5 h-5 mb-2", stat.color)} />
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="clients">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger value="clients">Assigned Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({filteredActivities.length})</TabsTrigger>
          <TabsTrigger value="time">Time Entries ({filteredTimeEntries.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({filteredTasks.length})</TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients" className="mt-4">
          <div className="space-y-3">
            {clients.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No clients assigned</p>}
            {clients.map(client => (
              <Link key={client.id} to={createPageUrl("ClientDetail") + `?id=${client.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {client.first_name?.[0]}{client.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 text-sm">{client.first_name} {client.last_name}</span>
                        <Badge className={cn("text-[10px] border-0", statusColors[client.status])}>{client.status}</Badge>
                        {client.is_archived && <Badge className="text-[10px] border-0 bg-slate-100 text-slate-400">archived</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{client.email}</p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card className="border-0 shadow-sm p-4">
            <div className="space-y-3">
              {filteredActivities.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No activity for this period</p>}
              {filteredActivities.slice(0, 50).map(act => (
                <div key={act.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-lg shrink-0">{activityIcons[act.activity_type] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{act.title}</p>
                    {act.description && <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>}
                    <p className="text-xs text-slate-300 mt-1">
                      {getClientName(act.client_id)} · {act.created_date ? format(new Date(act.created_date), "MMM d, yyyy h:mm a") : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="mt-4">
          <TimeEntriesDrillDown
            timeEntries={filteredTimeEntries}
            clients={clients}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
            timeClientFilter={timeClientFilter}
            setTimeClientFilter={setTimeClientFilter}
            expandedClient={expandedClient}
            setExpandedClient={setExpandedClient}
            getClientName={getClientName}
          />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <Card className="border-0 shadow-sm p-4">
            <div className="space-y-3">
              {filteredTasks.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No tasks for this period</p>}
              {filteredTasks.map(task => (
                <div key={task.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {task.category} {task.due_date ? `· Due ${format(new Date(task.due_date), "MMM d")}` : ""}
                    </p>
                  </div>
                  <Badge className={cn("border-0 text-xs shrink-0", {
                    "bg-orange-100 text-orange-700": task.status === 'pending',
                    "bg-blue-100 text-blue-700": task.status === 'in_progress',
                    "bg-emerald-100 text-emerald-700": task.status === 'completed',
                    "bg-slate-100 text-slate-500": task.status === 'cancelled',
                  })}>
                    {task.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}