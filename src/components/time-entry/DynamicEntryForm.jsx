import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData, normalizeTopLevelFields } from "@/lib/formHelpers";
import { validateEntryForm } from "@/lib/validationRules";
import { base44 } from "@/api/base44Client";

export default function DynamicEntryForm({
  entryTypeCode,
  schema,
  entry = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const initialData = useMemo(() => buildInitialFormData(schema, entry), [schema, entry]);
  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypeObj, setEntryTypeObj] = useState(null);

  // Resolve entry type object to get id
  useEffect(() => {
    base44.entities.EntryType.filter({ code: entryTypeCode, is_active: true })
      .then(results => {
        if (results.length > 0) {
          setEntryTypeObj(results[0]);
        }
      })
      .catch(err => console.error("Failed to load entry type:", err));
  }, [entryTypeCode]);

  function handleChange(key, value) {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validateEntryForm(entryTypeCode, formData, schema);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSaving(true);

    try {
      const payload = normalizeTopLevelFields(entryTypeCode, formData);

      // Add entry type metadata
      if (entryTypeObj) {
        payload.entry_type_id = entryTypeObj.id;
      }
      payload.category = entryTypeObj?.category || "structured";
      payload.legacy_category = entryTypeObj?.legacy_category || null;

      if (entry?.id) {
        payload.id = entry.id;
      }

      await onSave?.(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={formData[field.key]}
          onChange={(value) => handleChange(field.key, value)}
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
          disabled={saving}
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}