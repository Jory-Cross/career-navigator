import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Batch fix metadata with rate-limit handling
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const formCodeMap = {
      'job_coaching': 'USOR95',
      'job_development': 'USOR96',
      'life_skills': 'USOR148',
      'csb_hours': 'USOR148'
    };

    const sourceLayerMap = {
      'authorization_number': 'authorization',
      'vr_counselor_name': 'authorization',
      'job_goal': 'authorization',
      'job_title': 'authorization',
      'employer_name': 'authorization',
      'crp_company_name': 'authorization',
      'crp_contact_phone': 'authorization',
      'client_name': 'client',
      'coaching_date': 'time_entry',
      'coaching_hours': 'time_entry',
      'coaching_activities': 'time_entry',
      'client_performance_notes': 'time_entry',
      'job_coach_name': 'time_entry',
      'development_date': 'time_entry',
      'development_hours': 'time_entry',
      'billable_date': 'time_entry',
      'billable_hours': 'time_entry',
      'billable_activity': 'time_entry',
      'billable_observations': 'time_entry',
      'cbs_date': 'time_entry',
      'cbs_hours': 'time_entry',
      'cbs_activity': 'time_entry',
      'cbs_observations': 'time_entry',
      'primary_service_code': 'time_entry',
      'secondary_service_code': 'time_entry',
      'month_year': 'report_assembly',
      'development_activity': 'finalization',
      'activity_outcome': 'finalization',
      'next_steps': 'finalization',
      'summary_information': 'finalization',
      'barriers_to_cie': 'finalization'
    };

    const reportRequiredHeaders = [
      'client_name',
      'authorization_number',
      'vr_counselor_name',
      'job_goal',
      'job_title',
      'employer_name',
      'crp_company_name',
      'crp_contact_phone'
    ];

    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    console.log(`[BATCH] Starting batch fix for ${allFields.length} fields...`);
    
    let fixed = 0;
    const batchSize = 5;

    for (let i = 0; i < allFields.length; i += batchSize) {
      const batch = allFields.slice(i, i + batchSize);

      for (const field of batch) {
        const updates = {};

        // Set source_form_code
        const correctForm = formCodeMap[field.entry_type_code];
        if (correctForm) {
          updates.source_form_code = correctForm;
        }

        // Set data_source_layer
        const correctLayer = sourceLayerMap[field.field_key] || 'time_entry';
        updates.data_source_layer = correctLayer;

        // Fix header required_for_report
        if (field.pdf_context === 'header' && reportRequiredHeaders.includes(field.field_key)) {
          updates.required_for_report = true;
          updates.required_on_entry = false;
        }

        // Mark coaching fields internal
        if ((field.field_key === 'coaching_activities' || field.field_key === 'client_performance_notes') && field.entry_type_code === 'job_coaching') {
          updates.is_internal_only = true;
          updates.is_reportable = false;
        }

        // Remove service codes from USOR96
        if ((field.field_key === 'primary_service_code' || field.field_key === 'secondary_service_code') && field.entry_type_code === 'job_development') {
          updates.is_reportable = false;
          updates.is_internal_only = true;
        }

        try {
          await base44.entities.ReportFieldTemplate.update(field.id, updates);
          fixed++;
        } catch (e) {
          console.error(`Error updating ${field.field_key}:`, e.message);
        }
      }

      // Small delay between batches
      if (i + batchSize < allFields.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[BATCH] Fixed ${fixed} fields`);

    // Verify
    const verify = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const stillUnknownForm = verify.filter(f => !f.source_form_code);
    const stillUnknownLayer = verify.filter(f => !f.data_source_layer);

    return Response.json({
      status: stillUnknownForm.length === 0 && stillUnknownLayer.length === 0 ? '✅ READY' : '⚠️ CHECK',
      fixed_count: fixed,
      total_fields: verify.length,
      remaining_unknown_form: stillUnknownForm.length,
      remaining_unknown_layer: stillUnknownLayer.length
    });

  } catch (error) {
    console.error('[BATCH ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});