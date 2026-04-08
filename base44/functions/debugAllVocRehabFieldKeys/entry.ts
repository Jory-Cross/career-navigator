import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all voc rehab entry types
    const entryTypes = await base44.entities.EntryType.filter({
      report_mode: { $in: ["usor95_monthly", "usor96_monthly", "usor148_service_period"] }
    });

    console.log(`[debugAllVocRehabFieldKeys] Found ${entryTypes.length} VR entry types`);

    const results = {};

    for (const entryType of entryTypes) {
      // Get all fields for this entry type
      const fields = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: entryType.code,
        is_active: true
      });

      // Filter for service-code-related fields
      const serviceCodeFields = fields.filter(f => 
        f.field_key.toLowerCase().includes('service') || 
        f.field_key.toLowerCase().includes('code')
      );

      results[entryType.code] = {
        entryTypeName: entryType.name,
        totalFields: fields.length,
        serviceCodeFields: serviceCodeFields.map(f => ({
          key: f.field_key,
          label: f.label,
          type: f.field_type,
          is_required: f.is_required
        }))
      };

      console.log(`[debugAllVocRehabFieldKeys] ${entryType.code}:`, serviceCodeFields.map(f => f.field_key));
    }

    return Response.json(results);
  } catch (error) {
    console.error("[debugAllVocRehabFieldKeys] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});