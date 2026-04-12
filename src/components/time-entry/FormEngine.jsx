import React, { useEffect, useMemo, useState } from "react";
import DynamicEntryForm from "./DynamicEntryForm";
import { AlertCircle, Loader2 } from "lucide-react";
import { getEntryTypeConfig, normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";
import { getSchemaForEntryType, loadVocRehabSchema } from "@/lib/formSchemas";

async function resolveSchema(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  const config = getEntryTypeConfig(normalizedCode);

  if (!config) {
    throw new Error(`Could not resolve entry type. Code "${entryTypeCode}" not found in registry`);
  }

  if (config.schemaKey === "voc_rehab") {
    return await loadVocRehabSchema(normalizedCode);
  }

  return getSchemaForEntryType(normalizedCode);
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

  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchema() {
      if (!normalizedEntryTypeCode) {
        setSchema(null);
        setError("No entry type selected.");
        return;
      }

      setLoading(true);
      setError("");
      setSchema(null);

      try {
        const resolvedSchema = await resolveSchema(normalizedEntryTypeCode);

        if (!active) return;

        if (!resolvedSchema || !Array.isArray(resolvedSchema.fields) || resolvedSchema.fields.length === 0) {
          setSchema(null);
          setError(`No schema configured for entry type: ${config?.label || normalizedEntryTypeCode}`);
          return;
        }

        setSchema(resolvedSchema);
      } catch (err) {
        console.error("[FormEngine] Failed to load schema:", err);
        if (active) {
          setSchema(null);
          setError(err?.message || `Failed to load schema for ${normalizedEntryTypeCode}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSchema();

    return () => {
      active = false;
    };
  }, [normalizedEntryTypeCode, config?.label]);

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

  if (!schema) {
    return null;
  }

  return (
    <DynamicEntryForm
      entryTypeCode={normalizedEntryTypeCode}
      schema={schema.fields}
      entry={entry}
      clientId={clientId}
      mode={mode}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}
