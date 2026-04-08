import { base44 } from "@/api/base44Client";

/**
 * DUAL-WRITE UTILITY
 * 
 * Applies dual-write pattern to time entry and field answer submissions.
 * Ensures:
 * 1. New structured fields written (entry_type_id, entry_type_code, report_mode)
 * 2. Old fields preserved (legacy_category)
 * 3. Schema snapshots created (field definitions frozen at time of entry)
 * 4. Both old and new code paths work during migration
 */

/**
 * Submit a time entry with full dual-write enforcement.
 * 
 * Returns: { time_entry_id, field_answer_id, report_ready, completion_percent }
 */
export async function submitTimeEntryWithDualWrite({
  clientId,
  entryTypeId,
  entryTypeCode,
  date,
  startTime,
  endTime,
  durationMinutes,
  location,
  description,
  serviceAuthorizationId,
  fieldAnswers = {},
  asDraft = false
}) {
  const response = await base44.functions.invoke('submitTimeEntryDualWrite', {
    client_id: clientId,
    entry_type_id: entryTypeId,
    entry_type_code: entryTypeCode,
    date,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    location,
    description,
    service_authorization_id: serviceAuthorizationId,
    field_answers: fieldAnswers,
    as_draft: asDraft
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to submit time entry');
  }

  return response.data;
}

/**
 * Fetch and validate a time entry's dual-write status.
 * Returns both old and new field values for backward-compat checking.
 */
export async function validateTimeEntryDualWrite(timeEntryId) {
  const entry = await base44.entities.TimeEntry.read(timeEntryId);
  
  return {
    // NEW structured fields
    entry_type_id: entry.entry_type_id,
    entry_type_code: entry.entry_type_code,
    reporting_period_key: entry.reporting_period_key,
    report_ready: entry.report_ready,
    
    // LEGACY fields
    legacy_category: entry.legacy_category,
    
    // Status for dual-read compatibility
    uses_new_structure: !!entry.entry_type_id && !!entry.entry_type_code,
    is_legacy: !!entry.legacy_category && !entry.entry_type_id
  };
}

/**
 * Get field answer with schema snapshot for audit trail.
 * Returns immutable snapshot of field definitions at time of entry.
 */
export async function getFieldAnswerWithSnapshot(fieldAnswerId) {
  const answer = await base44.entities.ReportFieldAnswer.read(fieldAnswerId);
  
  return {
    answers: answer.answers,
    schema_snapshot: answer.field_schema_snapshot,
    schema_version: answer.field_schema_version,
    submitted_at: answer.submitted_at,
    completion_percent: answer.completion_percent,
    validation_errors: answer.validation_errors || []
  };
}