import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import FieldRenderer from "./FieldRenderer";
import { buildInitialFormData } from "@/lib/formHelpers";
import { buildFormDataFromEntry } from "@/lib/timeEntryRehydration";
import { handleDynamicEntrySave } from "@/lib/handleDynamicEntrySave";
import { persistTimeEntry } from "@/lib/persistTimeEntry";
import { base44 } from "@/api/base44Client";

export default function DynamicEntryForm({
  entryTypeCode,
  schema,
  entry = null,
  clientId = null,
  mode = "create",
  onSave,
  onCancel,
}) {
  const initialData = useMemo(() => {
    if (entry?.id) {
      console.log("[DynamicEntryForm] EDIT MODE - Rehydrating entry:", entry.id);
      const data = buildFormDataFromEntry(entry, { fields: schema });
      console.log("[DynamicEntryForm] Rehydrated form data:", data);
      return data;
    }
    const data = buildInitialFormData(schema, null);
    console.log("[DynamicEntryForm] Create mode - Initial form data:", data);
    return data;
  }, [schema, entry]);

  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypeObj, setEntryTypeObj] = useState(null);

  useEffect(() => {
    base44.entities.EntryType.filter({ code: entryTypeCode, is_active: true })
      .then(results => {
        if (results.length > 0) setEntryTypeObj(results[0]);
      })
      .catch(err => console.error("Failed to load entry type:", err));
  }, [entryTypeCode]);

  function handleChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      console.log("🔍 SUBMIT FORM DATA:", JSON.stringify(formData, null, 2));

      // Single save owner: handleDynamicEntrySave
      // Payload is built once inside handleDynamicEntrySave via buildTimeEntryPayload.
      // persistTimeEntry is the thin DB writer — receives the already-built payload.
      await handleDynamicEntrySave({
        entryType: { id: entryTypeObj?.id, code: entryTypeCode, name: entryTypeObj?.name },
        formData,
        schema,
        existingEntry: entry,
        mode,
        saveEntry: (payload) => persistTimeEntry(payload, entry?.id ?? null, clientId),
        // refresh/close are handled by the onSave callback below, not here
      });

      if (onSave) await onSave();
    } catch (err) {
      console.error("[DynamicEntryForm] Save failed:", err);
      setError(err?.message || "Failed to save entry");
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}