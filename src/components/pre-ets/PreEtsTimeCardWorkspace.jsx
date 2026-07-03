import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

function getFunctionData(response) {
  return response?.data ?? response ?? {};
}

function getErrorMessage(error, fallbackMessage) {
  const responseData =
    error?.response?.data?.data ??
    error?.response?.data ??
    error?.data ??
    {};

  return (
    responseData?.message ||
    responseData?.error ||
    error?.message ||
    fallbackMessage
  );
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getTodayDateOnly() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
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

function formatDateOnly(value) {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return value || "—";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(startDate, endDate) {
  return `${formatDateOnly(startDate)} – ${formatDateOnly(endDate)}`;
}

function formatMinutes(minutes) {
  const totalMinutes = Number(minutes || 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function formatStatus(status) {
  return normalizeText(status)
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getStatusClassName(status) {
  switch (status) {
    case "submitted_to_staff":
      return "bg-blue-100 text-blue-700";
    case "returned_to_student":
      return "bg-amber-100 text-amber-800";
    case "submitted_to_manager_payroll":
      return "bg-violet-100 text-violet-700";
    case "returned_to_staff":
      return "bg-orange-100 text-orange-800";
    case "finalized":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getStudentPreviewCard(preview) {
  if (!preview) {
    return null;
  }

  return preview.existing_time_card || {
    id: "",
    client_name: "Your Time Card",
    period_start: preview?.pay_period?.period_start,
    period_end: preview?.pay_period?.period_end,
    pay_period_label: preview?.pay_period?.label,
    pay_date: preview?.pay_period?.pay_date,
    status: preview.locked ? "submitted_to_staff" : "ready_to_submit",
    total_minutes: (preview.entries || []).reduce(
      (sum, entry) => sum + Number(entry?.duration_minutes || 0),
      0
    ),
    entries: preview.entries || [],
  };
}

function TimeCardEntryTable({ entries }) {
  const safeEntries = Array.isArray(entries) ? entries : [];

  if (safeEntries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-slate-500">
        No time entries are included in this Time Card.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Start</th>
            <th className="p-3">Stop</th>
            <th className="p-3">Duration</th>
            <th className="p-3">Description</th>
          </tr>
        </thead>
        <tbody>
          {safeEntries.map((entry) => (
            <tr key={entry.id} className="border-t">
              <td className="p-3">{formatDateOnly(entry.date)}</td>
              <td className="p-3">{entry.start_time || "—"}</td>
              <td className="p-3">{entry.end_time || "—"}</td>
              <td className="p-3">
                {formatMinutes(entry.duration_minutes)}
              </td>
              <td className="max-w-md p-3 text-slate-600">
                {entry.description || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PreEtsTimeCardWorkspace() {
  const queryClient = useQueryClient();
  const [referenceDate, setReferenceDate] = useState(
    getTodayDateOnly()
  );
  const [studentPreview, setStudentPreview] = useState(null);
  const [studentPreviewError, setStudentPreviewError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [returnToStudentNotes, setReturnToStudentNotes] = useState({});
  const [returnToStaffNotes, setReturnToStaffNotes] = useState({});
  const [finalizationNotes, setFinalizationNotes] = useState({});

  const {
    data: timeCardData = {},
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["preEtsTimeCards", "workspace"],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "getAuthorizedPreEtsTimeCards",
        {
          include_entries: true,
        }
      );

      const data = getFunctionData(response);

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "Unable to load your authorized Pre-ETS Time Cards."
        );
      }

      return data;
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });

  const viewerScope = normalizeText(timeCardData?.viewer_scope);
  const cards = Array.isArray(timeCardData?.cards)
    ? timeCardData.cards
    : [];

  const isStudentViewer = viewerScope === "student";
  const isAssignedStaffViewer =
    viewerScope === "assigned_staff" ||
    viewerScope === "administrator";
  const isManagerViewer =
    viewerScope === "management" ||
    viewerScope === "administrator";

  const activeCards = useMemo(
    () => cards.filter((card) => card.status !== "finalized"),
    [cards]
  );

  const finalizedCards = useMemo(
    () => cards.filter((card) => card.status === "finalized"),
    [cards]
  );

  const refreshCards = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["preEtsTimeCards"],
    });

    await refetch();
  };

  const getActionKey = (action, timeCardId = "") =>
    `${action}:${timeCardId}`;

  const isActionActive = (action, timeCardId = "") =>
    activeAction === getActionKey(action, timeCardId);

  const runCardAction = async ({
    action,
    timeCardId,
    payload = {},
    successMessage,
  }) => {
    const actionKey = getActionKey(action, timeCardId);

    try {
      setActiveAction(actionKey);

      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsTimeCard",
        {
          action,
          ...(timeCardId ? { time_card_id: timeCardId } : {}),
          ...payload,
        }
      );

      const data = getFunctionData(response);

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The Time Card action could not be completed."
        );
      }

      toast.success(data?.message || successMessage);
      await refreshCards();

      return data;
    } catch (actionError) {
      toast.error(
        getErrorMessage(
          actionError,
          "The Time Card action could not be completed."
        )
      );

      return null;
    } finally {
      setActiveAction("");
    }
  };

  const previewStudentTimeCard = async () => {
    if (!referenceDate) {
      toast.error("Select a date before previewing a Time Card.");
      return;
    }

    try {
      setStudentPreviewError("");
      setActiveAction(getActionKey("preview_student_time_card"));

      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsTimeCard",
        {
          action: "preview_student_time_card",
          time_card: {
            reference_date: referenceDate,
          },
        }
      );

      const data = getFunctionData(response);

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The Time Card preview could not be loaded."
        );
      }

      setStudentPreview(data);
    } catch (previewError) {
      const message = getErrorMessage(
        previewError,
        "The Time Card preview could not be loaded."
      );

      setStudentPreview(null);
      setStudentPreviewError(message);
    } finally {
      setActiveAction("");
    }
  };

  const submitStudentTimeCard = async () => {
    const result = await runCardAction({
      action: "submit_student_time_card",
      payload: {
        time_card: {
          reference_date: referenceDate,
        },
      },
      successMessage:
        "Your Pre-ETS Time Card was submitted to your assigned staff member.",
    });

    if (result?.time_card) {
      setStudentPreview({
        pay_period: result.pay_period || null,
        existing_time_card: result.time_card,
        entries: result.time_card.entries || [],
        locked: true,
      });
    }
  };

  const returnCardToStudent = async (card) => {
    const note = normalizeText(returnToStudentNotes[card.id]);

    if (!note) {
      toast.error(
        "Enter a correction note before returning this Time Card to the student."
      );
      return;
    }

    const result = await runCardAction({
      action: "return_to_student",
      timeCardId: card.id,
      payload: {
        return_to_student_note: note,
      },
      successMessage:
        "The Time Card was returned to the student with your correction note.",
    });

    if (result?.ok) {
      setReturnToStudentNotes((current) => ({
        ...current,
        [card.id]: "",
      }));
    }
  };

  const submitCardToManagerPayroll = async (card) => {
    await runCardAction({
      action: "submit_to_manager_payroll",
      timeCardId: card.id,
      successMessage:
        "The Time Card was submitted to manager or payroll for final review.",
    });
  };

  const returnCardToStaff = async (card) => {
    const note = normalizeText(returnToStaffNotes[card.id]);

    if (!note) {
      toast.error(
        "Enter a return note before sending this Time Card back to staff."
      );
      return;
    }

    const result = await runCardAction({
      action: "return_to_staff",
      timeCardId: card.id,
      payload: {
        return_to_staff_note: note,
      },
      successMessage:
        "The Time Card was returned to staff with your instructions.",
    });

    if (result?.ok) {
      setReturnToStaffNotes((current) => ({
        ...current,
        [card.id]: "",
      }));
    }
  };

  const finalizeCard = async (card) => {
    const note = normalizeText(finalizationNotes[card.id]);

    const result = await runCardAction({
      action: "finalize",
      timeCardId: card.id,
      payload: {
        finalization_note: note,
      },
      successMessage:
        "The Pre-ETS Time Card was finalized and moved to the archive.",
    });

    if (result?.ok) {
      setFinalizationNotes((current) => ({
        ...current,
        [card.id]: "",
      }));
    }
  };

  const studentPreviewCard = getStudentPreviewCard(studentPreview);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Pre-ETS Time Cards
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Submit student hours to staff, forward reviewed cards to
            manager or payroll, and retain finalized records in the archive.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={refreshCards}
          disabled={isLoading || Boolean(activeAction)}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {getErrorMessage(
            error,
            "Your authorized Pre-ETS Time Cards could not be loaded."
          )}
        </div>
      ) : null}

      {isStudentViewer ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-blue-600" />
              Student Time Card
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_auto] md:items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">
                  Select any date in the pay period
                </label>
                <Input
                  type="date"
                  value={referenceDate}
                  onChange={(event) =>
                    setReferenceDate(event.target.value)
                  }
                />
              </div>

              <Button
                type="button"
                className="gap-2"
                onClick={previewStudentTimeCard}
                disabled={isActionActive("preview_student_time_card")}
              >
                <FileText className="h-4 w-4" />
                {isActionActive("preview_student_time_card")
                  ? "Loading Preview..."
                  : "Preview Time Card"}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Select a date that falls within the payroll period you want
              to review. Dates are shown exactly as entered and are not
              shifted by time zone.
            </p>

            {studentPreviewError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {studentPreviewError}
              </div>
            ) : null}

            {studentPreviewCard ? (
              <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {studentPreviewCard.pay_period_label ||
                        "Payroll Period"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDateRange(
                        studentPreviewCard.period_start,
                        studentPreviewCard.period_end
                      )}
                    </p>
                    {studentPreviewCard.pay_date ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Pay date: {formatDateOnly(studentPreviewCard.pay_date)}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-left md:text-right">
                    <Badge
                      className={getStatusClassName(
                        studentPreviewCard.status
                      )}
                    >
                      {studentPreview?.locked
                        ? formatStatus(studentPreviewCard.status)
                        : "Ready to Submit"}
                    </Badge>
                    <p className="mt-2 text-lg font-bold text-slate-900">
                      {formatMinutes(studentPreviewCard.total_minutes)}
                    </p>
                  </div>
                </div>

                {studentPreview?.locked ? (
                  <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      This payroll period is currently locked. Review the
                      Time Card status and any return note below.
                    </p>
                  </div>
                ) : null}

                {studentPreviewCard.return_to_student_note ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">Staff correction note</p>
                    <p className="mt-1">
                      {studentPreviewCard.return_to_student_note}
                    </p>
                  </div>
                ) : null}

                <TimeCardEntryTable
                  entries={studentPreviewCard.entries}
                />

                {!studentPreview?.locked ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={submitStudentTimeCard}
                      disabled={
                        !studentPreviewCard.entries?.length ||
                        isActionActive("submit_student_time_card")
                      }
                    >
                      <Send className="h-4 w-4" />
                      {isActionActive("submit_student_time_card")
                        ? "Submitting..."
                        : "Submit Time Card to Staff"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!isStudentViewer ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Active Time Cards</p>
              <p className="mt-1 text-2xl font-bold">
                {activeCards.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">
                Awaiting Staff Action
              </p>
              <p className="mt-1 text-2xl font-bold">
                {
                  activeCards.filter(
                    (card) =>
                      card.status === "submitted_to_staff" ||
                      card.status === "returned_to_staff"
                  ).length
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">
                Awaiting Manager / Payroll
              </p>
              <p className="mt-1 text-2xl font-bold">
                {
                  activeCards.filter(
                    (card) =>
                      card.status === "submitted_to_manager_payroll"
                  ).length
                }
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!isStudentViewer ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-blue-600" />
              Active Time Cards
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Loading authorized Time Cards...
              </div>
            ) : activeCards.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                No active Pre-ETS Time Cards are available for your role.
              </div>
            ) : (
              activeCards.map((card) => {
                const canStaffReturn =
                  isAssignedStaffViewer &&
                  (card.status === "submitted_to_staff" ||
                    card.status === "returned_to_staff");

                const canStaffForward =
                  isAssignedStaffViewer &&
                  (card.status === "submitted_to_staff" ||
                    card.status === "returned_to_staff");

                const canManagerAct =
                  isManagerViewer &&
                  card.status === "submitted_to_manager_payroll";

                return (
                  <div
                    key={card.id}
                    className="space-y-4 rounded-lg border p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {card.client_name || "Pre-ETS Student"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {card.pay_period_label || "Payroll Period"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateRange(
                            card.period_start,
                            card.period_end
                          )}
                          {card.assigned_staff_name
                            ? ` · Assigned staff: ${card.assigned_staff_name}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <Badge className={getStatusClassName(card.status)}>
                          {formatStatus(card.status)}
                        </Badge>
                        <p className="mt-2 text-lg font-bold text-slate-900">
                          {formatMinutes(card.total_minutes)}
                        </p>
                      </div>
                    </div>

                    {card.return_to_student_note ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Return note to student</p>
                        <p className="mt-1">{card.return_to_student_note}</p>
                      </div>
                    ) : null}

                    {card.return_to_staff_note ? (
                      <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                        <p className="font-semibold">Return note to staff</p>
                        <p className="mt-1">{card.return_to_staff_note}</p>
                      </div>
                    ) : null}

                    <details className="rounded-md border bg-slate-50">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
                        View submitted time-entry snapshot
                      </summary>
                      <div className="border-t p-3">
                        <TimeCardEntryTable entries={card.entries} />
                      </div>
                    </details>

                    {canStaffReturn || canStaffForward ? (
                      <div className="grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-blue-900">
                            Return to student note
                          </label>
                          <textarea
                            value={returnToStudentNotes[card.id] || ""}
                            onChange={(event) =>
                              setReturnToStudentNotes((current) => ({
                                ...current,
                                [card.id]: event.target.value,
                              }))
                            }
                            placeholder="Explain what the student must correct before resubmitting."
                            className="min-h-[88px] w-full rounded-md border border-blue-200 bg-white p-3 text-sm"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => returnCardToStudent(card)}
                            disabled={isActionActive(
                              "return_to_student",
                              card.id
                            )}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {isActionActive(
                              "return_to_student",
                              card.id
                            )
                              ? "Returning..."
                              : "Return to Student"}
                          </Button>

                          <Button
                            type="button"
                            className="gap-2"
                            onClick={() =>
                              submitCardToManagerPayroll(card)
                            }
                            disabled={isActionActive(
                              "submit_to_manager_payroll",
                              card.id
                            )}
                          >
                            <Send className="h-4 w-4" />
                            {isActionActive(
                              "submit_to_manager_payroll",
                              card.id
                            )
                              ? "Submitting..."
                              : "Submit to Manager / Payroll"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {canManagerAct ? (
                      <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50 p-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-violet-900">
                            Return to staff note
                          </label>
                          <textarea
                            value={returnToStaffNotes[card.id] || ""}
                            onChange={(event) =>
                              setReturnToStaffNotes((current) => ({
                                ...current,
                                [card.id]: event.target.value,
                              }))
                            }
                            placeholder="Explain what staff must resolve before resubmitting."
                            className="min-h-[88px] w-full rounded-md border border-violet-200 bg-white p-3 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-violet-900">
                            Finalization note (optional)
                          </label>
                          <textarea
                            value={finalizationNotes[card.id] || ""}
                            onChange={(event) =>
                              setFinalizationNotes((current) => ({
                                ...current,
                                [card.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional payroll or archive note."
                            className="min-h-[72px] w-full rounded-md border border-violet-200 bg-white p-3 text-sm"
                          />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => returnCardToStaff(card)}
                            disabled={isActionActive(
                              "return_to_staff",
                              card.id
                            )}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {isActionActive(
                              "return_to_staff",
                              card.id
                            )
                              ? "Returning..."
                              : "Return to Staff"}
                          </Button>

                          <Button
                            type="button"
                            className="gap-2"
                            onClick={() => finalizeCard(card)}
                            disabled={isActionActive("finalize", card.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {isActionActive("finalize", card.id)
                              ? "Finalizing..."
                              : "Finalize and Archive"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isStudentViewer ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Finalized Archive
            </CardTitle>
          </CardHeader>

          <CardContent>
            {finalizedCards.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                No finalized Pre-ETS Time Cards are available in your archive.
              </div>
            ) : (
              <div className="space-y-3">
                {finalizedCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {card.client_name || "Pre-ETS Student"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formatDateRange(
                          card.period_start,
                          card.period_end
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatMinutes(card.total_minutes)}
                      </span>
                      <Badge className={getStatusClassName(card.status)}>
                        Finalized
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
