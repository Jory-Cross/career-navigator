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
 * Unified submit handler for all dynamic Time Entry forms.
 * Supports both CREATE and EDIT modes with the same payload builder.
 *
 * Browser-side debug logging is intentionally omitted because form values can
 * contain sensitive client-service information. Persistence remains delegated
 * to the server-authorized caller supplied by the active form workflow.
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

  const payload = buildTimeEntryPayload({
    entryType,
    formData,
    schema,
    existingEntry,
  });

  validateBeforeSave(payload);
  freezePayload(payload);

  const isEdit = mode === "edit" && !!existingEntry?.id;
  const result = isEdit
    ? await saveEntry(payload, existingEntry.id)
    : await saveEntry(payload);

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

  return result;
}
