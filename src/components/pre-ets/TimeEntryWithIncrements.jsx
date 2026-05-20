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

  const { data: rejectedEntries = [] } = useQuery({
    queryKey: ["preEtsRejectedTimeEntries", clientId],
    queryFn: async () => {
      const records = await base44.entities.PreEtsClientTimeEntry.filter({
        client_id: clientId,
        status: "rejected",
      });

      return Array.isArray(records) ? records : [];
    },
    enabled: !!clientId,
    refetchOnMount: "always",
  });
  
  const durationMinutes = useMemo(() => calculateDuration(startTime, endTime), [startTime, endTime]);

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

  const canSave = startTime && endTime && durationMinutes && !validationError;

    const loadRejectedEntryForCorrection = (entry) => {
    setCorrectionEntryId(entry.id);
    setDate(entry.date || format(new Date(), "yyyy-MM-dd"));
    setStartTime(entry.start_time || "");
    setEndTime(entry.end_time || "");
    setNotes(entry.description || "");
    toast.info("Rejected entry loaded. Make corrections and resubmit.");
  };

  
  const handleSave = async () => {
    if (!canSave) {
      toast.error("Please resolve validation errors");
      return;
    }

    setSaving(true);
    try {
            const payload = {
        client_id: clientId,
        client_name: clientName || "",
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        description: notes || "Work session",
        source: "client_portal",
        status: "pending",
        rejection_reason: null,
        resubmitted_at: correctionEntryId ? new Date().toISOString() : null,
      };

      if (correctionEntryId) {
        await base44.entities.PreEtsClientTimeEntry.update(correctionEntryId, payload);
      } else {
        await base44.entities.PreEtsClientTimeEntry.create(payload);
      }

      toast.success(`Time entry saved: ${formatDurationDisplay(durationMinutes)}`);

      await queryClient.invalidateQueries({
        queryKey: ["preEtsRejectedTimeEntries", clientId],
      });
      
      // Reset form
      setStartTime("");
      setEndTime("");
      setNotes("");
      setCorrectionEntryId(null);
      setShowPreview(false);
    } catch (error) {
      toast.error("Failed to save time entry");
      console.error(error);
    } finally {
      setSaving(false);
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

            {rejectedEntries.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900">
                  Time Entries Needing Correction
                </p>

                <p className="mt-1 text-xs text-red-700">
                  Please review the rejection reason, correct the time entry,
                  and resubmit it for staff approval.
                </p>

                <div className="mt-3 space-y-3">
                  {rejectedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-red-200 bg-white p-3"
                    >
                      <div className="text-xs text-slate-600">
                        <strong>Date:</strong> {entry.date || "—"} |{" "}
                        <strong>Start:</strong> {entry.start_time || "—"} |{" "}
                        <strong>Stop:</strong> {entry.end_time || "—"}
                      </div>

                      <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">
                        <strong>Reason:</strong>{" "}
                        {entry.rejection_reason || "No reason provided"}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => loadRejectedEntryForCorrection(entry)}
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
