import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Debug: Check what ReportFieldTemplates actually exist in the database
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Check all active EntryTypes
    const entryTypes = await base44.entities.EntryType.filter({ is_active: true });
    
    const entryTypeInfo = {};
    for (const type of entryTypes) {
      // 2. For each entry type, check if ReportFieldTemplates exist
      const templates = await base44.entities.ReportFieldTemplate.filter({
        entry_type_id: type.id,
        is_active: true
      });

      entryTypeInfo[type.code] = {
        entry_type_id: type.id,
        entry_type_name: type.name,
        field_templates_count: templates.length,
        field_templates: templates.length > 0 ? templates.map(t => ({
          field_key: t.field_key,
          label: t.label,
          field_type: t.field_type,
          is_required: t.is_required
        })) : null
      };
    }

    return Response.json({
      success: true,
      total_entry_types: entryTypes.length,
      entry_types: entryTypeInfo
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});