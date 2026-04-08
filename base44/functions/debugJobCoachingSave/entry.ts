import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    console.log('[debugJobCoachingSave] Payload received:', JSON.stringify(payload, null, 2));

    const { client_id, entry_type_id, field_answers } = payload;

    // Check if field templates exist and match
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id
    });

    console.log('[debugJobCoachingSave] Field templates found:', templates.length);
    templates.forEach(t => {
      console.log('[debugJobCoachingSave] Template:', t.field_key, '- required:', t.is_required, '- provided:', field_answers[t.field_key] !== undefined);
    });

    // Check which required fields are missing
    const requiredTemplates = templates.filter(t => t.is_required);
    const missingRequired = requiredTemplates.filter(t => !field_answers[t.field_key]);

    console.log('[debugJobCoachingSave] Required fields check:');
    console.log('  - Required count:', requiredTemplates.length);
    console.log('  - Missing required:', missingRequired.map(t => t.field_key));

    return Response.json({
      success: true,
      debug_info: {
        field_answers_provided: Object.keys(field_answers),
        template_keys: templates.map(t => ({ key: t.field_key, required: t.is_required })),
        missing_required: missingRequired.map(t => t.field_key),
        validation_would_pass: missingRequired.length === 0
      }
    });
  } catch (error) {
    console.error('[debugJobCoachingSave] ERROR:', error.message);
    console.error('[debugJobCoachingSave] Stack:', error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});