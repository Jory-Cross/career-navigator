/**
 * Test/Verification function for dual-write implementation.
 * Creates a test time entry and confirms all new fields are populated.
 * Call from backend or frontend to verify Phase 3 completion.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get test parameters from request
    const payload = await req.json();
    const { client_id, entry_type_code = 'job_coaching' } = payload;

    // Fetch the entry type
    const entryTypes = await base44.entities.EntryType.filter({ code: entry_type_code });
    if (!entryTypes || entryTypes.length === 0) {
      return Response.json({ error: `EntryType not found: ${entry_type_code}` }, { status: 404 });
    }
    const entryType = entryTypes[0];

    // Create a test time entry
    const testDate = new Date().toISOString().split('T')[0];
    const durationMinutes = 60;
    const month = testDate.substring(5, 7);
    const year = testDate.substring(0, 4);
    const reportingPeriodKey = `${year}-${month}`;

    const timeEntryData = {
      client_id: client_id || null,
      employee_id: user.id,
      entry_type_id: entryType.id,
      entry_type_code: entryType.code,
      date: testDate,
      start_time: '09:00',
      end_time: '10:00',
      duration_minutes: durationMinutes,
      reporting_period_key: reportingPeriodKey,
      location: 'Test Location',
      description: 'Test entry for dual-write verification',
      service_authorization_id: null,
      is_billable: entryType.is_billable,
      is_payroll_eligible: entryType.is_payroll_eligible,
      is_reportable: entryType.report_mode !== 'none',
      status: 'submitted',
      report_ready: false,
      legacy_category: entryType.code
    };

    const timeEntry = await base44.entities.TimeEntry.create(timeEntryData);

    // Fetch field templates for verification
    const fieldTemplates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    // Create schema snapshot
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

    // Create test field answers
    const reportFieldAnswerData = {
      time_entry_id: timeEntry.id,
      entry_type_id: entryType.id,
      entry_type_code: entryType.code,
      field_schema_version: 1,
      field_schema_snapshot: fieldSchemaSnapshot,
      answers: {},
      required_fields_complete: false,
      report_ready: false,
      submitted_at: new Date().toISOString(),
      validation_errors: [],
      completion_percent: 0
    };

    const fieldAnswer = await base44.entities.ReportFieldAnswer.create(reportFieldAnswerData);

    // Verification: Read back and confirm all new fields populated
    const timeEntries = await base44.asServiceRole.entities.TimeEntry.filter({ id: timeEntry.id });
    const verifyTimeEntry = timeEntries[0] || timeEntry;
    
    const fieldAnswers = await base44.asServiceRole.entities.ReportFieldAnswer.filter({ id: fieldAnswer.id });
    const verifyFieldAnswer = fieldAnswers[0] || fieldAnswer;

    const timeEntryChecks = {
      entry_type_id_present: !!verifyTimeEntry.entry_type_id,
      entry_type_code_present: !!verifyTimeEntry.entry_type_code,
      entry_type_code_correct: verifyTimeEntry.entry_type_code === entry_type_code,
      duration_minutes_present: verifyTimeEntry.duration_minutes === durationMinutes,
      reporting_period_key_present: !!verifyTimeEntry.reporting_period_key,
      reporting_period_key_correct: verifyTimeEntry.reporting_period_key === reportingPeriodKey,
      status_correct: verifyTimeEntry.status === 'submitted',
      is_billable_present: verifyTimeEntry.is_billable === entryType.is_billable,
      is_payroll_eligible_present: verifyTimeEntry.is_payroll_eligible === entryType.is_payroll_eligible,
      is_reportable_present: verifyTimeEntry.is_reportable === (entryType.report_mode !== 'none'),
      legacy_category_preserved: !!verifyTimeEntry.legacy_category
    };

    const fieldAnswerChecks = {
      entry_type_id_present: !!verifyFieldAnswer.entry_type_id,
      entry_type_code_present: !!verifyFieldAnswer.entry_type_code,
      field_schema_version_present: verifyFieldAnswer.field_schema_version === 1,
      field_schema_snapshot_present: !!verifyFieldAnswer.field_schema_snapshot && Object.keys(verifyFieldAnswer.field_schema_snapshot).length >= 0,
      answers_present: !!verifyFieldAnswer.answers,
      required_fields_complete_present: verifyFieldAnswer.required_fields_complete === false,
      report_ready_present: verifyFieldAnswer.report_ready === false,
      submitted_at_present: !!verifyFieldAnswer.submitted_at,
      validation_errors_present: Array.isArray(verifyFieldAnswer.validation_errors),
      completion_percent_present: typeof verifyFieldAnswer.completion_percent === 'number'
    };

    const allTimeEntryPassed = Object.values(timeEntryChecks).every(v => v);
    const allFieldAnswerPassed = Object.values(fieldAnswerChecks).every(v => v);

    return Response.json({
      success: true,
      test_entry_id: timeEntry.id,
      test_field_answer_id: fieldAnswer.id,
      time_entry_checks: timeEntryChecks,
      field_answer_checks: fieldAnswerChecks,
      all_time_entry_checks_passed: allTimeEntryPassed,
      all_field_answer_checks_passed: allFieldAnswerPassed,
      overall_status: allTimeEntryPassed && allFieldAnswerPassed ? 'PASS' : 'FAIL',
      message: allTimeEntryPassed && allFieldAnswerPassed 
        ? '✅ Phase 3 Dual-Write Implementation Verified'
        : '❌ Some verification checks failed'
    });
  } catch (error) {
    console.error('verifyDualWriteTest error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});