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
  mode = "create",
  onSave,
  onCancel,
}) {
  const config = getEntryTypeConfig(entryTypeCode);
  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load schema, with dynamic loading for voc_rehab types
  useEffect(() => {
    const loadSchema = async () => {
      // For voc_rehab entry types (job_coaching, job_development, usor96), always load from ReportFieldTemplate
      if (config?.schemaKey === "voc_rehab") {
        setLoading(true);
        const dynamicSchema = await loadVocRehabSchema(entryTypeCode);
        setSchema(dynamicSchema);
        setLoading(false);
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
    return (
      <Card className="p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-700">Unknown entry type</p>
          <p className="text-xs text-red-600 mt-0.5">{entryTypeCode}</p>
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
        mode={mode}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}