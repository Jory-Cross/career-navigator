import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job_coaching entry type
    const entryTypes = await base44.entities.EntryType.filter({
      code: "job_coaching"
    });

    if (!entryTypes.length) {
      return Response.json({ error: "job_coaching entry type not found" }, { status: 404 });
    }

    const entryType = entryTypes[0];
    console.log("[debugVocRehabFields] Found entry type:", entryType.code);

    // Get all fields for this entry type
    const fields = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: "job_coaching",
      is_active: true
    });

    console.log(`[debugVocRehabFields] Found ${fields.length} total fields`);

    // Filter for service-code-related fields
    const serviceCodeFields = fields.filter(f => 
      f.field_key.toLowerCase().includes('service') || 
      f.field_key.toLowerCase().includes('code')
    );

    console.log(`[debugVocRehabFields] Service code related fields:`, 
      serviceCodeFields.map(f => ({ key: f.field_key, label: f.label, type: f.field_type }))
    );

    // Get all service codes
    const serviceCodes = await base44.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    console.log(`[debugVocRehabFields] Found ${serviceCodes.length} service codes`);
    console.log("[debugVocRehabFields] Service codes:", 
      serviceCodes.slice(0, 3).map(c => ({ code: c.code, label: c.display_label }))
    );

    return Response.json({
      entryType: { code: entryType.code, id: entryType.id },
      totalFields: fields.length,
      serviceCodeFields: serviceCodeFields.map(f => ({ 
        key: f.field_key, 
        label: f.label, 
        type: f.field_type,
        options: f.options,
        is_required: f.is_required
      })),
      totalServiceCodes: serviceCodes.length,
      sampleServiceCodes: serviceCodes.slice(0, 5).map(c => ({ 
        code: c.code, 
        label: c.display_label,
        is_primary: c.is_primary,
        is_secondary: c.is_secondary
      }))
    });
  } catch (error) {
    console.error("[debugVocRehabFields] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});