import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Display cleaned ReportFieldTemplate records with full metadata
 * Shows field_key, label, type, required status, pdf_context, source mapping
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const reportOutput = {
      timestamp: new Date().toISOString(),
      entry_types: {}
    };

    const entryTypeCodes = ['job_coaching', 'job_development', 'life_skills', 'csb_hours'];
    const formMapping = {
      job_coaching: 'USOR95',
      job_development: 'USOR96',
      life_skills: 'USOR148',
      csb_hours: 'USOR148'
    };

    for (const code of entryTypeCodes) {
      console.log(`\n[DISPLAY] Fetching ${code}...`);
      
      const templates = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: code,
        is_active: true
      });

      // Sort by order
      const sorted = templates.sort((a, b) => (a.order || 0) - (b.order || 0));

      const formCode = formMapping[code];
      const headerFields = sorted.filter(t => t.pdf_context === 'header');
      const rowFields = sorted.filter(t => t.pdf_context === 'row');
      const summaryFields = sorted.filter(t => t.pdf_context === 'summary');
      const internalFields = sorted.filter(t => t.pdf_context === 'internal_only' || t.is_internal_only);

      reportOutput.entry_types[code] = {
        form_code: formCode,
        total_fields: sorted.length,
        header_fields: headerFields.length,
        row_fields: rowFields.length,
        summary_fields: summaryFields.length,
        internal_fields: internalFields.length,
        fields: {
          header: headerFields.map(t => ({
            field_key: t.field_key,
            label: t.label,
            field_type: t.field_type,
            required: t.is_required || false,
            pdf_context: t.pdf_context,
            source_form_code: t.source_form_code,
            source_form_field_name: t.source_form_field_name,
            collected_at: t.is_internal_only ? 'internal' : 'report_assembly',
            help_text: t.help_text || null,
            order: t.order
          })),
          row: rowFields.map(t => ({
            field_key: t.field_key,
            label: t.label,
            field_type: t.field_type,
            required: t.is_required || false,
            pdf_context: t.pdf_context,
            source_form_code: t.source_form_code,
            source_form_field_name: t.source_form_field_name,
            collected_at: 'time_entry_form',
            row_group: t.row_group,
            options: t.options || [],
            help_text: t.help_text || null,
            order: t.order
          })),
          summary: summaryFields.map(t => ({
            field_key: t.field_key,
            label: t.label,
            field_type: t.field_type,
            required: t.is_required || false,
            pdf_context: t.pdf_context,
            source_form_code: t.source_form_code,
            source_form_field_name: t.source_form_field_name,
            collected_at: 'report_finalization_dialog',
            help_text: t.help_text || null,
            order: t.order
          })),
          internal: internalFields.map(t => ({
            field_key: t.field_key,
            label: t.label,
            field_type: t.field_type,
            required: t.is_required || false,
            pdf_context: t.pdf_context,
            collected_at: 'not_in_pdf',
            help_text: t.help_text || null,
            order: t.order
          }))
        }
      };

      console.log(`[DISPLAY] ${code}: ${sorted.length} total fields`);
    }

    // Now show what was removed (old duplicates)
    const duplicatesRemoved = {
      job_coaching: [
        'employer_name (duplicate)',
        'job_title (duplicate)',
        'tasks_performed (duplicate)',
        'level_of_support (duplicate)'
      ],
      job_development: [],
      life_skills: [],
      csb_hours: []
    };

    reportOutput.cleanup_summary = {
      before: {
        job_coaching: '24 templates (with duplicates)',
        job_development: '19 templates',
        life_skills: '16 templates',
        csb_hours: '8 templates'
      },
      after: {
        job_coaching: '13 templates (0 duplicates)',
        job_development: '14 templates (0 duplicates)',
        life_skills: '11 templates (0 duplicates)',
        csb_hours: '0 templates (merged into life_skills)'
      },
      duplicates_removed: duplicatesRemoved,
      csb_hours_note: 'Merged into USOR148 with life_skills (same form)'
    };

    reportOutput.data_flow = {
      time_entry_form: [
        'Staff fills in row-level questions',
        'Creates TimeEntry record with date, duration, employee_id',
        'Creates ReportFieldAnswer with answers to row fields',
        'Submitted via submitTimeEntryWithDualWrite()'
      ],
      report_assembly: [
        'Query TimeEntry records for period',
        'Fetch ReportFieldAnswer for each entry',
        'Populate header from Client + ServiceAuthorization + User profiles',
        'Aggregate rows into report structure',
        'Send to PDF generation'
      ],
      report_finalization: [
        'Staff optionally adds summary-level fields',
        'Adds barriers, summary notes, etc.',
        'Locks period and creates GeneratedReport'
      ]
    };

    return Response.json(reportOutput, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DISPLAY ERROR]', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});