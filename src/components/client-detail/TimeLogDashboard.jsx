import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Copy, Filter, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import FormEngine from "@/components/time-entry/FormEngine";
import { getEntryTypeOptions, normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";
import { getEntryTypeLabel } from "@/lib/getEntryTypeLabel";

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

function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== "string") return null;

  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addOneDayDateOnly(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return dateString || "";

  const next = new Date(parsed);
  next.setDate(next.getDate() + 1);
  return format(next, "yyyy-MM-dd");
}

function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value && value !== "all");
}

function activeFilterCount(filters) {
  return Object.values(filters).filter((value) => value && value !== "all").length;
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
  const [resolvedEntryTypeCodes, setResolvedEntryTypeCodes] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const entryTypes = useMemo(() => getEntryTypeOptions(), []);

  useEffect(() => {
    let active = true;

    base44.entities.User.filter({ role: "employee" })
      .then((emps) => {
        if (!active) return;
        setEmployees(Array.isArray(emps) ? emps : []);
      })
      .catch(() => {
        if (!active) return;
        setEmployees([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      if (prev.clientId === (clientId || "")) return prev;
      return { ...prev, clientId: clientId || "" };
    });
  }, [clientId]);

  useEffect(() => {
    let active = true;

    async function resolveAllEntryTypeCodes() {
      if (!timeEntries?.length) {
        setResolvedEntryTypeCodes({});
        return;
      }

      const immediatePairs = [];
      const needsAsync = [];

      for (const entry of timeEntries) {
        const directCode =
          entry?.entry_type_code ||
          entry?.entry_type ||
          entry?.entry_type_key ||
          entry?.type ||
          entry?.category ||
          "";

        if (directCode) {
          immediatePairs.push([entry.id, normalizeEntryTypeCode(directCode) || directCode]);
        } else {
          needsAsync.push(entry);
        }
      }

      const baseMap = Object.fromEntries(immediatePairs);

      if (!needsAsync.length) {
        if (active) {
          setResolvedEntryTypeCodes(baseMap);
        }
        return;
      }

      const asyncPairs = await Promise.all(
        needsAsync.map(async (entry) => {
          try {
            const resolvedCode = await resolveEntryTypeCode(entry);
            return [entry.id, resolvedCode || ""];
          } catch (error) {
            console.error("[TimeLogDashboard] Failed to resolve entry type code for row:", error);
            return [entry.id, ""];
          }
        })
      );

      if (!active) return;

      setResolvedEntryTypeCodes({
        ...baseMap,
        ...Object.fromEntries(asyncPairs),
      });
    }

    resolveAllEntryTypeCodes();

    return () => {
      active = false;
    };
  }, [timeEntries]);

  const employeeById = useMemo(() => {
    const map = {};
    for (const employee of employees) {
      map[employee.id] = employee;
    }
    return map;
  }, [employees]);

  const clientById = useMemo(() => {
    const map = {};
    for (const client of clients) {
      map[client.id] = client;
    }
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    let result = [...timeEntries];

    if (filters.clientId) {
      result = result.filter((e) => e.client_id === filters.clientId);
    }

    if (filters.employeeId) {
      result = result.filter((e) => e.employee_id === filters.employeeId);
    }

    if (filters.entryTypeCode) {
      const normalizedFilter = normalizeEntryTypeCode(filters.entryTypeCode) || filters.entryTypeCode;

      result = result.filter((e) => {
        const code =
          resolvedEntryTypeCodes[e.id] ||
          e.entry_type_code ||
          e.entry_type ||
          e.entry_type_key ||
          e.type ||
          e.category ||
          "";

        const normalizedCode = normalizeEntryTypeCode(code) || code;
        return String(normalizedCode).toLowerCase() === String(normalizedFilter).toLowerCase();
      });
    }

    if (filters.dateFrom) {
      result = result.filter((e) => e.date && e.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      result = result.filter((e) => e.date && e.date <= filters.dateTo);
    }

    if (filters.reportable !== "all") {
      const val = filters.reportable === "true";
      result = result.filter((e) => Boolean(e.is_reportable) === val);
    }

    if (filters.billable !== "all") {
      const val = filters.billable === "true";
      result = result.filter((e) => Boolean(e.is_billable) === val);
    }

    if (filters.payrollEligible !== "all") {
      const val = filters.payrollEligible === "true";
      result = result.filter((e) => Boolean(e.is_payroll_eligible) === val);
    }

    return result.sort((a, b) => {
      const aDate = parseDateOnly(a.date);
      const bDate = parseDateOnly(b.date);

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return bDate.getTime() - aDate.getTime();
    });
  }, [timeEntries, filters, resolvedEntryTypeCodes]);

  const totalMinutes = useMemo(() => {
    return filtered.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  }, [filtered]);

  const totalHours = useMemo(() => {
    return (totalMinutes / 60).toFixed(1);
  }, [totalMinutes]);

  const handleEditEntry = useCallback(async (entry) => {
    if (typeof onEditEntry === "function") {
      await onEditEntry(entry);
      return;
    }

    const code =
      resolvedEntryTypeCodes[entry.id] || (await resolveEntryTypeCode(entry));

    setEditingEntry(entry);
    setSelectedEntryTypeCode(code || "");
    setShowForm(true);
  }, [onEditEntry, resolvedEntryTypeCodes]);

  const handleDuplicate = useCallback(async (entry) => {
    try {
      const newEntry = { ...entry };
      delete newEntry.id;
      delete newEntry.created_date;
      delete newEntry.updated_date;

      if (entry.date) {
        newEntry.date = addOneDayDateOnly(entry.date);
      }

      await base44.entities.TimeEntry.create(newEntry);
      toast.success("Entry duplicated");
      await onRefresh?.();
    } catch (err) {
      console.error("Failed to duplicate entry:", err);
      toast.error("Failed to duplicate entry");
    }
  }, [onRefresh]);

  const handleDelete = useCallback(async (entry) => {
    if (!window.confirm("Delete this entry permanently?")) return;

    try {
      await base44.entities.TimeEntry.delete(entry.id);
      toast.success("Entry deleted");
      await onRefresh?.();
    } catch (err) {
      console.error("Failed to delete entry:", err);
      toast.error("Failed to delete entry");
    }
  }, [onRefresh]);

  const getEntryTypeDisplay = useCallback((entry) => {
    const directLabel =
      entry.entry_type_name ||
      entry.entry_type_label ||
      entry.type_name ||
      entry.type_label ||
      "";

    if (directLabel) {
      return directLabel;
    }

    return getEntryTypeLabel(entry, resolvedEntryTypeCodes);
  }, [resolvedEntryTypeCodes]);

  const resetFormState = useCallback(() => {
    setShowForm(false);
    setEditingEntry(null);
    setSelectedEntryTypeCode("");
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      clientId: clientId || "",
      employeeId: "",
      entryTypeCode: "",
      dateFrom: "",
      dateTo: "",
      reportable: "all",
      billable: "all",
      payrollEligible: "all",
    });
  }, [clientId]);

  const activeEntryTypeCode =
    selectedEntryTypeCode ||
    editingEntry?.entry_type_code ||
    editingEntry?.entry_type ||
    editingEntry?.entry_type_key ||
    "";

  return (
    <Card className="p-4 md:p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Time Log Dashboard</h3>
          <p className="text-sm text-slate-600">
            {filtered.length} entries • {totalHours}h total
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
            className="gap-1.5"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters(filters) ? ` (${activeFilterCount(filters)})` : ""}
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
            <Plus className="w-4 h-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Client</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Employee</Label>
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
                    {employee.full_name || employee.email || "Unknown employee"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Entry Type</Label>
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
                  <SelectItem key={type.code} value={type.code}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Reportable</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Billable</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Payroll Eligible</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">From</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">To</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
              className="h-8 text-xs"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
          {timeEntries.length === 0
            ? "No time entries yet"
            : "No entries match the current filters"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const employee = employeeById[entry.employee_id];
            const client = clientById[entry.client_id];

            return (
              <div
                key={entry.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {entry.date
                          ? format(new Date(`${entry.date}T00:00:00`), "MMM d, yyyy")
                          : "No date"}
                      </Badge>

                      <Badge variant="outline">
                        {getEntryTypeDisplay(entry)}
                      </Badge>

                      <Badge variant="outline">
                        {formatDurationMinutes(entry.duration_minutes)}
                      </Badge>

                      {entry.is_reportable && <Badge>Reportable</Badge>}
                      {entry.is_billable && <Badge>Billable</Badge>}
                      {entry.is_payroll_eligible && <Badge>Payroll</Badge>}
                    </div>

                    <div className="text-sm text-slate-900 whitespace-pre-wrap">
                      {entry.description || "No description"}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {client && (
                        <span>
                          Client: {client.first_name} {client.last_name}
                        </span>
                      )}

                      {employee?.full_name && (
                        <span>Employee: {employee.full_name}</span>
                      )}

                      {entry.start_time && (
                        <span>
                          Time: {entry.start_time}
                          {entry.end_time ? ` - ${entry.end_time}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditEntry(entry)}
                      className="gap-1.5"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(entry)}
                      className="gap-1.5"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(entry)}
                      className="gap-1.5 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            resetFormState();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Time Entry" : "Add Time Entry"}
            </DialogTitle>
          </DialogHeader>

          {!editingEntry && (
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select
                value={selectedEntryTypeCode}
                onValueChange={setSelectedEntryTypeCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entry type" />
                </SelectTrigger>
                <SelectContent>
                  {entryTypes.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(() => {
            const normalizedActiveCode = normalizeEntryTypeCode(activeEntryTypeCode) || activeEntryTypeCode;

            if (!editingEntry && !normalizedActiveCode) {
              return (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                  Select an entry type above to begin
                </div>
              );
            }

            return (
              <FormEngine
                mode={editingEntry ? "edit" : "create"}
                entry={editingEntry || null}
                clientId={clientId || editingEntry?.client_id || null}
                entryTypeCode={normalizedActiveCode}
                onSave={async () => {
                  await onRefresh?.();
                  resetFormState();
                }}
                onCancel={resetFormState}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
