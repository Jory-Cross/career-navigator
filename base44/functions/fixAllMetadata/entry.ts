import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Fix ALL metadata in one pass - ensure no null/UNKNOWN values persist
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // ── CORRECTION MAPPINGS ──────────────────────────────────────────────

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

    const serviceCodeAudit = {
      'job_development': { remove: true, reason: 'Not on USOR96 form' },
      'life_skills': { remove: false, reason: 'Required for USOR148' },
      'csb_hours': { remove: false, reason: 'Required for USOR148' }
    };

    // ── FETCH AND FIX ────────────────────────────────────────────────────
    console.log('[FIX] Fetching all fields...');
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    console.log(`[FIX] Processing ${allFields.length} fields...`);
    const fixes = [];
    let fixedCount = 0;

    for (const field of allFields) {
      const updates = {};
      let hasChange = false;

      // 1. Fix source_form_code (always set, never null/UNKNOWN)
      const correctForm = formCodeMap[field.entry_type_code];
      if (correctForm && (!field.source_form_code || field.source_form_code === 'UNKNOWN' || field.source_form_code === null)) {
        updates.source_form_code = correctForm;
        hasChange = true;
      }

      // 2. Fix data_source_layer (always set, never null/unknown)
      const correctLayer = sourceLayerMap[field.field_key] || 'time_entry';
      if (!field.data_source_layer || field.data_source_layer === 'unknown' || field.data_source_layer === null) {
        updates.data_source_layer = correctLayer;
        hasChange = true;
      }

      // 3. Fix header required_for_report
      if (field.pdf_context === 'header' && reportRequiredHeaders.includes(field.field_key)) {
        if (field.required_for_report !== true) {
          updates.required_for_report = true;
          hasChange = true;
        }
        if (field.required_on_entry !== false) {
          updates.required_on_entry = false;
          hasChange = true;
        }
      }

      // 4. Audit service codes
      if ((field.field_key === 'primary_service_code' || field.field_key === 'secondary_service_code')) {
        const audit = serviceCodeAudit[field.entry_type_code];
        if (audit && audit.remove) {
          if (field.is_reportable) {
            updates.is_reportable = false;
            updates.is_internal_only = true;
            hasChange = true;
            fixes.push({
              type: 'service_code_removed',
              field: field.field_key,
              entry: field.entry_type_code
            });
          }
        }
      }

      // 5. Mark coaching fields as internal
      if ((field.field_key === 'coaching_activities' || field.field_key === 'client_performance_notes') && field.entry_type_code === 'job_coaching') {
        if (!field.is_internal_only) {
          updates.is_internal_only = true;
          updates.is_reportable = false;
          hasChange = true;
        }
      }

      // Apply updates
      if (hasChange) {
        await base44.entities.ReportFieldTemplate.update(field.id, updates);
        fixedCount++;
      }
    }

    console.log(`[FIX] Fixed ${fixedCount} fields`);

    // ── VERIFY FIX ───────────────────────────────────────────────────────
    console.log('[VERIFY] Checking for remaining unknowns...');
    const verifyFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const unknownForm = verifyFields.filter(f => !f.source_form_code || f.source_form_code === 'UNKNOWN' || f.source_form_code === null);
    const unknownLayer = verifyFields.filter(f => !f.data_source_layer || f.data_source_layer === 'unknown' || f.data_source_layer === null);

    console.log(`[VERIFY] Remaining unknown source_form_code: ${unknownForm.length}`);
    console.log(`[VERIFY] Remaining unknown data_source_layer: ${unknownLayer.length}`);

    // ── FINAL EXPORT ─────────────────────────────────────────────────────
    const forms = {
      USOR95: [],
      USOR96: [],
      USOR148_life_skills: [],
      USOR148_csb_hours: []
    };

    verifyFields.forEach(field => {
      const fieldData = {
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        required_on_entry: field.required_on_entry === true,
        required_for_report: field.required_for_report === true,
        pdf_context: field.pdf_context || 'none',
        source_form_code: field.source_form_code || 'ERROR',
        data_source_layer: field.data_source_layer || 'ERROR',
        source_form_field_name: field.source_form_field_name || `${field.pdf_context}_${field.field_key}`,
        populated_from: (() => {
          const layer = field.data_source_layer;
          const map = {
            'authorization': 'ServiceAuthorization',
            'client': 'Client',
            'time_entry': 'TimeEntry',
            'report_assembly': 'System (Report Assembly)',
            'finalization': 'Staff Input (Report Finalization)'
          };
          return map[layer] || 'Unknown';
        })()
      };

      if (field.entry_type_code === 'job_coaching') {
        forms.USOR95.push(fieldData);
      } else if (field.entry_type_code === 'job_development') {
        forms.USOR96.push(fieldData);
      } else if (field.entry_type_code === 'life_skills') {
        forms.USOR148_life_skills.push(fieldData);
      } else if (field.entry_type_code === 'csb_hours') {
        forms.USOR148_csb_hours.push(fieldData);
      }
    });

    const contextOrder = { header: 0, row: 1, summary: 2, none: 3 };
    Object.values(forms).forEach(fields => {
      fields.sort((a, b) => {
        const ctx = contextOrder[a.pdf_context] - contextOrder[b.pdf_context];
        return ctx !== 0 ? ctx : (a.label || '').localeCompare(b.label || '');
      });
    });

    const result = {
      status: unknownForm.length === 0 && unknownLayer.length === 0 ? '✅ READY FOR APPROVAL' : '❌ INCOMPLETE',
      fixed_count: fixedCount,
      unknowns_remaining: {
        source_form_code: unknownForm.length,
        data_source_layer: unknownLayer.length
      },
      field_counts: {
        usor95: forms.USOR95.length,
        usor96: forms.USOR96.length,
        life_skills: forms.USOR148_life_skills.length,
        csb_hours: forms.USOR148_csb_hours.length
      },
      forms
    };

    return Response.json(result);

  } catch (error) {
    console.error('[FIX ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});