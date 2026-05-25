import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Plus, Pencil, Copy, Filter, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import FormEngine from "@/components/time-entry/FormEngine";
import { base44 } from "@/api/base44Client";
import {
  getEntryTypeOptions,
  normalizeEntryTypeCode,
} from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";

const timeLogDashboardApi = {
  async listEmployees() {
    try {
      const result = await base44.functions.invoke("getOrgUsers", {});
      const users = result?.data?.users || result?.data || [];
      return Array.isArray(users)
        ? users.filter((u) => ["employee", "management", "admin"].includes(u.role))
        : [];
    } catch (error) {
      console.error("[TimeLogDashboard] Failed to load employees:", error);
      return [];
    }
  },

  async createTimeEntry(payload) {
    return await base44.entities.TimeEntry.create(payload);
  },

  async deleteTimeEntry(id) {
    return await base44.entities.TimeEntry.delete(id);
  },
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

function getImmediateEntryTypeCode(entry) {
  return normalizeEntryTypeCode(
    entry?.entry_type_code ||
      entry?.entry_type ||
      entry?.entry_type_key ||
      entry?.type ||
      entry?.category ||
      entry?.entryTypeCode ||
      ""
  );
}

function buildDuplicatePayload(entry) {
  const payload = { ...entry };

  delete payload.id;
  delete payload.created_date;
  delete payload.updated_date;

  if (entry.date) {
    payload.date = addOneDayDateOnly(entry.date);
  }

  return payload;
}

function EmptyState({ message }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">
      {message}
    </Card>
  );
}

