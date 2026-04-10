import React from "react";
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

const TIME_OPTIONS = generateQuarterHourOptions();

export default function FieldRenderer({ field, value, onChange, formData = {} }) {
  const durationFromClock =
    formData?.start_time && formData?.end_time
      ? calculateDurationMinutes(formData.start_time, formData.end_time)
      : 0;

  // Hide editable duration field when clock-in/clock-out fields are present
  if (
    (field.key === "duration" || field.key === "duration_minutes") &&
    formData?.start_time !== undefined &&
    formData?.end_time !== undefined
  ) {
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium">Duration</Label>
        <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-600">
          {durationFromClock > 0
            ? `${durationFromClock} minutes`
            : "Select start and end time"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {field.type === "text" && (
        <Input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}

      {field.type === "number" && (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}

      {field.type === "date" && (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}

      {field.type === "time" && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select time..." />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "textarea" && (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm min-h-20"
        />
      )}

      {field.type === "select" && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <SelectItem key={optValue} value={optValue}>
                  {optLabel}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
