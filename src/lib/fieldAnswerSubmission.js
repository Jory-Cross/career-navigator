/**
 * Field Answer Submission Handler
 * Captures schema snapshots at submission time for stable reporting
 * 
 * When a user submits field answers for a time entry:
 * 1. Fetch current ReportFieldTemplate records for this entry type
 * 2. Validate answers against schema
 * 3. Capture field definitions as snapshot
 * 4. Mark required fields as complete/incomplete
 * 5. Save ReportFieldAnswer with snapshot
 * 
 * Later, when generating reports:
 * - Use saved snapshot to understand what fields existed at time of entry
 * - Handle gracefully if template definitions changed
 * - Old entries remain stable and readable
 */

/**
 * Submit field answers with schema snapshot capture
 * @param {Object} base44 - Base44 client
 * @param {string} timeEntryId - TimeEntry ID
 * @param {string} entryTypeId - EntryType ID
 * @param {string} entryTypeCode - EntryType code
 * @param {Object} answers - Field answers { field_key: value, ... }
 * @param {Object} options - { userId, templateVersion, notes }
 * @returns {Promise<Object>} { success, data, errors, warnings }
 */
export async function submitFieldAnswers(base44, timeEntryId, entryTypeId, entryTypeCode, answers = {}, options = {}) {
  const { userId, templateVersion, notes } = options;

  try {
    // Step 1: Fetch current field templates for this entry type
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id: entryTypeId
    });

    if (templates.length === 0) {
      return {
        success: false,
        errors: [`No field templates found for entry type ${entryTypeCode}`]
      };
    }

    // Step 2: Build schema snapshot and validate
    const snapshot = buildFieldSnapshot(templates);
    const validation = validateAnswersAgainstSchema(answers, snapshot);

    // Step 3: Check if required fields are complete
    const requiredFieldsComplete = validation.required_fields_missing.length === 0;
    const reportReady = requiredFieldsComplete && validation.errors.length === 0;

    // Step 4: Save ReportFieldAnswer with snapshot
    const existingAnswers = await base44.entities.ReportFieldAnswer.filter({
      time_entry_id: timeEntryId
    });

    let fieldAnswer;
    const now = new Date().toISOString();

    if (existingAnswers.length > 0) {
      // Revision: update existing record
      const existing = existingAnswers[0];
      fieldAnswer = await base44.entities.ReportFieldAnswer.update(existing.id, {
        answers,
        field_schema_version: templateVersion || 'current',
        field_schema_snapshot: snapshot,
        required_fields_complete: requiredFieldsComplete,
        report_ready: reportReady,
        is_complete: requiredFieldsComplete,  // Legacy compat
        submitted_at: now,
        submitted_by: userId || 'system',
        validation_errors: validation.errors,
        revision_number: (existing.revision_number || 1) + 1,
        previous_revision_id: existing.id,
        notes: notes || `Resubmitted revision ${(existing.revision_number || 1) + 1}`
      });
    } else {
      // New submission
      fieldAnswer = await base44.entities.ReportFieldAnswer.create({
        time_entry_id: timeEntryId,
        entry_type_id: entryTypeId,
        entry_type_code: entryTypeCode,
        answers,
        field_schema_version: templateVersion || 'current',
        field_schema_snapshot: snapshot,
        required_fields_complete: requiredFieldsComplete,
        report_ready: reportReady,
        is_complete: requiredFieldsComplete,  // Legacy compat
        submitted_at: now,
        submitted_by: userId || 'system',
        validation_errors: validation.errors,
        revision_number: 1,
        notes: notes || 'Initial submission'
      });
    }

    return {
      success: true,
      data: fieldAnswer,
      field_answer_id: fieldAnswer.id,
      required_fields_complete: requiredFieldsComplete,
      report_ready: reportReady,
      errors: validation.errors,
      warnings: validation.warnings,
      required_fields_missing: validation.required_fields_missing,
      validation: {
        fields_answered: Object.keys(answers).length,
        required_fields: Object.values(snapshot).filter(f => f.is_required).length,
        missing_count: validation.required_fields_missing.length
      }
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message]
    };
  }
}