export default function TimeLogDashboard({
  timeEntries = [],
  client,
  clientId,
  clients = [],
  onRefresh,
  onEditEntry,
}) {
  const mountedRef = useRef(true);
  const resolveRunIdRef = useRef(0);

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
  const [showNonAttendanceDialog, setShowNonAttendanceDialog] = useState(false);
  const [savingNonAttendance, setSavingNonAttendance] = useState(false);
  const [nonAttendanceForm, setNonAttendanceForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    event_type: "no_show",
    description: "",
  });
  const [employees, setEmployees] = useState([]);
  const [resolvedEntryTypeCodes, setResolvedEntryTypeCodes] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [isDuplicatingId, setIsDuplicatingId] = useState(null);
  const [isDeletingId, setIsDeletingId] = useState(null);
  // Local override map: freshly-saved entries keyed by id.
  // Merged with the timeEntries prop so re-opening an entry uses the DB-fresh version
  // before the parent's React Query cache has been invalidated and refetched.
  const [savedEntryOverrides, setSavedEntryOverrides] = useState({});

  // Merge freshly-saved entry overrides with the incoming prop so the list
  // reflects the latest DB state even before React Query refetches.
  const effectiveTimeEntries = useMemo(() => {
    if (Object.keys(savedEntryOverrides).length === 0) return timeEntries;
    return timeEntries.map((e) => savedEntryOverrides[e.id] ?? e);
  }, [timeEntries, savedEntryOverrides]);

  const entryTypes = useMemo(() => getEntryTypeOptions(), []);

  const entryTypeLabelByCode = useMemo(() => {
    const map = {};
    for (const type of entryTypes) {
      const normalizedCode = normalizeEntryTypeCode(type?.code || "");
      if (normalizedCode) {
        map[normalizedCode] = type.label || normalizedCode;
      }
    }
    return map;
  }, [entryTypes]);

  const getResolvedEntryTypeCode = useCallback(
    (entry) => {
      return (
        normalizeEntryTypeCode(resolvedEntryTypeCodes[entry?.id]) ||
        getImmediateEntryTypeCode(entry) ||
        ""
      );
    },
    [resolvedEntryTypeCodes]
  );

  const getResolvedEntryTypeLabel = useCallback(
    (entry) => {
      const directLabel =
        entry?.entry_type_name ||
        entry?.entry_type_label ||
        entry?.type_name ||
        entry?.type_label ||
        entry?.service_type_name ||
        "";

      if (directLabel) return directLabel;

      const resolvedCode = getResolvedEntryTypeCode(entry);
      if (resolvedCode && entryTypeLabelByCode[resolvedCode]) {
        return entryTypeLabelByCode[resolvedCode];
      }

      if (resolvedCode) {
        return resolvedCode
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      }

      return "Unknown Type";
    },
    [entryTypeLabelByCode, getResolvedEntryTypeCode]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      const nextEmployees = await timeLogDashboardApi.listEmployees();
      if (cancelled || !mountedRef.current) return;
      setEmployees(nextEmployees);
    }

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const nextClientId = clientId || "";
      if (prev.clientId === nextClientId) return prev;
      return { ...prev, clientId: nextClientId };
    });
  }, [clientId]);

  useEffect(() => {
    const directMap = {};
    const needsAsync = [];

    for (const entry of timeEntries) {
      const directCode = getImmediateEntryTypeCode(entry);
      if (directCode) {
        directMap[entry.id] = directCode;
      } else if (entry?.id) {
        needsAsync.push(entry);
      }
    }

    setResolvedEntryTypeCodes((prev) => {
      const merged = { ...prev };
      let changed = false;

      for (const [id, code] of Object.entries(directMap)) {
        if ((merged[id] || "") !== code) {
          merged[id] = code;
          changed = true;
        }
      }

      for (const existingId of Object.keys(merged)) {
        const stillExists = timeEntries.some((entry) => entry?.id === existingId);
        if (!stillExists) {
          delete merged[existingId];
          changed = true;
        }
      }

      return changed ? merged : prev;
    });

    if (!needsAsync.length) return;

    const runId = ++resolveRunIdRef.current;
    let cancelled = false;

    async function resolveMissingCodes() {
      const asyncPairs = await Promise.all(
        needsAsync.map(async (entry) => {
          try {
            const resolvedCode = await resolveEntryTypeCode(entry);
            return [entry.id, normalizeEntryTypeCode(resolvedCode) || ""];
          } catch (error) {
            console.error("[TimeLogDashboard] Failed to resolve entry type code:", error);
            return [entry.id, ""];
          }
        })
      );

      if (cancelled || !mountedRef.current || resolveRunIdRef.current !== runId) {
        return;
      }

      setResolvedEntryTypeCodes((prev) => {
        const merged = { ...prev };
        let changed = false;

        for (const [id, code] of asyncPairs) {
          if (code && (merged[id] || "") !== code) {
            merged[id] = code;
            changed = true;
          }
        }

        return changed ? merged : prev;
      });
    }

    resolveMissingCodes();

    return () => {
      cancelled = true;
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
    let result = Array.isArray(effectiveTimeEntries) ? [...effectiveTimeEntries] : [];

    if (filters.clientId) {
      result = result.filter((entry) => entry.client_id === filters.clientId);
    }

    if (filters.employeeId) {
      result = result.filter((entry) => entry.employee_id === filters.employeeId);
    }

    if (filters.entryTypeCode) {
      const normalizedFilter =
        normalizeEntryTypeCode(filters.entryTypeCode) || filters.entryTypeCode;

      result = result.filter((entry) => {
        const resolvedCode = getResolvedEntryTypeCode(entry);
        return (
          String(resolvedCode).toLowerCase() === String(normalizedFilter).toLowerCase()
        );
      });
    }

    if (filters.dateFrom) {
      result = result.filter((entry) => entry.date && entry.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      result = result.filter((entry) => entry.date && entry.date <= filters.dateTo);
    }

    if (filters.reportable !== "all") {
      const val = filters.reportable === "true";
      result = result.filter((entry) => Boolean(entry.is_reportable) === val);
    }

    if (filters.billable !== "all") {
      const val = filters.billable === "true";
      result = result.filter((entry) => Boolean(entry.is_billable) === val);
    }

    if (filters.payrollEligible !== "all") {
      const val = filters.payrollEligible === "true";
      result = result.filter((entry) => Boolean(entry.is_payroll_eligible) === val);
    }

    result.sort((a, b) => {
      const aDate = parseDateOnly(a.date);
      const bDate = parseDateOnly(b.date);

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return bDate.getTime() - aDate.getTime();
    });

    return result;
  }, [timeEntries, filters, getResolvedEntryTypeCode]);

  const totalMinutes = useMemo(() => {
    return filtered.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  }, [filtered]);

  const totalHours = useMemo(() => {
    return (totalMinutes / 60).toFixed(1);
  }, [totalMinutes]);

  // Clear overrides when parent refreshes (new timeEntries prop reference means refetch completed)
  const prevTimeEntriesRef = useRef(timeEntries);
  useEffect(() => {
    if (prevTimeEntriesRef.current !== timeEntries) {
      prevTimeEntriesRef.current = timeEntries;
      setSavedEntryOverrides({});
    }
  }, [timeEntries]);

    const resetFormState = useCallback(() => {
    setShowForm(false);
    setEditingEntry(null);
    setSelectedEntryTypeCode("");
  }, []);

  const resetNonAttendanceDialog = useCallback(() => {
    setShowNonAttendanceDialog(false);
    setSavingNonAttendance(false);
    setNonAttendanceForm({
      date: format(new Date(), "yyyy-MM-dd"),
      event_type: "no_show",
      description: "",
    });
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

  const handleAddEntry = useCallback(() => {
    setEditingEntry(null);
    setSelectedEntryTypeCode("");
    setShowForm(true);
  }, []);

  const handleEditEntry = useCallback(
    async (entry) => {
      if (typeof onEditEntry === "function") {
        await onEditEntry(entry);
        return;
      }

      // Use the freshly-saved override if available, so form_data is current.
      const freshEntry = savedEntryOverrides[entry?.id] ?? entry;
      const resolvedCode = getResolvedEntryTypeCode(freshEntry);

      setEditingEntry(freshEntry);
      setSelectedEntryTypeCode(resolvedCode);
      setShowForm(true);
    },
    [onEditEntry, getResolvedEntryTypeCode, savedEntryOverrides]
  );

  const handleSaveNonAttendance = useCallback(async () => {
    const description = nonAttendanceForm.description.trim();

    if (!clientId) {
      toast.error("Client could not be identified.");
      return;
    }

    if (!nonAttendanceForm.date) {
      toast.error("Please select a date.");
      return;
    }

    if (!description) {
      toast.error("Please enter a note.");
      return;
    }

    try {
      setSavingNonAttendance(true);

      const currentUser = await base44.auth.me();

      if (!currentUser?.id) {
        toast.error("Staff user could not be identified.");
        setSavingNonAttendance(false);
        return;
      }

      await timeLogDashboardApi.createTimeEntry({
        org_id: currentUser.org_id || client?.org_id || "",
        client_id: clientId,
        employee_id: currentUser.id,
        entry_type_code: "client_non_attendance",
        date: nonAttendanceForm.date,
        start_time: "",
        end_time: "",
        duration_minutes: 0,
        description,
        form_data: {
          event_type: nonAttendanceForm.event_type,
          event_label: nonAttendanceForm.event_type.replace(/_/g, " "),
          description,
          created_from: "client_detail_time_log",
        },
        is_billable: false,
        is_payroll_eligible: false,
        is_reportable: false,
        status: "submitted",
      });

      toast.success("No-show/cancellation record added");
      resetNonAttendanceDialog();
      await onRefresh?.();
    } catch (error) {
      console.error("[TimeLogDashboard] Failed to save no-show/cancellation record:", error);
      toast.error("Failed to save record");
      setSavingNonAttendance(false);
    }
  }, [client, clientId, nonAttendanceForm, onRefresh, resetNonAttendanceDialog]);
  
  const handleDuplicate = useCallback(
    async (entry) => {
      try {
        setIsDuplicatingId(entry.id);
        const payload = buildDuplicatePayload(entry);
        await timeLogDashboardApi.createTimeEntry(payload);
        toast.success("Entry duplicated");
        await onRefresh?.();
      } catch (error) {
        console.error("[TimeLogDashboard] Failed to duplicate entry:", error);
        toast.error("Failed to duplicate entry");
      } finally {
        if (mountedRef.current) {
          setIsDuplicatingId(null);
        }
      }
    },
    [onRefresh]
  );

  const handleDelete = useCallback(
    async (entry) => {
      if (!window.confirm("Delete this entry permanently?")) return;

      try {
        setIsDeletingId(entry.id);
        await timeLogDashboardApi.deleteTimeEntry(entry.id);
        toast.success("Entry deleted");
        await onRefresh?.();
      } catch (error) {
        console.error("[TimeLogDashboard] Failed to delete entry:", error);
        toast.error("Failed to delete entry");
      } finally {
        if (mountedRef.current) {
          setIsDeletingId(null);
        }
      }
    },
    [onRefresh]
  );

  const activeEntryTypeCode =
    selectedEntryTypeCode || getResolvedEntryTypeCode(editingEntry) || "";

  return (
    <>
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Time Log Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              {filtered.length} entries • {totalHours}h total
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters(filters) ? ` (${activeFilterCount(filters)})` : ""}
            </Button>

                       {clientId ? (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setShowNonAttendanceDialog(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                No-Show / Cancellation
              </Button>
            ) : null}

            <Button className="gap-1.5" onClick={handleAddEntry}>
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </div>
        </div>

        {showFilters ? (
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {!clientId ? (
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Select
                    value={filters.clientId || "all_clients"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        clientId: value === "all_clients" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_clients">All clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.first_name || client.last_name
                            ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                            : client.full_name || client.email || "Unknown client"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select
                  value={filters.employeeId || "all_employees"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      employeeId: value === "all_employees" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
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
                <Label>Entry Type</Label>
                <Select
                  value={filters.entryTypeCode || "all_types"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      entryTypeCode: value === "all_types" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
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
                <Label>Reportable</Label>
                <Select
                  value={filters.reportable}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, reportable: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Billable</Label>
                <Select
                  value={filters.billable}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, billable: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Payroll Eligible</Label>
                <Select
                  value={filters.payrollEligible}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, payrollEligible: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button variant="ghost" onClick={resetFilters}>
                Clear
              </Button>
            </div>
          </Card>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState message="No time entries match the current filters." />
        ) : (
          <div className="space-y-3">
                       {filtered.map((entry) => {
              const employee = employeeById[entry.employee_id];
              const client = clientById[entry.client_id];
              const isNonAttendance =
                getResolvedEntryTypeCode(entry) === "client_non_attendance";

              const nonAttendanceLabel =
                entry.form_data?.event_label ||
                entry.form_data?.event_type?.replace(/_/g, " ") ||
                "No-show / cancellation";

              return (
                <Card key={entry.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {entry.date
                            ? format(new Date(`${entry.date}T00:00:00`), "MMM d, yyyy")
                            : "No date"}
                        </span>

                                                {isNonAttendance ? (
                          <>
                            <Badge className="bg-red-100 text-red-700">
                              No-show / cancellation
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {nonAttendanceLabel}
                            </Badge>
                            <Badge variant="outline">0 min</Badge>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">
                              {getResolvedEntryTypeLabel(entry)}
                            </Badge>

                            <Badge variant="outline">
                              {formatDurationMinutes(entry.duration_minutes)}
                            </Badge>

                            {entry.is_reportable ? (
                              <Badge className="bg-blue-600 text-white">
                                Reportable
                              </Badge>
                            ) : null}
                            {entry.is_billable ? (
                              <Badge className="bg-blue-600 text-white">
                                Billable
                              </Badge>
                            ) : null}
                            {entry.is_payroll_eligible ? (
                              <Badge className="bg-blue-600 text-white">
                                Payroll
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </div>

                                            <div className="text-sm text-muted-foreground">
                        {isNonAttendance ? (
                          <div>
                            <p className="font-medium capitalize text-slate-900">
                              {nonAttendanceLabel}
                            </p>
                            <p className="mt-1">
                              {entry.description || "No note entered"}
                            </p>
                          </div>
                        ) : (
                          entry.description || "No description"
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {client && !clientId ? (
                          <span>
                            Client:{" "}
                            {client.first_name || client.last_name
                              ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                              : client.full_name || client.email || "Unknown client"}
                          </span>
                        ) : null}

                        {employee?.full_name ? (
                          <span>Employee: {employee.full_name}</span>
                        ) : null}

                        {entry.start_time && entry.end_time ? (
                          <span>
                            {entry.start_time} - {entry.end_time}
                          </span>
                        ) : null}
                      </div>
                    </div>

                                       <div className="flex flex-wrap gap-2">
                      {isNonAttendance ? (
                        <Badge className="bg-slate-100 text-slate-700">
                          Staff record
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleEditEntry(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleDuplicate(entry)}
                            disabled={isDuplicatingId === entry.id}
                          >
                            <Copy className="h-4 w-4" />
                            {isDuplicatingId === entry.id ? "Duplicating..." : "Duplicate"}
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(entry)}
                        disabled={isDeletingId === entry.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeletingId === entry.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            resetFormState();
          } else {
            setShowForm(true);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Time Entry" : "Add Time Entry"}
            </DialogTitle>
          </DialogHeader>

          {!editingEntry ? (
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select
                value={selectedEntryTypeCode}
                onValueChange={(value) => setSelectedEntryTypeCode(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entry type" />
                </SelectTrigger>
                             <SelectContent position="popper" sideOffset={4} className="max-h-[45vh] overflow-y-auto">
                  {entryTypes.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {editingEntry ? (
                       <FormEngine
              key={`edit-${editingEntry.id}-${activeEntryTypeCode}`}
              entry={editingEntry}
              clientId={editingEntry.client_id || clientId}
                           clientTargetRole={
                client?.target_role ||
                clientById[editingEntry.client_id || clientId]?.target_role ||
                ""
              }
              entryTypeCode={activeEntryTypeCode}
              onSaved={async (savedEntry) => {
                if (savedEntry?.id) {
                  // Store the fresh DB entry so re-opening from the list
                  // uses the saved form_data before React Query refetches.
                  setSavedEntryOverrides((prev) => ({ ...prev, [savedEntry.id]: savedEntry }));
                  setEditingEntry(savedEntry);
                }
                await onRefresh?.();
                resetFormState();
              }}
              onCancel={resetFormState}
            />
          ) : selectedEntryTypeCode ? (
                       <FormEngine
              key={`create-${clientId || "none"}-${selectedEntryTypeCode}`}
              clientId={clientId || filters.clientId || ""}
                            clientTargetRole={
                client?.target_role ||
                clientById[clientId || filters.clientId]?.target_role ||
                ""
              }
              entryTypeCode={selectedEntryTypeCode}
              onSaved={async () => {
                await onRefresh?.();
                resetFormState();
              }}
              onCancel={resetFormState}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Select an entry type above to begin
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
