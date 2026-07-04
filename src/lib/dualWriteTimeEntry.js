import { base44 } from "@/api/base44Client";

/**
 * Transitional compatibility helper.
 *
 * All TimeEntry creation goes through the authorized server-side V2 route. The
 * server derives tenant scope, employee authority, EntryType flags,
 * authorization enforcement, field-answer validation, and ReportFieldAnswer
 * persistence.
 */
export async function submitTimeEntryWithDualWrite({
  clientId,
  employeeId = null,
  entryTypeId,
  entryTypeCode,
  date,
  startTime = null,
  endTime = null,
  durationMinutes,
  location = null,
  description = null,
  employerName = null,
  serviceAuthorizationId = null,
  fieldAnswers = {},
  asDraft = false,
}) {
  const safeFieldAnswers =
    fieldAnswers &&
    typeof fieldAnswers === "object" &&
    !Array.isArray(fieldAnswers)
      ? fieldAnswers
      : {};

  const response = await base44.functions.invoke(
    "mutateAuthorizedTimeEntryV2",
    {
      action: "create",
      time_entry: {
        client_id: clientId || null,
        ...(employeeId ? { employee_id: employeeId } : {}),
        entry_type_id: entryTypeId,
        entry_type_code: entryTypeCode,
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        duration_minutes: durationMinutes,
        location: location || null,
        description: description || null,
        employer_name: employerName || null,
        service_authorization_id: serviceAuthorizationId || null,
        field_answers: safeFieldAnswers,
        status: asDraft ? "draft" : "submitted",
      },
    }
  );

  const data = response?.data || response || {};

  if (!data.success) {
    throw new Error(data.error || "Failed to submit TimeEntry securely.");
  }

  return data;
}

/**
 * Deprecated compatibility export.
 *
 * TimeEntry records are server-only during remediation. Call
 * getAuthorizedTimeEntries for scoped reads instead.
 */
export async function validateTimeEntryDualWrite() {
  throw new Error(
    "This legacy TimeEntry read helper is unavailable during security remediation."
  );
}

/**
 * Deprecated compatibility export.
 *
 * ReportFieldAnswer records are server-only during remediation.
 */
export async function getFieldAnswerWithSnapshot() {
  throw new Error(
    "This legacy field-answer read helper is unavailable during security remediation."
  );
}
