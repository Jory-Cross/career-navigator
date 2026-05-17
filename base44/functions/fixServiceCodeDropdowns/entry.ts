import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all 4 service codes
    const allCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    allCodes.sort((a, b) => {
  const getNumber = (code: string) => {
    const match = String(code || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  return getNumber(a.code) - getNumber(b.code);
});

    const allOptions = allCodes.map(c => c.display_label);

    console.log(`Found ${allCodes.length} codes:`, allOptions);

    // Get job_coaching entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    if (!entryTypes.length) {
      return Response.json({ error: 'Job Coaching entry type not found' }, { status: 404 });
    }

    const entryType = entryTypes[0];

    // Get both service code fields
    const serviceCodeFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      field_type: "select"
    });

    let updated = 0;

    // Update both service code dropdowns
    for (const field of serviceCodeFields) {
      if (field.field_key === "primary_service_code" || field.field_key === "secondary_service_code") {
        console.log(`Updating ${field.field_key} with ${allOptions.length} options`);
        
        await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
          options: allOptions
        });
        updated++;
      }
    }

    // Verify update
    const updated_fields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      field_type: "select"
    });

    const primField = updated_fields.find(f => f.field_key === "primary_service_code");
    const secField = updated_fields.find(f => f.field_key === "secondary_service_code");

    return Response.json({
      status: 'success',
      updated_fields: updated,
      primary_options_count: primField?.options?.length || 0,
      secondary_options_count: secField?.options?.length || 0,
      all_options: allOptions
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
