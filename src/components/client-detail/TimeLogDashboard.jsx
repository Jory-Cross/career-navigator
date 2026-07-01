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
import { Plus, Pencil, Filter, Trash2, AlertTriangle } from "lucide-react";
import AuthorizationHoursCards from "@/components/client-detail/AuthorizationHoursCards";
import { cn } from "@/lib/utils";
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
    const currentUser = await base44.auth.me().catch(() => null);

    if (!currentUser?.id) {
      return [];
    }

    const currentRole = String(
      currentUser.role || ""
    ).toLowerCase();

    if (
      currentRole !== "admin" &&
      currentRole !== "management"
    ) {
      return [
        {
          id: currentUser.id,
          full_name: currentUser.full_name || "",
          email: currentUser.email || "",
          role: currentUser.role || "",
        },
      ];
    }

    try {
      const result = await base44.functions.invoke(
        "getOrgUsers",
        {}
      );

      const users = result?.data?.users || result?.data || [];

      return Array.isArray(users)
        ? users.filter((user) =>
            ["employee", "management", "admin"].includes(
              user.role
            )
          )
        : [];
    } catch (error) {
      console.error(
        "[TimeLogDashboard] Failed to load employees:",
        error
      );
      return [];
    }
  },

    async deleteTimeEntry(id) {
    const response = await base44.functions.invoke(
      "mutateAuthorizedTimeEntry",
      {
        action: "delete",
        entry_id: id,
        time_entry: {},
      }
    );

    const data = response?.data || response || {};

    if (!data.ok || data.action !== "delete") {
      throw new Error(
        data.error || "Secure TimeEntry deletion failed."
      );
    }

    return data;
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

function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value && value !== "all");
}

function activeFilterCount(filters) {
  return Object.values(filters).filter((value) => value && value !== "all").length;
}

const PLACEHOLDER_VALUES = new Set(["No description", "Session", ""]);

