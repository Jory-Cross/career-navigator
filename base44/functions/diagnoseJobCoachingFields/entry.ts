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

    // Get ALL job_coaching fields
    const allFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    // Group by type
    const byContext = {};
    const byKey = {};

    for (const field of allFields) {
      const ctx = field.pdf_context || 'unknown';
      if (!byContext[ctx]) byContext[ctx] = [];
      byContext[ctx].push({
        id: field.id,
        field_key: field.field_key,
        label: field.label,
        is_internal_only: field.is_internal_only,
        order: field.order,
        options: field.options?.slice(0, 3) // first 3 options
      });

      if (!byKey[field.field_key]) byKey[field.field_key] = [];
      byKey[field.field_key].push({
        id: field.id,
        label: field.label,
        pdf_context: ctx,
        is_internal_only: field.is_internal_only
      });
    }

    // Find duplicates (same field_key multiple times)
    const duplicates = Object.entries(byKey)
      .filter(([key, records]) => records.length > 1)
      .map(([key, records]) => ({ field_key: key, count: records.length, records }));

    return Response.json({
      status: 'success',
      total_fields: allFields.length,
      fields_by_context: byContext,
      duplicate_field_keys: duplicates.length > 0 ? duplicates : "None found",
      all_field_keys: Object.keys(byKey).sort(),
      sample_fields: allFields.slice(0, 10).map(f => ({
        id: f.id,
        field_key: f.field_key,
        label: f.label,
        pdf_context: f.pdf_context,
        is_internal_only: f.is_internal_only
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});