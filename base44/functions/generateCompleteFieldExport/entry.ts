import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Generate complete field export with all attributes for production review.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fix: Only coaching_activities and client_performance_notes should be internal_only
    const fieldsToFixInternal = ['coaching_activities', 'client_performance_notes'];
    
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    // Correct internal_only flags
    for (const field of allFields) {
      const shouldBeInternal = fieldsToFixInternal.includes(field.field_key);
      if (field.is_internal_only !== shouldBeInternal) {
        await base44.entities.ReportFieldTemplate.update(field.id, {
          is_internal_only: shouldBeInternal,
          is_reportable: !shouldBeInternal
        });
      }
    }

    // Re-fetch after corrections
    const fields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const forms = {
      USOR95: { entry_type_code: 'job_coaching', fields: [] },
      USOR96: { entry_type_code: 'job_development', fields: [] },
      USOR148_life_skills: { entry_type_code: 'life_skills', fields: [] },
      USOR148_csb_hours: { entry_type_code: 'csb_hours', fields: [] }
    };

    // Organize by form
    fields.forEach(field => {
      const fieldData = {
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        required_on_entry: field.required_on_entry === true,
        required_for_report: field.required_for_report === true,
        pdf_context: field.pdf_context || 'none',
        source_form_code: field.source_form_code || 'UNKNOWN',
        data_source_layer: field.data_source_layer || 'unknown',
        source_form_field_name: field.source_form_field_name || `${field.pdf_context}_${field.field_key}`,
        populated_from: (() => {
          if (field.data_source_layer === 'authorization') return 'ServiceAuthorization';
          if (field.data_source_layer === 'client') return 'Client';
          if (field.data_source_layer === 'time_entry') return 'TimeEntry';
          if (field.data_source_layer === 'report_assembly') return 'ReportAssembly';
          if (field.data_source_layer === 'finalization') return 'Staff Input (Report Finalization)';
          return 'Unknown';
        })(),
        is_internal_only: field.is_internal_only,
        is_reportable: field.is_reportable
      };

      if (field.entry_type_code === 'job_coaching') {
        forms.USOR95.fields.push(fieldData);
      } else if (field.entry_type_code === 'job_development') {
        forms.USOR96.fields.push(fieldData);
      } else if (field.entry_type_code === 'life_skills') {
        forms.USOR148_life_skills.fields.push(fieldData);
      } else if (field.entry_type_code === 'csb_hours') {
        forms.USOR148_csb_hours.fields.push(fieldData);
      }
    });

    // Sort by pdf_context then order
    const contextOrder = { header: 0, row: 1, summary: 2, none: 3 };
    Object.values(forms).forEach(form => {
      form.fields.sort((a, b) => {
        const contextDiff = contextOrder[a.pdf_context] - contextOrder[b.pdf_context];
        return contextDiff !== 0 ? contextDiff : (a.label || '').localeCompare(b.label || '');
      });
    });

    // Count active fields by entry_type_code
    const countsByCode = {};
    fields.forEach(f => {
      if (!countsByCode[f.entry_type_code]) {
        countsByCode[f.entry_type_code] = { total: 0, reportable: 0, internal: 0 };
      }
      countsByCode[f.entry_type_code].total++;
      if (f.is_reportable) countsByCode[f.entry_type_code].reportable++;
      if (f.is_internal_only) countsByCode[f.entry_type_code].internal++;
    });

    const result = {
      summary: {
        total_active_fields: fields.length,
        active_by_entry_type: countsByCode,
        usor95_internal_only_fields: forms.USOR95.fields
          .filter(f => f.is_internal_only)
          .map(f => f.field_key),
        job_goal_required_on_entry: forms.USOR95.fields
          .find(f => f.field_key === 'job_goal')?.required_on_entry || false,
        source_form_codes_used: ['USOR95', 'USOR96', 'USOR148'],
        corrected_internal_flags: true
      },
      forms
    };

    return Response.json(result);

  } catch (error) {
    console.error('[EXPORT ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});