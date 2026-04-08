import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Fix remaining source_form_code null values
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

    const fields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const needsFix = fields.filter(f => !f.source_form_code);
    console.log(`[FIX] Found ${needsFix.length} fields missing source_form_code`);

    for (const field of needsFix) {
      const formCode = formCodeMap[field.entry_type_code];
      if (formCode) {
        console.log(`[FIX] Setting ${field.field_key} (${field.entry_type_code}) → ${formCode}`);
        await base44.entities.ReportFieldTemplate.update(field.id, {
          source_form_code: formCode
        });
      }
    }

    // Verify again
    const verify = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const stillMissing = verify.filter(f => !f.source_form_code);
    const stillMissingLayer = verify.filter(f => !f.data_source_layer);

    // Generate final export
    const forms = {
      USOR95: [],
      USOR96: [],
      USOR148: []
    };

    verify.forEach(field => {
      const fieldData = {
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        required_on_entry: field.required_on_entry === true,
        required_for_report: field.required_for_report === true,
        pdf_context: field.pdf_context || 'none',
        source_form_code: field.source_form_code || 'MISSING',
        data_source_layer: field.data_source_layer || 'MISSING',
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
          return map[layer] || layer || 'Unknown';
        })()
      };

      if (field.entry_type_code === 'job_coaching') {
        forms.USOR95.push(fieldData);
      } else if (field.entry_type_code === 'job_development') {
        forms.USOR96.push(fieldData);
      } else if (field.entry_type_code === 'life_skills' || field.entry_type_code === 'csb_hours') {
        forms.USOR148.push(fieldData);
      }
    });

    const contextOrder = { header: 0, row: 1, summary: 2, none: 3 };
    Object.values(forms).forEach(f => {
      f.sort((a, b) => {
        const ctx = contextOrder[a.pdf_context] - contextOrder[b.pdf_context];
        return ctx !== 0 ? ctx : (a.label || '').localeCompare(b.label || '');
      });
    });

    return Response.json({
      status: stillMissing.length === 0 && stillMissingLayer.length === 0 ? '✅ READY FOR APPROVAL' : '❌ INCOMPLETE',
      fixed_count: needsFix.length,
      remaining_missing: {
        source_form_code: stillMissing.length,
        data_source_layer: stillMissingLayer.length
      },
      counts: {
        usor95: forms.USOR95.length,
        usor96: forms.USOR96.length,
        usor148: forms.USOR148.length
      },
      forms
    });

  } catch (error) {
    console.error('[FIX ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});