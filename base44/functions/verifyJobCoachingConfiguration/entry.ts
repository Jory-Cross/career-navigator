import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[verifyJobCoachingConfiguration] Starting verification...');

    // 1. Check EntryType
    const entryTypes = await base44.entities.EntryType.filter({ code: 'job_coaching', is_active: true });
    const entryType = entryTypes[0];
    
    if (!entryType) {
      return Response.json({ error: 'job_coaching EntryType not found' }, { status: 404 });
    }

    console.log('[verifyJobCoachingConfiguration] EntryType check:', {
      id: entryType.id,
      requires_authorization: entryType.requires_authorization,
      requires_field_answers: entryType.requires_field_answers
    });

    // 2. Check ReportFieldTemplate keys
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching'
    });

    console.log('[verifyJobCoachingConfiguration] Found', templates.length, 'field templates');

    const fieldKeys = templates.map(t => t.field_key).sort();
    const expectedKeys = ['jc_date', 'jc_hours', 'jc_job_coach_name', 'jc_primary_service_code', 'jc_secondary_service_code'].sort();

    console.log('[verifyJobCoachingConfiguration] Field keys:', fieldKeys);

    const keysMatch = JSON.stringify(fieldKeys) === JSON.stringify(expectedKeys);

    return Response.json({
      success: true,
      verification: {
        entry_type: {
          id: entryType.id,
          requires_authorization: entryType.requires_authorization,
          is_correct: entryType.requires_authorization === false
        },
        field_templates: {
          count: templates.length,
          keys: fieldKeys,
          expected: expectedKeys,
          keys_match: keysMatch
        }
      }
    });
  } catch (error) {
    console.error('[verifyJobCoachingConfiguration] ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});