import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Final production corrections:
 * 1. Fix source_form_code to USOR95/96/148
 * 2. Add data_source_layer field
 * 3. Clarify source_form_field_name as internal mapping key
 * 4. Fix auto-populated header required flags
 * 5. Confirm internal_only for coaching fields
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const corrections = [];

    // ── MAPPING: entry_type_code → USOR form code ──────────────────────────
    const formCodeMap = {
      'job_coaching': 'USOR95',
      'job_development': 'USOR96',
      'life_skills': 'USOR148',
      'csb_hours': 'USOR148'
    };

    // ── DATA SOURCE LAYER MAPPING ──────────────────────────────────────────
    const dataSourceMap = {
      // Header fields come from multiple sources
      'client_name': 'client',
      'authorization_number': 'authorization',
      'vr_counselor_name': 'authorization',
      'job_goal': 'authorization',
      'job_title': 'authorization',
      'employer_name': 'authorization',
      'crp_company_name': 'authorization',
      'crp_contact_phone': 'authorization',
      
      // Row fields from time entry
      'coaching_date': 'time_entry',
      'coaching_hours': 'time_entry',
      'development_date': 'time_entry',
      'development_hours': 'time_entry',
      'billable_date': 'time_entry',
      'billable_hours': 'time_entry',
      'cbs_date': 'time_entry',
      'cbs_hours': 'time_entry',
      
      // Service details
      'coaching_activities': 'time_entry',
      'client_performance_notes': 'time_entry',
      'development_activity': 'time_entry',
      'primary_service_code': 'time_entry',
      'secondary_service_code': 'time_entry',
      'billable_activity': 'time_entry',
      'billable_observations': 'time_entry',
      'cbs_activity': 'time_entry',
      'cbs_observations': 'time_entry',
      'job_coach_name': 'time_entry',
      
      // Finalization fields
      'activity_outcome': 'finalization',
      'next_steps': 'finalization',
      'development_activity': 'finalization',
      'summary_information': 'finalization',
      'barriers_to_cie': 'finalization',
      
      // System
      'month_year': 'report_assembly'
    };

    // ── AUTO-POPULATED HEADER FIELDS (should be required_for_report but not required_on_entry) ──
    const autoPopulatedHeaders = [
      'client_name',       // from Client
      'authorization_number', // from ServiceAuthorization
      'vr_counselor_name', // from ServiceAuthorization
      'job_goal',          // from ServiceAuthorization
      'job_title',         // from ServiceAuthorization
      'employer_name',     // from ServiceAuthorization
      'crp_company_name',  // from ServiceAuthorization
      'crp_contact_phone'  // from ServiceAuthorization
    ];

    // ── Get all active fields ──────────────────────────────────────────────
    console.log('[CORRECTIONS] Fetching all active fields...');
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    // ── Apply corrections ──────────────────────────────────────────────────
    console.log('[CORRECTIONS] Applying production-ready corrections...');

    for (const field of allFields) {
      const updates = {};
      
      // 1. Fix source_form_code
      const correctFormCode = formCodeMap[field.entry_type_code];
      if (correctFormCode && field.source_form_code !== correctFormCode) {
        updates.source_form_code = correctFormCode;
        corrections.push({
          field_key: field.field_key,
          entry_type_code: field.entry_type_code,
          change: `source_form_code: "${field.source_form_code}" → "${correctFormCode}"`
        });
      }

      // 2. Add data_source_layer
      const sourceLayer = dataSourceMap[field.field_key] || 'time_entry';
      if (!field.data_source_layer || field.data_source_layer !== sourceLayer) {
        updates.data_source_layer = sourceLayer;
        if (!corrections.find(c => c.field_key === field.field_key && c.change.includes('source_form_code'))) {
          corrections.push({
            field_key: field.field_key,
            entry_type_code: field.entry_type_code,
            change: `data_source_layer: "${sourceLayer}"`
          });
        }
      }

      // 3. Fix auto-populated headers
      if (autoPopulatedHeaders.includes(field.field_key) && field.pdf_context === 'header') {
        if (field.required_on_entry !== false) {
          updates.required_on_entry = false;
          corrections.push({
            field_key: field.field_key,
            entry_type_code: field.entry_type_code,
            change: `required_on_entry: true → false (auto-populated from ${sourceLayer})`
          });
        }
        if (field.required_for_report !== true) {
          updates.required_for_report = true;
        }
      }

      // 4. Ensure coaching fields are internal_only
      if ((field.field_key === 'coaching_activities' || field.field_key === 'client_performance_notes') 
          && !field.is_internal_only) {
        updates.is_internal_only = true;
        updates.is_reportable = false;
        corrections.push({
          field_key: field.field_key,
          entry_type_code: field.entry_type_code,
          change: `is_internal_only: true (no PDF mapping)`
        });
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await base44.entities.ReportFieldTemplate.update(field.id, updates);
      }
    }

    // ── Generate final field list ──────────────────────────────────────────
    console.log('[CORRECTIONS] Generating final production field list...');
    const finalFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    // Group by form
    const byForm = {
      'USOR95': [],
      'USOR96': [],
      'USOR148': []
    };

    const byEntryType = {};

    finalFields.forEach(field => {
      if (byForm[field.source_form_code]) {
        byForm[field.source_form_code].push({
          field_key: field.field_key,
          label: field.label,
          pdf_context: field.pdf_context,
          is_internal_only: field.is_internal_only,
          is_reportable: field.is_reportable,
          required_on_entry: field.required_on_entry,
          required_for_report: field.required_for_report,
          data_source_layer: field.data_source_layer
        });
      }

      if (!byEntryType[field.entry_type_code]) {
        byEntryType[field.entry_type_code] = [];
      }
      byEntryType[field.entry_type_code].push(field.field_key);
    });

    const result = {
      corrections_applied: corrections.length,
      correction_details: corrections.slice(0, 20), // First 20 for display
      total_corrections_count: corrections.length,
      field_counts_by_entry_type: {
        'job_coaching': finalFields.filter(f => f.entry_type_code === 'job_coaching').length,
        'job_development': finalFields.filter(f => f.entry_type_code === 'job_development').length,
        'life_skills': finalFields.filter(f => f.entry_type_code === 'life_skills').length,
        'csb_hours': finalFields.filter(f => f.entry_type_code === 'csb_hours').length,
        'admin_time': finalFields.filter(f => f.entry_type_code === 'admin_time').length,
        'eom_reporting': finalFields.filter(f => f.entry_type_code === 'eom_reporting').length
      },
      reportable_usor_counts: {
        'USOR95_count': byForm['USOR95'].filter(f => f.is_reportable && !f.is_internal_only).length,
        'USOR96_count': byForm['USOR96'].filter(f => f.is_reportable && !f.is_internal_only).length,
        'USOR148_count': byForm['USOR148'].filter(f => f.is_reportable && !f.is_internal_only).length
      },
      final_field_list_by_form: byForm,
      math_summary: {
        usor95_active: finalFields.filter(f => f.entry_type_code === 'job_coaching').length,
        usor96_active: finalFields.filter(f => f.entry_type_code === 'job_development').length,
        usor148_life_skills: finalFields.filter(f => f.entry_type_code === 'life_skills').length,
        usor148_csb_hours: finalFields.filter(f => f.entry_type_code === 'csb_hours').length,
        total_usor_fields: finalFields.filter(f => ['job_coaching', 'job_development', 'life_skills', 'csb_hours'].includes(f.entry_type_code)).length,
        total_all_fields: finalFields.length,
        note: 'life_skills and csb_hours are distinct templates with separate field records'
      }
    };

    return Response.json(result);

  } catch (error) {
    console.error('[CORRECTIONS ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});