function getEntryDisplayText(entry, fallback = "No description") {
  const fd = entry?.form_data || {};
  const candidates = [
    entry?.description,
    fd.description,
    fd.development_activity,
    fd.activity_description,
    fd.development_activity_description,
    fd.job_development_activity_description,
    fd.job_dev_activity_description,
    fd.job_development_activity,
    fd.job_coaching_activity,
    fd.activity,
    fd.job_coaching,
    fd.individual_support,
    fd.community_outreach,
    fd.job_application_process,
    fd.resume_writing,
    fd.job_interview_process,
    fd.specific_skill_taught,
    fd.life_skills_area,
    fd.observations_comments,
  ];
  for (const val of candidates) {
    if (val && !PLACEHOLDER_VALUES.has(val.trim())) return val.trim();
  }
  return fallback;
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

function getEntryTypeColorClasses(entryTypeCode) {
  const code = normalizeEntryTypeCode(entryTypeCode);

  if (code === "client_non_attendance") {
    return {
      card: "border-red-200 bg-red-50/50",
      badge: "bg-red-100 text-red-700 border-red-200",
    };
  }

  if (code === "admin_time") {
    return {
      card: "border-slate-200 bg-slate-50/70",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  if (code === "dspd") {
    return {
      card: "border-purple-200 bg-purple-50/50",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
    };
  }

  if (code === "job_coaching") {
    return {
      card: "border-blue-200 bg-blue-50/50",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  if (code === "job_development") {
    return {
      card: "border-green-200 bg-green-50/50",
      badge: "bg-green-100 text-green-700 border-green-200",
    };
  }

  if (code === "life_skills") {
    return {
      card: "border-teal-200 bg-teal-50/50",
      badge: "bg-teal-100 text-teal-700 border-teal-200",
    };
  }

  if (code === "pre_ets_training") {
    return {
      card: "border-indigo-200 bg-indigo-50/50",
      badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }

  return {
    card: "border-slate-200 bg-white",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  };
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
  onClientUpdate,
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

    const eventLabel = nonAttendanceForm.event_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    try {
      setSavingNonAttendance(true);

      const response = await base44.functions.invoke(
        "mutateAuthorizedTimeEntry",
        {
          action: "create",
          time_entry: {
            client_id: clientId,
            entry_type_code: "client_non_attendance",
            date: nonAttendanceForm.date,
            duration_minutes: 0,
            description: `${eventLabel}: ${description}`,
            status: "submitted",
          },
        }
      );

      const data = response?.data || response || {};

      if (!data.ok || !data.entry?.id) {
        throw new Error(
          data.error ||
            "Secure no-show/cancellation record creation failed."
        );
      }

      toast.success("No-show/cancellation record added");
      resetNonAttendanceDialog();
      await onRefresh?.();
    } catch (error) {
      const serverData =
        error?.response?.data ||
        error?.data ||
        {};

      const message =
        serverData?.error ||
        error?.message ||
        "Failed to save record";

      console.error(
        "[TimeLogDashboard] Failed to save no-show/cancellation record:",
        error
      );
      toast.error(message);
      setSavingNonAttendance(false);
    }
  }, [clientId, nonAttendanceForm, onRefresh, resetNonAttendanceDialog]);
  
    const handleDuplicate = useCallback(
    async (entry) => {
      try {
        setIsDuplicatingId(entry.id);

        await timeLogDashboardApi.duplicateTimeEntry(entry);

        toast.success("Entry duplicated");
        await onRefresh?.();
      } catch (error) {
        const serverData =
          error?.response?.data ||
          error?.data ||
          {};

        const message =
          serverData?.error ||
          error?.message ||
          "Failed to duplicate entry";

        console.error(
          "[TimeLogDashboard] Failed to duplicate entry:",
          error
        );
        toast.error(message);
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

        {/* Authorization hour tracking cards — only show when viewing a specific client */}
        {clientId && client && (
          <AuthorizationHoursCards
            client={client}
            timeEntries={effectiveTimeEntries}
            selectedMonth={filters.dateFrom ? filters.dateFrom.substring(0, 7) : undefined}
            onClientUpdate={onClientUpdate || onRefresh}
          />
        )}

        {filtered.length === 0 ? (
          <EmptyState message="No time entries match the current filters." />
        ) : (
          <div className="space-y-3">
                       {filtered.map((entry) => {
              const employee = employeeById[entry.employee_id];
              const client = clientById[entry.client_id];
              const entryTypeCode = getResolvedEntryTypeCode(entry);
              const entryColors = getEntryTypeColorClasses(entryTypeCode);
              const isNonAttendance =
                entryTypeCode === "client_non_attendance";

              const nonAttendanceLabel =
                entry.form_data?.event_label ||
                entry.form_data?.event_type?.replace(/_/g, " ") ||
                "No-show / cancellation";

              return (
                  <Card key={entry.id} className={cn("p-4", entryColors.card)}>
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
                            <Badge className={entryColors.badge}>
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
                          getEntryDisplayText(entry)
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
        open={showNonAttendanceDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetNonAttendanceDialog();
          } else {
            setShowNonAttendanceDialog(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>No-Show / Cancellation Record</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Use this to document a client no-show, cancellation, or related staff note. This creates a staff record with 0 hours and does not count toward payroll.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <input
                  type="date"
                  value={nonAttendanceForm.date}
                  onChange={(e) =>
                    setNonAttendanceForm((form) => ({
                      ...form,
                      date: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={nonAttendanceForm.event_type}
                  onValueChange={(value) =>
                    setNonAttendanceForm((form) => ({
                      ...form,
                      event_type: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_show">No show</SelectItem>
                    <SelectItem value="late_cancellation">Late cancellation</SelectItem>
                    <SelectItem value="excused_cancellation">Excused cancellation</SelectItem>
                    <SelectItem value="transportation_issue">Transportation issue</SelectItem>
                    <SelectItem value="client_unavailable">Client unavailable</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <textarea
                value={nonAttendanceForm.description}
                onChange={(e) =>
                  setNonAttendanceForm((form) => ({
                    ...form,
                    description: e.target.value,
                  }))
                }
                placeholder="Example: Client cancelled 20 minutes before scheduled service. Staff attempted contact and documented cancellation."
                className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={resetNonAttendanceDialog}
                disabled={savingNonAttendance}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveNonAttendance}
                disabled={savingNonAttendance}
              >
                {savingNonAttendance ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
