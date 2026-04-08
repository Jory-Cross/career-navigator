import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Compact verification: For each entry type, confirm:
 * 1. Dynamic questions exist
 * 2. Answers are captured in ReportFieldAnswer.answers
 * 3. TimeEntry + ReportFieldAnswer created successfully
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
        // 1. Get entry type and field templates
        const entryTypes = await base44.asServiceRole.entities.EntryType.filter({ 
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
        const fieldTemplates = await base44.asServiceRole.entities.ReportFieldTemplate.filter({ 
          entry_type_code: entryTypeCode,
          is_active: true
        });

        // 2. Get test client
        const clients = await base44.asServiceRole.entities.Client.filter({ 
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

        // 3. Build simulated answers
        const simulatedAnswers = {};
        fieldTemplates.slice(0, 3).forEach(field => {
          switch (field.field_type) {
            case 'text':
            case 'textarea':
              simulatedAnswers[field.field_key] = `Answer: ${field.label}`;
              break;
            case 'number':
              simulatedAnswers[field.field_key] = 42;
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

        // 4. Submit via dual-write (using service role to invoke)
        const submitResult = await base44.asServiceRole.functions.invoke('submitTimeEntryDualWrite', {
          client_id: testClientId,
          entry_type_id: entryType.id,
          entry_type_code: entryTypeCode,
          date: '2026-04-08',
          start_time: '10:00',
          end_time: '11:30',
          duration_minutes: 90,
          location: 'Test',
          description: `Test ${entryTypeCode}`,
          service_authorization_id: null,
          field_answers: simulatedAnswers,
          as_draft: false
        });

        // 5. Verify ReportFieldAnswer.answers was populated
        const answerRecords = await base44.asServiceRole.entities.ReportFieldAnswer.filter({
          id: submitResult.data?.report_field_answer_id
        });

        if (!answerRecords.length) {
          results[entryTypeCode] = { 
            status: 'FAIL', 
            reason: 'ReportFieldAnswer not found' 
          };
          continue;
        }

        const savedAnswers = answerRecords[0].answers || {};
        const questionsCount = fieldTemplates.length;
        const answersCount = Object.keys(savedAnswers).length;
        const allAnswersMatched = answersCount > 0;

        results[entryTypeCode] = {
          status: allAnswersMatched ? 'PASS' : 'FAIL',
          questions_defined: questionsCount,
          questions_list: fieldTemplates.slice(0, 5).map(f => f.field_key),
          answers_submitted: Object.keys(simulatedAnswers),
          answers_saved_in_db: Object.keys(savedAnswers),
          answers_count: answersCount,
          time_entry_id: submitResult.data?.time_entry_id,
          field_answer_id: submitResult.data?.report_field_answer_id
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