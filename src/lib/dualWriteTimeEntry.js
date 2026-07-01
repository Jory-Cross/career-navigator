import { base44 } from "@/api/base44Client";

/**
 * Transitional compatibility helper.
 *
 * All TimeEntry creation now goes through the secure server-side
 * mutateAuthorizedTimeEntry function. The function derives tenant,
 * employee ownership, EntryType flags, authorization enforcement,
 * field-answer validation, and ReportFieldAnswer persistence.
 *
 * The response shape remains compatible with existing callers:
 * { success, time_entry_id, field_answer_id, report_ready, completion_percent }
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
    "mutateAuthorizedTimeEntry",
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

  const data = response?.data || {};

  if (!data.success) {
    throw new Error(
      data.error || "Failed to submit TimeEntry securely."
    );
  }

  return data;
}

/**
 * Transitional read helper.
 *
 * Do not use this helper as permission authority. Secure TimeEntry reads
 * must use getAuthorizedTimeEntries until this compatibility helper is retired.
 */
export async function validateTimeEntryDualWrite(timeEntryId) {
  const entry = await base44.entities.TimeEntry.read(timeEntryId);

  return {
    entry_type_id: entry.entry_type_id,
    entry_type_code: entry.entry_type_code,
    reporting_period_key: entry.reporting_period_key,
    report_ready: entry.report_ready,
    legacy_category: entry.legacy_category,
    uses_new_structure:
      !!entry.entry_type_id && !!entry.entry_type_code,
    is_legacy:
      !!entry.legacy_category && !entry.entry_type_id,
  };
}

/**
 * Transitional read helper.
 *
 * Do not use this helper as permission authority. It remains only for
 * compatibility while ReportFieldAnswer read paths are migrated.
 */
export async function getFieldAnswerWithSnapshot(fieldAnswerId) {
  const answer = await base44.entities.ReportFieldAnswer.read(
    fieldAnswerId
  );

  return {
    answers: answer.answers,
    schema_snapshot: answer.field_schema_snapshot,
    schema_version: answer.field_schema_version,
    submitted_at: answer.submitted_at,
    completion_percent: answer.completion_percent,
    validation_errors: answer.validation_errors || [],
  };
}
