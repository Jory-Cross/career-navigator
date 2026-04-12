import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData } from "@/lib/formHelpers";
import { buildFormDataFromEntry } from "@/lib/timeEntryRehydration";
import { handleDynamicEntrySave } from "@/lib/handleDynamicEntrySave";
import { persistTimeEntry } from "@/lib/persistTimeEntry";
import { base44 } from "@/api/base44Client";
import {
  normalizeEntryTypeCode,
  getEntryTypeConfig,
  ENTRY_TYPE_ALIASES,
} from "@/lib/entryTypeRegistry";

function getCandidateCodes(entryTypeCode) {
  if (!entryTypeCode) return [];

  const originalCode = String(entryTypeCode).trim();
  const normalizedCode = normalizeEntryTypeCode(originalCode);

  const reverseAliases = Object.entries(ENTRY_TYPE_ALIASES)
    .filter(([, canonical]) => canonical === normalizedCode)
    .map(([alias]) => alias);

  return [...new Set([originalCode, normalizedCode, ...reverseAliases])].filter(Boolean);
}

async function resolveEntryTypeByCode(entryTypeCode) {
  const candidateCodes = getCandidateCodes(entryTypeCode);

  for (const code of candidateCodes) {
    try {
      const results = await base44.entities.EntryType.filter({
        code,
      });

      if (results?.length) {
        return results[0];
      }
    } catch (err) {
      console.error(
        `[DynamicEntryForm] Failed entry type lookup for code "${code}":`,
        err
      );
    }
  }

  return null;
}

function parseTimeToMinutes(value) {
  if (!value) return null;

  const raw = String(value).trim();

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const ampm = ampmMatch[3].toUpperCase();

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour < 1 || hour > 12) return null;

    if (ampm === "AM") {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }

    return hour * 60 + minute;
  }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = Number(hhmmMatch[2]);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;

    return hour * 60 + minute;
  }

  return null;
}

function validateChronologicalTimes(formData) {
  const startTime =
    formData?.start_time ??
    formData?.startTime ??
    formData?.clock_in ??
    formData?.clockIn ??
    null;

  const endTime =
    formData?.end_time ??
    formData?.endTime ??
    formData?.clock_out ??
    formData?.clockOut ??
    null;

  if (!startTime || !endTime) {
    return "";
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null) {
    return "";
  }

  if (endMinutes <= startMinutes) {
    return "End time must be after start time.";
  }

  return "";
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
  const normalizedSchema = Array.isArray(schema) ? schema : [];
  const normalizedEntryTypeCode = normalizeEntryTypeCode(entryTypeCode);

  const initialData = useMemo(() => {
    if (entry?.id) {
      return buildFormDataFromEntry(entry, { fields: normalizedSchema });
    }
    return buildInitialFormData(normalizedSchema, null);
  }, [normalizedSchema, entry]);

  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypeObj, setEntryTypeObj] = useState(null);
  const [entryTypeLoading, setEntryTypeLoading] = useState(false);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    let active = true;

    async function loadEntryType() {
      if (!normalizedEntryTypeCode) {
        setEntryTypeObj(null);
        return;
      }

      const config = getEntryTypeConfig(normalizedEntryTypeCode);
      if (!config) {
        setEntryTypeObj(null);
        setError(`Could not resolve entry type for code "${normalizedEntryTypeCode}".`);
        return;
      }

      setEntryTypeLoading(true);
      setError("");

      try {
        const resolved = await resolveEntryTypeByCode(entryTypeCode || normalizedEntryTypeCode);

        if (!active) return;

        if (!resolved) {
          setEntryTypeObj(null);
          setError(`Could not resolve entry type for code "${normalizedEntryTypeCode}".`);
          return;
        }

        setEntryTypeObj(resolved);
      } catch (err) {
        console.error("[DynamicEntryForm] Failed to load entry type:", err);
        if (active) {
          setEntryTypeObj(null);
          setError("Failed to load entry type.");
        }
      } finally {
        if (active) {
          setEntryTypeLoading(false);
        }
      }
    }

    loadEntryType();

    return () => {
      active = false;
    };
  }, [entryTypeCode, normalizedEntryTypeCode]);

  function handleChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!entryTypeObj?.id) {
      setError(
        "Entry type is still loading or could not be resolved. Please wait a moment and try again."
      );
      return;
    }

    const timeValidationError = validateChronologicalTimes(formData);
    if (timeValidationError) {
      setError(timeValidationError);
      return;
    }

    setSaving(true);

    try {
      await handleDynamicEntrySave({
        entryType: {
          id: entryTypeObj.id,
          code: normalizeEntryTypeCode(entryTypeObj.code || normalizedEntryTypeCode),
          name: entryTypeObj?.name,
        },
        formData,
        schema: normalizedSchema,
        existingEntry: entry,
        mode,
        saveEntry: (payload) =>
          persistTimeEntry(payload, entry?.id ?? null, clientId),
      });

      if (onSave) {
        await onSave();
      }
    } catch (err) {
      console.error("[DynamicEntryForm] Save failed:", err);
      setError(err?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {normalizedSchema.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={formData[field.key]}
          onChange={(value) => handleChange(field.key, value)}
          formData={formData}
        />
      ))}

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || entryTypeLoading || !entryTypeObj?.id}
        >
          {(saving || entryTypeLoading) && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
