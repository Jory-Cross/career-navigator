import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get life_skills templates to use as a source
    const lifeSkillsTemplates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'life_skills',
      is_active: true,
      pdf_context: 'row',
      is_internal_only: false
    });

    if (lifeSkillsTemplates.length === 0) {
      return Response.json({
        status: 'error',
        message: 'No life_skills templates found to copy from',
        csbCreated: 0
      });
    }

    // Get the csb_hours entry type
    const csbTypes = await base44.entities.EntryType.filter({ code: 'csb_hours' });
    if (csbTypes.length === 0) {
      return Response.json({
        status: 'error',
        message: 'csb_hours entry type not found',
        csbCreated: 0
      });
    }

    const csbEntryType = csbTypes[0];

    // Check if csb_hours templates already exist
    const existingCsb = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'csb_hours',
      is_active: true
    });

    if (existingCsb.length > 0) {
      return Response.json({
        status: 'already_exists',
        message: 'csb_hours templates already configured',
        count: existingCsb.length
      });
    }

    // Create csb_hours templates by copying from life_skills
    const created = [];
    for (const template of lifeSkillsTemplates) {
      const newTemplate = {
        org_id: template.org_id,
        entry_type_id: csbEntryType.id,
        entry_type_code: 'csb_hours',
        field_key: template.field_key,
        label: template.label,
        field_type: template.field_type,
        field_group: template.field_group,
        section: template.section,
        order: template.order,
        options: template.options,
        placeholder: template.placeholder,
        help_text: template.help_text,
        is_required: template.is_required,
        is_reportable: template.is_reportable,
        is_internal_only: template.is_internal_only,
        pdf_context: template.pdf_context,
        source_form_code: template.source_form_code,
        data_source_layer: template.data_source_layer,
        source_form_field_name: template.source_form_field_name,
        required_on_entry: template.required_on_entry,
        required_for_report: template.required_for_report,
        maps_to_form_code: template.maps_to_form_code,
        validation_rule: template.validation_rule,
        conditional_logic: template.conditional_logic,
        schema_version: template.schema_version,
        is_active: true,
        pdf_field_name: template.pdf_field_name,
        display_in_summary: template.display_in_summary
      };

      await base44.entities.ReportFieldTemplate.create(newTemplate);
      created.push({
        field_key: template.field_key,
        label: template.label
      });
    }

    return Response.json({
      status: 'success',
      message: 'csb_hours templates created from life_skills',
      count: created.length,
      templates: created
    });
  } catch (error) {
    console.error('Error seeding csb_hours fields:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});