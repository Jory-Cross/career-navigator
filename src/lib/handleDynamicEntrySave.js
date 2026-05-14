import { buildTimeEntryPayload } from "@/lib/timeEntryPayloadBuilder";

function freezePayload(payload) {
  if (payload && typeof payload === "object") {
    Object.freeze(payload);

    if (payload.form_data && typeof payload.form_data === "object") {
      Object.freeze(payload.form_data);
    }
  }

  return payload;
}

function getSavedId(result) {
  return (
    result?.id ??
    result?._id ??
    result?.data?.id ??
    result?.record?.id ??
    result?.item?.id ??
    (Array.isArray(result) ? result[0]?.id : null) ??
    null
  );
}

function validateBeforeSave(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("❌ Hard Guard Failed: payload is missing or invalid");
  }

  if (!payload.entry_type_id) {
    throw new Error("❌ Hard Guard Failed: missing entry_type_id");
  }

  if (
    payload.duration_minutes == null ||
    Number.isNaN(Number(payload.duration_minutes))
  ) {
    throw new Error(
      `❌ Hard Guard Failed: invalid duration_minutes (${payload.duration_minutes})`
    );
  }

  if (typeof payload.form_data !== "object" || payload.form_data == null) {
    throw new Error("❌ Hard Guard Failed: missing or invalid form_data");
  }
}

async function runAfterSaveCallbacks({
  refreshEntries,
  closeModal,
  onSuccess,
  result,
  mode,
  payload,
}) {
  await refreshEntries?.();
  await closeModal?.();
  await onSuccess?.({ result, mode, payload });
}

/**
 * Unified submit handler for all dynamic time entry forms.
 * Supports both CREATE and EDIT modes with the same payload builder.
 *
 * @param {Object} config
 * @param {Object} config.entryType - Entry type metadata { id, code?, name? }
 * @param {Record<string, any>} config.formData - Form submission data
 * @param {Array} config.schema - Field schema
 * @param {Object|null} [config.existingEntry] - Existing entry for edit mode
 * @param {"create"|"edit"} [config.mode="create"] - Save mode
 * @param {Function} config.saveEntry - Persistence function
 * @param {Function} [config.refreshEntries] - Optional callback to refresh entry list
 * @param {Function} [config.closeModal] - Optional callback to close dialog/modal
 * @param {Function} [config.onSuccess] - Optional callback after successful save
 * @returns {Promise<Object>} Saved result
 */
export async function handleDynamicEntrySave({
  entryType,
  formData,
  schema,
  existingEntry = null,
  mode = "create",
  saveEntry,
  refreshEntries,
  closeModal,
  onSuccess,
}) {
  if (typeof saveEntry !== "function") {
    throw new Error("❌ Save failed: saveEntry must be a function");
  }

  console.log(
    "[handleDynamicEntrySave] formData:",
    JSON.stringify(formData, null, 2)
  );
  console.log(
    "[handleDynamicEntrySave] schema:",
    JSON.stringify(schema, null, 2)
  );

  const payload = buildTimeEntryPayload({
    entryType,
    formData,
    schema,
    existingEntry,
  });

  validateBeforeSave(payload);
  freezePayload(payload);

  const isEdit = mode === "edit" && !!existingEntry?.id;
  const modeLabel = isEdit ? "EDIT" : "CREATE";

  console.log(
    `[handleDynamicEntrySave] ${modeLabel} FINAL PAYLOAD:`,
    JSON.stringify(payload, null, 2)
  );

  let result;

  if (isEdit) {
    result = await saveEntry(payload, existingEntry.id);
  } else {
    result = await saveEntry(payload);
  }

  if (!result) {
    throw new Error("❌ Save failed: no result returned from backend");
  }

  await runAfterSaveCallbacks({
    refreshEntries,
    closeModal,
    onSuccess,
    result,
    mode: isEdit ? "edit" : "create",
    payload,
  });

  const savedId = getSavedId(result);

  if (savedId) {
    console.log(
      `✅ Entry ${isEdit ? "updated" : "created"} with ID:`,
      savedId
    );
  } else {
    console.warn(
      "⚠️ Save succeeded but backend response had no top-level id",
      result
    );
  }

  return result;
}