import { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getResponseData(response) {
  return response?.data || response || {};
}

function getErrorMessage(error, fallbackMessage) {
  const serverData =
    error?.response?.data ||
    error?.data ||
    {};

  const serverMessage =
    typeof serverData?.error === "string"
      ? serverData.error.trim()
      : "";

  return serverMessage || error?.message || fallbackMessage;
}

function getTodayDateValue() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "—";
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateRange(card) {
  return `${formatDate(card?.period_start)} – ${formatDate(card?.period_end)}`;
}

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString();
}

function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function getStatusLabel(status) {
  if (status === "submitted") {
    return "Submitted";
  }

  if (status === "returned") {
    return "Returned for correction";
  }

  if (status === "approved") {
    return "Approved / Archived";
  }

  return status || "Unknown";
}

function getStatusClasses(status) {
  if (status === "submitted") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "returned") {
    return "bg-red-100 text-red-800";
  }

  if (status === "approved") {
    return "bg-emerald-100 text-emerald-800";
  }

  return "bg-slate-100 text-slate-700";
}

const ENTRY_TYPE_LABELS = {
  admin_time: "Admin Time",
  client_non_attendance: "No-Show / Cancellation",
  csb: "CSB",
  dspd: "DSPD",
  eom_reporting: "End-of-Month Reporting",
  job_coaching: "Job Coaching",
  job_development: "Job Development",
  life_skills: "Life Skills",
  misc: "Miscellaneous",
  miscellaneous: "Miscellaneous",
  pre_ets: "Pre-ETS",
  pto: "PTO",
  wsa: "WSA",
};

function getEntryTypeCode(entry) {
  return String(entry?.entry_type_code || "")
    .trim()
    .toLowerCase();
}

