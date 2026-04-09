import React, { useState, useEffect } from "react";
import DynamicEntryForm from "./DynamicEntryForm";
import { getEntryTypeConfig } from "@/lib/entryTypeRegistry";
import { getSchemaForEntryType } from "@/lib/formHelpers";
import { loadVocRehabSchema } from "@/lib/formSchemas";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export default function FormEngine({
  entryTypeCode,
  entry = null,
  clientId = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const config = getEntryTypeConfig(entryTypeCode);
  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSchema = async () => {
      if (config?.schemaKey === "voc_rehab") {
        setLoading(true);
        try {
          const dynamicSchema = await loadVocRehabSchema(entryTypeCode);
          setSchema(dynamicSchema);
        } catch (err) {
          console.error("[FormEngine] Failed to load schema:", err);
          setSchema([]);
        } finally {
          setLoading(false);
        }
      } else {
        const baseSchema = getSchemaForEntryType(entryTypeCode);
        setSchema(baseSchema);
      }
    };

    if (config) {
      loadSchema();
    }
  }, [entryTypeCode, config]);

  if (!config) {
    console.warn("⚠️ FormEngine: unknown entry type code:", entryTypeCode, {
      entry_type_id: entry?.entry_type_id,
      entry_type_code: entry?.entry_type_code,
      entry_type_key: entry?.entry_type_key,
    });
    return (
      <Card className="p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700">Could not resolve entry type</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {entryTypeCode ? `Code "${entryTypeCode}" not found in registry` : "No entry type code available — please close and try again"}
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-4 flex gap-3">
        <Loader2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
        <div>
          <p className="text-sm font-medium text-blue-700">Loading form...</p>
        </div>
      </Card>
    );
  }

  if (!schema.length) {
    return (
      <Card className="p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700">No schema configured</p>
          <p className="text-xs text-amber-600 mt-0.5">Entry type: {config.label}</p>
        </div>
      </Card>
    );
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
        entryTypeCode={entryTypeCode}
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