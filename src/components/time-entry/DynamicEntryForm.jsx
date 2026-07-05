import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData } from "@/lib/formHelpers";
import { buildFormDataFromEntry } from "@/lib/timeEntryRehydration";
import { handleDynamicEntrySave } from "@/lib/handleDynamicEntrySave";
import { persistTimeEntry } from "@/lib/persistTimeEntry";
import { base44 } from "@/api/base44Client";
import {
  ENTRY_TYPE_ALIASES,
  normalizeEntryTypeCode,
} from "@/lib/entryTypeRegistry";

const entryTypeCache = new Map();

function getCandidateCodes(entryTypeCode) {
  if (!entryTypeCode) return [];

  const originalCode = String(entryTypeCode).trim();
  const normalizedCode = normalizeEntryTypeCode(originalCode);
  const reverseAliases = Object.entries(ENTRY_TYPE_ALIASES)
    .filter(([, canonical]) => canonical === normalizedCode)
    .map(([alias]) => alias);

  return [...new Set([originalCode, normalizedCode, ...reverseAliases])].filter(Boolean);
}

async function getAuthorizedEntryTypeByCode(entryTypeCode) {
  const candidateCodes = getCandidateCodes(entryTypeCode);

  for (const candidateCode of candidateCodes) {
    if (entryTypeCache.has(candidateCode)) {
      const cached = entryTypeCache.get(candidateCode);
      if (cached) return cached;
    }
  }

  const response = await base44.functions.invoke(
    "getAuthorizedTimeEntryConfig",
    { action: "list_entry_types" }
  );
  const payload = response?.data ?? response ?? {};

  if (!payload?.ok || !Array.isArray(payload?.entry_types)) {
    throw new Error(
      payload?.error || "Authorized service types could not be loaded."
    );
  }

  let resolved = null;

  for (const candidateCode of candidateCodes) {
    const normalizedCandidateCode = String(candidateCode).trim().toLowerCase();
    const matches = payload.entry_types.filter(
      (entryType) =>
        String(entryType?.code || "").trim().toLowerCase() ===
        normalizedCandidateCode
    );

    if (matches.length === 0) continue;

    resolved = matches.find((entryType) => entryType?.org_id) || matches[0];
    break;
  }

  for (const candidateCode of candidateCodes) {
    entryTypeCache.set(candidateCode, resolved);
  }

  return resolved;
}

function parseTimeToMinutes(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);

  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;

    return hour * 60 + minute;
  }

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!twentyFourHourMatch) return null;

  const hour = Number(twentyFourHourMatch[1]);
  const minute = Number(twentyFourHourMatch[2]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
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

  if (!startTime || !endTime) return "";

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) return "";

  return endMinutes <= startMinutes ? "End time must be after start time." : "";
}

function getTargetRoleFields(schemaFields) {
  return (Array.isArray(schemaFields) ? schemaFields : []).filter((field) => {
    if (!field?.key) return false;

    const key = String(field.key).toLowerCase();
    const label = String(field.label || "").toLowerCase();

    return (
      key === "job_goal" ||
      key === "target_role" ||
      label === "job goal" ||
      label.includes("target role")
    );
  });
}

function formatMonthYearFromDate(value) {
  if (!value || typeof value !== "string") return "";

  const [year, month] = value.split("-");
  return year && month ? `${month}/${year}` : "";
}

function getErrorMessage(error) {
  const serverPayload = error?.response?.data || error?.data || {};

  if (typeof serverPayload?.error === "string" && serverPayload.error.trim()) {
    return serverPayload.error.trim();
  }

  return error?.message || "The TimeEntry could not be saved.";
}

export function clearDynamicEntryFormEntryTypeCache() {
  entryTypeCache.clear();
}

