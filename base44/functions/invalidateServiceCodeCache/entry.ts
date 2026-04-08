import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Cache Invalidation Hook
 * Called after any ServiceCode create/update/delete to ensure:
 * - ReportFieldTemplate dropdowns are refreshed
 * - All dependent caches are cleared
 * - Frontend receives fresh data on next fetch
 * 
 * Triggers:
 * - Entity automation on ServiceCode.create/update/delete
 * - Manual calls from admin functions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse body to get operation type
    const body = await req.json().catch(() => ({}));
    const operation = body.operation || 'manual'; // 'create', 'update', 'delete', 'manual'

    console.log(`[Cache Invalidation] Operation: ${operation}`);

    // Get all active job coaching service codes
    const serviceCodes = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    serviceCodes.sort((a, b) => a.code.localeCompare(b.code));
    const allOptions = serviceCodes.map(c => c.display_label);

    console.log(`[Cache Invalidation] Found ${serviceCodes.length} active codes`);

    // Get job_coaching entry type
    const entryTypes = await base44.asServiceRole.entities.EntryType.filter({
      code: "job_coaching",
      is_active: true
    });

    if (!entryTypes.length) {
      return Response.json({ error: 'Job Coaching entry type not found' }, { status: 404 });
    }

    const entryType = entryTypes[0];

    // Update all service code dropdowns with fresh options
    const dropdownFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      field_type: "select"
    });

    let updatedCount = 0;
    const affectedFields = [];

    for (const field of dropdownFields) {
      if (field.field_key === "primary_service_code" || field.field_key === "secondary_service_code") {
        // Force update with fresh options (triggers cache invalidation)
        await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
          options: allOptions,
          updated_at: new Date().toISOString()
        });
        
        updatedCount++;
        affectedFields.push(field.field_key);
        console.log(`[Cache Invalidation] Updated ${field.field_key}`);
      }
    }

    // Also update any other select fields that reference service codes
    const otherSelectFields = dropdownFields.filter(f => 
      f.field_key !== "primary_service_code" && 
      f.field_key !== "secondary_service_code" &&
      f.options?.some(opt => opt.startsWith("JC"))
    );

    for (const field of otherSelectFields) {
      await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
        options: allOptions,
        updated_at: new Date().toISOString()
      });
      updatedCount++;
      affectedFields.push(field.field_key);
      console.log(`[Cache Invalidation] Updated related field: ${field.field_key}`);
    }

    return Response.json({
      status: 'success',
      operation,
      service_codes_count: serviceCodes.length,
      fields_updated: updatedCount,
      affected_fields: affectedFields,
      all_options: allOptions,
      message: `Cache invalidated. ${updatedCount} dropdown(s) refreshed with ${serviceCodes.length} codes.`
    });
  } catch (error) {
    console.error('[Cache Invalidation] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});