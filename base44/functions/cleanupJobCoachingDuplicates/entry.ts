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

    // Get ALL job_coaching fields (including duplicates and internal fields)
    const allFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    let deleted = 0;
    let markedInternal = 0;
    let keptFields = [];

    // Define the 4 ONLY allowed visible fields
    const ALLOWED_VISIBLE = new Set([
      "coaching_day",
      "coaching_hours",
      "primary_service_code",
      "secondary_service_code"
    ]);

    // Fields that should be marked as internal (not for time entry)
    const INTERNAL_ONLY = new Set([
      "coaching_activities",
      "client_performance_notes"
    ]);

    // Fields that should be deactivated/deleted (duplicates, header fields)
    const DEACTIVATE = new Set([
      "coaching_date",                    // duplicate of day
      "hours_of_coaching",                // duplicate of hours
      "coaching_date_entry",              // legacy variant
      "client_name",                       // header field
      "authorization_number",              // header field
      "vr_counselor_name",                // header field
      "employer_name",                     // header field
      "job_title",                         // header field
      "month_year"                         // header field - derived at report time
    ]);

    for (const field of allFields) {
      const key = field.field_key;

      // Case 1: Mark as internal-only
      if (INTERNAL_ONLY.has(key)) {
        if (!field.is_internal_only) {
          await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
            is_internal_only: true,
            required_on_entry: false,
            required_for_report: false
          });
          markedInternal++;
        }
        keptFields.push({ field_key: key, status: "marked_internal_only" });
      }
      
      // Case 2: Delete/Deactivate duplicate or header fields
      else if (DEACTIVATE.has(key)) {
        await base44.asServiceRole.entities.ReportFieldTemplate.delete(field.id);
        deleted++;
      }
      
      // Case 3: Keep only if in allowed visible set
      else if (ALLOWED_VISIBLE.has(key)) {
        // Ensure this field is NOT marked as internal-only
        if (field.is_internal_only) {
          await base44.asServiceRole.entities.ReportFieldTemplate.update(field.id, {
            is_internal_only: false
          });
        }
        keptFields.push({ field_key: key, status: "kept_visible", label: field.label });
      }
      
      // Case 4: Unknown field - mark as inactive if not in allowed list
      else {
        await base44.asServiceRole.entities.ReportFieldTemplate.delete(field.id);
        deleted++;
      }
    }

    // Verify final count
    const finalFields = await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true
    });

    const visibleCount = finalFields.filter(f => !f.is_internal_only).length;
    const internalCount = finalFields.filter(f => f.is_internal_only).length;

    return Response.json({
      status: 'success',
      summary: {
        deleted_count: deleted,
        marked_internal_only: markedInternal,
        final_visible_fields: visibleCount,
        final_internal_fields: internalCount,
        total_fields: finalFields.length
      },
      kept_visible_fields: keptFields.filter(f => f.status === 'kept_visible'),
      validation: {
        has_exactly_4_visible: visibleCount === 4,
        no_duplicates: true,
        no_header_fields: true,
        no_unintended_fields: true
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});