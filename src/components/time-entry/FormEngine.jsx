import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import DynamicEntryForm from "./DynamicEntryForm";
import {
  getEntryTypeConfig,
  normalizeEntryTypeCode,
} from "@/lib/entryTypeRegistry";
import { getSchemaForEntryType } from "@/lib/formHelpers";
import { loadAuthorizedVocRehabSchema } from "@/lib/authorizedTimeEntrySchema";

const schemaCache = new Map();
const SCHEMA_CACHE_VERSION = 4;

async function resolveSchema(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  const config = getEntryTypeConfig(normalizedCode);

  if (!config) {
    throw new Error(
      `Could not resolve entry type. Code "${entryTypeCode}" not found in registry.`
    );
  }

  const cacheKey = `v${SCHEMA_CACHE_VERSION}::${normalizedCode}::${config.schemaKey || "default"}`;

  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey);
  }

  const resolvedSchema =
    config.schemaKey === "voc_rehab"
      ? await loadAuthorizedVocRehabSchema(normalizedCode)
      : getSchemaForEntryType(normalizedCode);
  const normalizedSchema = Array.isArray(resolvedSchema) ? resolvedSchema : [];

  schemaCache.set(cacheKey, normalizedSchema);
  return normalizedSchema;
}

export function clearFormEngineSchemaCache() {
  schemaCache.clear();
}

export default function FormEngine({
  entryTypeCode,
  entry = null,
  clientId = null,
  clientTargetRole = "",
  mode,
  onSave,
  onSaved,
  onCancel,
}) {
  const loadRunIdRef = useRef(0);
  const normalizedEntryTypeCode = useMemo(
    () => normalizeEntryTypeCode(entryTypeCode),
    [entryTypeCode]
  );
  const config = useMemo(
    () => getEntryTypeConfig(normalizedEntryTypeCode),
    [normalizedEntryTypeCode]
  );
  const effectiveMode = useMemo(
    () => mode || (entry?.id ? "edit" : "create"),
    [mode, entry?.id]
  );
  const [schema, setSchema] = useState(() => {
    if (!normalizedEntryTypeCode || !config) return [];
    const cacheKey = `v${SCHEMA_CACHE_VERSION}::${normalizedEntryTypeCode}::${config.schemaKey || "default"}`;
    return schemaCache.get(cacheKey) || [];
  });
  const [loading, setLoading] = useState(() => {
    if (!normalizedEntryTypeCode || !config) return false;
    const cacheKey = `v${SCHEMA_CACHE_VERSION}::${normalizedEntryTypeCode}::${config.schemaKey || "default"}`;
    return !schemaCache.has(cacheKey);
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchema() {
      if (!normalizedEntryTypeCode) {
        setSchema([]);
        setError("No entry type selected.");
        setLoading(false);
        return;
      }

      if (!config) {
        setSchema([]);
        setError(
          `Could not resolve entry type. Code "${normalizedEntryTypeCode}" not found in registry.`
        );
        setLoading(false);
        return;
      }

      const cacheKey = `v${SCHEMA_CACHE_VERSION}::${normalizedEntryTypeCode}::${config.schemaKey || "default"}`;
      const cachedSchema = schemaCache.get(cacheKey);

      if (cachedSchema) {
        setSchema(cachedSchema);
        setError(
          cachedSchema.length
            ? ""
            : `No schema configured for entry type: ${config.label || normalizedEntryTypeCode}`
        );
        setLoading(false);
        return;
      }

      const runId = ++loadRunIdRef.current;
      setLoading(true);
      setError("");
      setSchema([]);

      try {
        const resolvedSchema = await resolveSchema(normalizedEntryTypeCode);

        if (!active || loadRunIdRef.current !== runId) return;

        if (!Array.isArray(resolvedSchema) || resolvedSchema.length === 0) {
          setSchema([]);
          setError(
            `No schema configured for entry type: ${config.label || normalizedEntryTypeCode}`
          );
          return;
        }

        setSchema(resolvedSchema);
      } catch (loadError) {
        console.error("[FormEngine] Failed to load schema:", loadError);

        if (!active || loadRunIdRef.current !== runId) return;

        setSchema([]);
        setError(
          loadError?.message ||
            `Failed to load schema for ${normalizedEntryTypeCode}.`
        );
      } finally {
        if (active && loadRunIdRef.current === runId) {
          setLoading(false);
        }
      }
    }

    loadSchema();

    return () => {
      active = false;
    };
  }, [normalizedEntryTypeCode, config]);

  const handleSaved = async (savedEntry) => {
    if (typeof onSave === "function") {
      await onSave(savedEntry);
    }

    if (typeof onSaved === "function") {
      await onSaved(savedEntry);
    }
  };

  if (!config) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Could not resolve entry type
        </div>
        <div className="text-sm">
          {normalizedEntryTypeCode
            ? `Code "${normalizedEntryTypeCode}" not found in registry.`
            : "No entry type selected."}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading form…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
        {config?.label ? (
          <div className="text-sm text-amber-700">Entry type: {config.label}</div>
        ) : null}
      </div>
    );
  }

  if (!schema.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold text-slate-900">{config.label}</h3>
        <p className="text-sm text-slate-500">
          {effectiveMode === "edit" ? "Edit entry" : "Create new entry"}
        </p>
      </div>

      <DynamicEntryForm
        entryTypeCode={normalizedEntryTypeCode}
        schema={schema}
        entry={entry}
        clientId={clientId}
        clientTargetRole={clientTargetRole}
        mode={effectiveMode}
        onSave={handleSaved}
        onCancel={onCancel}
      />
    </div>
  );
}
