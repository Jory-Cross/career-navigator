import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get job_coaching entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    if (!entryTypes.length) {
      return Response.json({ error: 'Job Coaching entry type not found' }, { status: 404 });
    }

    const entryType = entryTypes[0];

    // Field definitions for USOR95 Job Coaching (row-level only)
    const jobCoachingFields = [
      {
        field_key: "coaching_day",
        label: "Day",
        field_type: "number",
        section: "Service Details",
        order: 1,
        placeholder: "Day of month (e.g., 5, 12, 27)",
        help_text: "The specific day of the month the coaching service occurred",
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_coaching_day",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "coaching_hours",
        label: "Hours",
        field_type: "number",
        section: "Service Details",
        order: 2,
        placeholder: "e.g., 2.5",
        help_text: "Number of hours spent on this coaching service",
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_coaching_hours",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "primary_service_code",
        label: "Primary Service Code",
        field_type: "select",
        section: "Service Details",
        order: 3,
        placeholder: "Select primary service code",
        help_text: "Primary service code for this coaching activity",
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_primary_service_code",
        required_on_entry: true,
        required_for_report: true,
        options: [] // Will be populated dynamically from ServiceCode table
      },
      {
        field_key: "secondary_service_code",
        label: "Secondary Service Code",
        field_type: "select",
        section: "Service Details",
        order: 4,
        placeholder: "Select if applicable",
        help_text: "Optional secondary service code if multiple services were provided",
        is_required: false,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_secondary_service_code",
        required_on_entry: false,
        required_for_report: false,
        options: [] // Will be populated dynamically from ServiceCode table
      }
    ];

    // Fields to mark as internal-only (remove from entry form)
    const internalOnlyFields = [
      "coaching_activities",
      "client_performance_notes"
    ];

    let updated = 0;
    let created = 0;
    let markedInternal = 0;

    // Update or create the 4 visible fields
    for (const fieldDef of jobCoachingFields) {
      const existing = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: entryType.id,
        field_key: fieldDef.field_key,
        is_active: true
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ReportFieldTemplate.update(existing[0].id, fieldDef);
        updated++;
      } else {
        await base44.asServiceRole.entities.ReportFieldTemplate.create({
          entry_type_id: entryType.id,
          entry_type_code: "job_coaching",
          ...fieldDef
        });
        created++;
      }
    }

    // Mark coaching_activities and client_performance_notes as internal-only
    for (const fieldKey of internalOnlyFields) {
      const fields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: entryType.id,
        field_key: fieldKey,
        is_active: true
      });

      for (const f of fields) {
        await base44.asServiceRole.entities.ReportFieldTemplate.update(f.id, {
          is_internal_only: true,
          required_on_entry: false,
          required_for_report: false
        });
        markedInternal++;
      }
    }

    // Get service codes for job_coaching to verify they exist
    const serviceCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    const codeList = serviceCodes.map(sc => sc.display_label);

    return Response.json({
      status: 'success',
      summary: {
        created,
        updated,
        marked_internal_only: markedInternal,
        visible_fields: 4,
        service_codes_available: codeList.length
      },
      service_codes: codeList,
      message: "Job Coaching fields refined for USOR95"
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});