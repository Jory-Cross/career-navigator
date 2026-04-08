import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Dual-write backend function for time entry submission.
 * 
 * CRITICAL: This function enforces the following:
 * 1. Write new structured fields (entry_type_id, entry_type_code, reporting_period_key)
 * 2. Preserve old fields (legacy_category, etc.)
 * 3. Create schema snapshot in ReportFieldAnswer
 * 4. Validate ServiceAuthorization if required
 * 5. Set report_ready based on field completion
 * 
 * This enables dual-read during migration: old code reads legacy fields,
 * new code reads structured fields. Both paths work until migration complete.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      client_id,
      entry_type_id,
      entry_type_code,
      date,
      start_time,
      end_time,
      duration_minutes,
      location,
      description,
      service_authorization_id,
      field_answers = {},
      as_draft = false
    } = payload;

    // Validate required fields
    if (!entry_type_id || !entry_type_code || !date || !duration_minutes) {
      return Response.json(
        { error: 'Missing required: entry_type_id, entry_type_code, date, duration_minutes' },
        { status: 400 }
      );
    }

    // Fetch entry type to get program type and report mode
    const entryType = await base44.entities.EntryType.read(entry_type_id);
    if (!entryType) {
      return Response.json({ error: 'EntryType not found' }, { status: 404 });
    }

    // Validate authorization if required
    if (entryType.requires_authorization && service_authorization_id) {
      const auth = await base44.entities.ServiceAuthorization.read(service_authorization_id);
      if (!auth || auth.status !== 'active') {
        return Response.json(
          { error: 'ServiceAuthorization is not active' },
          { status: 400 }
        );
      }
    } else if (entryType.requires_authorization && !service_authorization_id) {
      return Response.json(
        { error: `Authorization required for ${entryType.name}` },
        { status: 400 }
      );
    }

    // Calculate reporting period key
    const dateObj = new Date(date);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const reportingPeriodKey = entryType.report_mode.includes('service_period')
      ? `${year}-Q${Math.ceil((dateObj.getMonth() + 1) / 3)}`
      : `${year}-${month}`;

    // Fetch field templates for this entry type
    const fieldTemplates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id: entry_type_id,
      is_active: true
    });

    // Validate required fields are present
    const requiredFields = fieldTemplates.filter(f => f.is_required);
    const missingRequired = requiredFields.filter(f => !field_answers[f.field_key]);

    // Create/Update TimeEntry with DUAL WRITE
    // NEW: Structured fields (entry_type_id, entry_type_code, reporting_period_key)
    // OLD: legacy_category (preserved for backward compat)
    const timeEntryData = {
      client_id: client_id || null,
      employee_id: user.id,
      entry_type_id,
      entry_type_code,
      date,
      start_time: start_time || null,
      end_time: end_time || null,
      duration_minutes,
      reporting_period_key: reportingPeriodKey,
      location: location || null,
      description: description || null,
      service_authorization_id: service_authorization_id || null,
      is_billable: entryType.is_billable,
      is_payroll_eligible: entryType.is_payroll_eligible,
      is_reportable: entryType.report_mode !== 'none',
      status: as_draft ? 'draft' : 'submitted',
      
      // NEW: Report readiness flag
      report_ready: missingRequired.length === 0 && !as_draft,
      
      // LEGACY: Preserve old category field for backward compat
      legacy_category: entryType.code || null
    };

    const timeEntry = await base44.entities.TimeEntry.create(timeEntryData);

    // Create schema snapshot for field answers (CRITICAL for immutability)
    const fieldSchemaSnapshot = {};
    fieldTemplates.forEach(ft => {
      fieldSchemaSnapshot[ft.field_key] = {
        label: ft.label,
        field_type: ft.field_type,
        is_required: ft.is_required,
        order: ft.order,
        section: ft.section
      };
    });

    // Create/Update ReportFieldAnswer with DUAL WRITE
    // NEW: field_schema_snapshot (preserves schema at time of entry)
    // NEW: completion_percent, validation_errors
    // LEGACY: answers field (same as before)
    const reportFieldAnswerData = {
      time_entry_id: timeEntry.id,
      entry_type_id,
      entry_type_code,
      field_schema_version: 1,
      field_schema_snapshot: fieldSchemaSnapshot,
      answers: field_answers,
      required_fields_complete: missingRequired.length === 0,
      report_ready: missingRequired.length === 0 && !as_draft,
      submitted_at: new Date().toISOString(),
      
      // NEW: Track which fields failed validation
      validation_errors: missingRequired.map(f => f.field_key),
      
      // NEW: Track completion percentage
      completion_percent: requiredFields.length > 0
        ? Math.round(((requiredFields.length - missingRequired.length) / requiredFields.length) * 100)
        : 0
    };

    const fieldAnswer = await base44.entities.ReportFieldAnswer.create(reportFieldAnswerData);

    return Response.json({
      success: true,
      time_entry_id: timeEntry.id,
      field_answer_id: fieldAnswer.id,
      report_ready: reportFieldAnswerData.report_ready,
      missing_required_fields: missingRequired.map(f => f.field_key),
      completion_percent: reportFieldAnswerData.completion_percent
    });
  } catch (error) {
    console.error('submitTimeEntryDualWrite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});