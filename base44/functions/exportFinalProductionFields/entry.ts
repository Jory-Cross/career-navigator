import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Export complete field metadata for each USOR form with all requested attributes.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const forms = {
      USOR95: { entry_type_code: 'job_coaching', fields: [] },
      USOR96: { entry_type_code: 'job_development', fields: [] },
      USOR148_life_skills: { entry_type_code: 'life_skills', fields: [] },
      USOR148_csb_hours: { entry_type_code: 'csb_hours', fields: [] }
    };

    // Organize fields by form
    allFields.forEach(field => {
      if (field.entry_type_code === 'job_coaching') {
        forms.USOR95.fields.push(field);
      } else if (field.entry_type_code === 'job_development') {
        forms.USOR96.fields.push(field);
      } else if (field.entry_type_code === 'life_skills') {
        forms.USOR148_life_skills.fields.push(field);
      } else if (field.entry_type_code === 'csb_hours') {
        forms.USOR148_csb_hours.fields.push(field);
      }
    });

    // Sort each form's fields by order
    Object.values(forms).forEach(form => {
      form.fields.sort((a, b) => (a.order || 999) - (b.order || 999));
    });

    const result = {
      summary: {
        usor95_count: forms.USOR95.fields.length,
        usor96_count: forms.USOR96.fields.length,
        life_skills_count: forms.USOR148_life_skills.fields.length,
        csb_hours_count: forms.USOR148_csb_hours.fields.length,
        internal_only_moved_to: forms.USOR95.fields
          .filter(f => f.is_internal_only)
          .map(f => f.field_key)
      },
      forms
    };

    return Response.json(result);

  } catch (error) {
    console.error('[EXPORT ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});