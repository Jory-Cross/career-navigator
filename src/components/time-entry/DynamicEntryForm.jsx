import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData } from "@/lib/formHelpers";
import { handleDynamicEntrySave } from "@/lib/handleDynamicEntrySave";
import { base44 } from "@/api/base44Client";

export default function DynamicEntryForm({
  entryTypeCode,
  schema,
  entry = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const initialData = useMemo(() => {
    console.log("[DynamicEntryForm] EDIT ENTRY:", entry);
    console.log("[DynamicEntryForm] ENTRY FORM_DATA:", entry?.form_data);
    const data = buildInitialFormData(schema, entry);
    console.log("[DynamicEntryForm] Initial form data after hydration:", data);
    return data;
  }, [schema, entry]);
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
    setError("");
    setSaving(true);

    try {
      await handleDynamicEntrySave({
        entryType: { id: entryTypeObj?.id, code: entryTypeCode, name: entryTypeObj?.name },
        formData,
        schema,
        saveEntry: onSave,
      });
    } catch (err) {
      const errorMsg = err?.message || "Failed to save entry";
      console.error("[DynamicEntryForm] Save failed:", err);
      setError(errorMsg);
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