/**
 * Build field snapshot from ReportFieldTemplate records
 * Captures all field definitions at time of submission
 */
function buildFieldSnapshot(templates) {
  const snapshot = {};

  templates.forEach(template => {
    snapshot[template.field_key] = {
      field_key: template.field_key,
      label: template.label,
      field_type: template.field_type,
      is_required: template.is_required,
      options: template.options || [],
      section: template.section || null,
      placeholder: template.placeholder || null,
      help_text: template.help_text || null,
      order: template.order || 0,
      is_active: template.is_active !== false
    };
  });

  return snapshot;
}

/**
 * Validate answers against field schema snapshot
 */
function validateAnswersAgainstSchema(answers, snapshot) {
  const errors = [];
  const warnings = [];
  const required_fields_missing = [];

  // Check required fields
  Object.entries(snapshot).forEach(([fieldKey, fieldDef]) => {
    if (fieldDef.is_required && !fieldDef.is_active) {
      warnings.push(`Required field '${fieldKey}' is inactive in schema`);
    }

    if (fieldDef.is_required && !fieldDef.is_active) {
      return;  // Skip validation for inactive fields
    }

    const value = answers[fieldKey];

    if (fieldDef.is_required) {
      if (value === null || value === undefined || value === '') {
        required_fields_missing.push(fieldKey);
      }
    }

    // Type validation
    if (value !== null && value !== undefined && value !== '') {
      const validation = validateFieldValue(value, fieldDef);
      if (!validation.valid) {
        errors.push({
          field_key: fieldKey,
          message: validation.message,
          value
        });
      }
    }
  });

  // Warn about extra answers (not in schema)
  Object.keys(answers).forEach(fieldKey => {
    if (!snapshot[fieldKey]) {
      warnings.push(`Answer provided for unknown field '${fieldKey}' (not in schema snapshot)`);
    }
  });

  return {
    valid: errors.length === 0 && required_fields_missing.length === 0,
    errors,
    warnings,
    required_fields_missing
  };
}

/**
 * Validate individual field value against field definition
 */
