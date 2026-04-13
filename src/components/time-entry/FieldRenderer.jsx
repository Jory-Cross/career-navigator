import React, { memo, useMemo } from "react";
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

const TIME_OPTIONS = generateQuarterHourOptions();

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return 0;
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const diff = endTotal - startTotal;

  if (diff <= 0) return 0;
  return diff;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  return options
    .map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        const value = String(opt);
        return { value, label: value };
      }

      if (!opt || typeof opt !== "object") {
        return null;
      }

      const value = opt.value ?? opt.code ?? opt.id ?? opt.label;
      const label = opt.label ?? opt.name ?? opt.title ?? value;

      if (value == null || label == null) {
        return null;
      }

      return {
        value: String(value),
        label: String(label),
      };
    })
    .filter(Boolean);
}

function FieldRendererComponent({ field, value, onChange, formData = {} }) {
  const durationFromClock = useMemo(() => {
    if (!formData?.start_time || !formData?.end_time) return 0;
    return calculateDurationMinutes(formData.start_time, formData.end_time);
  }, [formData?.start_time, formData?.end_time]);

  const shouldHideDurationInput =
    (field.key === "duration" || field.key === "duration_minutes") &&
    formData?.start_time !== undefined &&
    formData?.end_time !== undefined;

  const normalizedOptions = useMemo(() => {
    if (field.type !== "select") return [];
    return normalizeOptions(field.options || []);
  }, [field.type, field.options]);

  const label = field.label || field.key || "Field";
  const required = Boolean(field.required);
  const placeholder = field.placeholder || "";

  if (shouldHideDurationInput) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Duration
          {required ? " *" : ""}
        </Label>
        <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
          {durationFromClock > 0
            ? `${durationFromClock} minutes`
            : "Select start and end time"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </Label>

      {field.type === "text" ? (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : null}

      {field.type === "number" ? (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : null}

      {field.type === "date" ? (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      ) : null}

      {field.type === "time" ? (
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
      ) : null}

      {field.type === "textarea" ? (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-20 text-sm"
        />
      ) : null}

      {field.type === "select" ? (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {!["text", "number", "date", "time", "textarea", "select"].includes(field.type) ? (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : null}
    </div>
  );
}

const FieldRenderer = memo(FieldRendererComponent);

export default FieldRenderer;
