import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get service codes for job_coaching - order by code for consistency
    const serviceCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    serviceCodes.sort((a, b) => {
  const getNumber = (code: string) => {
    const match = String(code || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  return getNumber(a.code) - getNumber(b.code);
});

    // Build option labels: "CODE - description"
    const options = serviceCodes.map(sc => sc.display_label);

    // Get job_coaching entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    if (!entryTypes.length) {
      return Response.json({ error: 'Job Coaching entry type not found' }, { status: 404 });
    }

    const entryType = entryTypes[0];

    // Update service code fields with options
    const fields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true,
      field_type: "select"
    });

    let updated = 0;

    for (const field of fields) {
      if (field.field_key === "primary_service_code" || field.field_key === "secondary_service_code") {
        await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
          options: options
        });
        updated++;
      }
    }

    return Response.json({
      status: 'success',
      updated_fields: updated,
      service_code_options: options,
      total_codes: serviceCodes.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
