import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Final Phase 3 export - USOR forms only (job_coaching, job_development, life_skills)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Phase 3 scope: USOR forms only
    const usorEntryTypes = ['job_coaching', 'job_development', 'life_skills'];

    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    // Filter to Phase 3 scope only
    const phase3Fields = allFields.filter(f => usorEntryTypes.includes(f.entry_type_code));

    console.log(`[PHASE3] Filtered to ${phase3Fields.length} USOR fields from ${allFields.length} total`);

    // Audit Phase 3 scope
    const audit = {
      total_usor_fields: phase3Fields.length,
      by_entry_type: {},
      missing_source_form_code: [],
      missing_data_source_layer: [],
      missing_source_form_field_name: [],
      header_issues: []
    };

    // Group by entry type
    const byForm = {
      USOR95: [],
      USOR96: [],
      USOR148: []
    };

    for (const field of phase3Fields) {
      const entryType = field.entry_type_code;

      // Initialize entry type tracking
      if (!audit.by_entry_type[entryType]) {
        audit.by_entry_type[entryType] = {
          total: 0,
          complete: 0,
          missing: []
        };
      }
      audit.by_entry_type[entryType].total++;

      // Check metadata
      const missing = [];
      if (!field.source_form_code) missing.push('source_form_code');
      if (!field.data_source_layer) missing.push('data_source_layer');
      if (field.is_reportable !== false && !field.source_form_field_name) {
        missing.push('source_form_field_name');
      }

      // Header validation
      if (field.pdf_context === 'header') {
        if (field.required_for_report !== true) {
          audit.header_issues.push({
            field_key: field.field_key,
            issue: `required_for_report should be true, got ${field.required_for_report}`
          });
        }
        if (field.required_on_entry === true) {
          audit.header_issues.push({
            field_key: field.field_key,
            issue: `required_on_entry should be false, got true`
          });
        }
      }

      if (missing.length === 0) {
        audit.by_entry_type[entryType].complete++;
      } else {
        audit.by_entry_type[entryType].missing.push({
          field_key: field.field_key,
          missing_fields: missing
        });
        if (missing.includes('source_form_code')) {
          audit.missing_source_form_code.push(field.field_key);
        }
        if (missing.includes('data_source_layer')) {
          audit.missing_data_source_layer.push(field.field_key);
        }
        if (missing.includes('source_form_field_name')) {
          audit.missing_source_form_field_name.push(field.field_key);
        }
      }

      // Organize by form
      const form = field.source_form_code;
      if (form && byForm[form]) {
        byForm[form].push({
          field_key: field.field_key,
          label: field.label,
          field_type: field.field_type,
          required_on_entry: field.required_on_entry === true,
          required_for_report: field.required_for_report === true,
          pdf_context: field.pdf_context || 'row',
          source_form_code: form,
          data_source_layer: field.data_source_layer,
          source_form_field_name: field.source_form_field_name,
          populated_from: (() => {
            const map = {
              'authorization': 'ServiceAuthorization',
              'client': 'Client',
              'time_entry': 'TimeEntry',
              'report_assembly': 'System (Report Assembly)',
              'finalization': 'Staff Input (Report Finalization)'
            };
            return map[field.data_source_layer] || field.data_source_layer;
          })()
        });
      }
    }

    // Determine approval status - ONLY for Phase 3 scope
    const readyForApproval =
      audit.missing_source_form_code.length === 0 &&
      audit.missing_data_source_layer.length === 0 &&
      audit.missing_source_form_field_name.length === 0 &&
      audit.header_issues.length === 0;

    // Sort each form
    Object.values(byForm).forEach(fields => {
      fields.sort((a, b) => {
        const ctxOrder = { header: 0, row: 1, summary: 2 };
        const ctxDiff = (ctxOrder[a.pdf_context] || 99) - (ctxOrder[b.pdf_context] || 99);
        return ctxDiff !== 0 ? ctxDiff : (a.label || '').localeCompare(b.label || '');
      });
    });

    return Response.json({
      status: readyForApproval ? '✅ READY FOR APPROVAL' : '❌ NOT READY',
      phase3_scope: {
        description: 'USOR forms only (job_coaching, job_development, life_skills)',
        audit
      },
      forms: byForm,
      summary: {
        usor95_count: byForm.USOR95.length,
        usor96_count: byForm.USOR96.length,
        usor148_count: byForm.USOR148.length,
        total_usor_fields: phase3Fields.length,
        approval_conditions: {
          zero_missing_source_form_code: audit.missing_source_form_code.length === 0,
          zero_missing_data_source_layer: audit.missing_data_source_layer.length === 0,
          zero_missing_source_form_field_name: audit.missing_source_form_field_name.length === 0,
          zero_header_issues: audit.header_issues.length === 0
        }
      }
    });

  } catch (error) {
    console.error('[ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});