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

    // Get all current fields
    const allFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    // Get service codes for dropdown options
    const serviceCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    const serviceCodeOptions = serviceCodes.map(sc => sc.display_label);

    // Fields to DELETE (old/duplicate versions)
    const fieldsToDelete = new Set([
      "coaching_date",
      "hours_of_coaching",
      "job_coach_name",
      "coaching_day",  // old version
      "coaching_hours" // old version
    ]);

    // Final field definitions (clean set)
    const finalFields = [
      {
        field_key: "coaching_date",
        label: "Coaching Date",
        field_type: "date",
        section: "Service Details",
        order: 1,
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_coaching_date",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "hours_of_coaching",
        label: "Hours of Coaching",
        field_type: "number",
        section: "Service Details",
        order: 2,
        placeholder: "e.g. 2.5",
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_hours_of_coaching",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "job_coach_name",
        label: "Job Coach Name",
        field_type: "text",
        section: "Service Details",
        order: 3,
        placeholder: "Name of coaching staff member",
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_job_coach_name",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "primary_service_code",
        label: "Primary Service Code",
        field_type: "select",
        section: "Service Details",
        order: 4,
        placeholder: "Select primary service code",
        options: serviceCodeOptions,
        is_required: true,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_primary_service_code",
        required_on_entry: true,
        required_for_report: true
      },
      {
        field_key: "secondary_service_code",
        label: "Secondary Service Code",
        field_type: "select",
        section: "Service Details",
        order: 5,
        placeholder: "Select if applicable",
        options: serviceCodeOptions,
        is_required: false,
        is_reportable: true,
        is_internal_only: false,
        pdf_context: "row",
        source_form_code: "USOR95",
        data_source_layer: "time_entry",
        source_form_field_name: "row_secondary_service_code",
        required_on_entry: false,
        required_for_report: false
      }
    ];

    let deleted = 0;
    let updated = 0;
    let created = 0;

    // Delete old/duplicate fields
    for (const field of allFields) {
      if (fieldsToDelete.has(field.field_key)) {
        await base44.asServiceRole.entities.ReportFieldTemplate.delete(field.id);
        deleted++;
      }
    }

    // Create or update final fields
    for (const fieldDef of finalFields) {
      const existing = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: entryType.id,
        field_key: fieldDef.field_key,
        is_active: true
      });

      if (existing.length > 0) {
        // Update
        await base44.asServiceRole.entities.ReportFieldTemplate.update(existing[0].id, fieldDef);
        updated++;
      } else {
        // Create
        await base44.asServiceRole.entities.ReportFieldTemplate.create({
          entry_type_id: entryType.id,
          entry_type_code: "job_coaching",
          ...fieldDef
        });
        created++;
      }
    }

    // Verify final state
    const finalState = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    const finalVisible = finalState.filter(f => !f.is_internal_only && f.pdf_context === 'row');

    return Response.json({
      status: 'success',
      operations: {
        deleted,
        updated,
        created
      },
      final_visible_fields: finalVisible.length,
      final_fields: finalVisible.map(f => ({
        field_key: f.field_key,
        label: f.label,
        type: f.field_type,
        required: f.is_required,
        order: f.order
      })),
      service_code_options: serviceCodeOptions
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});