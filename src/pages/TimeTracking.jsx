import { useState, useEffect, useMemo, useCallback } from "react";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
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
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";
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
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parsed.getMonth()]} ${parsed.getDate()}`;
}

function formatLongEntryDate(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}

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
  const [resolvedEntryTypeCodes, setResolvedEntryTypeCodes] = useState({});

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const effectiveUser = user?.role === "admin" && viewAsUser ? viewAsUser : user;
  const entryTypes = useMemo(() => getEntryTypeOptions(), []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && (user.role === "admin" || user.role === "management"),
  });

  const filterableEmployees = useMemo(() => {
    return allUsers.filter((u) => {
      if (!u.is_archived) {
        if (effectiveUser?.role === "management") {
          return u.role === "employee" && u.manager_id === effectiveUser.id;
        }
        if (user?.role === "admin" && !viewAsUser) {
          return u.role === "employee" || u.role === "management";
        }
      }
      return false;
    });
  }, [allUsers, effectiveUser?.role, effectiveUser?.id, user?.role, viewAsUser]);

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", effectiveUser?.id, effectiveUser?.role],
    queryFn: async () => {
      const all = await base44.entities.Client.list();

      if (!effectiveUser) return all;
      if (effectiveUser.role === "admin") return all;

      if (effectiveUser.role === "management") {
        const empIds = allUsers
          .filter((u) => u.manager_id === effectiveUser.id)
          .map((u) => u.id);

        return all.filter((c) => empIds.includes(c.assigned_employee_id));
      }

      if (effectiveUser.role === "employee") {
        return all.filter(
          (c) =>
            c.assigned_employee_id === effectiveUser.id ||
            c.created_by === effectiveUser.email
        );
      }

      return all;
    },
    enabled: !!effectiveUser,
  });

  const clientById = useMemo(() => {
    const map = {};
    for (const client of allClients) {
      map[client.id] = client;
    }
    return map;
  }, [allClients]);

  const employeeById = useMemo(() => {
    const map = {};
    for (const employee of filterableEmployees) {
      map[employee.id] = employee;
    }
    return map;
  }, [filterableEmployees]);

  const clients = useMemo(() => {
    if (
      (effectiveUser?.role === "admin" || effectiveUser?.role === "management") &&
      employeeFilter !== "all"
    ) {
      const emp = employeeById[employeeFilter];
      return allClients.filter((c) => {
        return (
          emp &&
          (c.assigned_employee_id === emp.id || c.created_by === emp.email)
        );
      });
    }

    return allClients;
  }, [allClients, effectiveUser?.role, employeeFilter, employeeById]);

  const clientIds = useMemo(() => allClients.map((c) => c.id), [allClients]);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list("-created_date"),
    enabled: !!effectiveUser,
  });

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
        if (entry?.entry_type_code) {
          immediatePairs.push([entry.id, entry.entry_type_code]);
        } else if (
          entry?.entry_type ||
          entry?.entry_type_key ||
          entry?.type ||
          entry?.category
        ) {
          immediatePairs.push([
            entry.id,
            entry.entry_type ||
              entry.entry_type_key ||
              entry.type ||
              entry.category ||
              "",
          ]);
        } else if (!resolvedEntryTypeCodes[entry.id]) {
          needsAsync.push(entry);
        }
      }

      const baseMap = Object.fromEntries(immediatePairs);

      if (!needsAsync.length) {
        if (active) {
          setResolvedEntryTypeCodes((prev) => ({ ...prev, ...baseMap }));
        }
        return;
      }

      const asyncPairs = await Promise.all(
        needsAsync.map(async (entry) => {
          try {
            const resolvedCode = await resolveEntryTypeCode(entry);
            return [entry.id, resolvedCode || ""];
          } catch (error) {
            console.error(
              "[TimeTracking] Failed to resolve entry type code for row:",
              error
            );
            return [entry.id, ""];
          }
        })
      );

      if (!active) return;

      setResolvedEntryTypeCodes((prev) => ({
        ...prev,
        ...baseMap,
        ...Object.fromEntries(asyncPairs),
      }));
    }

    resolveAllEntryTypeCodes();

    return () => {
      active = false;
    };
  }, [timeEntries, resolvedEntryTypeCodes]);

  const scopedTimeEntries = useMemo(() => {
    if (!effectiveUser) return timeEntries;
    if (effectiveUser.role === "admin" && !viewAsUser) return timeEntries;

    const clientIdSet = new Set(clientIds);
    return timeEntries.filter((e) => !e.client_id || clientIdSet.has(e.client_id));
  }, [timeEntries, clientIds, effectiveUser?.role, !!viewAsUser]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  }, [queryClient]);

  const handleEditEntry = async (entry) => {
    const code =
      resolvedEntryTypeCodes[entry.id] || (await resolveEntryTypeCode(entry));
    setEditingEntry(entry);
    setEditingEntryTypeCode(code);
    setSelectedEntry(null);
  };

  const handleOpenEntry = useCallback((entry) => {
    if (!entry?.id) {
      toast.error("Invalid entry");
      return;
    }
    setSelectedEntry(entry);
  }, []);

  const getClientName = useCallback(
    (id) => {
      if (!id) return "Myself";
      const client = clientById[id];
      return client ? `${client.first_name} ${client.last_name}` : "Unknown";
    },
    [clientById]
  );

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const payroll1Start = new Date(nowYear, nowMonth, 1);
  const payroll1End = new Date(nowYear, nowMonth, 15, 23, 59, 59);
  const payroll2Start = new Date(nowYear, nowMonth, 16);
  const payroll2End = new Date(nowYear, nowMonth + 1, 0, 23, 59, 59);

  const filteredClientIds = useMemo(() => clients.map((c) => c.id), [clients]);

  const filtered = useMemo(() => {
    const filteredClientIdSet = new Set(filteredClientIds);

    return scopedTimeEntries.filter((entry) => {
      if (
        (effectiveUser?.role === "admin" ||
          effectiveUser?.role === "management") &&
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
      if (!parsedDate) {
        return false;
      }

      if (periodFilter === "payroll1") {
        return parsedDate >= payroll1Start && parsedDate <= payroll1End;
      }

      if (periodFilter === "payroll2") {
        return parsedDate >= payroll2Start && parsedDate <= payroll2End;
      }

      if (periodFilter === "week") {
        return isWithinInterval(parsedDate, {
          start: startOfWeek(now),
          end: endOfWeek(now),
        });
      }

      if (periodFilter === "month") {
        return isWithinInterval(parsedDate, {
          start: startOfMonth(now),
          end: endOfMonth(now),
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
    payroll1Start,
    payroll1End,
    payroll2Start,
    payroll2End,
    now,
  ]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    const seen = {};

    scopedTimeEntries.forEach((entry) => {
      const key = `${entry.client_id}__${entry.date}__${entry.start_time || "notime"}`;
      if (seen[key]) {
        ids.add(entry.id);
        ids.add(seen[key]);
      } else {
        seen[key] = entry.id;
      }
    });

    return ids;
  }, [scopedTimeEntries]);

  const totalMinutes = useMemo(() => {
    return filtered.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  }, [filtered]);

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const legacyEntries = useMemo(() => {
    return scopedTimeEntries.filter(
      (entry) => entry.category && !entry.entry_type_code
    );
  }, [scopedTimeEntries]);

  const byClient = useMemo(() => {
    const grouped = {};

    filtered.forEach((entry) => {
      const key = entry.client_id || "__self__";
      if (!grouped[key]) {
        grouped[key] = { minutes: 0, entries: 0 };
      }
      grouped[key].minutes += entry.duration_minutes || 0;
      grouped[key].entries += 1;
    });

    return grouped;
  }, [filtered]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-muted-foreground">
            Log and review time spent with clients
          </p>
        </div>

        <Button onClick={() => setShowNewEntry(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      {legacyEntries.length > 0 && (
        <LegacyDataWarning count={legacyEntries.length} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Hours</div>
          <div className="text-2xl font-bold">{totalHours}h</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Sessions</div>
          <div className="text-2xl font-bold">{filtered.length}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Clients</div>
          <div className="text-2xl font-bold">{Object.keys(byClient).length}</div>
        </Card>
      </div>

      {Object.keys(byClient).length > 0 && (
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">Hours by Client</h3>

          <div className="space-y-3">
            {Object.entries(byClient)
              .sort(([, a], [, b]) => b.minutes - a.minutes)
              .map(([clientId, data]) => {
                const pct = totalMinutes > 0 ? (data.minutes / totalMinutes) * 100 : 0;
                const displayName =
                  clientId === "__self__" ? "Myself" : getClientName(clientId);

                return (
                  <button
                    key={clientId}
                    type="button"
                    className="w-full text-left space-y-1"
                    onClick={() => {
                      if (clientId !== "__self__") {
                        navigate(`/ClientDetail?clientId=${clientId}`);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium">{displayName}</span>
                      <span className="text-muted-foreground">
                        {Math.round((data.minutes / 60) * 10) / 10}h · {data.entries} sessions
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="payroll1">This Month 1–15</SelectItem>
              <SelectItem value="payroll2">This Month 16–End</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          {(effectiveUser?.role === "admin" || effectiveUser?.role === "management") &&
            filterableEmployees.length > 0 && (
              <Select
                value={employeeFilter}
                onValueChange={(value) => {
                  setEmployeeFilter(value);
                  setClientFilter("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Employee" />
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
            )}

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients
                .filter((client) => !client.is_archived)
                .map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex items-center text-sm text-muted-foreground">
            {format(now, "MMMM yyyy")}
          </div>
        </div>
      </Card>

      {duplicateIds.size > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <p className="text-sm">
              {duplicateIds.size} duplicate entries detected — entries with the same
              client, date, and time are highlighted below.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
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
                    "w-full text-left rounded-lg border p-4 transition hover:bg-muted/40",
                    isDuplicate && "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {entry.duration_minutes}min
                        </Badge>

                        {entry.start_time && (
                          <Badge variant="outline">
                            {entry.start_time} - {entry.end_time}
                          </Badge>
                        )}

                        <Badge variant="outline">
                          {getEntryTypeLabel(entry, resolvedEntryTypeCodes)}
                        </Badge>

                        {isDuplicate && (
                          <Badge className="bg-amber-500 hover:bg-amber-500">
                            Duplicate
                          </Badge>
                        )}
                      </div>

                      <div className="font-medium">
                        {entry.description || "Session"}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {entry.client_id ? (
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ClientDetail?clientId=${entry.client_id}`);
                            }}
                          >
                            {getClientName(entry.client_id)}
                          </button>
                        ) : (
                          <span>Myself</span>
                        )}

                        <span>{entry.date ? formatShortEntryDate(entry.date) : ""}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEntry(entry);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
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
          if (!open) {
            setShowNewEntry(false);
            setSelectedEntryTypeCode("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>

          {!selectedEntryTypeCode && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Entry Type</label>
              <Select
                value={selectedEntryTypeCode}
                onValueChange={setSelectedEntryTypeCode}
              >
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
          )}

          {selectedEntryTypeCode && (
            <FormEngine
              mode="create"
              entryTypeCode={selectedEntryTypeCode}
              onSuccess={async () => {
                await handleRefresh();
                setShowNewEntry(false);
                setSelectedEntryTypeCode("");
              }}
              onCancel={() => {
                setShowNewEntry(false);
                setSelectedEntryTypeCode("");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntry(null);
            setEditingEntryTypeCode("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>

          {editingEntry && editingEntryTypeCode && (
            <FormEngine
              mode="edit"
              entry={editingEntry}
              entryTypeCode={editingEntryTypeCode}
              onSuccess={async () => {
                await handleRefresh();
                setEditingEntry(null);
                setEditingEntryTypeCode("");
              }}
              onCancel={() => {
                setEditingEntry(null);
                setEditingEntryTypeCode("");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedEntry}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Time Entry Details</DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Client</div>
                  <div className="font-medium">
                    {selectedEntry.client_id
                      ? getClientName(selectedEntry.client_id)
                      : "Myself"}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Date</div>
                  <div className="font-medium">
                    {formatLongEntryDate(selectedEntry.date)}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Duration</div>
                  <div className="font-medium">
                    {selectedEntry.duration_minutes || 0} minutes
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Type</div>
                  <div className="font-medium">
                    {getEntryTypeLabel(selectedEntry, resolvedEntryTypeCodes)}
                  </div>
                </Card>
              </div>

              {(selectedEntry.start_time || selectedEntry.end_time) && (
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Time</div>
                  <div className="font-medium">
                    {selectedEntry.start_time || "—"} - {selectedEntry.end_time || "—"}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Description</div>
                <div className="whitespace-pre-wrap">
                  {selectedEntry.description || "—"}
                </div>
              </Card>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedEntry(null);
                    handleEditEntry(selectedEntry);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
