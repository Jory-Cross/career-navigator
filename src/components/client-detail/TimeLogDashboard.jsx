import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Copy, Filter, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import FormEngine from "@/components/time-entry/FormEngine";
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";

/**
 * TimeLogDashboard
 *
 * Updated to:
 * - remove status tabs (draft / submitted / approved / locked)
 * - remove status badge from each row
 * - show service type clearly
 * - show minutes logged clearly
 * - avoid "Unknown" when an entry type code exists but uses a legacy alias
 */

const ENTRY_TYPE_LABEL_ALIASES = {
  misc: "Miscellaneous",
  miscellaneous: "Miscellaneous",
  pre_ets: "Pre-ETS",
  pre_ets_training: "Pre-ETS",
  eom_reporting: "End-of-Month Reporting",
  end_of_month_reporting: "End-of-Month Reporting",
  admin_time: "Admin Time",
  wsa: "WSA",
  work_based_learning: "Work-Based Learning",
  wble: "Work-Based Learning",
  work_based_learning_experience: "Work-Based Learning",
  job_coaching: "Job Coaching",
  job_development: "Job Development",
  usor96: "Job Development",
  life_skills: "Life Skills",
  csb_hours: "CSB Hours",
};

function formatDurationMinutes(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "0 min";

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (remainder === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr ${remainder} min`;
}

function prettifyCode(code) {
  if (!code) return "Time Entry";
  return String(code)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TimeLogDashboard({
  timeEntries = [],
  clientId,
  clients = [],
  onRefresh,
  onEditEntry,
}) {
  const [filters, setFilters] = useState({
    clientId: clientId || "",
    employeeId: "",
    entryTypeCode: "",
    dateFrom: "",
    dateTo: "",
    reportable: "all",
    billable: "all",
    payrollEligible: "all",
  });
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");
  const [employees, setEmployees] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.User.filter({ role: "employee" }).catch(() => []),
    ]).then(([emps]) => {
      setEmployees(emps);
      setEntryTypes(getEntryTypeOptions());
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...timeEntries];

    if (filters.clientId) {
      result = result.filter((e) => e.client_id === filters.clientId);
    }
    if (filters.employeeId) {
      result = result.filter((e) => e.employee_id === filters.employeeId);
    }
    if (filters.entryTypeCode) {
      result = result.filter((e) => {
        const code = e.entry_type_code || e.entry_type || e.entry_type_key || "";
        return code === filters.entryTypeCode;
      });
    }
    if (filters.dateFrom) {
      result = result.filter((e) => e.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter((e) => e.date <= filters.dateTo);
    }
    if (filters.reportable !== "all") {
      const val = filters.reportable === "true";
      result = result.filter((e) => e.is_reportable === val);
    }
    if (filters.billable !== "all") {
      const val = filters.billable === "true";
      result = result.filter((e) => e.is_billable === val);
    }
    if (filters.payrollEligible !== "all") {
      const val = filters.payrollEligible === "true";
      result = result.filter((e) => e.is_payroll_eligible === val);
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [timeEntries, filters]);

  const totalMinutes = filtered.reduce(
    (sum, entry) => sum + Number(entry.duration_minutes || 0),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleEditEntry = async (entry) => {
    const code = await resolveEntryTypeCode(entry);
    setEditingEntry(entry);
    setSelectedEntryTypeCode(code);
    setShowForm(true);
  };

  const handleDuplicate = async (entry) => {
    try {
      const newEntry = { ...entry };
      delete newEntry.id;
      delete newEntry.created_date;
      delete newEntry.updated_date;

      if (entry.date) {
        newEntry.date = format(
          new Date(new Date(entry.date).getTime() + 86400000),
          "yyyy-MM-dd"
        );
      }

      await base44.entities.TimeEntry.create(newEntry);
      toast.success("Entry duplicated");
      onRefresh?.();
    } catch (err) {
      console.error("Failed to duplicate entry:", err);
      toast.error("Failed to duplicate entry");
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm("Delete this entry permanently?")) return;

    try {
      await base44.entities.TimeEntry.delete(entry.id);
      toast.success("Entry deleted");
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete entry:", err);
      toast.error("Failed to delete entry");
    }
  };

 const getEntryTypeDisplay = (entry) => {
  const rawCode =
    entry.entry_type_code ||
    entry.entry_type ||
    entry.entry_type_key ||
    entry.type ||
    entry.category ||
    "";

  const code = String(rawCode).toLowerCase();

  // 1. Try registry match first
  const match = entryTypes.find(
    (type) =>
      type.value === code ||
      type.code === code ||
      String(type.value).toLowerCase() === code
  );

  if (match?.label) return match.label;
  if (match?.name) return match.name;

  // 2. Known aliases
  if (ENTRY_TYPE_LABEL_ALIASES[code]) {
    return ENTRY_TYPE_LABEL_ALIASES[code];
  }

  // 3. Always show readable version of code
  if (code) {
    return code
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "Unknown Type";
};
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Time Log Dashboard
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {filtered.length} entries • {totalHours}h total
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters((prev) => !prev)}
              className="gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {Object.values(filters).some((value) => value && value !== "all") &&
                ` (${Object.values(filters).filter((value) => value && value !== "all").length})`}
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setEditingEntry(null);
                setSelectedEntryTypeCode("");
                setShowForm(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Entry
            </Button>
          </div>
        </div>
      </Card>

      {showFilters && (
        <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Client</Label>
            <Select
              value={filters.clientId || "all_clients"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  clientId: value === "all_clients" ? "" : value,
                }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_clients">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Employee</Label>
            <Select
              value={filters.employeeId || "all_employees"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  employeeId: value === "all_employees" ? "" : value,
                }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_employees">All employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Entry Type</Label>
            <Select
              value={filters.entryTypeCode || "all_types"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  entryTypeCode: value === "all_types" ? "" : value,
                }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">All types</SelectItem>
                {entryTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reportable</Label>
            <Select
              value={filters.reportable}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, reportable: value }))
              }
            >
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
            <Select
              value={filters.billable}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, billable: value }))
              }
            >
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
            <Select
              value={filters.payrollEligible}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, payrollEligible: value }))
              }
            >
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
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
              className="h-8 text-xs"
            />
          </div>

          <button
            onClick={() =>
              setFilters({
                clientId: clientId || "",
                employeeId: "",
                entryTypeCode: "",
                dateFrom: "",
                dateTo: "",
                reportable: "all",
                billable: "all",
                payrollEligible: "all",
              })
            }
            className="col-span-2 md:col-span-4 text-xs text-slate-600 hover:text-slate-800 font-medium"
          >
            Clear filters
          </button>
        </Card>
      )}

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {timeEntries.length === 0
              ? "No time entries yet"
              : "No entries match the current filters"}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((entry) => {
              const employee = employees.find((e) => e.id === entry.employee_id);

              return (
                <div
                  key={entry.id}
                  className="p-4 hover:bg-slate-50 transition-colors group space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-sm font-semibold text-slate-800 w-24 shrink-0">
                      {entry.date
                        ? format(new Date(`${entry.date}T00:00:00`), "MMM d, yyyy")
                        : "No date"}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getEntryTypeDisplay(entry)}
                        </Badge>
                        <span className="text-xs font-medium text-slate-600">
                          {formatDurationMinutes(entry.duration_minutes)}
                        </span>
                      </div>

                      {(employee?.full_name || entry.description) && (
                        <div className="flex gap-2 text-xs text-slate-600">
                          {employee?.full_name && <span>👤 {employee.full_name}</span>}
                          {entry.description && (
                            <span className="text-slate-500 italic line-clamp-1">
                              {entry.description}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleEditEntry(entry)}
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

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(entry)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingEntry(null);
            setSelectedEntryTypeCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
            <DialogTitle>
              {editingEntry ? "Edit Time Entry" : "Add Time Entry"}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4">
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
                      {entryTypes.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(() => {
                const activeEntryTypeCode =
                  selectedEntryTypeCode || editingEntry?.entry_type_code || "";

                if (!editingEntry && !activeEntryTypeCode) {
                  return (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Select an entry type above to begin
                    </div>
                  );
                }

                return (
                  <FormEngine
                    entryTypeCode={activeEntryTypeCode}
                    entry={editingEntry}
                    clientId={clientId}
                    mode={editingEntry ? "edit" : "create"}
                    onSave={async () => {
                      await onRefresh?.();
                      setShowForm(false);
                      setEditingEntry(null);
                      setSelectedEntryTypeCode("");
                    }}
                    onCancel={() => {
                      setShowForm(false);
                      setEditingEntry(null);
                      setSelectedEntryTypeCode("");
                    }}
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
