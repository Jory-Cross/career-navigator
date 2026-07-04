/**
 * Legacy field-answer helper constrained during the security remediation freeze.
 *
 * All TimeEntry and ReportFieldAnswer mutations must use the authorized
 * TimeEntry route. The remaining exports are pure read-only formatters retained
 * for compatibility with historical report rendering.
 */

const REMEDIATION_ERROR =
  "This legacy field-answer workflow is unavailable during security remediation.";

export async function submitFieldAnswers() {
  return {
    success: false,
    errors: [REMEDIATION_ERROR],
  };
}

export function getFieldsFromSnapshot(fieldAnswerRecord = {}) {
  const snapshot = fieldAnswerRecord?.field_schema_snapshot || {};

  return Object.values(snapshot).sort(
    (left, right) => (left?.order || 0) - (right?.order || 0)
  );
}

export function isAnswerSetReportReady(fieldAnswer = {}) {
  return (
    fieldAnswer?.report_ready === true &&
    fieldAnswer?.required_fields_complete === true
  );
}

export function getMissingRequiredFields(fieldAnswer = {}) {
  const snapshot = fieldAnswer?.field_schema_snapshot || {};
  const answers = fieldAnswer?.answers || {};

  return Object.entries(snapshot)
    .filter(([, definition]) => definition?.is_required && !answers[definition.field_key])
    .map(([fieldKey, definition]) => ({
      field_key: fieldKey,
      label: definition?.label || fieldKey,
      field_type: definition?.field_type || "text",
    }));
}

export function generateFieldAnswerSummary(fieldAnswer = {}) {
  const snapshot = fieldAnswer?.field_schema_snapshot || {};
  const answers = fieldAnswer?.answers || {};
  const requiredFields = Object.values(snapshot).filter(
    (definition) => definition?.is_required
  );
  const answeredRequired = requiredFields.filter(
    (definition) => answers[definition?.field_key]
  ).length;

  return {
    total_fields: Object.keys(snapshot).length,
    answered_fields: Object.keys(answers).length,
    required_fields: requiredFields.length,
    required_fields_answered: answeredRequired,
    completion_percentage:
      requiredFields.length > 0
        ? Math.round((answeredRequired / requiredFields.length) * 100)
        : 100,
    is_complete: fieldAnswer?.required_fields_complete === true,
    is_report_ready: fieldAnswer?.report_ready === true,
    submitted_at: fieldAnswer?.submitted_at || null,
    submitted_by: fieldAnswer?.submitted_by || null,
    revision_number: fieldAnswer?.revision_number || 1,
    missing_fields: getMissingRequiredFields(fieldAnswer),
  };
}

export async function compareSchemaWithSnapshot() {
  return {
    error: REMEDIATION_ERROR,
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    has_breaking_changes: false,
  };
}

export function reconstructFieldData(fieldAnswer = {}) {
  const snapshot = fieldAnswer?.field_schema_snapshot || {};
  const answers = fieldAnswer?.answers || {};

  return Object.values(snapshot)
    .sort((left, right) => (left?.order || 0) - (right?.order || 0))
    .map((definition) => {
      const fieldKey = definition?.field_key || "";
      const value = answers[fieldKey];

      return {
        field_key: fieldKey,
        label: definition?.label || fieldKey,
        field_type: definition?.field_type || "text",
        section: definition?.section || null,
        value,
        is_answered: value !== null && value !== undefined && value !== "",
        is_required: definition?.is_required === true,
        options: definition?.options || [],
        help_text: definition?.help_text || null,
      };
    });
}
