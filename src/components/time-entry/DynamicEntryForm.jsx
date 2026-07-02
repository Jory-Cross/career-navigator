import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
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

const entryTypeCache = new Map();

const dynamicEntryFormApi = {
  async getEntryTypeByCode(entryTypeCode) {
    const candidateCodes = getCandidateCodes(entryTypeCode);

    for (const code of candidateCodes) {
      if (entryTypeCache.has(code)) {
        const cached = entryTypeCache.get(code);
        if (cached) return cached;
      }

           try {
        const results = await base44.entities.EntryType.filter({ code });

        const normalizedCandidateCode = String(code)
          .trim()
          .toLowerCase();

        const exactMatches = (
          Array.isArray(results) ? results : []
        ).filter((entryType) => {
          const resolvedCode = String(entryType?.code || "")
            .trim()
            .toLowerCase();

          return (
            resolvedCode === normalizedCandidateCode &&
            entryType?.is_active !== false &&
            entryType?.is_archived !== true
          );
        });

        if (exactMatches.length === 1) {
          const resolved = exactMatches[0];

          for (const candidate of candidateCodes) {
            entryTypeCache.set(candidate, resolved);
          }

          return resolved;
        }

        if (exactMatches.length > 1) {
          console.error(
            `[DynamicEntryForm] Found ${exactMatches.length} active EntryType records for code "${normalizedCandidateCode}".`
          );
        }
      } catch (err) {
        console.error(
          `[DynamicEntryForm] Failed entry type lookup for code "${code}":`,
          err
        );
      }    }

    for (const candidate of candidateCodes) {
      entryTypeCache.set(candidate, null);
    }

    return null;
  },
};