/**
 * Dynamic TimeEntry form.
 *
 * EntryType authority is loaded only through getAuthorizedTimeEntryConfig;
 * schema rendering, entry rehydration, autosave, and secure persistence remain
 * local to the current FormEngine workflow.
 */
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
  const hasUnsavedChangesRef = useRef(false);

  const normalizedSchema = useMemo(
    () => (Array.isArray(schema) ? schema : []),
    [schema]
  );
  const normalizedEntryTypeCode = useMemo(
    () => normalizeEntryTypeCode(entryTypeCode),
    [entryTypeCode]
  );

  const initialData = useMemo(() => {
    const targetRoleFields = getTargetRoleFields(normalizedSchema);

    if (entry?.id) {
      const rehydrated = buildFormDataFromEntry(entry, {
        fields: normalizedSchema,
      });

      if (clientTargetRole) {
        for (const field of targetRoleFields) {
          if (!rehydrated[field.key]) {
            rehydrated[field.key] = clientTargetRole;
          }
        }
      }

      return rehydrated;
    }

    const initialized = {
      ...buildInitialFormData(normalizedSchema, null),
    };

    for (const field of normalizedSchema) {
      if (field?.key && initialized[field.key] === undefined) {
        initialized[field.key] = "";
      }
    }

    if (clientTargetRole) {
      for (const field of targetRoleFields) {
        if (!initialized[field.key]) {
          initialized[field.key] = clientTargetRole;
        }
      }
    }

    return initialized;
  }, [entry?.id, entry, normalizedSchema, clientTargetRole]);

  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState(null);
  const [entryTypeLoading, setEntryTypeLoading] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFormData(initialData);
    hasUnsavedChangesRef.current = false;
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntryType() {
      if (!normalizedEntryTypeCode) {
        setEntryType(null);
        setEntryTypeLoading(false);
        setError("No service type is selected.");
        return;
      }

      const runId = ++lookupRunIdRef.current;
      setEntryTypeLoading(true);
      setError("");

      try {
        const resolved = await getAuthorizedEntryTypeByCode(
          entryTypeCode || normalizedEntryTypeCode
        );

        if (cancelled || !mountedRef.current || lookupRunIdRef.current !== runId) {
          return;
        }

        if (!resolved?.id) {
          setEntryType(null);
          setError(
            `The service type "${normalizedEntryTypeCode}" is unavailable to your account.`
          );
          return;
        }

        setEntryType(resolved);
      } catch (loadError) {
        console.error("[DynamicEntryForm] EntryType load failed:", loadError);

        if (cancelled || !mountedRef.current || lookupRunIdRef.current !== runId) {
          return;
        }

        setEntryType(null);
        setError(
          getErrorMessage(loadError) || "The service type could not be loaded."
        );
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
  }, [entryTypeCode, normalizedEntryTypeCode]);

  const saveCurrentEntry = useCallback(async () => {
    if (!entryType?.id) {
      throw new Error("The service type is still loading or is unavailable.");
    }

    const timeValidationError = validateChronologicalTimes(formData);
    if (timeValidationError) {
      throw new Error(timeValidationError);
    }

    const savedEntry = await handleDynamicEntrySave({
      entryType: {
        id: entryType.id,
        code: normalizeEntryTypeCode(
          entryType.code || normalizedEntryTypeCode
        ),
        name: entryType.name,
      },
      formData,
      schema: normalizedSchema,
      existingEntry: entry,
      mode,
      saveEntry: (payload) =>
        persistTimeEntry(payload, entry?.id ?? null, clientId),
    });

    hasUnsavedChangesRef.current = false;
    return savedEntry;
  }, [
    clientId,
    entry,
    entryType,
    formData,
    mode,
    normalizedEntryTypeCode,
    normalizedSchema,
  ]);

  const handleChange = useCallback((key, value) => {
    hasUnsavedChangesRef.current = true;

    setFormData((current) => {
      const next = { ...current, [key]: value };

      if (key === "development_date") {
        next.month_year = formatMonthYearFromDate(value);
      }

      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setError("");
      setSaving(true);

      try {
        const savedEntry = await saveCurrentEntry();
        await onSave?.(savedEntry);
      } catch (saveError) {
        console.error("[DynamicEntryForm] Save failed:", saveError);
        setError(getErrorMessage(saveError));
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [onSave, saveCurrentEntry]
  );

  const handleCancel = useCallback(async () => {
    if (
      hasUnsavedChangesRef.current &&
      !saving &&
      entryType?.id
    ) {
      try {
        setSaving(true);
        await saveCurrentEntry();
      } catch (saveError) {
        console.error("[DynamicEntryForm] Auto-save failed:", saveError);
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    }

    onCancel?.();
  }, [entryType?.id, onCancel, saveCurrentEntry, saving]);

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
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={handleCancel}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={saving || entryTypeLoading || !entryType?.id}>
          {(saving || entryTypeLoading) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
