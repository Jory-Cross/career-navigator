import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Complete Phase 3 metadata audit with detailed reporting
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all active fields
    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    console.log(`[AUDIT] Total active fields: ${allFields.length}`);

    // Group by entry type
    const byEntryType = {
      job_coaching: [],
      job_development: [],
      life_skills: [],
      csb_hours: []
    };

    // Audit results
    const audit = {
      total_fields: allFields.length,
      by_entry_type: {},
      missing_source_form_code: [],
      missing_data_source_layer: [],
      missing_source_form_field_name: [],
      fields_by_status: {
        complete: [],
        incomplete: []
      }
    };

    for (const field of allFields) {
      const entryType = field.entry_type_code;
      if (byEntryType[entryType]) {
        byEntryType[entryType].push(field);
      }

      const isReportable = field.is_reportable !== false;
      const missing = [];

      // Check required metadata
      if (!field.source_form_code) {
        missing.push('source_form_code');
        audit.missing_source_form_code.push({
          field_key: field.field_key,
          entry_type_code: entryType,
          label: field.label
        });
      }

      if (!field.data_source_layer) {
        missing.push('data_source_layer');
        audit.missing_data_source_layer.push({
          field_key: field.field_key,
          entry_type_code: entryType,
          label: field.label
        });
      }

      // For reportable fields, check source_form_field_name
      if (isReportable && !field.source_form_field_name) {
        missing.push('source_form_field_name');
        audit.missing_source_form_field_name.push({
          field_key: field.field_key,
          entry_type_code: entryType,
          label: field.label,
          is_reportable: true
        });
      }

      // Categorize
      if (missing.length === 0) {
        audit.fields_by_status.complete.push({
          field_key: field.field_key,
          entry_type_code: entryType
        });
      } else {
        audit.fields_by_status.incomplete.push({
          field_key: field.field_key,
          entry_type_code: entryType,
          missing_fields: missing
        });
      }
    }

    // Summary by entry type
    Object.entries(byEntryType).forEach(([entryType, fields]) => {
      audit.by_entry_type[entryType] = {
        total: fields.length,
        missing_source_form_code: fields.filter(f => !f.source_form_code).length,
        missing_data_source_layer: fields.filter(f => !f.data_source_layer).length,
        missing_source_form_field_name: fields.filter(
          f => f.is_reportable !== false && !f.source_form_field_name
        ).length,
        complete: fields.filter(f => 
          f.source_form_code && 
          f.data_source_layer && 
          (f.is_reportable === false || f.source_form_field_name)
        ).length
      };
    });

    // Header required_for_report validation
    const headerFields = allFields.filter(f => f.pdf_context === 'header');
    const headerAudit = {
      total_headers: headerFields.length,
      correct_required_for_report: headerFields.filter(f => f.required_for_report === true).length,
      incorrect_required_on_entry: headerFields.filter(f => f.required_on_entry === true).length,
      issues: []
    };

    headerFields.forEach(f => {
      if (f.required_for_report !== true) {
        headerAudit.issues.push({
          field_key: f.field_key,
          entry_type_code: f.entry_type_code,
          problem: `required_for_report=${f.required_for_report}, should be true`
        });
      }
      if (f.required_on_entry === true) {
        headerAudit.issues.push({
          field_key: f.field_key,
          entry_type_code: f.entry_type_code,
          problem: `required_on_entry=true, should be false`
        });
      }
    });

    const readyForApproval = 
      audit.missing_source_form_code.length === 0 &&
      audit.missing_data_source_layer.length === 0 &&
      audit.missing_source_form_field_name.length === 0 &&
      headerAudit.issues.length === 0;

    return Response.json({
      status: readyForApproval ? '✅ READY FOR APPROVAL' : '❌ NOT READY',
      audit,
      header_audit: headerAudit,
      summary: {
        total_fields: allFields.length,
        complete_fields: audit.fields_by_status.complete.length,
        incomplete_fields: audit.fields_by_status.incomplete.length,
        zero_missing_source_form_code: audit.missing_source_form_code.length === 0,
        zero_missing_data_source_layer: audit.missing_data_source_layer.length === 0,
        zero_missing_source_form_field_name: audit.missing_source_form_field_name.length === 0,
        zero_header_issues: headerAudit.issues.length === 0
      }
    });

  } catch (error) {
    console.error('[AUDIT ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});