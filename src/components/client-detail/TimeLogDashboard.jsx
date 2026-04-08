import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Copy, Loader2, Filter, AlertCircle, CheckCircle2, FileText, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import FormEngine from "@/components/time-entry/FormEngine";
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";

/**
 * TimeLogDashboard - Operational dashboard for time entry management
 * 
 * Features:
 * - Status tabs (all, draft, submitted, approved, locked)
 * - Advanced filtering (client, employee, entry type, date range, reportable, billable)
 * - Enhanced row display with report linkage and authorization indicators
 * - Actions: edit, duplicate, complete draft, view report history, void
 * - Uses EntryType name/code instead of legacy category
 */
export default function TimeLogDashboard({
  timeEntries = [],
  clientId,
  clients = [],
  onRefresh,
  onEditEntry
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [filters, setFilters] = useState({
    clientId: clientId || "",
    employeeId: "",
    entryTypeCode: "",
    dateFrom: "",
    dateTo: "",
    reportable: "all",
    billable: "all",
    payrollEligible: "all"
  });
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");
  const [employees, setEmployees] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [generatedReports, setGeneratedReports] = useState({});
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load reference data
   useEffect(() => {
     Promise.all([
       base44.entities.User.filter({ role: "employee" }).catch(() => []),
       base44.entities.GeneratedReport.filter({ client_id: clientId }).catch(() => [])
     ]).then(([emps, reports]) => {
       setEmployees(emps);
       // Use canonical entry type options from registry
       setEntryTypes(getEntryTypeOptions());
      // Index reports by time entry ID for quick lookup
      const indexed = {};
      reports.forEach(r => {
        r.included_time_entry_ids?.forEach(id => {
          indexed[id] = r;
        });
      });
      setGeneratedReports(indexed);
    });
  }, [clientId]);

  // Filter entries
  const filtered = useMemo(() => {
    let result = timeEntries;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(e => e.status === statusFilter);
    }

    // Advanced filters
    if (filters.clientId) {
      result = result.filter(e => e.client_id === filters.clientId);
    }
    if (filters.employeeId) {
      result = result.filter(e => e.employee_id === filters.employeeId);
    }
    if (filters.entryTypeCode) {
      result = result.filter(e => e.entry_type_code === filters.entryTypeCode);
    }
    if (filters.dateFrom) {
      result = result.filter(e => e.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(e => e.date <= filters.dateTo);
    }
    if (filters.reportable !== "all") {
      const val = filters.reportable === "true";
      result = result.filter(e => e.is_reportable === val);
    }
    if (filters.billable !== "all") {
      const val = filters.billable === "true";
      result = result.filter(e => e.is_billable === val);
    }
    if (filters.payrollEligible !== "all") {
      const val = filters.payrollEligible === "true";
      result = result.filter(e => e.is_payroll_eligible === val);
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [timeEntries, statusFilter, filters]);

  const totalMinutes = filtered.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const statusCounts = useMemo(() => {
    const counts = {
      all: timeEntries.length,
      draft: timeEntries.filter(e => e.status === "draft").length,
      submitted: timeEntries.filter(e => e.status === "submitted").length,
      approved: timeEntries.filter(e => e.status === "approved").length,
      locked: timeEntries.filter(e => e.status === "locked").length
    };
    return counts;
  }, [timeEntries]);

  const handleDuplicate = async (entry) => {
    try {
      const newEntry = { ...entry };
      delete newEntry.id;
      delete newEntry.created_date;
      delete newEntry.updated_date;
      newEntry.status = "draft";
      newEntry.date = format(new Date(entry.date).getTime() + 86400000, "yyyy-MM-dd"); // next day
      
      await base44.entities.TimeEntry.create(newEntry);
      toast.success("Entry duplicated");
      onRefresh();
    } catch (err) {
      toast.error("Failed to duplicate");
    }
  };

  const handleCompleteDraft = async (entry) => {
    try {
      await base44.entities.TimeEntry.update(entry.id, { status: "submitted" });
      toast.success("Draft marked as submitted");
      onRefresh();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleVoid = async (entry) => {
    if (!confirm("Void this entry? This cannot be undone.")) return;
    try {
      await base44.entities.TimeEntry.update(entry.id, { status: "void" });
      toast.success("Entry voided");
      onRefresh();
    } catch (err) {
      toast.error("Failed to void entry");
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm("Delete this entry permanently?")) return;
    try {
      await base44.entities.TimeEntry.delete(entry.id);
      toast.success("Entry deleted");
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const getEntryTypeDisplay = (entry) => {
    if (entry.entry_type_code) {
      const type = entryTypes.find(t => t.code === entry.entry_type_code);
      return type?.name || entry.entry_type_code;
    }
    return entry.legacy_category?.replace(/_/g, " ") || "Unknown";
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: "bg-slate-100 text-slate-700",
      submitted: "bg-blue-100 text-blue-700",
      approved: "bg-emerald-100 text-emerald-700",
      locked: "bg-purple-100 text-purple-700",
      void: "bg-red-100 text-red-700"
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Time Log Dashboard</h3>
            <p className="text-xs text-slate-500 mt-1">
              {filtered.length} entries • {totalHours}h total
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters {Object.values(filters).some(v => v && v !== "all") && `(${Object.values(filters).filter(v => v && v !== "all").length})`}
            </Button>
            <Button size="sm" onClick={() => { setEditingEntry(null); setSelectedEntryTypeCode(""); setShowForm(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1.5 border-b border-slate-200 overflow-x-auto">
          {["all", "draft", "submitted", "approved", "locked"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-[2px]",
                statusFilter === status
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-800"
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1 text-slate-400">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Client</Label>
            <Select value={filters.clientId} onValueChange={v => setFilters(p => ({ ...p, clientId: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Employee</Label>
            <Select value={filters.employeeId} onValueChange={v => setFilters(p => ({ ...p, employeeId: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Entry Type</Label>
            <Select value={filters.entryTypeCode} onValueChange={v => setFilters(p => ({ ...p, entryTypeCode: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All types</SelectItem>
                {entryTypes.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reportable</Label>
            <Select value={filters.reportable} onValueChange={v => setFilters(p => ({ ...p, reportable: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Billable</Label>
            <Select value={filters.billable} onValueChange={v => setFilters(p => ({ ...p, billable: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payroll Eligible</Label>
            <Select value={filters.payrollEligible} onValueChange={v => setFilters(p => ({ ...p, payrollEligible: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          <button
            onClick={() => setFilters({
              clientId: clientId || "",
              employeeId: "",
              entryTypeCode: "",
              dateFrom: "",
              dateTo: "",
              reportable: "all",
              billable: "all",
              payrollEligible: "all"
            })}
            className="col-span-2 md:col-span-4 text-xs text-slate-600 hover:text-slate-800 font-medium"
          >
            Clear filters
          </button>
        </Card>
      )}

      {/* Entries Table */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {timeEntries.length === 0 ? "No time entries yet" : "No entries match the current filters"}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(entry => {
              const report = generatedReports[entry.id];
              const employee = employees.find(e => e.id === entry.employee_id);
              const client = clients.find(c => c.id === entry.client_id);
              
              return (
                <div key={entry.id} className="p-4 hover:bg-slate-50 transition-colors group space-y-2.5">
                  {/* Row 1: Date, Entry Type, Duration, Status */}
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-800 w-20">
                      {format(new Date(entry.date + "T00:00:00"), "MMM d, yyyy")}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getEntryTypeDisplay(entry)}
                    </Badge>
                    <div className="text-sm font-medium text-slate-700 ml-auto">
                      {Math.round(entry.duration_minutes / 60 * 10) / 10}h
                    </div>
                    <Badge className={cn("text-xs border-0", getStatusBadge(entry.status))}>
                      {entry.status}
                    </Badge>
                  </div>

                  {/* Row 2: Report-Ready, Authorization, Report Link */}
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    {entry.report_ready && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded border border-emerald-200 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Report Ready
                      </div>
                    )}
                    {entry.service_authorization_id && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded border border-blue-200 text-blue-700 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Auth Linked
                      </div>
                    )}
                    {report && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded border border-purple-200 text-purple-700 font-medium ml-auto">
                        <FileText className="w-3.5 h-3.5" />
                        In Report v{report.version_number}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Employee, Description */}
                  {(employee?.full_name || entry.description) && (
                    <div className="flex gap-2 text-xs text-slate-600">
                      {employee?.full_name && <span>👤 {employee.full_name}</span>}
                      {entry.description && <span className="text-slate-500 italic line-clamp-1">{entry.description}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setEditingEntry(entry);
                        setSelectedEntryTypeCode(entry.entry_type_code || "");
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleDuplicate(entry)}
                    >
                      <Copy className="w-3 h-3" />
                      Duplicate
                    </Button>
                    {entry.status === "draft" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCompleteDraft(entry)}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </Button>
                    )}
                    {report && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => window.open(`/Reports?report_id=${report.id}`)}
                      >
                        <Eye className="w-3 h-3" />
                        View Report
                      </Button>
                    )}
                    {entry.status !== "locked" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => handleVoid(entry)}
                        >
                          <AlertCircle className="w-3 h-3" />
                          Void
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog with Entry Type Selector at top */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingEntry(null); setSelectedEntryTypeCode(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4">
              {/* Entry Type Dropdown */}
              {!editingEntry && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Entry Type</Label>
                  <Select
                    value={selectedEntryTypeCode}
                    onValueChange={setSelectedEntryTypeCode}
                  >
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

              {/* Unified Form Engine */}
              {(() => {
                const activeEntryTypeCode = editingEntry?.entry_type_code || selectedEntryTypeCode || "";

                // For new entries, only render form if an entry type is selected
                if (!editingEntry && !activeEntryTypeCode) {
                  return (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Select an entry type above to begin
                    </div>
                  );
                }

                const handleFormSave = async (payload) => {
                   console.log("[TimeLogDashboard] === FORM SAVE START ===");
                   console.log("[TimeLogDashboard] Incoming payload:", JSON.stringify(payload, null, 2));

                   try {
                      // Extract duration in minutes from multiple possible fields
                      const durationMinutes = payload.duration_minutes || payload.duration || 0;
                      console.log("[TimeLogDashboard] Duration minutes:", durationMinutes);
                      console.log("[TimeLogDashboard] Date:", payload.date);
                      console.log("[TimeLogDashboard] Entry type code:", payload.entry_type_code);

                      // Validate required fields
                      if (!payload.date) throw new Error("Missing date");
                      if (!durationMinutes) throw new Error("Missing duration");
                      const entryTypeCode = payload.entry_type_code || activeEntryTypeCode;
                      if (!entryTypeCode) throw new Error("Missing entry type");

                      const updateData = {
                        date: payload.date,
                        duration_minutes: durationMinutes,
                        description: payload.description,
                        entry_type_code: entryTypeCode,
                        start_time: payload.start_time || null,
                        end_time: payload.end_time || null,
                        form_data: payload.form_data
                      };

                      console.log("[TimeLogDashboard] Update/create data:", updateData);

                      if (editingEntry?.id) {
                        // Update existing entry
                        console.log("[TimeLogDashboard] Updating entry:", editingEntry.id);
                        await base44.entities.TimeEntry.update(editingEntry.id, updateData);
                        console.log("[TimeLogDashboard] Update successful");
                        toast.success("Entry updated");
                      } else {
                        // Create new entry
                        const currentUser = await base44.auth.me();
                        const createData = {
                          ...updateData,
                          client_id: clientId,
                          employee_id: currentUser?.id,
                          status: "submitted",
                          is_reportable: true,
                          is_billable: false,
                          is_payroll_eligible: true,
                          reporting_period_key: payload.date ? payload.date.substring(0, 7) : null
                        };
                        console.log("[TimeLogDashboard] Creating TimeEntry with payload:", createData);
                        await base44.entities.TimeEntry.create(createData);
                        console.log("[TimeLogDashboard] Create successful");
                        toast.success("Entry created");
                      }
                      setShowForm(false);
                      setEditingEntry(null);
                      setSelectedEntryTypeCode("");
                      onRefresh();
                    } catch (err) {
                      console.error("[TimeLogDashboard] Full error object:", err);
                      console.error("[TimeLogDashboard] Error message:", err?.message);
                      console.error("[TimeLogDashboard] Error status:", err?.status);
                      toast.error(err?.message || "Failed to save entry");
                    }
                  };

                return (
                  <FormEngine
                    entryTypeCode={activeEntryTypeCode}
                    entry={editingEntry}
                    mode={editingEntry ? "edit" : "create"}
                    onSave={handleFormSave}
                    onCancel={() => { setShowForm(false); setEditingEntry(null); setSelectedEntryTypeCode(""); }}
                  />
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}