function getEntryTypeLabel(entry) {
  const entryTypeCode = getEntryTypeCode(entry);

  if (ENTRY_TYPE_LABELS[entryTypeCode]) {
    return ENTRY_TYPE_LABELS[entryTypeCode];
  }

  if (!entryTypeCode) {
    return "Time Entry";
  }

  return entryTypeCode
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getClientName(entry, clientById) {
  if (!entry?.client_id) {
    return "Staff / non-client entry";
  }

  const client = clientById?.[entry.client_id];

  if (!client) {
    return "Client record unavailable";
  }

  return (
    `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
    client.full_name ||
    client.email ||
    "Client"
  );
}
function getEntryDescription(entry) {
  const description = String(entry?.description || "").trim();

  return description || "No description entered";
}

function cardContainsReferenceDate(card, referenceDate) {
  return (
    Boolean(card?.period_start) &&
    Boolean(card?.period_end) &&
    card.period_start <= referenceDate &&
    referenceDate <= card.period_end
  );
}

function TimeCardEntries({ entries, clientById }) {
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");
  const [openDay, setOpenDay] = useState(null);

    const safeEntries = useMemo(
    () => asArray(entries),
    [entries]
  );

  const payPeriodTotalMinutes = useMemo(
    () =>
      safeEntries.reduce(
        (total, entry) =>
          total + Number(entry?.duration_minutes || 0),
        0
      ),
    [safeEntries]
  );

  const entryTypeOptions = useMemo(() => {
    const optionsByCode = new Map();

    for (const entry of safeEntries) {
      const entryTypeCode =
        getEntryTypeCode(entry) || "unknown";

      if (!optionsByCode.has(entryTypeCode)) {
        optionsByCode.set(
          entryTypeCode,
          getEntryTypeLabel(entry)
        );
      }
    }

    return Array.from(optionsByCode.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) =>
        left.label.localeCompare(right.label)
      );
  }, [safeEntries]);

   const filteredEntries = useMemo(() => {
    if (entryTypeFilter === "all") {
      return safeEntries;
    }

    return safeEntries.filter(
      (entry) =>
        getEntryTypeCode(entry) === entryTypeFilter
    );
  }, [entryTypeFilter, safeEntries]);

   const ptoMinutesByDate = useMemo(() => {
    const minutesByDate = new Map();

    for (const entry of safeEntries) {
      if (
        getEntryTypeCode(entry) !== "pto" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry?.date || "")
      ) {
        continue;
      }

      minutesByDate.set(
        entry.date,
        (minutesByDate.get(entry.date) || 0) +
          Number(entry?.duration_minutes || 0)
      );
    }

    return minutesByDate;
  }, [safeEntries]);

  const entriesByDay = useMemo(() => {
    const grouped = new Map();

    for (const entry of filteredEntries) {
      const dateKey =
        /^\d{4}-\d{2}-\d{2}$/.test(entry?.date || "")
          ? entry.date
          : "undated";

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }

      grouped.get(dateKey).push(entry);
    }

    return Array.from(grouped.entries())
      .map(([date, dayEntries]) => ({
        date,
        entries: [...dayEntries].sort((left, right) => {
          const leftKey = `${left?.start_time || ""}|${left?.id || ""}`;
          const rightKey = `${right?.start_time || ""}|${right?.id || ""}`;

          return leftKey.localeCompare(rightKey);
        }),
               totalMinutes: dayEntries.reduce(
          (total, entry) =>
            total + Number(entry?.duration_minutes || 0),
          0
        ),
               ptoMinutes: ptoMinutesByDate.get(date) || 0,
      }))
      .sort((left, right) =>
        left.date.localeCompare(right.date)
      );
  }, [filteredEntries, ptoMinutesByDate]);
  if (safeEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
        No entry snapshot is available for this Time Card.
      </div>
    );
  }

  return (
    <div className="space-y-4">
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-5 py-4">
        <div className="text-sm font-medium uppercase tracking-wide text-blue-800">
          Pay Period Total
        </div>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatDuration(payPeriodTotalMinutes)}
          </div>

          <div className="text-sm text-slate-600">
            {safeEntries.length}{" "}
            {safeEntries.length === 1 ? "entry" : "entries"}{" "}
            in this payroll period
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing {filteredEntries.length} of {safeEntries.length} entries
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Entry type</span>

          <select
            value={entryTypeFilter}
            onChange={(event) =>
              setEntryTypeFilter(event.target.value)
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-slate-900"
          >
            <option value="all">All entry types</option>

            {entryTypeOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {entriesByDay.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
          No entries match this entry-type filter.
        </div>
      ) : (
         entriesByDay.map((day) => {
          const isOpen = openDay === day.date;

          return (
            <div
              key={day.date}
              className="overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenDay((currentDay) =>
                    currentDay === day.date
                      ? null
                      : day.date
                  )
                }
                className="flex w-full flex-wrap items-center justify-between gap-2 bg-slate-100 px-4 py-3 text-left transition hover:bg-slate-200"
              >
                             <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 text-slate-600 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />

                  <div className="font-semibold text-slate-900">
                    {day.date === "undated"
                      ? "Date unavailable"
                      : formatDate(day.date)}
                  </div>

                                   {day.ptoMinutes > 0 ? (
                    <Badge className="bg-red-600 text-white hover:bg-red-600">
                      PTO · {formatDuration(day.ptoMinutes)}
                    </Badge>
                  ) : null}
                </div>

                <Badge className="bg-slate-800 text-white">
                  {formatDuration(day.totalMinutes)} total
                </Badge>
              </button>

              {isOpen ? (
                <div className="space-y-2 border-t p-3">
                  {day.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">
                          {getEntryTypeLabel(entry)}
                        </div>

                        <Badge variant="secondary">
                          {formatDuration(entry.duration_minutes)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-sm font-medium text-slate-700">
                        {getClientName(entry, clientById)}
                      </div>

                      {entry.start_time ? (
                        <div className="mt-1 text-sm text-slate-600">
                          {entry.start_time}
                          {entry.end_time
                            ? ` – ${entry.end_time}`
                            : ""}
                        </div>
                      ) : null}

                      <div className="mt-2 text-sm text-slate-700">
                        {getEntryDescription(entry)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
export default function TimeCardWorkspace({
  onTimeCardChanged,
  onTimeCardPeriodSelected,
  clientById = {},
}) {
  const [referenceDate, setReferenceDate] = useState(
    getTodayDateValue
  );
  const [cards, setCards] = useState([]);
  const [caller, setCaller] = useState(null);
  const [loadingCards, setLoadingCards] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");
    const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const loadCards = useCallback(async () => {
    try {
      setLoadingCards(true);
      setError("");

      const response = await base44.functions.invoke(
        "getAuthorizedTimeCards",
        {
          include_entries: true,
          limit: 100,
        }
      );

      const data = getResponseData(response);

      if (!data.ok) {
        throw new Error(
          data.error || "Unable to load Time Cards."
        );
      }

      setCards(asArray(data.cards));
      setCaller(data.caller || null);
    } catch (loadError) {
      console.error(
        "[TimeCardWorkspace] Failed to load Time Cards:",
        loadError
      );

      setError(
        getErrorMessage(
          loadError,
          "Unable to load Time Cards."
        )
      );
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const callerId = caller?.id || "";
  const callerRole = String(caller?.role || "").toLowerCase();

  const mayReviewTimeCards =
    callerRole === "admin" ||
    callerRole === "management";

  const myCards = useMemo(
    () =>
      cards.filter(
        (card) => card.employee_id === callerId
      ),
    [cards, callerId]
  );

    const currentMyCard = useMemo(
    () =>
      myCards.find(
        (card) =>
          cardContainsReferenceDate(
            card,
            referenceDate
          ) &&
          (card.status === "submitted" ||
            card.status === "returned")
      ) || null,
    [myCards, referenceDate]
  );

  useEffect(() => {
    if (
      !currentMyCard?.period_start ||
      !currentMyCard?.period_end
    ) {
      return;
    }

    onTimeCardPeriodSelected?.({
      period_start: currentMyCard.period_start,
      period_end: currentMyCard.period_end,
      label: currentMyCard.pay_period_label || null,
    });
  }, [
    currentMyCard?.period_start,
    currentMyCard?.period_end,
    currentMyCard?.pay_period_label,
    onTimeCardPeriodSelected,
  ]);

  const submittedReviewCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.status === "submitted" &&
          card.employee_id !== callerId
      ),
    [cards, callerId]
  );

  const approvedCards = useMemo(
    () =>
      cards.filter(
        (card) => card.status === "approved"
      ),
    [cards]
  );

  const handlePreview = useCallback(async () => {
    if (!referenceDate) {
      setError("Choose a date within the payroll period.");
      return;
    }

    try {
      setPreviewLoading(true);
      setError("");
      setNotice("");

      const response = await base44.functions.invoke(
        "mutateAuthorizedTimeCard",
        {
          action: "preview",
          time_card: {
            reference_date: referenceDate,
          },
        }
      );

      const data = getResponseData(response);

           if (!data.ok) {
        throw new Error(
          data.error || "Unable to preview this Time Card."
        );
      }

      if (
        data?.pay_period?.period_start &&
        data?.pay_period?.period_end
      ) {
        onTimeCardPeriodSelected?.({
          period_start: data.pay_period.period_start,
          period_end: data.pay_period.period_end,
          label: data.pay_period.label || null,
        });
      }

      setPreview(data);
    } catch (previewError) {
      console.error(
        "[TimeCardWorkspace] Preview failed:",
        previewError
      );

      setError(
        getErrorMessage(
          previewError,
          "Unable to preview this Time Card."
        )
      );
       } finally {
      setPreviewLoading(false);
    }
  }, [onTimeCardPeriodSelected, referenceDate]);

  const handleSubmit = useCallback(async () => {
    if (!referenceDate) {
      setError("Choose a date within the payroll period.");
      return;
    }

    try {
      setSubmittingCard(true);
      setError("");
      setNotice("");

      const response = await base44.functions.invoke(
        "mutateAuthorizedTimeCard",
        {
          action: "submit",
          time_card: {
            reference_date: referenceDate,
          },
        }
      );

      const data = getResponseData(response);

      if (!data.ok || !data.time_card?.id) {
        throw new Error(
          data.error || "Unable to submit this Time Card."
        );
      }

      setPreview(null);
      setNotice(
        data.resubmitted
          ? "Your corrected Time Card was resubmitted."
          : "Your Time Card was submitted. Entries in this payroll period are now locked from edits."
      );

      await loadCards();
      await onTimeCardChanged?.();
    } catch (submitError) {
      console.error(
        "[TimeCardWorkspace] Submit failed:",
        submitError
      );

      setError(
        getErrorMessage(
          submitError,
          "Unable to submit this Time Card."
        )
      );
    } finally {
      setSubmittingCard(false);
    }
  }, [
    loadCards,
    onTimeCardChanged,
    referenceDate,
  ]);

  const openDecision = useCallback((action, card) => {
    setDecision({
      action,
      card,
    });

    setDecisionNote(
      action === "return_for_correction"
        ? card?.return_note || ""
        : ""
    );
  }, []);

  const closeDecision = useCallback(() => {
    if (decisionLoading) {
      return;
    }

    setDecision(null);
    setDecisionNote("");
  }, [decisionLoading]);

  const handleDecision = useCallback(async () => {
    if (!decision?.card?.id) {
      return;
    }

    if (
      decision.action === "return_for_correction" &&
      !decisionNote.trim()
    ) {
      setError(
        "A correction note is required when returning a Time Card."
      );
      return;
    }

    try {
      setDecisionLoading(true);
      setError("");
      setNotice("");

      const payload =
        decision.action === "return_for_correction"
          ? {
              action: "return_for_correction",
              time_card_id: decision.card.id,
              return_note: decisionNote.trim(),
            }
          : {
              action: "approve",
              time_card_id: decision.card.id,
              approval_note:
                decisionNote.trim() || undefined,
            };

      const response = await base44.functions.invoke(
        "mutateAuthorizedTimeCard",
        payload
      );

      const data = getResponseData(response);

      if (!data.ok || !data.time_card?.id) {
        throw new Error(
          data.error || "Unable to update this Time Card."
        );
      }

      setSelectedCard(null);
      closeDecision();

      setNotice(
        decision.action === "return_for_correction"
          ? "The Time Card was returned to staff for correction."
          : "The Time Card was approved and moved to the archive."
      );

      await loadCards();
      await onTimeCardChanged?.();
    } catch (decisionError) {
      console.error(
        "[TimeCardWorkspace] Review decision failed:",
        decisionError
      );

      setError(
        getErrorMessage(
          decisionError,
          "Unable to update this Time Card."
        )
      );
    } finally {
      setDecisionLoading(false);
    }
  }, [
    closeDecision,
    decision,
    decisionNote,
    loadCards,
    onTimeCardChanged,
  ]);

  return (
    <section className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold">
                My Time Card
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Review and submit the Time Entries in a payroll period.
              Submission locks that period from edits until a manager returns it for correction.
            </p>
          </div>

                   <div className="flex flex-wrap gap-2">
            {approvedCards.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setShowArchive((isVisible) => !isVisible)
                }
                className="gap-2"
              >
                <Archive className="h-4 w-4" />
                {showArchive ? "Hide Archive" : "View Archive"}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={loadCards}
              disabled={loadingCards}
              className="gap-2"
            >
              {loadingCards ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Date within payroll period
            </label>

            <input
              type="date"
              value={referenceDate}
                               onChange={(event) => {
                setReferenceDate(event.target.value);
                setPreview(null);
                setError("");
                setNotice("");
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {!currentMyCard ||
          currentMyCard.status === "returned" ? (
            <Button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || loadingCards}
              className="gap-2"
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Review Time Card
            </Button>
          ) : null}
        </div>

             {currentMyCard && !preview ? (
          <div className="mt-4 rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">
                    {currentMyCard.pay_period_label ||
                      formatDateRange(currentMyCard)}
                  </div>

                  <Badge
                    className={getStatusClasses(
                      currentMyCard.status
                    )}
                  >
                    {getStatusLabel(currentMyCard.status)}
                  </Badge>
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {formatDuration(
                    currentMyCard.total_minutes
                  )}{" "}
                  · {currentMyCard.entry_count}{" "}
                  {currentMyCard.entry_count === 1
                    ? "entry"
                    : "entries"}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelectedCard(currentMyCard)
                }
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                View Entries
              </Button>
            </div>

            {currentMyCard.status === "submitted" ? (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                This Time Card is submitted. Its payroll-period entries cannot be edited unless a manager returns it for correction.
              </div>
            ) : null}

            {currentMyCard.status === "returned" ? (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <div className="font-medium">
                  Returned for correction
                </div>

                <div className="mt-1">
                  {currentMyCard.return_note ||
                    "Your manager did not leave a correction note."}
                </div>
              </div>
            ) : null}
          </div>
               ) : !preview ? (
          <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No submitted or returned Time Card exists for the selected payroll period.
          </div>
        ) : null}
      </Card>

      {preview ? (
        <Card className="border-blue-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">
                Review Before Submission
              </h3>

              <div className="mt-1 text-sm text-slate-600">
                {preview.pay_period?.label ||
                  `${formatDate(
                    preview.pay_period?.period_start
                  )} – ${formatDate(
                    preview.pay_period?.period_end
                  )}`}
              </div>
            </div>

                       <div className="text-sm text-slate-500">
              Review all entries before submitting.
            </div>
          </div>

          {preview.returned_time_card ? (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <div className="font-medium">
                This is a corrected resubmission.
              </div>

              <div className="mt-1">
                {preview.returned_time_card.return_note ||
                  "Review the corrected entries before resubmitting."}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
                      <TimeCardEntries
              entries={preview.entries}
              clientById={clientById}
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={submittingCard}
              onClick={() => setPreview(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={submittingCard}
              onClick={handleSubmit}
              className="gap-2"
            >
              {submittingCard ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {preview.returned_time_card
                ? "Resubmit Time Card"
                : "Submit Time Card"}
            </Button>
          </div>
        </Card>
      ) : null}

      {mayReviewTimeCards ? (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold">
              Management Review Queue
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Review submitted Time Cards for staff you are authorized to supervise.
          </p>

          {loadingCards ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Time Cards…
            </div>
          ) : submittedReviewCards.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-slate-500">
              No submitted Time Cards are waiting for review.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {submittedReviewCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">
                          {card.employee_name}
                        </div>

                        <Badge
                          className={getStatusClasses(
                            card.status
                          )}
                        >
                          {getStatusLabel(card.status)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-sm text-slate-600">
                        {card.pay_period_label ||
                          formatDateRange(card)}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {formatDuration(card.total_minutes)} ·{" "}
                        {card.entry_count}{" "}
                        {card.entry_count === 1
                          ? "entry"
                          : "entries"}{" "}
                        · submitted{" "}
                        {formatTimestamp(
                          card.last_submitted_at
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSelectedCard(card)
                        }
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          openDecision(
                            "return_for_correction",
                            card
                          )
                        }
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Return
                      </Button>

                      <Button
                        type="button"
                        onClick={() =>
                          openDecision(
                            "approve",
                            card
                          )
                        }
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

           {showArchive ? (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold">
              Approved Time Card Archive
            </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Approved Time Cards remain available here for review. Approval archives the Time Card only; it does not change authorization balances.
        </p>

        {loadingCards ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading archive…
          </div>
        ) : approvedCards.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No approved Time Cards are in the archive yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {approvedCards.map((card) => (
              <div
                key={card.id}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">
                        {card.employee_name}
                      </div>

                      <Badge
                        className={getStatusClasses(
                          card.status
                        )}
                      >
                        {getStatusLabel(card.status)}
                      </Badge>
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {card.pay_period_label ||
                        formatDateRange(card)}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {formatDuration(card.total_minutes)} ·{" "}
                      approved{" "}
                      {formatTimestamp(card.approved_at)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSelectedCard(card)
                    }
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
             </Card>
      ) : null}

      {selectedCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">
                    {selectedCard.employee_name}'s Time Card
                  </h3>

                  <Badge
                    className={getStatusClasses(
                      selectedCard.status
                    )}
                  >
                    {getStatusLabel(selectedCard.status)}
                  </Badge>
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {selectedCard.pay_period_label ||
                    formatDateRange(selectedCard)}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedCard(null)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-500">
                    Total time
                  </div>
                  <div className="font-medium">
                    {formatDuration(
                      selectedCard.total_minutes
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Entries
                  </div>
                  <div className="font-medium">
                    {selectedCard.entry_count}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Submission revision
                  </div>
                  <div className="font-medium">
                    {selectedCard.submission_revision}
                  </div>
                </div>
              </div>

              {selectedCard.return_note ? (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
                  <div className="font-medium">
                    Return note
                  </div>

                  <div className="mt-1">
                    {selectedCard.return_note}
                  </div>
                </div>
              ) : null}

              {selectedCard.approval_note ? (
                <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="font-medium">
                    Approval note
                  </div>

                  <div className="mt-1">
                    {selectedCard.approval_note}
                  </div>
                </div>
              ) : null}

                         <TimeCardEntries
                entries={selectedCard.entries}
                clientById={clientById}
              />
              {mayReviewTimeCards &&
              selectedCard.status === "submitted" &&
              selectedCard.employee_id !== callerId ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      openDecision(
                        "return_for_correction",
                        selectedCard
                      )
                    }
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Return for Correction
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      openDecision(
                        "approve",
                        selectedCard
                      )
                    }
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve and Archive
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {decision ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b p-5">
              <h3 className="text-lg font-semibold">
                {decision.action === "return_for_correction"
                  ? "Return Time Card for Correction"
                  : "Approve Time Card"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {decision.card.employee_name} ·{" "}
                {decision.card.pay_period_label ||
                  formatDateRange(decision.card)}
              </p>
            </div>

            <div className="p-5">
              <label className="text-sm font-medium">
                {decision.action === "return_for_correction"
                  ? "Correction note"
                  : "Approval note (optional)"}
              </label>

              <textarea
                value={decisionNote}
                onChange={(event) =>
                  setDecisionNote(event.target.value)
                }
                placeholder={
                  decision.action === "return_for_correction"
                    ? "Explain what must be corrected before resubmission."
                    : "Optional note for the approved Time Card."
                }
                className="mt-2 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={decisionLoading}
              />

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDecision}
                  disabled={decisionLoading}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleDecision}
                  disabled={decisionLoading}
                  className="gap-2"
                >
                  {decisionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : decision.action ===
                    "return_for_correction" ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {decision.action === "return_for_correction"
                    ? "Return Time Card"
                    : "Approve and Archive"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
