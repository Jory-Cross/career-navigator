import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function safeDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export default function PreEtsTimeEntries() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [rejectingEntryId, setRejectingEntryId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["preEtsClientTimeEntries"],
    queryFn: async () => {
      const records = await base44.entities.PreEtsClientTimeEntry.list();
      return Array.isArray(records) ? records : [];
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const status = entry.status || "pending";
      const name = `${entry.client_name || ""}`.toLowerCase();
      const q = search.trim().toLowerCase();

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (q && !name.includes(q)) return false;

      return true;
    });
  }, [entries, statusFilter, search]);

  const totalMinutes = useMemo(() => {
    return filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.duration_minutes || 0),
      0
    );
  }, [filteredEntries]);

  const startReject = (entry) => {
    setRejectingEntryId(entry.id);
    setRejectionReason(entry.rejection_reason || "");
  };

  const cancelReject = () => {
    setRejectingEntryId(null);
    setRejectionReason("");
    setSubmittingReject(false);
  };

  const submitReject = async (entry) => {
    const reason = rejectionReason.trim();

    if (!reason) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    try {
      setSubmittingReject(true);

      await base44.entities.PreEtsClientTimeEntry.update(entry.id, {
        status: "rejected",
        rejection_reason: reason,
        approved_at: null,
      });

      toast.success("Entry rejected");
      cancelReject();

      await queryClient.invalidateQueries({
        queryKey: ["preEtsClientTimeEntries"],
      });
    } catch (error) {
      console.error("Failed to reject Pre-ETS time entry", error);
      toast.error("Failed to reject entry");
      setSubmittingReject(false);
    }
  };

  
  const updateStatus = async (entry, nextStatus) => {
    try {
      await base44.entities.PreEtsClientTimeEntry.update(entry.id, {
        status: nextStatus,
        approved_at:
          nextStatus === "approved" ? new Date().toISOString() : entry.approved_at || null,
      });

      toast.success(`Entry marked ${nextStatus}`);
      await queryClient.invalidateQueries({
        queryKey: ["preEtsClientTimeEntries"],
      });
    } catch (error) {
      console.error("Failed to update Pre-ETS time entry", error);
      toast.error("Failed to update entry");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pre-ETS Time Entries
        </h1>
        <p className="text-sm text-slate-500">
          Review Pre-ETS student clock in/out hours.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Entries shown</p>
            <p className="text-2xl font-bold">{filteredEntries.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total hours</p>
            <p className="text-2xl font-bold">{formatMinutes(totalMinutes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="text-2xl font-bold">
              {entries.filter((e) => (e.status || "pending") === "pending").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-blue-600" />
            Submitted Student Hours
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student name"
              className="md:max-w-sm"
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["preEtsClientTimeEntries"],
                })
              }
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading time entries...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
              No Pre-ETS time entries found.
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
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEntries.map((entry) => {
                    const status = entry.status || "pending";

                    return (
                      <tr key={entry.id} className="border-t">
                        <td className="p-3 font-medium">
                          {entry.client_name || "Unknown student"}
                        </td>
                        <td className="p-3">{safeDate(entry.date)}</td>
                        <td className="p-3">{entry.start_time || "—"}</td>
                        <td className="p-3">{entry.end_time || "—"}</td>
                        <td className="p-3">
                          {formatMinutes(entry.duration_minutes)}
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              status === "approved"
                                ? "bg-green-100 text-green-700"
                                : status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : status === "paid"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="max-w-xs p-3 text-slate-600">
                          {entry.description || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(entry, "approved")}
                              disabled={status === "approved"}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>

                                                        <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startReject(entry)}
                              disabled={submittingReject}
                              className="gap-1 text-red-700"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </td>
                                           </tr>

                      {rejectingEntryId === entry.id && (
                        <tr className="border-t bg-red-50">
                          <td colSpan={8} className="p-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-red-900">
                                  Rejection Reason Required
                                </p>

                                <p className="text-xs text-red-700">
                                  Explain what needs to be corrected before the
                                  student resubmits this time entry.
                                </p>
                              </div>

                              <textarea
                                value={rejectionReason}
                                onChange={(e) =>
                                  setRejectionReason(e.target.value)
                                }
                                placeholder="Enter rejection reason..."
                                className="min-h-[100px] w-full rounded-md border border-red-200 bg-white p-3 text-sm"
                              />

                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={cancelReject}
                                  disabled={submittingReject}
                                >
                                  Cancel
                                </Button>

                                <Button
                                  variant="destructive"
                                  onClick={() => submitReject(entry)}
                                  disabled={submittingReject}
                                >
                                  {submittingReject
                                    ? "Rejecting..."
                                    : "Reject Entry"}
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
