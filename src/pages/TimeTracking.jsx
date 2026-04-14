import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useViewAs } from "@/lib/ViewAsContext";
import {
  getCurrentUser,
  getAllUsers,
  getAllClients,
  getAllTimeEntries,
  getScopedUsers,
  getScopedClients,
} from "@/lib/api/clientPortalApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { User, Filter, AlertTriangle, Pencil, Plus } from "lucide-react";
import FormEngine from "@/components/time-entry/FormEngine";
import LegacyDataWarning from "@/components/shared/LegacyDataWarning";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getEntryTypeOptions, normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";
import { getEntryTypeLabel } from "@/lib/getEntryTypeLabel";

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

function formatShortEntryDate(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return "";
  return format(parsed, "MMM d");
}

function formatLongEntryDate(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return "—";
  return format(parsed, "MMM d, yyyy");
}

function formatDurationMinutes(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "0m";
  if (total < 60) return `${total}m`;

  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function getImmediateEntryTypeCode(entry) {
  return normalizeEntryTypeCode(
    entry?.entry_type_code ||
      entry?.entry_type ||
      entry?.entry_type_key ||
      entry?.type ||
      entry?.category ||
      ""
  );
}

export default function TimeTracking() {
  const { viewAsUser } = useViewAs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mountedRef = useRef(true);
  const resolveRunIdRef = useRef(0);

  const [periodFilter, setPeriodFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const [user, setUser] = useState(null);

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingEntryTypeCode, setEditingEntryTypeCode] = useState("");

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");

  const [resolvedEntryTypeCodes, setResolvedEntryTypeCodes] = useState({});

  const entryTypes = useMemo(() => getEntryTypeOptions(), []);

  useEffect(() => {
  mountedRef.current = true;
  getCurrentUser()
    .then((result) => {
      if (mountedRef.current) {
        setUser(result);
      }
    })
    .catch(() => {});
  return () => {
    mountedRef.current = false;
  };
}, []);

  const effectiveUser = user?.role === "admin" && viewAsUser ? viewAsUser : user;

  const { data: allUsers = [] } = useQuery({
  queryKey: ["timeTracking", "users"],
  queryFn: getAllUsers,
  enabled: !!user && (user.role === "admin" || user.role === "management"),
  staleTime: 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
});

  const scopedUsers = useMemo(() => {
  return getScopedUsers(allUsers, effectiveUser);
}, [allUsers, effectiveUser]);

const filterableEmployees = useMemo(() => {
  return scopedUsers.filter((u) => {
    if (u.is_archived) return false;

    if (effectiveUser?.role === "management") {
      return u.role === "employee" && u.manager_id === effectiveUser.id;
    }

    if (user?.role === "admin" && !viewAsUser) {
      return u.role === "employee" || u.role === "management";
    }

    return false;
  });
}, [scopedUsers, effectiveUser, user, viewAsUser]);

  const { data: rawClients = [] } = useQuery({
  queryKey: ["timeTracking", "clients"],
  queryFn: getAllClients,
  enabled: !!effectiveUser,
  staleTime: 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
});

const allClients = useMemo(() => {
  return getScopedClients(rawClients, effectiveUser, allUsers);
}, [rawClients, effectiveUser, allUsers]);

  const { data: timeEntries = [] } = useQuery({
  queryKey: ["timeTracking", "entries"],
  queryFn: getAllTimeEntries,
  enabled: !!effectiveUser,
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
});

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
      const next = { ...directMap };
      const sameSize = Object.keys(prev).length === Object.keys(next).length;
      const sameValues =
        sameSize && Object.keys(next).every((key) => prev[key] === next[key]);
      return sameValues ? prev : next;
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
            console.error("[TimeTracking] Failed to resolve entry type code:", error);
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
          if ((merged[id] || "") !== (code || "")) {
            merged[id] = code || "";
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
    for (const employee of filterableEmployees) {
      map[employee.id] = employee;
    }
    return map;
  }, [filterableEmployees]);

  const clientById = useMemo(() => {
    const map = {};
    for (const client of allClients) {
      map[client.id] = client;
    }
    return map;
  }, [allClients]);

  const clients = useMemo(() => {
    if (
      (effectiveUser?.role === "admin" || effectiveUser?.role === "management") &&
      employeeFilter !== "all"
    ) {
      const employee = employeeById[employeeFilter];

      return allClients.filter((client) => {
        return (
          employee &&
          (client.assigned_employee_id === employee.id ||
            client.created_by === employee.email)
        );
      });
    }

    return allClients;
  }, [allClients, effectiveUser?.role, employeeFilter, employeeById]);

  const clientIds = useMemo(() => allClients.map((client) => client.id), [allClients]);

  const scopedTimeEntries = useMemo(() => {
    if (!effectiveUser) return timeEntries;
    if (effectiveUser.role === "admin" && !viewAsUser) return timeEntries;

    const clientIdSet = new Set(clientIds);

    return timeEntries.filter((entry) => !entry.client_id || clientIdSet.has(entry.client_id));
  }, [timeEntries, clientIds, effectiveUser?.role, viewAsUser]);

  const now = useMemo(() => new Date(), []);
  const payrollRanges = useMemo(() => {
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    return {
      payroll1Start: new Date(nowYear, nowMonth, 1),
      payroll1End: new Date(nowYear, nowMonth, 15, 23, 59, 59),
      payroll2Start: new Date(nowYear, nowMonth, 16),
      payroll2End: new Date(nowYear, nowMonth + 1, 0, 23, 59, 59),
      weekStart: startOfWeek(now),
      weekEnd: endOfWeek(now),
      monthStart: startOfMonth(now),
      monthEnd: endOfMonth(now),
    };
  }, [now]);

  const filteredClientIds = useMemo(() => clients.map((client) => client.id), [clients]);

  const filtered = useMemo(() => {
    const filteredClientIdSet = new Set(filteredClientIds);

    return scopedTimeEntries.filter((entry) => {
      if (
        (effectiveUser?.role === "admin" || effectiveUser?.role === "management") &&
        employeeFilter !== "all" &&
        entry.client_id &&
        !filteredClientIdSet.has(entry.client_id)
      ) {
        return false;
      }

      if (clientFilter !== "all" && entry.client_id !== clientFilter) {
        return false;
      }

      if (!entry.date) {
        return periodFilter === "all";
      }

      const parsedDate = parseDateOnly(entry.date);
      if (!parsedDate) return false;

      if (periodFilter === "payroll1") {
        return (
          parsedDate >= payrollRanges.payroll1Start &&
          parsedDate <= payrollRanges.payroll1End
        );
      }

      if (periodFilter === "payroll2") {
        return (
          parsedDate >= payrollRanges.payroll2Start &&
          parsedDate <= payrollRanges.payroll2End
        );
      }

      if (periodFilter === "week") {
        return isWithinInterval(parsedDate, {
          start: payrollRanges.weekStart,
          end: payrollRanges.weekEnd,
        });
      }

      if (periodFilter === "month") {
        return isWithinInterval(parsedDate, {
          start: payrollRanges.monthStart,
          end: payrollRanges.monthEnd,
        });
      }

      return true;
    });
  }, [
    scopedTimeEntries,
    effectiveUser?.role,
    employeeFilter,
    filteredClientIds,
    clientFilter,
    periodFilter,
    payrollRanges,
  ]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    const seen = {};

    for (const entry of scopedTimeEntries) {
      const key = `${entry.client_id || "__self__"}__${entry.date || ""}__${
        entry.start_time || "notime"
      }`;

      if (seen[key]) {
        ids.add(entry.id);
        ids.add(seen[key]);
      } else {
        seen[key] = entry.id;
      }
    }

    return ids;
  }, [scopedTimeEntries]);

  const totalMinutes = useMemo(() => {
    return filtered.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0);
  }, [filtered]);

  const totalHours = useMemo(() => {
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [totalMinutes]);

  const legacyEntries = useMemo(() => {
    return scopedTimeEntries.filter((entry) => entry.category && !entry.entry_type_code);
  }, [scopedTimeEntries]);

  const byClient = useMemo(() => {
    const grouped = {};

    for (const entry of filtered) {
      const key = entry.client_id || "__self__";

      if (!grouped[key]) {
        grouped[key] = { minutes: 0, entries: 0 };
      }

      grouped[key].minutes += Number(entry.duration_minutes || 0);
      grouped[key].entries += 1;
    }

    return grouped;
  }, [filtered]);

  const getClientName = useCallback(
    (id) => {
      if (!id) return "Myself";

      const client = clientById[id];
      if (!client) return "Unknown";

      const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
      return fullName || client.full_name || client.email || "Unknown";
    },
    [clientById]
  );

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  }, [queryClient]);

  const handleEditEntry = useCallback(
    async (entry) => {
      const code =
        resolvedEntryTypeCodes[entry.id] ||
        getImmediateEntryTypeCode(entry) ||
        normalizeEntryTypeCode(await resolveEntryTypeCode(entry)) ||
        "";

      setEditingEntry(entry);
      setEditingEntryTypeCode(code);
      setSelectedEntry(null);
    },
    [resolvedEntryTypeCodes]
  );

  const handleOpenEntry = useCallback((entry) => {
    if (!entry?.id) {
      toast.error("Invalid entry");
      return;
    }

    setSelectedEntry(entry);
  }, []);

  const closeNewEntryDialog = useCallback(() => {
    setShowNewEntry(false);
    setSelectedEntryTypeCode("");
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingEntry(null);
    setEditingEntryTypeCode("");
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Tracking</h1>
          <p className="text-sm text-slate-500">Log and review time spent with clients</p>
        </div>

        <Button onClick={() => setShowNewEntry(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {legacyEntries.length > 0 ? <LegacyDataWarning count={legacyEntries.length} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-slate-500">Total Hours</div>
          <div className="mt-1 text-2xl font-semibold">{totalHours}h</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-slate-500">Sessions</div>
          <div className="mt-1 text-2xl font-semibold">{filtered.length}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-slate-500">Clients</div>
          <div className="mt-1 text-2xl font-semibold">{Object.keys(byClient).length}</div>
        </Card>
      </div>

      {Object.keys(byClient).length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-4 text-base font-semibold">Hours by Client</h2>

          <div className="space-y-3">
            {Object.entries(byClient)
              .sort(([, a], [, b]) => b.minutes - a.minutes)
              .map(([clientId, data]) => {
                const pct = totalMinutes > 0 ? (data.minutes / totalMinutes) * 100 : 0;
                const displayName = clientId === "__self__" ? "Myself" : getClientName(clientId);

                return (
                  <button
                    key={clientId}
                    type="button"
                    onClick={() => {
                      if (clientId !== "__self__") {
                        navigate(`/ClientDetail?clientId=${clientId}`);
                      }
                    }}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition hover:bg-slate-50",
                      clientId === "__self__" && "cursor-default"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-medium">{displayName}</div>
                      <div className="text-sm text-slate-500">
                        {Math.round((data.minutes / 60) * 10) / 10}h · {data.entries} sessions
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold">Filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Period</label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="payroll1">This Month 1–15</SelectItem>
                <SelectItem value="payroll2">This Month 16–End</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(effectiveUser?.role === "admin" || effectiveUser?.role === "management") &&
          filterableEmployees.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Employee</label>
              <Select
                value={employeeFilter}
                onValueChange={(value) => {
                  setEmployeeFilter(value);
                  setClientFilter("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {filterableEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Client</label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients
                  .filter((client) => !client.is_archived)
                  .map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {`${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                        client.full_name ||
                        client.email ||
                        "Unknown"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end text-sm text-slate-500">{format(now, "MMMM yyyy")}</div>
        </div>
      </Card>

      {duplicateIds.size > 0 ? (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
            <div className="text-sm text-amber-800">
              {duplicateIds.size} duplicate entries detected — entries with the same client,
              date, and time are highlighted below.
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
            No time entries found
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => {
              const isDuplicate = duplicateIds.has(entry.id);

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleOpenEntry(entry)}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition hover:bg-muted/40",
                    isDuplicate && "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{formatDurationMinutes(entry.duration_minutes)}</Badge>

                    {entry.start_time ? (
                      <Badge variant="outline">
                        {entry.start_time} {entry.end_time ? `- ${entry.end_time}` : ""}
                      </Badge>
                    ) : null}

                    <Badge variant="outline">
                      {getEntryTypeLabel(entry, resolvedEntryTypeCodes)}
                    </Badge>

                    {isDuplicate ? <Badge variant="destructive">Duplicate</Badge> : null}
                  </div>

                  <div className="mb-2 text-sm text-slate-900">
                    {entry.description || "Session"}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {entry.client_id ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ClientDetail?clientId=${entry.client_id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/ClientDetail?clientId=${entry.client_id}`);
                          }
                        }}
                      >
                        <User className="h-3.5 w-3.5" />
                        {getClientName(entry.client_id)}
                      </span>
                    ) : (
                      <span>Myself</span>
                    )}

                    <span>{entry.date ? formatShortEntryDate(entry.date) : ""}</span>

                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center gap-1 hover:text-slate-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEntry(entry);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditEntry(entry);
                        }
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={showNewEntry}
        onOpenChange={(open) => {
          if (!open) closeNewEntryDialog();
          else setShowNewEntry(true);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>

          {!selectedEntryTypeCode ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">Entry Type</label>
              <Select value={selectedEntryTypeCode} onValueChange={setSelectedEntryTypeCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entry type" />
                </SelectTrigger>
                <SelectContent>
                  {entryTypes.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <FormEngine
              entryTypeCode={selectedEntryTypeCode}
              onSaved={async () => {
                await handleRefresh();
                closeNewEntryDialog();
              }}
              onCancel={closeNewEntryDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>

          {editingEntry && editingEntryTypeCode ? (
            <FormEngine
              entry={editingEntry}
              entryTypeCode={editingEntryTypeCode}
              onSaved={async () => {
                await handleRefresh();
                closeEditDialog();
              }}
              onCancel={closeEditDialog}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedEntry}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Time Entry Details</DialogTitle>
          </DialogHeader>

          {selectedEntry ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs text-slate-500">Client</div>
                <div className="text-sm">
                  {selectedEntry.client_id ? getClientName(selectedEntry.client_id) : "Myself"}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">Date</div>
                <div className="text-sm">{formatLongEntryDate(selectedEntry.date)}</div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">Duration</div>
                <div className="text-sm">{selectedEntry.duration_minutes || 0} minutes</div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">Type</div>
                <div className="text-sm">
                  {getEntryTypeLabel(selectedEntry, resolvedEntryTypeCodes)}
                </div>
              </div>

              {selectedEntry.start_time || selectedEntry.end_time ? (
                <div>
                  <div className="mb-1 text-xs text-slate-500">Time</div>
                  <div className="text-sm">
                    {selectedEntry.start_time || "—"} - {selectedEntry.end_time || "—"}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-1 text-xs text-slate-500">Description</div>
                <div className="text-sm">{selectedEntry.description || "—"}</div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    const entry = selectedEntry;
                    setSelectedEntry(null);
                    handleEditEntry(entry);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
