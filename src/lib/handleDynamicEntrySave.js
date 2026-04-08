import { buildTimeEntryPayload } from "@/lib/timeEntryPayloadBuilder";

/**
 * Unified submit handler for all dynamic time entry forms.
 * Used by Job Coaching, Job Development, and other entry types.
 * Ensures consistent save path, validation, and lifecycle management.
 * 
 * @param {Object} config
 * @param {Object} config.entryType - Entry type metadata { id, key?, name? }
 * @param {Record<string, any>} config.formData - Form submission data
 * @param {any} config.schema - Field schema
 * @param {Function} config.saveEntry - Function to persist the entry
 * @param {Function} [config.refreshEntries] - Optional callback to refresh entry list
 * @param {Function} [config.closeModal] - Optional callback to close modal
 * @returns {Promise<void>}
 */
export async function handleDynamicEntrySave({
  entryType,
  formData,
  schema,
  saveEntry,
  refreshEntries,
  closeModal,
}) {
  // Build unified payload
  const payload = buildTimeEntryPayload({ entryType, formData, schema });

  console.log("[handleDynamicEntrySave] Payload:", payload);

  // Hard guards before save
  validateBeforeSave(payload);

  // Persist
  await saveEntry(payload);

  // Refresh entry list if callback provided
  if (refreshEntries) {
    await refreshEntries();
  }

  // Close modal if callback provided
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