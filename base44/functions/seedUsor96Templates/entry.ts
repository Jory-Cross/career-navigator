import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the USOR96 entry type
    const entryTypeResults = await base44.entities.EntryType.filter({ code: 'usor96' });
    const entryType = entryTypeResults[0];

    if (!entryType) {
      return Response.json({ error: 'USOR96 entry type not found' }, { status: 404 });
    }

    // Delete existing templates for USOR96 to start fresh
    const existingTemplates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id
    });
    
    for (const template of existingTemplates) {
      await base44.asServiceRole.entities.ReportFieldTemplate.delete(template.id);
    }

    // Create USOR96-specific field templates
    const usor96Fields = [
      {
        entry_type_id: entryType.id,
        entry_type_code: 'usor96',
        field_key: 'usor96_day',
        label: 'Day',
        field_type: 'date',
        section: 'entry_info',
        order: 1,
        is_required: true,
        is_reportable: true,
        pdf_context: 'row',
        source_form_code: 'USOR96',
        data_source_layer: 'time_entry',
        required_on_entry: true,
        required_for_report: true
      },
      {
        entry_type_id: entryType.id,
        entry_type_code: 'usor96',
        field_key: 'usor96_hours',
        label: 'Hours',
        field_type: 'number',
        section: 'entry_info',
        order: 2,
        is_required: true,
        is_reportable: true,
        pdf_context: 'row',
        source_form_code: 'USOR96',
        data_source_layer: 'time_entry',
        required_on_entry: true,
        required_for_report: true,
        placeholder: '0.0'
      },
      {
        entry_type_id: entryType.id,
        entry_type_code: 'usor96',
        field_key: 'usor96_jd_activity',
        label: 'Job Development Activity',
        field_type: 'textarea',
        section: 'activity',
        order: 3,
        is_required: true,
        is_reportable: true,
        pdf_context: 'row',
        source_form_code: 'USOR96',
        data_source_layer: 'report_assembly',
        required_on_entry: true,
        required_for_report: true,
        placeholder: 'Describe the job development activity...'
      },
      {
        entry_type_id: entryType.id,
        entry_type_code: 'usor96',
        field_key: 'usor96_outcome',
        label: 'Outcome',
        field_type: 'textarea',
        section: 'activity',
        order: 4,
        is_required: true,
        is_reportable: true,
        pdf_context: 'row',
        source_form_code: 'USOR96',
        data_source_layer: 'report_assembly',
        required_on_entry: true,
        required_for_report: true,
        placeholder: 'Describe the outcome of the activity...'
      },
      {
        entry_type_id: entryType.id,
        entry_type_code: 'usor96',
        field_key: 'usor96_next_steps',
        label: 'Next Steps',
        field_type: 'textarea',
        section: 'activity',
        order: 5,
        is_required: true,
        is_reportable: true,
        pdf_context: 'row',
        source_form_code: 'USOR96',
        data_source_layer: 'report_assembly',
        required_on_entry: true,
        required_for_report: true,
        placeholder: 'Describe the next steps...'
      }
    ];

    const createdTemplates = await base44.entities.ReportFieldTemplate.bulkCreate(usor96Fields);

    return Response.json({
      success: true,
      entry_type_id: entryType.id,
      templates_created: createdTemplates.length,
      field_keys: usor96Fields.map(f => f.field_key)
    });
  } catch (error) {
    console.error('[seedUsor96Templates] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});