import { useState, useEffect, useMemo } from "react";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Filter, AlertTriangle, Trash2, Pencil, Plus } from "lucide-react";
import FormEngine from "@/components/time-entry/FormEngine";
import LegacyDataWarning from "@/components/shared/LegacyDataWarning";
// saveTimeEntry removed — DynamicEntryForm owns all save operations via handleDynamicEntrySave
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";

export default function TimeTracking() {
  const { viewAsUser } = useViewAs();
  const [periodFilter, setPeriodFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingEntryTypeCode, setEditingEntryTypeCode] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");
  const [entryTypes, setEntryTypes] = useState([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
     base44.auth.me().then(setUser).catch(() => {});
     setEntryTypes(getEntryTypeOptions());
   }, []);

  // Effective user: admin viewing as someone else uses that person's perspective
  const effectiveUser = (user?.role === 'admin' && viewAsUser) ? viewAsUser : user;

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'management'),
  });

  // Employees filterable depend on effective perspective
  const filterableEmployees = allUsers.filter(u => {
    if (!u.is_archived) {
      if (effectiveUser?.role === 'management') return u.role === 'employee' && u.manager_id === effectiveUser.id;
      if (user?.role === 'admin' && !viewAsUser) return u.role === 'employee' || u.role === 'management';
    }
    return false;
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", effectiveUser?.id, effectiveUser?.role],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      if (!effectiveUser) return all;
      if (effectiveUser.role === 'admin') return all;
      if (effectiveUser.role === 'management') {
        const empIds = allUsers.filter(u => u.manager_id === effectiveUser.id).map(u => u.id);
        return all.filter(c => empIds.includes(c.assigned_employee_id));
      }
      if (effectiveUser.role === 'employee') {
        return all.filter(c => c.assigned_employee_id === effectiveUser.id || c.created_by === effectiveUser.email);
      }
      return all;
    },
    enabled: !!effectiveUser
  });

  // Clients visible after employee filter
  const clients = (effectiveUser?.role === 'admin' || effectiveUser?.role === 'management') && employeeFilter !== 'all'
    ? allClients.filter(c => {
        const emp = filterableEmployees.find(e => e.id === employeeFilter);
        return emp && (c.assigned_employee_id === emp.id || c.created_by === emp.email);
      })
    : allClients;

  const clientIds = allClients.map(c => c.id);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list("-created_date"),
    enabled: !!effectiveUser,
  });

  // Filter time entries to only those for visible clients (when not admin)
  // Include entries with no client_id (myself/admin entries)
  const scopedTimeEntries = useMemo(() => {
    if (!effectiveUser) return timeEntries;
    if (effectiveUser.role === 'admin' && !viewAsUser) return timeEntries;
    return timeEntries.filter(e => !e.client_id || clientIds.includes(e.client_id));
  }, [timeEntries, clientIds, effectiveUser?.id, viewAsUser?.id]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  };

  // Edit launcher — uses shared resolveEntryTypeCode from lib/resolveEntryTypeCode.js
  const handleEditEntry = async (entry) => {
    console.log("🟣 TIME TRACKING EDIT RAW ENTRY:", JSON.stringify(entry, null, 2));
    const code = await resolveEntryTypeCode(entry);
    console.log("🟣 TIME TRACKING RESOLVED TYPE CODE:", code);
    setEditingEntry(entry);
    setEditingEntryTypeCode(code);
    setSelectedEntry(null);
  };

  const handleOpenEntry = async (entry) => {
    if (!entry?.id) {
      toast.error("Invalid entry");
      return;
    }
    try {
      const fresh = await base44.entities.TimeEntry.get(entry.id);
      if (!fresh) {
        toast.error("This entry no longer exists");
        handleRefresh();
        return;
      }
      setSelectedEntry(fresh);
    } catch (err) {
      console.error("Failed to open entry:", err);
      toast.error("This entry no longer exists");
      handleRefresh();
    }
  };

  const getClientName = (id) => {
    if (!id) return "Myself";
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

  const filtered = scopedTimeEntries.filter(e => {
    if ((effectiveUser?.role === 'admin' || effectiveUser?.role === 'management') && employeeFilter !== 'all' && e.client_id && !filteredClientIds.includes(e.client_id)) return false;
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
  scopedTimeEntries.forEach(e => {
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

  // Detect legacy entries (using category field instead of entry_type_code)
  const legacyEntries = scopedTimeEntries.filter(e => e.category && !e.entry_type_code);

  // Group by client
  const byClient = {};
  filtered.forEach(e => {
    if (!byClient[e.client_id]) byClient[e.client_id] = { minutes: 0, entries: 0 };
    byClient[e.client_id].minutes += (e.duration_minutes || 0);
    byClient[e.client_id].entries += 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">Log and review time spent with clients</p>
        </div>
        <Button onClick={() => setShowNewEntry(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Entry
        </Button>
      </div>

      {legacyEntries.length > 0 && (
        <LegacyDataWarning
          type="banner"
          recordCount={legacyEntries.length}
          issues={["legacy_category", "unstructured_entry"]}
          recordIds={legacyEntries.map(e => e.id)}
        />
      )}

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
                         <button className="font-medium text-slate-700 hover:text-blue-600 hover:underline text-left" onClick={() => navigate(`/ClientDetail?clientId=${cId}`)}>{getClientName(cId)}</button>
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
            {(effectiveUser?.role === 'admin' || effectiveUser?.role === 'management') && filterableEmployees.length > 0 && (
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
                {clients.filter(c => !c.is_archived).map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
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
                    onClick={() => handleOpenEntry(entry)}
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
                          {entry.client_id ? (
                            <button className="text-xs text-slate-500 flex items-center gap-1 hover:text-blue-600 hover:underline" onClick={e => { e.stopPropagation(); navigate(`/ClientDetail?clientId=${entry.client_id}`); }}><User className="w-3 h-3" />{getClientName(entry.client_id)}</button>
                          ) : (
                            <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" />Myself</span>
                          )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">
                     {entry.date && (() => {
  const [y, m, d] = entry.date.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
})()}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Removed QuickTimeLog - consolidated into unified FormEngine */}
        </div>
      </div>
      {/* New Entry Dialog with FormEngine */}
      <Dialog open={showNewEntry} onOpenChange={open => { if (!open) { setShowNewEntry(false); setSelectedEntryTypeCode(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4">
              {!selectedEntryTypeCode && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Entry Type</label>
                  <Select value={selectedEntryTypeCode} onValueChange={setSelectedEntryTypeCode}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select an entry type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entryTypes.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedEntryTypeCode && (
                <FormEngine
                  entryTypeCode={selectedEntryTypeCode}
                  entry={null}
                  clientId={null}
                  mode="create"
                  onSave={async () => {
                    // DynamicEntryForm owns saving — onSave is called after success
                    await handleRefresh();
                    setShowNewEntry(false);
                    setSelectedEntryTypeCode("");
                  }}
                  onCancel={() => { setShowNewEntry(false); setSelectedEntryTypeCode(""); }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2">
              Time Entry Details
              {selectedEntry && duplicateIds.has(selectedEntry.id) && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Duplicate
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4">
              {selectedEntry && (
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Client</p>
                      <p className="font-medium text-slate-800">{getClientName(selectedEntry.client_id)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Date</p>
                 <p className="font-medium text-slate-800">
  {selectedEntry.date ? (() => {
    const [y, m, d] = selectedEntry.date.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
  })() : "—"}
</p>
  
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Duration</p>
                      <p className="font-medium text-slate-800">{selectedEntry.duration_minutes} minutes</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Time</p>
                      <p className="font-medium text-slate-800">{selectedEntry.start_time || "—"}{selectedEntry.end_time ? ` - ${selectedEntry.end_time}` : ""}</p>
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
                        try {
                          await base44.entities.TimeEntry.delete(selectedEntry.id);
                          toast.success("Entry deleted");
                          setSelectedEntry(null);
                          queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
                        } catch (err) {
                          toast.error("Failed to delete entry");
                          console.error(err);
                          setSelectedEntry(null);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Entry
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditEntry(selectedEntry)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>Close</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — same pipeline as TimeLogDashboard */}
      <Dialog open={!!editingEntry} onOpenChange={open => { if (!open) { setEditingEntry(null); setEditingEntryTypeCode(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4">
              {editingEntry && (
                <FormEngine
                  entryTypeCode={editingEntryTypeCode}
                  entry={editingEntry}
                  clientId={editingEntry.client_id || null}
                  mode="edit"
                  onSave={async () => {
                    setEditingEntry(null);
                    setEditingEntryTypeCode("");
                    handleRefresh();
                  }}
                  onCancel={() => { setEditingEntry(null); setEditingEntryTypeCode(""); }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
     </div>
   );
 }
