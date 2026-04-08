import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[testJobCoachingSave] Starting end-to-end test...');

    // Get first client for testing
    const clients = await base44.entities.Client.list();
    if (clients.length === 0) {
      return Response.json({ error: 'No clients found for testing' }, { status: 404 });
    }

    const testClient = clients[0];
    console.log('[testJobCoachingSave] Using test client:', testClient.id);

    // Get job_coaching EntryType
    const entryTypes = await base44.entities.EntryType.filter({ code: 'job_coaching', is_active: true });
    const entryType = entryTypes[0];

    if (!entryType) {
      return Response.json({ error: 'job_coaching EntryType not found' }, { status: 404 });
    }

    console.log('[testJobCoachingSave] EntryType requires_authorization:', entryType.requires_authorization);

    // Get a user (employee) for testing
    const users = await base44.entities.User.filter({ role: 'employee' });
    const testEmployee = users[0] || { id: 'test-employee-id', email: user.email };

    const testDate = new Date().toISOString().split('T')[0];
    const durationMinutes = 120;

    // Create TimeEntry
    console.log('[testJobCoachingSave] Creating TimeEntry...');
    const timeEntry = await base44.entities.TimeEntry.create({
      client_id: testClient.id,
      employee_id: testEmployee.id,
      entry_type_id: entryType.id,
      entry_type_code: 'job_coaching',
      date: testDate,
      duration_minutes: durationMinutes,
      location: 'Worksite',
      description: 'Test Job Coaching Entry',
      is_billable: false,
      is_payroll_eligible: true,
      is_reportable: true,
      status: 'submitted'
    });

    console.log('[testJobCoachingSave] TimeEntry created:', timeEntry.id);

    // Create ReportFieldAnswer with correct field keys
    console.log('[testJobCoachingSave] Creating ReportFieldAnswer...');
    const fieldAnswer = await base44.entities.ReportFieldAnswer.create({
      time_entry_id: timeEntry.id,
      entry_type_id: entryType.id,
      entry_type_code: 'job_coaching',
      answers: {
        jc_date: testDate,
        jc_hours: durationMinutes / 60,
        jc_job_coach_name: 'Test Coach',
        jc_primary_service_code: 'JC01',
        jc_secondary_service_code: 'JC02'
      },
      field_schema_version: 1,
      required_fields_complete: true,
      report_ready: true
    });

    console.log('[testJobCoachingSave] ReportFieldAnswer created:', fieldAnswer.id);

    // Verify both records exist
    const verifyTimeEntry = await base44.entities.TimeEntry.list();
    const verifyAnswer = await base44.entities.ReportFieldAnswer.list();

    console.log('[testJobCoachingSave] Verification - TimeEntry count:', verifyTimeEntry.length);
    console.log('[testJobCoachingSave] Verification - ReportFieldAnswer count:', verifyAnswer.length);

    return Response.json({
      success: true,
      test_results: {
        test_client_id: testClient.id,
        test_employee_id: testEmployee.id,
        entry_type: {
          id: entryType.id,
          requires_authorization: entryType.requires_authorization
        },
        time_entry_created: {
          id: timeEntry.id,
          date: timeEntry.date,
          duration_minutes: timeEntry.duration_minutes,
          entry_type_code: timeEntry.entry_type_code
        },
        field_answer_created: {
          id: fieldAnswer.id,
          time_entry_id: fieldAnswer.time_entry_id,
          answers_keys: Object.keys(fieldAnswer.answers)
        },
        answer_values: fieldAnswer.answers
      }
    });
  } catch (error) {
    console.error('[testJobCoachingSave] ERROR:', error.message);
    console.error('[testJobCoachingSave] Stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});