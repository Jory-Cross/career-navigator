import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData } from "@/lib/formHelpers";
import { buildFormDataFromEntry } from "@/lib/timeEntryRehydration";
import { handleDynamicEntrySave } from "@/lib/handleDynamicEntrySave";
import { persistTimeEntry } from "@/lib/persistTimeEntry";
import { base44 } from "@/api/base44Client";

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const diff = endTotal - startTotal;

  if (diff <= 0) return 0;
  return diff;
}

export default function DynamicEntryForm({
  entryTypeCode,
  schema,
  entry = null,
  clientId = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const initialData = useMemo(() => {
    if (entry?.id) {
      const data = buildFormDataFromEntry(entry, { fields: schema });
      return data;
    }
    return buildInitialFormData(schema, null);
  }, [schema, entry]);

  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypeObj, setEntryTypeObj] = useState(null);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    base44.entities.EntryType.filter({ code: entryTypeCode, is_active: true })
      .then((results) => {
        if (results.length > 0) setEntryTypeObj(results[0]);
      })
      .catch((err) => console.error("Failed to load entry type:", err));
  }, [entryTypeCode]);

  const hasClockRange = useMemo(() => {
    const keys = new Set((schema || []).map((field) => field.key));
    return keys.has("start_time") && keys.has("end_time");
  }, [schema]);

  const visibleFields = useMemo(() => {
    if (!hasClockRange) return schema || [];

    return (schema || []).filter((field) => {
      const key = field.key || "";
      const label = (field.label || "").toLowerCase();

      if (key === "duration_minutes") return false;
      if (key === "duration") return false;
      if (key === "hours") return false;
      if (key === "hours_spent") return false;
      if (label.includes("duration")) return false;
      if (label.includes("hours spent")) return false;

      return true;
    });
  }, [schema, hasClockRange]);

  const calculatedDuration = useMemo(() => {
    return calculateDurationMinutes(formData.start_time, formData.end_time);
  }, [formData.start_time, formData.end_time]);

  function handleChange(key, value) {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };

      if (hasClockRange) {
        const nextDuration = calculateDurationMinutes(next.start_time, next.end_time);
        next.duration_minutes = nextDuration > 0 ? nextDuration : "";
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const finalFormData = { ...formData };

      if (hasClockRange) {
        const nextDuration = calculateDurationMinutes(finalFormData.start_time, finalFormData.end_time);
        finalFormData.duration_minutes = nextDuration;

        if (!finalFormData.start_time || !finalFormData.end_time) {
          throw new Error("Start time and end time are required.");
        }

        if (nextDuration < 15 || nextDuration % 15 !== 0) {
          throw new Error("Duration must be at least 15 minutes and in 15-minute increments.");
        }
      }

      await handleDynamicEntrySave({
        entryType: {
          id: entryTypeObj?.id,
          code: entryTypeCode,
          name: entryTypeObj?.name,
        },
        formData: finalFormData,
        schema,
        existingEntry: entry,
        mode,
        saveEntry: (payload) => persistTimeEntry(payload, entry?.id ?? null, clientId),
      });

      if (onSave) await onSave();
    } catch (err) {
      console.error("[DynamicEntryForm] Save failed:", err);
      setError(err?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={formData[field.key]}
          onChange={(value) => handleChange(field.key, value)}
        />
      ))}

      {hasClockRange && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Duration: {calculatedDuration > 0 ? `${calculatedDuration} minutes` : "Select start and end time"}
        </div>
      )}

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
