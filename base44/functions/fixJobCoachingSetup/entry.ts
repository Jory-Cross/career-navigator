import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[fixJobCoachingSetup] Starting...');

    // 1. Update job_coaching EntryType to NOT require authorization
    const entryTypes = await base44.entities.EntryType.filter({ code: 'job_coaching', is_active: true });
    const entryType = entryTypes[0];
    
    if (entryType) {
      console.log('[fixJobCoachingSetup] Found job_coaching EntryType, updating requires_authorization to false');
      await base44.entities.EntryType.update(entryType.id, {
        requires_authorization: false
      });
      console.log('[fixJobCoachingSetup] EntryType updated');
    }

    // 2. Clear old field templates for job_coaching
    const oldTemplates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching'
    });
    console.log('[fixJobCoachingSetup] Clearing', oldTemplates.length, 'old templates');
    for (const t of oldTemplates) {
      await base44.entities.ReportFieldTemplate.delete(t.id);
    }

    // 3. Seed correct field templates with exact field keys
    const correctFields = [
      {
        entry_type_id: entryType?.id || '',
        entry_type_code: 'job_coaching',
        field_key: 'jc_date',
        label: 'Coaching Date',
        field_type: 'date',
        is_required: true,
        is_reportable: true,
        pdf_context: 'row'
      },
      {
        entry_type_id: entryType?.id || '',
        entry_type_code: 'job_coaching',
        field_key: 'jc_hours',
        label: 'Hours of Coaching',
        field_type: 'number',
        is_required: true,
        is_reportable: true,
        pdf_context: 'row'
      },
      {
        entry_type_id: entryType?.id || '',
        entry_type_code: 'job_coaching',
        field_key: 'jc_job_coach_name',
        label: 'Job Coach Name',
        field_type: 'text',
        is_required: true,
        is_reportable: true,
        pdf_context: 'row'
      },
      {
        entry_type_id: entryType?.id || '',
        entry_type_code: 'job_coaching',
        field_key: 'jc_primary_service_code',
        label: 'Primary Service Code',
        field_type: 'select',
        is_required: true,
        is_reportable: true,
        pdf_context: 'row'
      },
      {
        entry_type_id: entryType?.id || '',
        entry_type_code: 'job_coaching',
        field_key: 'jc_secondary_service_code',
        label: 'Secondary Service Code',
        field_type: 'select',
        is_required: false,
        is_reportable: true,
        pdf_context: 'row'
      }
    ];

    console.log('[fixJobCoachingSetup] Creating', correctFields.length, 'new field templates with correct keys');
    await base44.entities.ReportFieldTemplate.bulkCreate(correctFields);
    console.log('[fixJobCoachingSetup] Field templates created');

    return Response.json({
      success: true,
      message: 'Job Coaching setup fixed',
      changes: {
        entry_type_requires_authorization: false,
        old_templates_removed: oldTemplates.length,
        new_templates_created: correctFields.length,
        correct_field_keys: correctFields.map(f => f.field_key)
      }
    });
  } catch (error) {
    console.error('[fixJobCoachingSetup] ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});