import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * PHASE 3 COMPLETION: Complete metadata fixes for production approval
 * 
 * Fixes:
 * 1. source_form_code: Must be USOR95/96/148 (not UNKNOWN)
 * 2. data_source_layer: time_entry | client | authorization | report_assembly | finalization
 * 3. Header required_for_report: true for report-critical fields
 * 4. USOR96 service codes audit: remove if not on actual USOR96 form
 * 5. USOR148 service codes audit: keep if reportable, else remove
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // ── CORRECTION MAPPINGS ──────────────────────────────────────────────

    // Map entry_type_code → source_form_code
    const formCodeMap = {
      'job_coaching': 'USOR95',
      'job_development': 'USOR96',
      'life_skills': 'USOR148',
      'csb_hours': 'USOR148'
    };

    // Map field_key → data_source_layer
    const sourceLayerMap = {
      // Header fields from ServiceAuthorization
      'authorization_number': 'authorization',
      'vr_counselor_name': 'authorization',
      'job_goal': 'authorization',
      'job_title': 'authorization',
      'employer_name': 'authorization',
      'crp_company_name': 'authorization',
      'crp_contact_phone': 'authorization',
      
      // Header from Client
      'client_name': 'client',
      
      // TimeEntry fields
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
      
      // Report Assembly (computed)
      'month_year': 'report_assembly',
      
      // Finalization (staff input during report generation)
      'development_activity': 'finalization',
      'activity_outcome': 'finalization',
      'next_steps': 'finalization',
      'summary_information': 'finalization',
      'barriers_to_cie': 'finalization'
    };

    // Header fields that are REQUIRED FOR REPORT (auto-populated but critical)
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

    // AUDIT: Service code fields that may not belong to certain forms
    // USOR96 (job_development): REMOVE service codes (not on the actual form)
    // USOR148 (life_skills/csb_hours): KEEP service codes (part of service tracking)
    const formServiceCodeAudit = {
      'job_development': { keep: false, reason: 'Service codes not on USOR96 form' },
      'life_skills': { keep: true, reason: 'Service codes required for USOR148' },
      'csb_hours': { keep: true, reason: 'Service codes required for USOR148' }
    };

    // ── FETCH AND CORRECT ────────────────────────────────────────────────
    console.log('[PHASE 3] Fetching all active fields...');
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const corrections = [];
    let updateCount = 0;

    for (const field of allFields) {
      const updates = {};

      // 1. FIX source_form_code
      const correctFormCode = formCodeMap[field.entry_type_code];
      if (correctFormCode && field.source_form_code !== correctFormCode) {
        updates.source_form_code = correctFormCode;
        corrections.push({
          type: 'source_form_code',
          field_key: field.field_key,
          entry_type_code: field.entry_type_code,
          old_value: field.source_form_code,
          new_value: correctFormCode
        });
      }

      // 2. FIX data_source_layer
      const correctLayer = sourceLayerMap[field.field_key] || 'time_entry';
      if (!field.data_source_layer || field.data_source_layer !== correctLayer) {
        updates.data_source_layer = correctLayer;
        corrections.push({
          type: 'data_source_layer',
          field_key: field.field_key,
          entry_type_code: field.entry_type_code,
          old_value: field.data_source_layer,
          new_value: correctLayer
        });
      }

      // 3. FIX header required_for_report
      if (field.pdf_context === 'header' && reportRequiredHeaders.includes(field.field_key)) {
        if (field.required_for_report !== true) {
          updates.required_for_report = true;
          corrections.push({
            type: 'required_for_report',
            field_key: field.field_key,
            entry_type_code: field.entry_type_code,
            reason: 'Header field critical for PDF'
          });
        }
        if (field.required_on_entry !== false) {
          updates.required_on_entry = false;
        }
      }

      // 4. AUDIT: Service codes in USOR96 and USOR148
      if ((field.field_key === 'primary_service_code' || field.field_key === 'secondary_service_code')) {
        const audit = formServiceCodeAudit[field.entry_type_code];
        if (audit && !audit.keep) {
          // Remove from reportable (mark as internal_only if still needed for tracking)
          if (field.is_reportable) {
            updates.is_reportable = false;
            updates.is_internal_only = true;
            corrections.push({
              type: 'service_code_audit',
              field_key: field.field_key,
              entry_type_code: field.entry_type_code,
              action: 'removed_from_reportable',
              reason: audit.reason
            });
          }
        } else if (audit && audit.keep) {
          // Ensure it's reportable for USOR148
          if (!field.is_reportable) {
            updates.is_reportable = true;
            updates.is_internal_only = false;
            corrections.push({
              type: 'service_code_audit',
              field_key: field.field_key,
              entry_type_code: field.entry_type_code,
              action: 'enabled_as_reportable',
              reason: audit.reason
            });
          }
        }
      }

      // Apply all updates
      if (Object.keys(updates).length > 0) {
        await base44.entities.ReportFieldTemplate.update(field.id, updates);
        updateCount++;
      }
    }

    console.log(`[PHASE 3] Applied ${updateCount} updates from ${corrections.length} corrections`);

    // ── RE-EXPORT FINAL LIST ─────────────────────────────────────────────
    console.log('[PHASE 3] Re-exporting final corrected field list...');
    const finalFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const forms = {
      USOR95: [],
      USOR96: [],
      USOR148_life_skills: [],
      USOR148_csb_hours: []
    };

    finalFields.forEach(field => {
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
          const layer = field.data_source_layer;
          const map = {
            'authorization': 'ServiceAuthorization',
            'client': 'Client',
            'time_entry': 'TimeEntry',
            'report_assembly': 'System (Report Assembly)',
            'finalization': 'Staff Input (Report Finalization)'
          };
          return map[layer] || 'Unknown';
        })(),
        is_internal_only: field.is_internal_only === true,
        is_reportable: field.is_reportable === true
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

    // Sort by context, then label
    const contextOrder = { header: 0, row: 1, summary: 2, none: 3 };
    Object.values(forms).forEach(fields => {
      fields.sort((a, b) => {
        const ctx = contextOrder[a.pdf_context] - contextOrder[b.pdf_context];
        return ctx !== 0 ? ctx : (a.label || '').localeCompare(b.label || '');
      });
    });

    // Count verification
    const counts = {
      usor95: forms.USOR95.length,
      usor95_reportable: forms.USOR95.filter(f => f.is_reportable && !f.is_internal_only).length,
      usor95_internal: forms.USOR95.filter(f => f.is_internal_only).length,
      usor96: forms.USOR96.length,
      usor96_reportable: forms.USOR96.filter(f => f.is_reportable && !f.is_internal_only).length,
      life_skills: forms.USOR148_life_skills.length,
      life_skills_reportable: forms.USOR148_life_skills.filter(f => f.is_reportable && !f.is_internal_only).length,
      csb_hours: forms.USOR148_csb_hours.length,
      csb_hours_reportable: forms.USOR148_csb_hours.filter(f => f.is_reportable && !f.is_internal_only).length
    };

    // Check for unknowns
    const unknownChecks = {
      source_form_code_unknown: finalFields.filter(f => !f.source_form_code || f.source_form_code === 'UNKNOWN').length,
      data_source_layer_unknown: finalFields.filter(f => !f.data_source_layer || f.data_source_layer === 'unknown').length
    };

    const result = {
      phase: 'Phase 3 - Production Field Corrections',
      status: unknownChecks.source_form_code_unknown === 0 && unknownChecks.data_source_layer_unknown === 0 
        ? 'READY FOR APPROVAL ✅' 
        : 'INCOMPLETE',
      corrections_applied: updateCount,
      correction_summary: corrections.slice(0, 30),
      total_corrections: corrections.length,
      unknown_check: unknownChecks,
      field_counts: counts,
      forms
    };

    return Response.json(result);

  } catch (error) {
    console.error('[PHASE 3 ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});