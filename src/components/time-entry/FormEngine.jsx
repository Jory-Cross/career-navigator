import React, { useEffect, useMemo, useState } from "react";
import DynamicEntryForm from "./DynamicEntryForm";
import { AlertCircle, Loader2 } from "lucide-react";
import { getEntryTypeConfig, normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";
import { getSchemaForEntryType } from "@/lib/formHelpers";
import { loadVocRehabSchema } from "@/lib/formSchemas";

const schemaCache = new Map();

async function resolveSchema(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  const config = getEntryTypeConfig(normalizedCode);

  if (!config) {
    throw new Error(`Could not resolve entry type. Code "${entryTypeCode}" not found in registry`);
  }

  const cacheKey = `${normalizedCode}::${config.schemaKey || "default"}`;
  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey);
  }

  let resolvedSchema = [];

  if (config.schemaKey === "voc_rehab") {
    resolvedSchema = await loadVocRehabSchema(normalizedCode);
  } else {
    resolvedSchema = getSchemaForEntryType(normalizedCode);
  }

  schemaCache.set(cacheKey, resolvedSchema || []);
  return resolvedSchema;
}

export function clearFormEngineSchemaCache() {
  schemaCache.clear();
}

export default function FormEngine({
  entryTypeCode,
  entry = null,
  clientId = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const normalizedEntryTypeCode = useMemo(
    () => normalizeEntryTypeCode(entryTypeCode),
    [entryTypeCode]
  );

  const config = useMemo(
    () => getEntryTypeConfig(normalizedEntryTypeCode),
    [normalizedEntryTypeCode]
  );

  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchema() {
      if (!normalizedEntryTypeCode) {
        setSchema([]);
        setError("No entry type selected.");
        return;
      }

      setLoading(true);
      setError("");
      setSchema([]);

      try {
        const resolvedSchema = await resolveSchema(normalizedEntryTypeCode);

        if (!active) return;

        if (!resolvedSchema || !Array.isArray(resolvedSchema) || resolvedSchema.length === 0) {
          setSchema([]);
          setError(`No schema configured for entry type: ${config?.label || normalizedEntryTypeCode}`);
          return;
        }

        setSchema(resolvedSchema);
      } catch (err) {
        console.error("[FormEngine] Failed to load schema:", err);
        if (active) {
          setSchema([]);
          setError(err?.message || `Failed to load schema for ${normalizedEntryTypeCode}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (config) {
      loadSchema();
    } else {
      setSchema([]);
      setError(
        normalizedEntryTypeCode
          ? `Could not resolve entry type. Code "${normalizedEntryTypeCode}" not found in registry`
          : "No entry type selected."
      );
    }

    return () => {
      active = false;
    };
  }, [normalizedEntryTypeCode, config?.label]);

  if (!config) {
    return (
      <div className="flex gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Could not resolve entry type</p>
          <p className="text-xs text-amber-700 mt-1">
            {normalizedEntryTypeCode
              ? `Code "${normalizedEntryTypeCode}" not found in registry`
              : "No entry type selected."}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading form...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">{error}</p>
          {config?.label && (
            <p className="text-xs text-amber-700 mt-1">Entry type: {config.label}</p>
          )}
        </div>
      </div>
    );
  }

  if (!schema.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{config.label}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {mode === "create" ? "Create new entry" : "Edit entry"}
        </p>
      </div>

      <DynamicEntryForm
        entryTypeCode={normalizedEntryTypeCode}
        schema={schema}
        entry={entry}
        clientId={clientId}
        mode={mode}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}
