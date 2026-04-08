import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validates that each entry type only has its intended row-level fields active.
 * AUDIT-ONLY MODE: Reports discrepancies without auto-deactivating.
 * Set AUTO_DEACTIVATE = true only after confirming field maps are correct.
 */

// *** SAFETY FLAG: Set to true only after confirming intended field maps ***
const AUTO_DEACTIVATE = false;

// Intended row-level field keys per entry type (extracted from live templates)
const INTENDED_FIELDS = {
  job_coaching: [
    'jc_date',
    'jc_hours',
    'jc_job_coach_name',
    'jc_primary_service_code',
    'jc_secondary_service_code'
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
  ],
  life_skills: [
    'skill_area',
    'skill_taught',
    'client_progress',
    'practice_completed',
    'barriers_encountered',
    'recommended_next_steps'
  ]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all entry types
    const entryTypes = await base44.entities.EntryType.list();
    const results = {};
    const allIssues = [];

    // Audit each entry type
    for (const entryType of entryTypes) {
      if (!entryType.code) continue;

      // Get all active row-level fields for this entry type
      const activeFields = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: entryType.code,
        is_active: true,
        pdf_context: 'row'
      });

      const fieldKeys = activeFields.map(f => f.field_key);
      const intended = INTENDED_FIELDS[entryType.code] || [];
      
      // Find unwanted (active but not in intended list)
      const unwanted = fieldKeys.filter(key => !intended.includes(key));
      
      // Find missing (should be active but aren't)
      const missing = intended.filter(key => !fieldKeys.includes(key));

      const isValid = unwanted.length === 0 && missing.length === 0;

      results[entryType.code] = {
        entryTypeId: entryType.id,
        programType: entryType.program_type,
        isValid,
        activeFieldCount: fieldKeys.length,
        activeFields: fieldKeys,
        intendedFields: intended,
        unwantedFields: unwanted,
        unwantedCount: unwanted.length,
        missingFields: missing,
        missingCount: missing.length
      };

      // Track issues for summary
      if (unwanted.length > 0) {
        allIssues.push({
          entryType: entryType.code,
          issue: 'unwanted_fields',
          fields: unwanted,
          message: `${unwanted.length} active field(s) not in intended list`
        });
      }

      if (missing.length > 0) {
        allIssues.push({
          entryType: entryType.code,
          issue: 'missing_fields',
          fields: missing,
          message: `${missing.length} intended field(s) not active`
        });
      }

      // Optional: Auto-deactivate if flag is enabled
      if (AUTO_DEACTIVATE && unwanted.length > 0) {
        const fieldsToDeactivate = activeFields.filter(f => unwanted.includes(f.field_key));
        
        for (const field of fieldsToDeactivate) {
          await base44.entities.ReportFieldTemplate.update(field.id, {
            is_active: false
          });
        }

        results[entryType.code].deactivatedCount = unwanted.length;
        results[entryType.code].deactivatedFields = unwanted;
        console.log(`[validateEntryTypeFields] Deactivated ${unwanted.length} field(s) for ${entryType.code}`);
      }
    }

    // Summary
    const validEntryTypes = Object.values(results).filter(r => r.isValid).length;
    const invalidEntryTypes = Object.values(results).filter(r => !r.isValid).length;

    return Response.json({
      status: 'audit_complete',
      mode: AUTO_DEACTIVATE ? 'AUTO_DEACTIVATE_ON' : 'AUDIT_ONLY',
      summary: {
        totalEntryTypes: entryTypes.length,
        validEntryTypes,
        invalidEntryTypes,
        issueCount: allIssues.length,
        timestamp: new Date().toISOString()
      },
      issues: allIssues,
      results,
      message: AUTO_DEACTIVATE
        ? `Audit complete. Auto-deactivated unwanted fields for ${invalidEntryTypes} entry type(s).`
        : `AUDIT-ONLY: Found ${allIssues.length} issue(s) across ${invalidEntryTypes} entry type(s). No changes made. Set AUTO_DEACTIVATE=true to enable cleanup.`
    });
  } catch (error) {
    console.error('[validateEntryTypeFields] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});