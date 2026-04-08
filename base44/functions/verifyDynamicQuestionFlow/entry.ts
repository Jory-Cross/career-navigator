import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * End-to-end verification of dynamic question flow for different entry types
 * Simulates: Select client → Select entry type → Answer dynamic questions → Save → Verify records
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const results = {};

    // Test each entry type
    const entryTypesToTest = ['job_coaching', 'job_development', 'life_skills'];

    for (const entryTypeCode of entryTypesToTest) {
      const testResult = await testEntryTypeFlow(base44, entryTypeCode);
      results[entryTypeCode] = testResult;
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      tested_entry_types: entryTypesToTest,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function testEntryTypeFlow(base44, entryTypeCode) {
  const result = {
    entry_type_code: entryTypeCode,
    dynamic_questions_found: [],
    test_entry_id: null,
    test_answer_record_id: null,
    captured_answers: {},
    verification_passed: false,
    error: null
  };

  try {
    // 1. Get the entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({ 
      code: entryTypeCode, 
      is_active: true 
    });
    
    if (!entryTypes.length) {
      result.error = `Entry type not found: ${entryTypeCode}`;
      return result;
    }

    const entryType = entryTypes[0];
    result.entry_type_id = entryType.id;

    // 2. Get dynamic field templates for this entry type
    const fieldTemplates = await base44.asServiceRole.entities.ReportFieldTemplate.filter({ 
      entry_type_code: entryTypeCode,
      is_active: true
    });

    if (fieldTemplates.length > 0) {
      result.dynamic_questions_found = fieldTemplates.map(f => ({
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        is_required: f.is_required
      }));
    }

    // 3. Get a test client (use the first available or create a test scenario)
    let testClientId = null;
    const clients = await base44.asServiceRole.entities.Client.filter({ 
      is_archived: false 
    });
    
    if (clients.length > 0) {
      testClientId = clients[0].id;
    }

    if (!testClientId) {
      result.error = 'No test client available';
      return result;
    }

    // 4. Simulate user providing answers to dynamic questions
    const simulatedAnswers = {};
    fieldTemplates.forEach(field => {
      // Simulate different answer types based on field_type
      switch (field.field_type) {
        case 'text':
        case 'textarea':
          simulatedAnswers[field.field_key] = `Test answer for ${field.label}`;
          break;
        case 'number':
          simulatedAnswers[field.field_key] = 42;
          break;
        case 'date':
          simulatedAnswers[field.field_key] = '2026-04-08';
          break;
        case 'select':
        case 'multiselect':
          simulatedAnswers[field.field_key] = field.options?.[0] || 'option1';
          break;
        case 'checkbox':
        case 'boolean':
          simulatedAnswers[field.field_key] = true;
          break;
      }
    });

    // 5. Call dual-write function to submit the entry
    const response = await base44.functions.invoke('submitTimeEntryDualWrite', {
      clientId: testClientId,
      entryTypeId: entryType.id,
      entryTypeCode,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:30',
      durationMinutes: 90,
      location: 'Test Location',
      description: `Test entry for ${entryTypeCode}`,
      serviceAuthorizationId: null,
      fieldAnswers: simulatedAnswers,
      asDraft: false
    });

    if (!response.data?.time_entry_id || !response.data?.report_field_answer_id) {
      result.error = 'Dual-write function did not return expected IDs';
      return result;
    }

    result.test_entry_id = response.data.time_entry_id;
    result.test_answer_record_id = response.data.report_field_answer_id;

    // 6. Query back the ReportFieldAnswer to verify answers were saved
    const savedAnswerRecord = await base44.asServiceRole.entities.ReportFieldAnswer.filter({
      id: response.data.report_field_answer_id
    });

    if (savedAnswerRecord.length > 0) {
      const record = savedAnswerRecord[0];
      result.captured_answers = record.answers || {};
      
      // 7. Verification: Check that submitted answers match saved answers
      const answersMatch = JSON.stringify(simulatedAnswers) === JSON.stringify(result.captured_answers);
      result.verification_passed = answersMatch && Object.keys(result.captured_answers).length > 0;
    }

    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}