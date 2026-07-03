import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Clock,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import PreEtsTimeCardWorkspace from "@/components/pre-ets/PreEtsTimeCardWorkspace";

function getFunctionData(response) {
  return response?.data ?? response ?? {};
}

function parseDateOnly(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
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

function safeDate(value) {
  const parsed = parseDateOnly(value);

  return parsed ? format(parsed, "MMM d, yyyy") : value || "—";
}

function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function getStatusClassName(status) {
  if (status === "approved") {
    return "bg-green-100 text-green-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function PreEtsTimeEntries() {
  const [activeView, setActiveView] = useState("time_cards");
  const [periodFilter, setPeriodFilter] = useState(() =>
    new Date().getDate() <= 15 ? "payroll1" : "payroll2"
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    format(new Date(), "yyyy-MM")
  );
  const [studentFilter, setStudentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const {
    data: timeEntryData = {
      entries: [],
      clients: [],
    },
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["preEtsClientTimeEntries"],
    enabled: activeView === "entry_history",
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "getAuthorizedPreEtsTimeEntries",
        {}
      );

      const data = getFunctionData(response);

      if (!data?.ok) {
        throw new Error(
          data?.error || "Unable to load authorized Pre-ETS time entries."
        );
      }

      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        clients: Array.isArray(data.clients) ? data.clients : [],
      };
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });

  const entries = timeEntryData.entries || [];
  const authorizedClients = timeEntryData.clients || [];

  const payrollRanges = useMemo(() => {
    const [selectedYearRaw, selectedMonthRaw] = selectedMonth.split("-");
    const selectedYear = Number(selectedYearRaw);
    const selectedMonthIndex = Number(selectedMonthRaw) - 1;

    const safeBaseDate =
      Number.isFinite(selectedYear) &&
      Number.isFinite(selectedMonthIndex) &&
      selectedMonthIndex >= 0 &&
      selectedMonthIndex <= 11
        ? new Date(selectedYear, selectedMonthIndex, 1)
        : new Date();

    return {
      payroll1Start: new Date(
        safeBaseDate.getFullYear(),
        safeBaseDate.getMonth(),
        1
      ),
      payroll1End: new Date(
        safeBaseDate.getFullYear(),
        safeBaseDate.getMonth(),
        15,
        23,
        59,
        59
      ),
      payroll2Start: new Date(
        safeBaseDate.getFullYear(),
        safeBaseDate.getMonth(),
        16
      ),
      payroll2End: new Date(
        safeBaseDate.getFullYear(),
        safeBaseDate.getMonth() + 1,
        0,
        23,
        59,
        59
      ),
      weekStart: startOfWeek(new Date()),
      weekEnd: endOfWeek(new Date()),
      monthStart: startOfMonth(safeBaseDate),
      monthEnd: endOfMonth(safeBaseDate),
    };
  }, [selectedMonth]);

  const students = useMemo(() => {
    const studentById = new Map();

    for (const client of authorizedClients) {
      const clientId = client?.id;

      if (!clientId) {
        continue;
      }

      studentById.set(clientId, {
        id: clientId,
        name: client?.name || client?.client_name || "Unnamed student",
      });
    }

    for (const entry of entries) {
      const clientId = entry?.client_id;

      if (!clientId || studentById.has(clientId)) {
        continue;
      }

      studentById.set(clientId, {
        id: clientId,
        name: entry?.client_name || "Unnamed student",
      });
    }

    return Array.from(studentById.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [authorizedClients, entries]);

  const filteredEntries = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const status = entry.status || "pending";
      const studentName = `${entry.client_name || ""}`.toLowerCase();

      if (
        studentFilter !== "all" &&
        entry.client_id !== studentFilter
      ) {
        return false;
      }

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (searchText && !studentName.includes(searchText)) {
        return false;
      }

      if (periodFilter === "all") {
        return true;
      }

      const entryDate = parseDateOnly(entry.date);

      if (!entryDate) {
        return false;
      }

      if (periodFilter === "payroll1") {
        return (
          entryDate >= payrollRanges.payroll1Start &&
          entryDate <= payrollRanges.payroll1End
        );
      }

      if (periodFilter === "payroll2") {
        return (
          entryDate >= payrollRanges.payroll2Start &&
          entryDate <= payrollRanges.payroll2End
        );
      }

      if (periodFilter === "week") {
        return isWithinInterval(entryDate, {
          start: payrollRanges.weekStart,
          end: payrollRanges.weekEnd,
        });
      }

      if (periodFilter === "month") {
        return isWithinInterval(entryDate, {
          start: payrollRanges.monthStart,
          end: payrollRanges.monthEnd,
        });
      }

      return true;
    });
  }, [
    entries,
    payrollRanges,
    periodFilter,
    search,
    statusFilter,
    studentFilter,
  ]);

  const totalMinutes = useMemo(
    () =>
      filteredEntries.reduce(
        (total, entry) => total + Number(entry.duration_minutes || 0),
        0
      ),
    [filteredEntries]
  );

  const pendingCount = useMemo(
    () =>
      entries.filter(
        (entry) => (entry.status || "pending") === "pending"
      ).length,
    [entries]
  );

  const refreshEntries = async () => {
    await refetch();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pre-ETS Time Management
          </h1>
          <p className="text-sm text-slate-500">
            Submit and review payroll-period Time Cards. Entry history is
            available for reference only.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button
          type="button"
          variant={activeView === "time_cards" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setActiveView("time_cards")}
        >
          <ShieldCheck className="h-4 w-4" />
          Time Cards
        </Button>

        <Button
          type="button"
          variant={activeView === "entry_history" ? "default" : "outline"}
          className="gap-2"
          onClick={() => setActiveView("entry_history")}
        >
          <FileText className="h-4 w-4" />
          Entry History
        </Button>
      </div>

      {activeView === "time_cards" ? (
        <PreEtsTimeCardWorkspace />
      ) : null}

      {activeView === "entry_history" ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Entries shown</p>
                <p className="text-2xl font-bold">
                  {filteredEntries.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Total hours</p>
                <p className="text-2xl font-bold">
                  {formatMinutes(totalMinutes)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Pending entries</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-blue-600" />
                Pre-ETS Entry History
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                Individual entry approval is no longer the payroll review
                workflow. Use the <strong>Time Cards</strong> tab to return,
                forward, or finalize a payroll period.
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) =>
                      setSelectedMonth(event.target.value)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Period</label>
                  <Select
                    value={periodFilter}
                    onValueChange={setPeriodFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="payroll1">1st–15th</SelectItem>
                      <SelectItem value="payroll2">
                        16th–End of Month
                      </SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Student</label>
                  <Select
                    value={studentFilter}
                    onValueChange={setStudentFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value="all">All Students</SelectItem>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Status</label>
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500">
                    Search Student
                  </label>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search student name"
                  />
                </div>

                <div className="flex flex-col justify-end gap-1">
                  <span className="min-h-5 text-xs text-slate-500">
                    {periodFilter === "payroll1"
                      ? `Viewing: ${format(
                          payrollRanges.payroll1Start,
                          "MMM d"
                        )}–${format(
                          payrollRanges.payroll1End,
                          "MMM d, yyyy"
                        )}`
                      : periodFilter === "payroll2"
                      ? `Viewing: ${format(
                          payrollRanges.payroll2Start,
                          "MMM d"
                        )}–${format(
                          payrollRanges.payroll2End,
                          "MMM d, yyyy"
                        )}`
                      : periodFilter === "week"
                      ? `Viewing: ${format(
                          payrollRanges.weekStart,
                          "MMM d"
                        )}–${format(
                          payrollRanges.weekEnd,
                          "MMM d, yyyy"
                        )}`
                      : periodFilter === "month"
                      ? `Viewing: ${format(
                          payrollRanges.monthStart,
                          "MMM d"
                        )}–${format(
                          payrollRanges.monthEnd,
                          "MMM d, yyyy"
                        )}`
                      : "Viewing: All Time"}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={refreshEntries}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading time-entry history...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error.message ||
                    "Unable to load Pre-ETS time-entry history."}
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                  No authorized Pre-ETS time entries match these filters.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Start</th>
                        <th className="p-3">Stop</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Review workflow</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredEntries.map((entry) => {
                        const status = entry.status || "pending";

                        return (
                          <tr key={entry.id} className="border-t">
                            <td className="p-3 font-medium">
                              {entry.client_name || "Unnamed student"}
                            </td>
                            <td className="p-3">{safeDate(entry.date)}</td>
                            <td className="p-3">
                              {entry.start_time || "—"}
                            </td>
                            <td className="p-3">
                              {entry.end_time || "—"}
                            </td>
                            <td className="p-3">
                              {formatMinutes(entry.duration_minutes)}
                            </td>
                            <td className="p-3">
                              <Badge
                                className={getStatusClassName(status)}
                              >
                                {status}
                              </Badge>
                            </td>
                            <td className="max-w-xs p-3 text-slate-600">
                              {entry.description || "—"}
                            </td>
                            <td className="p-3 text-slate-500">
                              Review through Time Card
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
