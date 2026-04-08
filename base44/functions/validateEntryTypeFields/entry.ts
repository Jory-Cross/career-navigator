import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validates that each entry type only has its intended row-level fields active.
 * Identifies and optionally deactivates legacy or duplicate fields.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Define intended fields per entry type
    const intendedFields = {
      job_coaching: [
        'service_code_primary',
        'service_code_secondary',
        'coaching_focus',
        'coaching_hours',
        'employer_name',
        'next_steps',
        'activity_outcome'
      ],
      job_development: [
        'activity',
        'activity_outcome',
        'next_steps'
      ],
      usor96: [
        'activity',
        'activity_outcome',
        'next_steps'
      ]
    };

    // Fetch all entry types
    const entryTypes = await base44.entities.EntryType.list();
    const results = {};

    // Check each entry type
    for (const entryType of entryTypes) {
      if (!entryType.code) continue;

      // Get all active row-level fields for this entry type
      const activeFields = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: entryType.code,
        is_active: true,
        pdf_context: 'row'
      });

      const fieldKeys = activeFields.map(f => f.field_key);
      const intended = intendedFields[entryType.code] || [];
      
      // Find unwanted fields
      const unwanted = fieldKeys.filter(key => !intended.includes(key));
      
      // Find missing fields
      const missing = intended.filter(key => !fieldKeys.includes(key));

      results[entryType.code] = {
        entryTypeId: entryType.id,
        programType: entryType.program_type,
        activeFieldCount: fieldKeys.length,
        activeFields: fieldKeys,
        intendedFields: intended,
        unwantedFields: unwanted,
        missingFields: missing,
        isValid: unwanted.length === 0 && missing.length === 0
      };

      // Auto-deactivate unwanted fields
      if (unwanted.length > 0) {
        const fieldsToDeactivate = activeFields.filter(f => unwanted.includes(f.field_key));
        
        for (const field of fieldsToDeactivate) {
          await base44.entities.ReportFieldTemplate.update(field.id, {
            is_active: false
          });
        }

        results[entryType.code].deactivatedCount = unwanted.length;
        results[entryType.code].deactivatedFields = unwanted;
      }
    }

    // Summary
    const validEntryTypes = Object.values(results).filter(r => r.isValid).length;
    const invalidEntryTypes = Object.values(results).filter(r => !r.isValid).length;

    return Response.json({
      status: 'validation_complete',
      summary: {
        totalEntryTypes: entryTypes.length,
        validEntryTypes,
        invalidEntryTypes,
        timestamp: new Date().toISOString()
      },
      results,
      message: `Validation complete. Found ${invalidEntryTypes} entry type(s) with issues. Auto-deactivated unwanted fields.`
    });
  } catch (error) {
    console.error('[validateEntryTypeFields] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});