function validateFieldValue(value, fieldDef) {
  const { field_type, options } = fieldDef;

  // Type-specific validation
  switch (field_type) {
    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, message: `Expected number, got ${typeof value}` };
      }
      break;

    case 'date':
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(String(value))) {
        return { valid: false, message: 'Expected date in YYYY-MM-DD format' };
      }
      break;

    case 'select':
    case 'multiselect':
      if (options && options.length > 0) {
        const vals = Array.isArray(value) ? value : [value];
        const invalid = vals.filter(v => !options.includes(v));
        if (invalid.length > 0) {
          return { valid: false, message: `Invalid option(s): ${invalid.join(', ')}` };
        }
      }
      break;

    case 'email':
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(String(value))) {
        return { valid: false, message: 'Invalid email format' };
      }
      break;

    case 'phone':
      const digits = String(value).replace(/\D/g, '');
      if (digits.length < 10) {
        return { valid: false, message: 'Phone number must be at least 10 digits' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Reconstruct field definitions from snapshot for UI/reports
 * Used when rendering or reporting old entries
 */
export function getFieldsFromSnapshot(fieldAnswerRecord) {
  const snapshot = fieldAnswerRecord.field_schema_snapshot || {};

  return Object.values(snapshot).sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Check if answers are complete and ready for reporting
 */
export function isAnswerSetReportReady(fieldAnswer) {
  return fieldAnswer.report_ready === true && fieldAnswer.required_fields_complete === true;
}

/**
 * Get missing required fields for a field answer record
 */
export function getMissingRequiredFields(fieldAnswer) {
  if (!fieldAnswer.field_schema_snapshot) return [];

  const snapshot = fieldAnswer.field_schema_snapshot;
  const answers = fieldAnswer.answers || {};

  return Object.entries(snapshot)
    .filter(([key, def]) => def.is_required && !answers[key])
    .map(([key, def]) => ({
      field_key: key,
      label: def.label,
      field_type: def.field_type
    }));
}

/**
 * Generate a summary of field answer status for UI display
 */
export function generateFieldAnswerSummary(fieldAnswer) {
  const snapshot = fieldAnswer.field_schema_snapshot || {};
  const answers = fieldAnswer.answers || {};

  const requiredFields = Object.values(snapshot).filter(f => f.is_required);
  const answeredRequired = requiredFields.filter(f => answers[f.field_key]).length;

  return {
    total_fields: Object.keys(snapshot).length,
    answered_fields: Object.keys(answers).length,
    required_fields: requiredFields.length,
    required_fields_answered: answeredRequired,
    completion_percentage: requiredFields.length > 0
      ? Math.round((answeredRequired / requiredFields.length) * 100)
      : 100,
    is_complete: fieldAnswer.required_fields_complete === true,
    is_report_ready: fieldAnswer.report_ready === true,
    submitted_at: fieldAnswer.submitted_at,
    submitted_by: fieldAnswer.submitted_by,
    revision_number: fieldAnswer.revision_number || 1,
    missing_fields: getMissingRequiredFields(fieldAnswer)
  };
}

/**
 * Create a comparison between current schema and saved snapshot
 * Useful for detecting what changed in field definitions
 */
export async function compareSchemaWithSnapshot(base44, entryTypeId, fieldAnswer) {
  const currentTemplates = await base44.entities.ReportFieldTemplate.filter({
    entry_type_id: entryTypeId
  });

  const currentSnapshot = buildFieldSnapshot(currentTemplates);
  const savedSnapshot = fieldAnswer.field_schema_snapshot || {};

  const changes = {
    added: [],      // New fields in current schema
    removed: [],    // Fields removed from schema
    modified: [],   // Fields with changed definitions
    unchanged: []
  };

  // Check for added and modified fields
  Object.entries(currentSnapshot).forEach(([key, currentDef]) => {
    if (!savedSnapshot[key]) {
      changes.added.push(key);
    } else {
      const savedDef = savedSnapshot[key];
      if (
        currentDef.label !== savedDef.label ||
        currentDef.is_required !== savedDef.is_required ||
        JSON.stringify(currentDef.options) !== JSON.stringify(savedDef.options)
      ) {
        changes.modified.push({
          field_key: key,
          old: savedDef,
          new: currentDef
        });
      } else {
        changes.unchanged.push(key);
      }
    }
  });

  // Check for removed fields
  Object.keys(savedSnapshot).forEach(key => {
    if (!currentSnapshot[key]) {
      changes.removed.push(key);
    }
  });

  return {
    entry_type_id: entryTypeId,
    field_answer_id: fieldAnswer.id,
    submitted_at: fieldAnswer.submitted_at,
    current_template_count: Object.keys(currentSnapshot).length,
    saved_template_count: Object.keys(savedSnapshot).length,
    changes,
    has_breaking_changes: changes.removed.length > 0 || changes.modified.length > 0
  };
}

/**
 * Reconstruct viewable/reportable data from answers + snapshot
 * Converts raw answers into labeled, validated field data
 */
export function reconstructFieldData(fieldAnswer) {
  const snapshot = fieldAnswer.field_schema_snapshot || {};
  const answers = fieldAnswer.answers || {};

  const reconstructed = [];

  Object.values(snapshot)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(fieldDef => {
      const value = answers[fieldDef.field_key];

      reconstructed.push({
        field_key: fieldDef.field_key,
        label: fieldDef.label,
        field_type: fieldDef.field_type,
        section: fieldDef.section,
        value,
        is_answered: value !== null && value !== undefined && value !== '',
        is_required: fieldDef.is_required,
        options: fieldDef.options || [],
        help_text: fieldDef.help_text
      });
    });

  return reconstructed;
}