import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all active service codes
    const serviceCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    serviceCodes.sort((a, b) => a.code.localeCompare(b.code));

    // Get entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    if (!entryTypes.length) {
      return Response.json({ error: 'Job Coaching entry type not found' }, { status: 404 });
    }

    const entryType = entryTypes[0];

    // Get dropdown fields
    const allFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      field_type: "select"
    });

    const primaryField = allFields.find(f => f.field_key === "primary_service_code");
    const secondaryField = allFields.find(f => f.field_key === "secondary_service_code");

    const expectedOptions = serviceCodes.map(c => c.display_label);
    const primaryMismatch = primaryField?.options?.length !== expectedOptions.length;
    const secondaryMismatch = secondaryField?.options?.length !== expectedOptions.length;

    const inconsistencies = [];

    if (primaryMismatch) {
      inconsistencies.push({
        field: 'primary_service_code',
        expected_count: expectedOptions.length,
        actual_count: primaryField?.options?.length || 0,
        missing: primaryField?.options?.length < expectedOptions.length ? 'Yes' : 'No'
      });
    }

    if (secondaryMismatch) {
      inconsistencies.push({
        field: 'secondary_service_code',
        expected_count: expectedOptions.length,
        actual_count: secondaryField?.options?.length || 0,
        missing: secondaryField?.options?.length < expectedOptions.length ? 'Yes' : 'No'
      });
    }

    if (!primaryField) inconsistencies.push({ field: 'primary_service_code', error: 'Field not found' });
    if (!secondaryField) inconsistencies.push({ field: 'secondary_service_code', error: 'Field not found' });

    return Response.json({
      status: inconsistencies.length === 0 ? 'consistent' : 'inconsistent',
      service_codes_count: serviceCodes.length,
      service_codes: serviceCodes.map(c => ({ code: c.code, label: c.display_label })),
      primary_field_options_count: primaryField?.options?.length || 0,
      secondary_field_options_count: secondaryField?.options?.length || 0,
      inconsistencies: inconsistencies,
      validation_message: inconsistencies.length === 0 
        ? '✅ All dropdowns are consistent with service codes'
        : `⚠️ Found ${inconsistencies.length} inconsistency(ies)`
    });
  } catch (error) {
    console.error('Validation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});