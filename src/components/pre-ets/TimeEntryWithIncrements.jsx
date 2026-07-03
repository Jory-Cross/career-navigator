import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Generate time options in 15-minute increments
function generateTimeOptions() {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      times.push(timeStr);
    }
  }
  return times;
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return null;

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;

  if (endTotalMin <= startTotalMin) return null;

  return endTotalMin - startTotalMin;
}

function formatDurationDisplay(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} minute${mins !== 1 ? "s" : ""}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours} hour${hours !== 1 ? "s" : ""} ${mins} minute${mins !== 1 ? "s" : ""}`;
}

export default function TimeEntryWithIncrements({
  clientId,
  clientName,
  employeeId = null,
}) {
  const queryClient = useQueryClient();
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [correctionEntryId, setCorrectionEntryId] = useState(null);
    const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [resubmittingTimeCardId, setResubmittingTimeCardId] =
    useState(null);
    const {
    data: studentTimeEntryData = { entries: [] },
  } = useQuery({
    queryKey: ["preEtsStudentTimeEntries"],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "getAuthorizedPreEtsStudentTimeEntries",
        {}
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "Your Pre-ETS time entries could not be loaded."
        );
      }

      return {
        entries: Array.isArray(data?.entries) ? data.entries : [],
      };
    },
    refetchOnMount: "always",
  });

  const {
    data: studentTimeCardData = { cards: [] },
  } = useQuery({
    queryKey: ["preEtsStudentTimeCards"],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "getAuthorizedPreEtsTimeCards",
        {
          include_entries: true,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "Your Pre-ETS Time Cards could not be loaded."
        );
      }

      return {
        cards: Array.isArray(data?.cards) ? data.cards : [],
      };
    },
    refetchOnMount: "always",
  });

    const studentEntries = Array.isArray(studentTimeEntryData?.entries)
    ? studentTimeEntryData.entries
    : [];

  const returnedTimeCardsForResubmission = useMemo(() => {
    const cards = Array.isArray(studentTimeCardData?.cards)
      ? studentTimeCardData.cards
      : [];

    return cards
      .filter(
        (timeCard) =>
          timeCard?.id &&
          timeCard?.status === "returned_to_student"
      )
      .sort((left, right) => {
        const leftKey = `${left?.period_start || ""}:${left?.id || ""}`;
        const rightKey = `${right?.period_start || ""}:${right?.id || ""}`;

        return rightKey.localeCompare(leftKey);
      });
  }, [studentTimeCardData]);

  const correctionEntries = useMemo(() => {
    const entriesById = new Map(
      studentEntries
        .filter((entry) => entry?.id)
        .map((entry) => [entry.id, entry])
    );

    const correctionEntriesById = new Map();

    for (const entry of studentEntries) {
      if (entry?.status !== "rejected" || !entry?.id) {
        continue;
      }

      correctionEntriesById.set(entry.id, {
        ...entry,
        correction_type: "individual_rejection",
        correction_note:
          entry?.rejection_reason || "No rejection reason was provided.",
      });
    }

    const returnedTimeCards = Array.isArray(studentTimeCardData?.cards)
      ? studentTimeCardData.cards.filter(
          (card) => card?.status === "returned_to_student"
        )
      : [];

    for (const timeCard of returnedTimeCards) {
      const snapshotEntries = Array.isArray(timeCard?.entries)
        ? timeCard.entries
        : [];

      for (const snapshotEntry of snapshotEntries) {
        const entryId = snapshotEntry?.id;

        if (!entryId || correctionEntriesById.has(entryId)) {
          continue;
        }

        const currentEntry = entriesById.get(entryId);

        if (!currentEntry) {
          continue;
        }

        correctionEntriesById.set(entryId, {
          ...currentEntry,
          correction_type: "time_card_return",
          correction_note:
            timeCard?.return_to_student_note ||
            "Staff returned this Time Card for correction.",
        });
      }
    }

    return Array.from(correctionEntriesById.values()).sort((left, right) => {
      const leftKey = `${left?.date || ""}T${left?.start_time || ""}`;
      const rightKey = `${right?.date || ""}T${right?.start_time || ""}`;

      return rightKey.localeCompare(leftKey);
    });
  }, [studentEntries, studentTimeCardData]);

  const durationMinutes = useMemo(
    () => calculateDuration(startTime, endTime),
    [startTime, endTime]
  );

  const validationError = useMemo(() => {
    if (startTime && endTime && !durationMinutes) {
      return "Stop Time must be later than Start Time";
    }
    if (durationMinutes && durationMinutes < 15) {
      return "Duration must be at least 15 minutes";
    }
    if (durationMinutes && durationMinutes % 15 !== 0) {
      return "Duration must be in 15-minute increments";
    }
    return null;
  }, [startTime, endTime, durationMinutes]);

  const canSave =
    startTime &&
    endTime &&
    durationMinutes &&
    !validationError;

  const loadEntryForCorrection = (entry) => {
    setCorrectionEntryId(entry.id);
    setDate(entry.date || format(new Date(), "yyyy-MM-dd"));
    setStartTime(entry.start_time || "");
    setEndTime(entry.end_time || "");
    setNotes(entry.description || "");
    toast.info("Time entry loaded. Make corrections and resubmit.");
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Please resolve validation errors");
      return;
    }

    setSaving(true);

    try {
      const action = correctionEntryId
        ? "resubmit_student_entry"
        : "create_student_entry";

      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsTimeEntry",
        {
          action,
          ...(correctionEntryId
            ? { entry_id: correctionEntryId }
            : {}),
          entry: {
            date,
            start_time: startTime,
            end_time: endTime,
            description: notes.trim() || "Work session",
          },
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "Your Pre-ETS time entry could not be saved."
        );
      }

      toast.success(
        correctionEntryId
          ? `Corrected time entry resubmitted: ${formatDurationDisplay(
              durationMinutes
            )}`
          : `Time entry saved: ${formatDurationDisplay(durationMinutes)}`
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["preEtsStudentTimeEntries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["preEtsStudentTimeCards"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["preEtsTimeCards"],
        }),
      ]);

      setStartTime("");
      setEndTime("");
      setNotes("");
      setCorrectionEntryId(null);
      setShowPreview(false);
    } catch (error) {
      const errorData =
        error?.response?.data?.data ??
        error?.response?.data ??
        error?.data ??
        {};

      toast.error(
        errorData?.error ||
          error?.message ||
          "Your Pre-ETS time entry could not be saved."
      );

      console.error("Failed to save Pre-ETS time entry", error);
      } finally {
      setSaving(false);
    }
  };

  const handleResubmitTimeCard = async (timeCard) => {
    const timeCardId = timeCard?.id || "";
    const referenceDate =
      timeCard?.period_start ||
      timeCard?.entries?.[0]?.date ||
      "";

    if (!timeCardId || !referenceDate) {
      toast.error(
        "This returned Time Card is missing the payroll-period information needed for resubmission."
      );
      return;
    }

    setResubmittingTimeCardId(timeCardId);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsTimeCard",
        {
          action: "submit_student_time_card",
          time_card: {
            reference_date: referenceDate,
          },
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "Your Pre-ETS Time Card could not be resubmitted."
        );
      }

      toast.success(
        data?.message ||
          "Your corrected Pre-ETS Time Card was resubmitted to staff."
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["preEtsStudentTimeEntries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["preEtsStudentTimeCards"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["preEtsTimeCards"],
        }),
      ]);
    } catch (error) {
      const errorData =
        error?.response?.data?.data ??
        error?.response?.data ??
        error?.data ??
        {};

      toast.error(
        errorData?.error ||
          error?.message ||
          "Your Pre-ETS Time Card could not be resubmitted."
      );

      console.error(
        "Failed to resubmit Pre-ETS Time Card",
        error
      );
    } finally {
      setResubmittingTimeCardId(null);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Time Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">

                      {correctionEntries.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Time Entries Needing Correction
                </p>

                <p className="mt-1 text-xs text-amber-800">
                  Staff returned a Time Card or rejected an individual entry.
                  Select an entry, make the needed correction, and resubmit it
                  before resubmitting the Time Card.
                </p>

                <div className="mt-3 space-y-3">
                  {correctionEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-amber-200 bg-white p-3"
                    >
                      <div className="text-xs text-slate-600">
                        <strong>Date:</strong> {entry.date || "—"} |{" "}
                        <strong>Start:</strong> {entry.start_time || "—"} |{" "}
                        <strong>Stop:</strong> {entry.end_time || "—"}
                      </div>

                      <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
                        <strong>
                          {entry.correction_type === "time_card_return"
                            ? "Staff correction note:"
                            : "Rejection reason:"}
                        </strong>{" "}
                        {entry.correction_note}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => loadEntryForCorrection(entry)}
                      >
                        Correct This Entry
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Date */}
            <div>
              <Label htmlFor="date" className="text-xs font-medium mb-1.5 block">
                Date
              </Label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            {/* Start Time */}
            <div>
              <Label htmlFor="start-time" className="text-xs font-medium mb-1.5 block">
                Start Time
              </Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(time => (
                    <SelectItem key={`start-${time}`} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stop Time */}
            <div>
              <Label htmlFor="stop-time" className="text-xs font-medium mb-1.5 block">
                Stop Time
              </Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="stop-time">
                  <SelectValue placeholder="Select stop time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(time => (
                    <SelectItem key={`end-${time}`} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration Display */}
            {startTime && endTime && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Duration</p>
                <p className="text-lg font-semibold text-slate-900">
                  {durationMinutes ? formatDurationDisplay(durationMinutes) : "—"}
                </p>
              </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{validationError}</p>
              </div>
            )}

            {/* Work Description */}
            <div>
              <Label htmlFor="notes" className="text-xs font-medium mb-1.5 block">
                Work Description (optional)
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you work on?"
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={() => setShowPreview(true)}
              disabled={!canSave || saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save Time Entry"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Start</p>
                <p className="text-sm font-semibold text-slate-900">{startTime}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Stop</p>
                <p className="text-sm font-semibold text-slate-900">{endTime}</p>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 mb-1">Total Duration</p>
              <p className="text-lg font-bold text-blue-900">
                {formatDurationDisplay(durationMinutes)}
              </p>
            </div>
            {notes && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700">{notes}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              disabled={saving}
            >
              Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
