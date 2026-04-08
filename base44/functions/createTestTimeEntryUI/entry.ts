import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Creates a complete test entry via the UI flow (for screenshot verification)
 * - Gets a real client
 * - Creates a time entry with job_coaching type
 * - Populates field answers
 * - Returns entry details for verification
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get test client (Manny Montoya)
    const clients = await base44.entities.Client.filter({ 
      first_name: 'Manny',
      last_name: 'Montoya'
    });

    if (clients.length === 0) {
      return Response.json({ error: 'Manny Montoya not found' }, { status: 400 });
    }

    const client = clients[0];

    // Get job_coaching entry type
    const entryTypes = await base44.entities.EntryType.filter({ 
      code: 'job_coaching'
    });

    if (entryTypes.length === 0) {
      return Response.json({ error: 'job_coaching not found' }, { status: 400 });
    }

    const entryType = entryTypes[0];

    // Get templates
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching',
      is_active: true
    });

    // Create time entry with fields from templates
    const timeEntry = await base44.entities.TimeEntry.create({
      org_id: client.org_id,
      client_id: client.id,
      employee_id: user.id,
      entry_type_id: entryType.id,
      entry_type_code: 'job_coaching',
      date: '2026-04-09',
      start_time: '14:00',
      end_time: '15:15',
      duration_minutes: 75,
      reporting_period_key: '2026-04',
      location: 'Acme Corp warehouse',
      description: 'Job coaching session - completed barcode training module with excellent results',
      is_billable: false,
      is_payroll_eligible: true,
      is_reportable: true,
      status: 'submitted'
    });

    // Create sample answers from first few questions
    const sampleAnswers = {
      employer_name: 'Acme Corp',
      job_title: 'Warehouse Associate',
      work_site_location: 'Distribution center, North building',
      shift_start_time: '14:00',
      shift_end_time: '15:15',
      hours_worked: '1.25',
      tasks_performed: 'Completed barcode scanning training. Practiced on sample inventory boxes. Demonstrated improved accuracy and speed compared to previous session.',
      skills_trained: 'Barcode scanning, inventory organization, attention to detail',
      interventions_provided: 'Verbal coaching with visual modeling. Provided immediate feedback on accuracy.',
      level_of_support: 'Moderate',
      client_independence_level: 'Improving',
      performance_observations: 'Client showed steady improvement throughout the session. Started slowly but gained confidence. Made minimal errors by end of training block.',
      progress_made: 'Increased scanning speed from 8 items/min to 12 items/min. Error rate reduced from 3% to 1%.',
      issues_or_barriers: 'Client requested slower pace in first 10 minutes due to anxiety about accuracy. Once rhythm established, proceeded at normal pace.'
    };

    // Create field answers
    const fieldAnswer = await base44.entities.ReportFieldAnswer.create({
      org_id: client.org_id,
      time_entry_id: timeEntry.id,
      entry_type_id: entryType.id,
      entry_type_code: 'job_coaching',
      field_schema_version: 1,
      field_schema_snapshot: {
        entry_type_code: 'job_coaching',
        template_count: templates.length,
        fields: templates.reduce((acc, t) => {
          acc[t.field_key] = {
            label: t.label,
            type: t.field_type,
            required: t.is_required,
            section: t.section
          };
          return acc;
        }, {})
      },
      answers: sampleAnswers,
      required_fields_complete: true,
      report_ready: true,
      submitted_at: new Date().toISOString()
    });

    // Verify we can fetch the time entry back
    const entries = await base44.asServiceRole.entities.TimeEntry.filter({
      client_id: client.id,
      entry_type_code: 'job_coaching'
    });

    const createdEntry = entries.find(e => e.id === timeEntry.id);

    return Response.json({
      success: true,
      message: 'Test entry created successfully - ready for UI screenshot',
      client: {
        id: client.id,
        name: `${client.first_name} ${client.last_name}`,
        navigate_url: `/ClientDetail?id=${client.id}`
      },
      entry: {
        id: timeEntry.id,
        date: timeEntry.date,
        type: 'Job Coaching',
        duration: '75 minutes',
        status: timeEntry.status,
        visible_in_db: !!createdEntry
      },
      field_answers: {
        created: !!fieldAnswer,
        fields_count: Object.keys(sampleAnswers).length,
        sample_fields: {
          employer_name: sampleAnswers.employer_name,
          tasks_performed: sampleAnswers.tasks_performed.substring(0, 50) + '...'
        }
      }
    });

  } catch (error) {
    console.error('[TEST ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});