function getCandidateCodes(entryTypeCode) {
  if (!entryTypeCode) return [];

  const originalCode = String(entryTypeCode).trim();
  const normalizedCode = normalizeEntryTypeCode(originalCode);

  const reverseAliases = Object.entries(ENTRY_TYPE_ALIASES)
    .filter(([, canonical]) => canonical === normalizedCode)
    .map(([alias]) => alias);

  return [...new Set([originalCode, normalizedCode, ...reverseAliases])].filter(Boolean);
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
    } else if (hour !== 12) {
      hour += 12;
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

export function clearDynamicEntryFormEntryTypeCache() {
  entryTypeCache.clear();
}

function formatMonthYearFromDate(value) {
  if (!value || typeof value !== "string") return "";

  const parts = value.split("-");
  if (parts.length !== 3) return "";

  const year = parts[0];
  const month = parts[1];

  if (!year || !month) return "";

  return `${month}/${year}`;
}

export default function DynamicEntryForm({
  entryTypeCode,
  schema,
  entry = null,
  clientId = null,
  clientTargetRole = "",
  mode = "create",
  onSave,
  onCancel,
}) {
  const mountedRef = useRef(true);
  const lookupRunIdRef = useRef(0);

  const normalizedSchema = useMemo(() => {
    return Array.isArray(schema) ? schema : [];
  }, [schema]);

  const normalizedEntryTypeCode = useMemo(() => {
    return normalizeEntryTypeCode(entryTypeCode);
  }, [entryTypeCode]);

  const config = useMemo(() => {
    return getEntryTypeConfig(normalizedEntryTypeCode);
  }, [normalizedEntryTypeCode]);

  // Helper: find schema fields that represent a "job goal / target role" field
  const findTargetRoleFields = useCallback((schemaFields) => {
    return (schemaFields || []).filter((f) => {
      if (!f?.key) return false;
      const key = f.key.toLowerCase();
      const label = (f.label || "").toLowerCase();
      return (
        key === "job_goal" ||
        key === "target_role" ||
        label === "job goal" ||
        label.includes("target role")
      );
    });
  }, []);

  const initialData = useMemo(() => {
    let data;
    if (entry?.id) {
      // EDIT MODE: load from entry.form_data, don't initialize missing schema fields
      // This prevents blank strings from overwriting saved form_data
      data = buildFormDataFromEntry(entry, { fields: normalizedSchema });

      if (clientTargetRole) {
        for (const field of findTargetRoleFields(normalizedSchema)) {
          if (!data[field.key]) {
            data[field.key] = clientTargetRole;
          }
        }
      }

      return data;
    }

    // CREATE MODE: initialize all schema fields as empty strings
    data = buildInitialFormData(normalizedSchema, null);
    const initialized = { ...data };

    if (clientTargetRole) {
      for (const field of findTargetRoleFields(normalizedSchema)) {
        if (!initialized[field.key]) {
          initialized[field.key] = clientTargetRole;
        }
      }
    }

    if (Array.isArray(normalizedSchema)) {
      for (const field of normalizedSchema) {
        if (field?.key && initialized[field.key] === undefined) {
          initialized[field.key] = "";
        }
      }
    }
    return initialized;
    // Only depend on entry.id and entry to prevent re-rehydration on schema changes
  }, [entry?.id, entry, clientTargetRole]);

  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypeObj, setEntryTypeObj] = useState(null);
  const hasUnsavedChangesRef = useRef(false);
  const [entryTypeLoading, setEntryTypeLoading] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

   // Sync form data when initialData changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntryType() {
      if (!normalizedEntryTypeCode) {
        setEntryTypeObj(null);
        setEntryTypeLoading(false);
        setError("No entry type selected.");
        return;
      }

      if (!config) {
        setEntryTypeObj(null);
        setEntryTypeLoading(false);
        setError(`Could not resolve entry type for code "${normalizedEntryTypeCode}".`);
        return;
      }

      const runId = ++lookupRunIdRef.current;
      setEntryTypeLoading(true);
      setError("");

      try {
        const resolved = await dynamicEntryFormApi.getEntryTypeByCode(
          entryTypeCode || normalizedEntryTypeCode
        );

        if (cancelled || !mountedRef.current || lookupRunIdRef.current !== runId) {
          return;
        }

        if (!resolved) {
          setEntryTypeObj(null);
          setError(`Could not resolve entry type for code "${normalizedEntryTypeCode}".`);
          return;
        }

        setEntryTypeObj(resolved);
      } catch (err) {
        console.error("[DynamicEntryForm] Failed to load entry type:", err);

        if (cancelled || !mountedRef.current || lookupRunIdRef.current !== runId) {
          return;
        }

        setEntryTypeObj(null);
        setError("Failed to load entry type.");
      } finally {
        if (!cancelled && mountedRef.current && lookupRunIdRef.current === runId) {
          setEntryTypeLoading(false);
        }
      }
    }

    loadEntryType();

    return () => {
      cancelled = true;
    };
  }, [entryTypeCode, normalizedEntryTypeCode, config]);

  const handleChange = useCallback((key, value) => {
  hasUnsavedChangesRef.current = true;

  setFormData((prev) => {
    const next = { ...prev, [key]: value };

    if (key === "development_date") {
      next.month_year = formatMonthYearFromDate(value);
    }

    return next;
  });
}, []);

  const handleSubmit = useCallback(
    async (e) => {
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
        const savedEntry = await handleDynamicEntrySave({
          entryType: {
            id: entryTypeObj.id,
            code: normalizeEntryTypeCode(
              entryTypeObj.code || normalizedEntryTypeCode
            ),
            name: entryTypeObj?.name,
          },
          formData,
          schema: normalizedSchema,
          existingEntry: entry,
          mode,
          saveEntry: (payload) =>
            persistTimeEntry(payload, entry?.id ?? null, clientId),
        });

        if (typeof onSave === "function") {
          await onSave(savedEntry);
        }
           } catch (err) {
        console.error("[DynamicEntryForm] Save failed:", err);

        const serverMessage =
          typeof err?.response?.data?.error === "string"
            ? err.response.data.error.trim()
            : "";

        const timeCardLockMatch = serverMessage.match(
          /^A (submitted|approved) Time Card locks this employee's entries for (.+?)\. A manager must return the Time Card for correction before this entry can be (?:changed|deleted|created)\.$/i
        );

        if (timeCardLockMatch) {
          setError(
            `This entry is part of a ${timeCardLockMatch[1].toLowerCase()} Time Card for ${timeCardLockMatch[2]}. It cannot be changed unless a manager returns the Time Card for correction.`
          );
        } else {
          setError(
            serverMessage ||
              err?.message ||
              "Failed to save entry."
          );
        }
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [
      entryTypeObj,
      formData,
      normalizedEntryTypeCode,
      normalizedSchema,
      entry,
      mode,
      clientId,
      onSave,
    ]
  );

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

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
  type="button"
  variant="outline"
  disabled={saving}
  onClick={async () => {
    if (
      hasUnsavedChangesRef.current &&
      !saving &&
      entryTypeObj?.id
    ) {
      try {
        setSaving(true);

        await handleDynamicEntrySave({
          entryType: {
            id: entryTypeObj.id,
            code: normalizeEntryTypeCode(
              entryTypeObj.code || normalizedEntryTypeCode
            ),
            name: entryTypeObj?.name,
          },
          formData,
          schema: normalizedSchema,
          existingEntry: entry,
          mode,
          saveEntry: (payload) =>
            persistTimeEntry(payload, entry?.id ?? null, clientId),
        });
      } catch (err) {
        console.error("[DynamicEntryForm] Auto-save failed:", err);
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    }

    onCancel?.();
  }}
>
  Cancel
</Button>

        <Button type="submit" disabled={saving || entryTypeLoading}>
          {(saving || entryTypeLoading) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
