import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Submit Field Answers with Schema Snapshot
 * 
 * Captures field definitions at submission time so old entries remain stable
 * even if ReportFieldTemplate records change later.
 * 
 * Request body:
 * {
 *   time_entry_id: string,
 *   entry_type_id: string,
 *   entry_type_code: string,
 *   answers: { field_key: value, ... },
 *   template_version?: string,
 *   notes?: string
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      time_entry_id,
      entry_type_id,
      entry_type_code,
      answers = {},
      template_version,
      notes
    } = await req.json();

    // Validate inputs
    if (!time_entry_id || !entry_type_id || !entry_type_code) {
      return Response.json(
        { error: 'Missing required: time_entry_id, entry_type_id, entry_type_code' },
        { status: 400 }
      );
    }

    // Step 1: Fetch field templates for this entry type
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id
    });

    if (templates.length === 0) {
      return Response.json(
        { error: `No field templates found for entry type: ${entry_type_code}` },
        { status: 404 }
      );
    }

    // Step 2: Build schema snapshot
    const snapshot = buildFieldSnapshot(templates);

    // Step 3: Validate answers against schema
    const validation = validateAnswersAgainstSchema(answers, snapshot);

    // Step 4: Determine completion status
    const requiredFieldsComplete = validation.required_fields_missing.length === 0;
    const reportReady = requiredFieldsComplete && validation.errors.length === 0;

    // Step 5: Check if record already exists
    const existingAnswers = await base44.entities.ReportFieldAnswer.filter({
      time_entry_id
    });

    const now = new Date().toISOString();
    let fieldAnswer;

    if (existingAnswers.length > 0) {
      // Update existing record (revision)
      const existing = existingAnswers[0];
      fieldAnswer = await base44.entities.ReportFieldAnswer.update(existing.id, {
        answers,
        field_schema_version: template_version || 'current',
        field_schema_snapshot: snapshot,
        required_fields_complete: requiredFieldsComplete,
        report_ready: reportReady,
        is_complete: requiredFieldsComplete,
        submitted_at: now,
        submitted_by: user.email,
        validation_errors: validation.errors,
        revision_number: (existing.revision_number || 1) + 1,
        previous_revision_id: existing.id,
        notes: notes || `Resubmitted revision ${(existing.revision_number || 1) + 1}`
      });
    } else {
      // Create new record
      fieldAnswer = await base44.entities.ReportFieldAnswer.create({
        time_entry_id,
        entry_type_id,
        entry_type_code,
        answers,
        field_schema_version: template_version || 'current',
        field_schema_snapshot: snapshot,
        required_fields_complete: requiredFieldsComplete,
        report_ready: reportReady,
        is_complete: requiredFieldsComplete,
        submitted_at: now,
        submitted_by: user.email,
        validation_errors: validation.errors,
        revision_number: 1,
        notes: notes || 'Initial submission'
      });
    }

    // Step 6: Return detailed response
    return Response.json({
      success: true,
      field_answer_id: fieldAnswer.id,
      time_entry_id,
      required_fields_complete: requiredFieldsComplete,
      report_ready: reportReady,
      submitted_at: now,
      revision_number: fieldAnswer.revision_number,
      validation: {
        fields_answered: Object.keys(answers).length,
        required_fields: Object.values(snapshot).filter(f => f.is_required).length,
        missing_count: validation.required_fields_missing.length,
        errors: validation.errors,
        warnings: validation.warnings
      },
      summary: {
        completion_percentage: calculateCompletion(answers, snapshot),
        missing_required_fields: validation.required_fields_missing,
        can_generate_report: reportReady
      }
    });
  } catch (error) {
    console.error('submitFieldAnswers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Build field snapshot from ReportFieldTemplate records
 */
function buildFieldSnapshot(templates) {
  const snapshot = {};

  templates.forEach(template => {
    snapshot[template.field_key] = {
      field_key: template.field_key,
      label: template.label,
      field_type: template.field_type,
      is_required: template.is_required || false,
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
 * Validate answers against schema
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

    if (!fieldDef.is_active) {
      return;
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

  // Warn about extra answers
  Object.keys(answers).forEach(fieldKey => {
    if (!snapshot[fieldKey]) {
      warnings.push(`Answer provided for unknown field '${fieldKey}'`);
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
 * Validate individual field value
 */
function validateFieldValue(value, fieldDef) {
  const { field_type, options } = fieldDef;

  switch (field_type) {
    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, message: 'Expected number' };
      }
      break;

    case 'date':
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(String(value))) {
        return { valid: false, message: 'Expected YYYY-MM-DD format' };
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
        return { valid: false, message: 'Phone must be at least 10 digits' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Calculate completion percentage
 */
function calculateCompletion(answers, snapshot) {
  const requiredFields = Object.values(snapshot).filter(f => f.is_required).length;
  if (requiredFields === 0) return 100;

  const answeredRequired = Object.values(snapshot)
    .filter(f => f.is_required && answers[f.field_key])
    .length;

  return Math.round((answeredRequired / requiredFields) * 100);
}