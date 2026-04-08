import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Plus, Pencil, Copy, Loader2, Filter, AlertCircle, CheckCircle2, Lock, FileText, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";

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
  const [employees, setEmployees] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [generatedReports, setGeneratedReports] = useState({});
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load reference data
  useEffect(() => {
    Promise.all([
      base44.entities.User.filter({ role: "employee" }).catch(() => []),
      base44.entities.EntryType.filter({ is_active: true }).catch(() => []),
      base44.entities.GeneratedReport.filter({ client_id: clientId }).catch(() => [])
    ]).then(([emps, types, reports]) => {
      setEmployees(emps);
      setEntryTypes(types);
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
            <Button size="sm" onClick={() => { setEditingEntry(null); setShowForm(true); }} className="gap-1.5">
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

      {/* Edit/Add Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingEntry(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4">
              <TimeEntryFormContent
                entry={editingEntry}
                clientId={clientId}
                onClose={() => { setShowForm(false); setEditingEntry(null); }}
                onSave={() => { setShowForm(false); setEditingEntry(null); onRefresh(); }}
                entryTypes={entryTypes}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * TimeEntryFormContent - Form content for adding/editing time entries
 * Uses EntryType instead of legacy category
 * NOW LOADS AND DISPLAYS DYNAMIC QUESTIONS FROM ReportFieldTemplate
 */
function TimeEntryFormContent({ entry, clientId, onClose, onSave, entryTypes }) {
   const [form, setForm] = useState(
      entry ? {
        date: entry.date,
        duration_minutes: entry.duration_minutes,
        entry_type_id: entry.entry_type_id,
        entry_type_code: entry.entry_type_code,
        description: entry.description,
        start_time: entry.start_time || "",
        end_time: entry.end_time || ""
      } : {
        date: format(new Date(), "yyyy-MM-dd"),
        duration_minutes: "",
        entry_type_id: "",
        entry_type_code: "",
        description: "",
        start_time: "",
        end_time: ""
      }
   );
   const [fieldAnswers, setFieldAnswers] = useState({});
   const [questions, setQuestions] = useState([]);
   const [loadingQuestions, setLoadingQuestions] = useState(false);
   const [saving, setSaving] = useState(false);

   // Load dynamic questions when entry type changes
   useEffect(() => {
     if (!form.entry_type_code) {
       setQuestions([]);
       return;
     }

     setLoadingQuestions(true);
     base44.entities.ReportFieldTemplate.filter({
       entry_type_code: form.entry_type_code,
       is_active: true
     }).then(templates => {
       setQuestions(templates.sort((a, b) => (a.order || 0) - (b.order || 0)));
     }).catch(err => {
       console.error('Failed to load questions:', err);
       toast.error('Failed to load form questions');
     }).finally(() => {
       setLoadingQuestions(false);
     });
   }, [form.entry_type_code]);

   const handleSave = async () => {
     if (!form.date || !form.entry_type_code) {
       toast.error("Date and entry type are required");
       return;
     }

     const duration = form.start_time && form.end_time && !form.duration_minutes
       ? Math.round(((new Date(`2000-01-01T${form.end_time}`) - new Date(`2000-01-01T${form.start_time}`)) / 1000) / 60)
       : parseInt(form.duration_minutes);

     if (!duration || duration <= 0) {
       toast.error("Duration required");
       return;
     }

     setSaving(true);
     try {
       if (entry) {
         // Editing existing entry - update only
         const data = {
           date: form.date,
           duration_minutes: duration,
           entry_type_id: form.entry_type_id,
           entry_type_code: form.entry_type_code,
           description: form.description,
           start_time: form.start_time || null,
           end_time: form.end_time || null,
           reporting_period_key: form.date.slice(0, 7),
           is_reportable: true,
           is_billable: false,
           is_payroll_eligible: true
         };
         await base44.entities.TimeEntry.update(entry.id, data);
         toast.success("Entry updated");
       } else {
         // Creating new entry - use dual-write to ensure ReportFieldAnswer is created
         await submitTimeEntryWithDualWrite({
           clientId,
           entryTypeId: form.entry_type_id,
           entryTypeCode: form.entry_type_code,
           date: form.date,
           startTime: form.start_time || null,
           endTime: form.end_time || null,
           durationMinutes: duration,
           location: null,
           description: form.description,
           serviceAuthorizationId: null,
           fieldAnswers: fieldAnswers,
           asDraft: false
         });
         toast.success("Entry created with reporting fields");
       }
       onSave();
     } catch (err) {
       toast.error("Failed to save");
       console.error(err);
     } finally {
       setSaving(false);
     }
   };

   return (
     <div className="space-y-4">
       <div className="grid grid-cols-2 gap-3">
         <div className="space-y-1">
           <Label className="text-xs">Date</Label>
           <Input
             type="date"
             value={form.date}
             onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
           />
         </div>
         <div className="space-y-1">
           <Label className="text-xs">Entry Type</Label>
           <Select
             value={form.entry_type_code}
             onValueChange={v => {
               const type = entryTypes.find(t => t.code === v);
               setForm(p => ({ ...p, entry_type_code: v, entry_type_id: type?.id }));
             }}
           >
             <SelectTrigger>
               <SelectValue placeholder="Select..." />
             </SelectTrigger>
             <SelectContent>
               {entryTypes.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
             </SelectContent>
           </Select>
         </div>
       </div>

       <div className="space-y-1">
         <Label className="text-xs">Description</Label>
         <Input
           value={form.description}
           onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
           placeholder="What did you work on?"
         />
       </div>

       <div className="space-y-2 p-3 bg-slate-50 rounded">
         <p className="text-xs font-medium text-slate-600">Duration</p>
         <div className="grid grid-cols-3 gap-2">
           <div className="space-y-1">
             <Label className="text-xs">Start Time</Label>
             <Input
               type="time"
               value={form.start_time}
               onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
             />
           </div>
           <div className="space-y-1">
             <Label className="text-xs">End Time</Label>
             <Input
               type="time"
               value={form.end_time}
               onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
             />
           </div>
           <div className="space-y-1">
             <Label className="text-xs">Minutes</Label>
             <Input
               type="number"
               value={form.duration_minutes}
               onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
               placeholder="60"
             />
           </div>
         </div>
       </div>

       {/* Dynamic Questions Section */}
       {questions.length > 0 && (
         <div className="space-y-3 p-3 bg-blue-50 rounded border border-blue-200">
           <p className="text-xs font-semibold text-blue-900">Reporting Questions ({questions.length})</p>
           <div className="space-y-3">
             {loadingQuestions ? (
               <p className="text-xs text-slate-500 italic">Loading questions...</p>
             ) : (
               questions.map(q => (
                 <div key={q.field_key} className="space-y-1.5">
                   <Label className="text-xs">
                     {q.label}
                     {q.is_required && <span className="text-red-500 ml-1">*</span>}
                   </Label>
                   {q.field_type === 'textarea' ? (
                     <textarea
                       className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-20"
                       value={fieldAnswers[q.field_key] || ''}
                       onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                       placeholder={q.placeholder || ''}
                     />
                   ) : q.field_type === 'select' ? (
                     <Select
                       value={fieldAnswers[q.field_key] || ''}
                       onValueChange={v => setFieldAnswers(p => ({ ...p, [q.field_key]: v }))}
                     >
                       <SelectTrigger className="h-8 text-xs">
                         <SelectValue placeholder={q.placeholder || 'Select...'} />
                       </SelectTrigger>
                       <SelectContent>
                         {q.options?.filter(opt => opt && opt.trim()).map(opt => {
                           const trimmed = opt.trim();
                           return trimmed ? <SelectItem key={trimmed} value={trimmed}>{trimmed}</SelectItem> : null;
                         })}
                       </SelectContent>
                     </Select>
                   ) : q.field_type === 'date' ? (
                     <Input
                       type="date"
                       value={fieldAnswers[q.field_key] || ''}
                       onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                     />
                   ) : q.field_type === 'time' ? (
                     <Input
                       type="time"
                       value={fieldAnswers[q.field_key] || ''}
                       onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                     />
                   ) : q.field_type === 'number' ? (
                     <Input
                       type="number"
                       value={fieldAnswers[q.field_key] || ''}
                       onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                       placeholder={q.placeholder || ''}
                     />
                   ) : (
                     <Input
                       type="text"
                       value={fieldAnswers[q.field_key] || ''}
                       onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                       placeholder={q.placeholder || ''}
                     />
                   )}
                   {q.help_text && <p className="text-xs text-slate-500 italic">{q.help_text}</p>}
                 </div>
               ))
             )}
           </div>
         </div>
       )}

       <div className="flex gap-2 justify-end pt-2 mt-4 border-t border-slate-200">
         <Button variant="outline" onClick={onClose}>Cancel</Button>
         <Button onClick={handleSave} disabled={saving}>
           {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
           {entry ? "Save" : "Add"}
         </Button>
       </div>
     </div>
   );
}