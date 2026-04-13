import React, { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import LegacyDataWarning from "@/components/shared/LegacyDataWarning";
import { toast } from "sonner";

const DEFAULT_START_TIME = "07:00";
const DEFAULT_END_TIME = "07:15";

const CATEGORY_OPTIONS = [
  { value: "consultation", label: "Consultation" },
  { value: "resume_work", label: "Resume Work" },
  { value: "job_search", label: "Job Search" },
  { value: "interview_prep", label: "Interview Prep" },
  { value: "follow_up", label: "Follow Up" },
  { value: "job_coaching", label: "Job Coaching" },
  { value: "life_skills", label: "Life Skills" },
  { value: "cbh", label: "CBH" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];

const CAT_COLORS = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  job_coaching: "bg-orange-50 text-orange-700",
  life_skills: "bg-pink-50 text-pink-700",
  cbh: "bg-purple-50 text-purple-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600",
};

const timeLogSectionApi = {
  async createTimeEntry(payload) {
    return await base44.entities.TimeEntry.create(payload);
  },

  async updateTimeEntry(id, payload) {
    return await base44.entities.TimeEntry.update(id, payload);
  },

  async deleteTimeEntry(id) {
    return await base44.entities.TimeEntry.delete(id);
  },

  async createMeeting(payload) {
    return await base44.entities.Meeting.create(payload);
  },
};

function generateQuarterHourOptions() {
  const options = [];

  for (let hour = 0; hour < 24; hour += 1) {
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

function getDefaultForm() {
  return {
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    category: "consultation",
    start_time: DEFAULT_START_TIME,
    end_time: DEFAULT_END_TIME,
  };
}

function deriveTimesFromEntry(entry) {
  let startTime = entry.start_time || DEFAULT_START_TIME;
  let endTime = entry.end_time || DEFAULT_END_TIME;

  if (!entry.start_time && !entry.end_time && entry.duration_minutes) {
    const derivedEndMinutes = 7 * 60 + Number(entry.duration_minutes || 0);
    const derivedEndHour = Math.floor(derivedEndMinutes / 60);
    const derivedEndMinute = derivedEndMinutes % 60;

    startTime = DEFAULT_START_TIME;
    endTime = `${String(derivedEndHour).padStart(2, "0")}:${String(derivedEndMinute).padStart(
      2,
      "0"
    )}`;
  }

  return { startTime, endTime };
}

export default function TimeLogSection({ timeEntries = [], clientId, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(getDefaultForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const timeOptions = useMemo(() => generateQuarterHourOptions(), []);

  const totalMinutes = useMemo(
    () => timeEntries.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
    [timeEntries]
  );

  const totalHours = useMemo(
    () => Math.round((totalMinutes / 60) * 10) / 10,
    [totalMinutes]
  );

  const legacyEntries = useMemo(
    () => timeEntries.filter((entry) => entry.category && !entry.entry_type_code),
    [timeEntries]
  );

  const sortedEntries = useMemo(() => {
    return [...timeEntries].sort((a, b) => {
      const aDate = new Date(a.created_date || a.date || 0).getTime();
      const bDate = new Date(b.created_date || b.date || 0).getTime();
      return bDate - aDate;
    });
  }, [timeEntries]);

  const calculatedDuration = useMemo(
    () => calculateDurationMinutes(form.start_time, form.end_time),
    [form.start_time, form.end_time]
  );

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetDialog = useCallback(() => {
    setShowAdd(false);
    setEditingEntry(null);
    setForm(getDefaultForm());
    setSaving(false);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingEntry(null);
    setForm(getDefaultForm());
    setShowAdd(true);
  }, []);

  const handleEdit = useCallback((entry) => {
    const { startTime, endTime } = deriveTimesFromEntry(entry);

    setEditingEntry(entry);
    setForm({
      date: entry.date || format(new Date(), "yyyy-MM-dd"),
      description: entry.description || "",
      category: entry.category || "consultation",
      start_time: startTime,
      end_time: endTime,
    });
    setShowAdd(true);
  }, []);

  const handleDelete = useCallback(
    async (entryId) => {
      if (!window.confirm("Delete this time entry?")) return;

      try {
        setDeletingId(entryId);
        await timeLogSectionApi.deleteTimeEntry(entryId);
        toast.success("Entry deleted");
        await onRefresh?.();
      } catch (error) {
        console.error("Failed to delete time entry:", error);
        toast.error("Failed to delete entry");
      } finally {
        setDeletingId(null);
      }
    },
    [onRefresh]
  );

  const handleSave = useCallback(async () => {
    if (!form.date) {
      toast.error("Date is required");
      return;
    }

    if (!form.start_time || !form.end_time) {
      toast.error("Start time and end time are required");
      return;
    }

    const duration = calculateDurationMinutes(form.start_time, form.end_time);

    if (!isValidQuarterHourDuration(duration)) {
      toast.error("Duration must be at least 15 minutes and in 15-minute increments");
      return;
    }

    const duplicate = timeEntries.find((entry) => {
      if (editingEntry && entry.id === editingEntry.id) return false;
      if (entry.date !== form.date) return false;
      if (!entry.start_time || !form.start_time) return false;
      return entry.start_time === form.start_time;
    });

    if (duplicate) {
      toast.error(
        `A time entry for this client on ${form.date} at ${form.start_time} already exists.\nOnly one entry is allowed per time slot.`,
        { duration: 5000 }
      );
      return;
    }

    setSaving(true);

    try {
      const reportingPeriodKey = form.date ? form.date.slice(0, 7) : null;
      const payload = {
        date: form.date,
        duration_minutes: duration,
        description: form.description,
        category: form.category,
        start_time: form.start_time,
        end_time: form.end_time,
        legacy_category: form.category,
        reporting_period_key: reportingPeriodKey,
        is_reportable: true,
        is_billable: false,
        is_payroll_eligible: true,
      };

      if (editingEntry) {
        await timeLogSectionApi.updateTimeEntry(editingEntry.id, payload);
        toast.success("Time entry updated");
      } else {
        await timeLogSectionApi.createTimeEntry({
          client_id: clientId,
          ...payload,
          status: "submitted",
          report_ready: false,
        });

        try {
          const startDateTime = new Date(`${form.date}T${form.start_time}`);
          const endDateTime = new Date(`${form.date}T${form.end_time}`);

          await timeLogSectionApi.createMeeting({
            client_id: clientId,
            title: form.description || form.category.replace(/_/g, " "),
            description: form.description,
            meeting_type: form.category,
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            status: "completed",
            location: "Time Entry",
          });
        } catch (meetingError) {
          console.error("Failed to create calendar entry:", meetingError);
        }

        toast.success("Time entry added");
      }

      resetDialog();
      await onRefresh?.();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error(editingEntry ? "Failed to update entry" : "Failed to add entry");
      setSaving(false);
    }
  }, [clientId, editingEntry, form, onRefresh, resetDialog, timeEntries]);

  return (
    <>
      {legacyEntries.length > 0 ? <LegacyDataWarning count={legacyEntries.length} /> : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-slate-100 p-2">
              <Clock className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Time Log</h3>
              <p className="text-sm text-slate-500">{totalHours}h total</p>
            </div>
          </div>

          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="p-4">
          {sortedEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
              No time logged yet
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{entry.duration_minutes}m</Badge>

                      {entry.start_time ? (
                        <Badge variant="outline">{entry.start_time}</Badge>
                      ) : null}

                      <Badge
                        className={cn(
                          "capitalize",
                          CAT_COLORS[entry.category] || CAT_COLORS.other
                        )}
                      >
                        {(entry.category || "other").replace(/_/g, " ")}
                      </Badge>

                      {entry.date ? (
                        <span className="text-xs text-slate-500">
                          {format(new Date(`${entry.date}T00:00:00`), "MMM d")}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-slate-800">
                      {entry.description || "Session"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            resetDialog();
          } else {
            setShowAdd(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateForm("date", e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => updateForm("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Clock In</Label>
                <Select
                  value={form.start_time}
                  onValueChange={(value) => updateForm("start_time", value)}
                >
                  <SelectTrigger>
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
                <Label className="text-xs">Clock Out</Label>
                <Select
                  value={form.end_time}
                  onValueChange={(value) => updateForm("end_time", value)}
                >
                  <SelectTrigger>
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

            <div>
              <Label className="text-xs">Duration</Label>
              <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {calculatedDuration > 0
                  ? `${calculatedDuration} minutes`
                  : "Select start and end time"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
