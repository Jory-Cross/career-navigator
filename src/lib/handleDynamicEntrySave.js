import { buildTimeEntryPayload } from "@/lib/timeEntryPayloadBuilder";

/**
 * Unified submit handler for all dynamic time entry forms.
 * Supports both CREATE and EDIT modes with same payload builder.
 * Used by Job Coaching, Job Development, and other entry types.
 * 
 * @param {Object} config
 * @param {Object} config.entryType - Entry type metadata { id, key?, name? }
 * @param {Record<string, any>} config.formData - Form submission data
 * @param {any} config.schema - Field schema
 * @param {Object} [config.existingEntry] - For edit mode, the entry being updated
 * @param {string} [config.mode] - "create" or "edit" (defaults to "create")
 * @param {Function} config.saveEntry - Function to persist the entry
 * @param {Function} [config.refreshEntries] - Optional callback to refresh entry list
 * @param {Function} [config.closeModal] - Optional callback to close modal
 * @returns {Promise<void>}
 */
export async function handleDynamicEntrySave({
  entryType,
  formData,
  schema,
  existingEntry,
  mode = "create",
  saveEntry,
  refreshEntries,
  closeModal,
}) {
  // 1️⃣ Build unified payload (same for create & edit)
  const payload = buildTimeEntryPayload({ entryType, formData, schema });

  // 2️⃣ Hard guards before save
  validateBeforeSave(payload);

  // 3️⃣ Freeze payload shape (prevents accidental mutations)
  Object.freeze(payload);
  Object.freeze(payload.form_data);

  // 4️⃣ Snapshot logging (critical for debugging)
  const modeLabel = mode === "edit" ? "🔵 EDIT" : "🟢 CREATE";
  console.log(`${modeLabel} FINAL PAYLOAD:`, JSON.stringify(payload, null, 2));

  // 5️⃣ Persist with response validation
  let result;
  if (mode === "edit" && existingEntry?.id) {
    // Edit: pass existing entry ID
    result = await saveEntry(payload, existingEntry.id);
  } else {
    // Create: no ID
    result = await saveEntry(payload);
  }

  // 6️⃣ Backend response validation
  if (!result?.id) {
    throw new Error("❌ Save succeeded but no ID returned from backend");
  }

  console.log(`✅ Entry ${mode === "edit" ? "updated" : "created"} with ID:`, result.id);

  // 7️⃣ Refresh entry list if callback provided
  if (refreshEntries) {
    await refreshEntries();
  }

  // 8️⃣ Close modal if callback provided
  if (closeModal) {
    closeModal();
  }
}

/**
 * Hard guards before persistence.
 * Fails loudly if payload structure is invalid.
 */
function validateBeforeSave(payload) {
  if (!payload.entry_type_id) {
    throw new Error("❌ Hard Guard Failed: missing entry_type_id");
  }

  if (payload.duration_minutes == null || Number.isNaN(Number(payload.duration_minutes))) {
    throw new Error(`❌ Hard Guard Failed: invalid duration_minutes (${payload.duration_minutes})`);
  }

  if (typeof payload.form_data !== "object" || payload.form_data == null) {
    throw new Error("❌ Hard Guard Failed: missing or invalid form_data");
  }
}