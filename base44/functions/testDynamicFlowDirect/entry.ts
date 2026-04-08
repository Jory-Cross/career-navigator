import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Direct verification without calling submitTimeEntryDualWrite
 * Replicates the dual-write logic inline to verify question flow
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {};
    const entryTypesToTest = ['job_coaching', 'job_development', 'life_skills'];

    for (const entryTypeCode of entryTypesToTest) {
      try {
        // 1. Get entry type
        const entryTypes = await base44.entities.EntryType.filter({ 
          code: entryTypeCode, 
          is_active: true 
        });
        
        if (!entryTypes.length) {
          results[entryTypeCode] = { 
            status: 'FAIL', 
            reason: 'Entry type not found' 
          };
          continue;
        }

        const entryType = entryTypes[0];

        // 2. Get field templates (query by code since data was seeded by code)
        const fieldTemplates = await base44.entities.ReportFieldTemplate.filter({ 
          entry_type_code: entryTypeCode,
          is_active: true
        });

        // 3. Get test client
        const clients = await base44.entities.Client.filter({ 
          is_archived: false 
        });
        
        if (!clients.length) {
          results[entryTypeCode] = { 
            status: 'FAIL', 
            reason: 'No test client' 
          };
          continue;
        }

        const testClientId = clients[0].id;

        // 4. Build simulated answers (use real field keys from templates)
        const simulatedAnswers = {};
        fieldTemplates.slice(0, 3).forEach(field => {
          switch (field.field_type) {
            case 'text':
            case 'textarea':
              simulatedAnswers[field.field_key] = `Test: ${field.label}`;
              break;
            case 'number':
              simulatedAnswers[field.field_key] = 5;
              break;
            case 'date':
              simulatedAnswers[field.field_key] = '2026-04-08';
              break;
            case 'time':
              simulatedAnswers[field.field_key] = '14:30';
              break;
            case 'select':
            case 'multiselect':
              simulatedAnswers[field.field_key] = field.options?.[0] || 'default';
              break;
            case 'boolean':
            case 'checkbox':
              simulatedAnswers[field.field_key] = true;
              break;
          }
        });

        // 5. Calculate reporting period
        const date = '2026-04-08';
        const dateObj = new Date(date);
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const reportingPeriodKey = `${year}-${month}`;

        // 6. Create TimeEntry (mimic dual-write)
        const timeEntryData = {
          client_id: testClientId,
          employee_id: user.id,
          entry_type_id: entryType.id,
          entry_type_code: entryTypeCode,
          date: date,
          start_time: '10:00',
          end_time: '11:30',
          duration_minutes: 90,
          reporting_period_key: reportingPeriodKey,
          location: 'Test',
          description: `Test ${entryTypeCode}`,
          service_authorization_id: null,
          is_billable: entryType.is_billable || false,
          is_payroll_eligible: entryType.is_payroll_eligible !== false,
          is_reportable: entryType.report_mode !== 'none',
          status: 'submitted',
          report_ready: false,
          legacy_category: entryType.code
        };

        const timeEntry = await base44.entities.TimeEntry.create(timeEntryData);

        // 7. Create schema snapshot
        const fieldSchemaSnapshot = {};
        fieldTemplates.forEach(ft => {
          fieldSchemaSnapshot[ft.field_key] = {
            label: ft.label,
            field_type: ft.field_type,
            is_required: ft.is_required
          };
        });

        // 8. Create ReportFieldAnswer (mimic dual-write)
        const reportFieldAnswerData = {
          time_entry_id: timeEntry.id,
          entry_type_id: entryType.id,
          entry_type_code: entryTypeCode,
          field_schema_version: 1,
          field_schema_snapshot: fieldSchemaSnapshot,
          answers: simulatedAnswers,
          required_fields_complete: false,
          report_ready: false,
          submitted_at: new Date().toISOString(),
          validation_errors: [],
          completion_percent: fieldTemplates.length > 0 
            ? Math.round((Object.keys(simulatedAnswers).length / fieldTemplates.length) * 100)
            : 0
        };

        const fieldAnswer = await base44.entities.ReportFieldAnswer.create(reportFieldAnswerData);

        // 9. Verify by querying back
        const savedEntries = await base44.entities.TimeEntry.filter({ id: timeEntry.id });
        const savedAnswers = await base44.entities.ReportFieldAnswer.filter({ id: fieldAnswer.id });
        const savedEntry = savedEntries[0];
        const savedAnswer = savedAnswers[0];

        results[entryTypeCode] = {
          status: 'PASS',
          total_questions_defined: fieldTemplates.length,
          sample_questions: fieldTemplates.slice(0, 3).map(f => ({
            key: f.field_key,
            label: f.label,
            type: f.field_type
          })),
          answers_submitted: Object.keys(simulatedAnswers).length,
          answers_saved_in_db: Object.keys(savedAnswer.answers || {}).length,
          sample_answers_in_db: Object.keys(savedAnswer.answers || {}).slice(0, 3),
          time_entry_created: !!savedEntry,
          field_answer_created: !!savedAnswer,
          entry_id: timeEntry.id,
          answer_id: fieldAnswer.id
        };

      } catch (error) {
        results[entryTypeCode] = { 
          status: 'ERROR', 
          error: error.message 
        };
      }
    }

    return Response.json({
      success: true,
      verified_at: new Date().toISOString(),
      entry_types_tested: entryTypesToTest,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});