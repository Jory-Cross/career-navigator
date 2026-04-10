import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import EntryTypePicker from "@/components/time-entry/EntryTypePicker";
import JobCoachingTimeEntryForm from "@/components/time-entry/JobCoachingTimeEntryForm";

function generateQuarterHourOptions() {
  const options = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      const displayHour = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const displayMinute = String(minute).padStart(2, "0");

      options.push({
        value,
        label: `${displayHour}:${displayMinute} ${ampm}`,
      });
    }
  }

  return options;
}

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const diff = endTotal - startTotal;

  if (diff <= 0) return 0;
  return diff;
}

function isValidQuarterHourDuration(minutes) {
  return minutes >= 15 && minutes % 15 === 0;
}

export default function ActiveTimer({ clients, onTimeSaved }) {
  const [selectedClient, setSelectedClient] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showJobCoachingForm, setShowJobCoachingForm] = useState(false);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("07:15");

  const timeOptions = useMemo(() => generateQuarterHourOptions(), []);

  useEffect(() => {
    if (selectedEntryType?.code === "job_coaching" && selectedClient) {
      setShowJobCoachingForm(true);
    }
  }, [selectedEntryType?.code, selectedClient]);

  const handleSave = async () => {
    if (!selectedClient || !selectedEntryType) {
      toast.error("Please select a client and service type");
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    if (!startTime || !endTime) {
      toast.error("Please select clock in and clock out times");
      return;
    }

    const durationMinutes = calculateDurationMinutes(startTime, endTime);

    if (!isValidQuarterHourDuration(durationMinutes)) {
      toast.error("Time must be at least 15 minutes and in 15-minute increments");
      return;
    }

    setSaving(true);

    try {
      const actualClientId = selectedClient?.startsWith("self:") ? null : selectedClient;

      await submitTimeEntryWithDualWrite({
        clientId: actualClientId,
        entryTypeId: selectedEntryType?.id,
        entryTypeCode: selectedEntryType?.code,
        date,
        startTime,
        endTime,
        durationMinutes,
        location: null,
        description: description || selectedEntryType?.name || "Time entry",
        serviceAuthorizationId: null,
        fieldAnswers: {},
        asDraft: true,
      });

      toast.success("Time logged");
      setDescription("");
      setSelectedEntryType(null);
      setSelectedClient("");
      setDate("");
      setStartTime("07:00");
      setEndTime("07:15");

      if (onTimeSaved) onTimeSaved();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error("Failed to log time");
    } finally {
      setSaving(false);
    }
  };

  const durationMinutes = calculateDurationMinutes(startTime, endTime);

  if (showJobCoachingForm && selectedClient) {
    return (
      <Card className={cn("border-0 shadow-sm overflow-hidden")}>
        <div className="h-1 w-full bg-emerald-400" />
        <div className="p-5">
          <div className="mb-4">
            <button
              className="text-sm text-slate-500 hover:text-slate-700"
              onClick={() => {
                setShowJobCoachingForm(false);
                setSelectedEntryType(null);
              }}
            >
              ← Back
            </button>
          </div>
          <JobCoachingTimeEntryForm
            clientId={selectedClient}
            onSuccess={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
              setSelectedClient("");
              setDescription("");
              setDate("");
              setStartTime("07:00");
              setEndTime("07:15");
              onTimeSaved?.();
            }}
            onCancel={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
            }}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-slate-100" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Clock className="w-4 h-4" />
          <span>Time Entry</span>
        </div>

        <div className="space-y-2.5">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="border-slate-200 text-sm">
              <SelectValue placeholder="Select client..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self:true">👤 Myself (no client)</SelectItem>
              {clients
                .filter((c) => c.status === "active" && !c.is_archived)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-slate-200 text-sm"
          />

          <Input
            placeholder="Description (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-slate-200 text-sm"
          />

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Service Type *
            </label>
            <EntryTypePicker
              value={selectedEntryType?.id || selectedEntryType?.code || ""}
              onChange={setSelectedEntryType}
              mode="select"
              showDescriptions={false}
              groupByProgram={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">
                Clock In
              </label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="border-slate-200 text-sm">
                  <SelectValue placeholder="Start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">
                Clock Out
              </label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="border-slate-200 text-sm">
                  <SelectValue placeholder="End time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Duration: {durationMinutes > 0 ? `${durationMinutes} minutes` : "Select start and end time"}
          </div>
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleSave}
          disabled={!selectedClient || !selectedEntryType || saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>Save Time Entry</>
          )}
        </Button>
      </div>
    </Card>
  );
}
