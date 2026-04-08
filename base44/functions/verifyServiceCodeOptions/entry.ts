import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    const entryType = entryTypes[0];

    // Get primary service code field directly
    const allFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id
    });

    const primaryField = allFields.find(f => f.field_key === "primary_service_code");
    const secondaryField = allFields.find(f => f.field_key === "secondary_service_code");

    return Response.json({
      status: 'success',
      primary_field: {
        id: primaryField?.id,
        field_key: primaryField?.field_key,
        label: primaryField?.label,
        options_count: primaryField?.options?.length || 0,
        options: primaryField?.options || []
      },
      secondary_field: {
        id: secondaryField?.id,
        field_key: secondaryField?.field_key,
        label: secondaryField?.label,
        options_count: secondaryField?.options?.length || 0,
        options: secondaryField?.options || []
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});