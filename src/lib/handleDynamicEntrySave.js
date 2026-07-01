import { base44 } from "@/api/base44Client";

function isPlainObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function buildSecureTimeEntryInput(payload, clientId, isUpdate) {
  const source = isPlainObject(payload) ? payload : {};

  const timeEntry = {
    entry_type_id: source.entry_type_id,
    entry_type_code: source.entry_type_code,
    date: source.date,
    start_time: source.start_time ?? null,
    end_time: source.end_time ?? null,
    duration_minutes: source.duration_minutes,
    location: source.location ?? null,
    description: source.description ?? null,
    employer_name: source.employer_name ?? null,
    service_authorization_id:
      source.service_authorization_id ?? null,
    form_data: isPlainObject(source.form_data)
      ? source.form_data
      : {},
  };

  if (hasOwn(source, "status")) {
    timeEntry.status = source.status;
  }

  if (!isUpdate) {
    timeEntry.client_id =
      clientId ?? source.client_id ?? null;

    if (source.employee_id) {
      timeEntry.employee_id = source.employee_id;
    }
  }

  return timeEntry;
}

async function invokeSecureTimeEntryMutation(request) {
  const response = await base44.functions.invoke(
    "mutateAuthorizedTimeEntry",
    request
  );

  const data = response?.data || response || {};

  if (!data.ok || !data.entry?.id) {
    throw new Error(
      data.error ||
        "Secure TimeEntry mutation did not return a saved entry."
    );
  }

  return data.entry;
}

/**
 * Secure persistence gateway for FormEngine TimeEntry workflows.
 *
 * Browser code submits only the requested fields. The server derives and
 * enforces tenant scope, employee authority, EntryType configuration,
 * authorization rules, reporting fields, and ReportFieldAnswer persistence.
 *
 * @param {Object} payload - Final payload from buildTimeEntryPayload
 * @param {string|null} existingEntryId - Existing TimeEntry ID for updates
 * @param {string|null} clientId - Client ID used only on new entries
 * @returns {Promise<Object>} Saved TimeEntry record
 */
export async function persistTimeEntry(
  payload,
  existingEntryId,
  clientId
) {
  if (!isPlainObject(payload)) {
    throw new Error(
      "Cannot persist entry: payload is missing or invalid."
    );
  }

  if (existingEntryId) {
    return await invokeSecureTimeEntryMutation({
      action: "update",
      entry_id: existingEntryId,
      time_entry: buildSecureTimeEntryInput(
        payload,
        null,
        true
      ),
    });
  }

  return await invokeSecureTimeEntryMutation({
    action: "create",
    time_entry: buildSecureTimeEntryInput(
      payload,
      clientId,
      false
    ),
  });
}

/**
 * Retained for compatibility with existing imports.
 * TimeEntry persistence no longer keeps a browser-side user cache.
 */
export function clearPersistTimeEnt
