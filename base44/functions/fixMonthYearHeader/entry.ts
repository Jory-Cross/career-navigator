import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Fix month_year required_for_report across USOR forms
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const usorEntryTypes = ['job_coaching', 'job_development', 'life_skills'];
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const monthYearFields = allFields.filter(f => 
      f.field_key === 'month_year' && 
      usorEntryTypes.includes(f.entry_type_code)
    );

    console.log(`[FIX] Found ${monthYearFields.length} month_year fields to update`);

    for (const field of monthYearFields) {
      await base44.entities.ReportFieldTemplate.update(field.id, {
        required_for_report: true,
        required_on_entry: false
      });
      console.log(`[FIXED] ${field.entry_type_code} month_year`);
    }

    return Response.json({
      fixed: monthYearFields.length,
      status: '✅ COMPLETE'
    });

  } catch (error) {
    console.error('[ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});