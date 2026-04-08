import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Audit ReportFieldTemplate for duplicates
 * Identifies:
 * - Duplicate field_keys within same entry_type_code
 * - Duplicate labels within same entry_type_code
 * - Missing required metadata
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[AUDIT] Starting duplicate field audit...');

    const entryTypeCodes = ['job_coaching', 'job_development', 'life_skills', 'csb_hours'];
    const auditResults = {};

    for (const code of entryTypeCodes) {
      console.log(`\n[AUDIT] Checking ${code}...`);
      
      const templates = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: code,
        is_active: true
      });

      const fieldKeyMap = {};
      const labelMap = {};
      const duplicateFieldKeys = [];
      const duplicateLabels = [];
      const missingMetadata = [];

      templates.forEach(t => {
        // Track field_key duplicates
        if (fieldKeyMap[t.field_key]) {
          duplicateFieldKeys.push({
            field_key: t.field_key,
            count: fieldKeyMap[t.field_key] + 1,
            ids: [fieldKeyMap[t.field_key], t.id]
          });
        } else {
          fieldKeyMap[t.field_key] = t.id;
        }

        // Track label duplicates
        if (labelMap[t.label]) {
          duplicateLabels.push({
            label: t.label,
            field_keys: [labelMap[t.label], t.field_key],
            ids: [fieldKeyMap[t.label], t.id]
          });
        } else {
          labelMap[t.label] = t.field_key;
        }

        // Check missing metadata
        const missing = [];
        if (!t.field_type) missing.push('field_type');
        if (!t.label) missing.push('label');
        if (!t.pdf_context) missing.push('pdf_context');
        if (missing.length > 0) {
          missingMetadata.push({
            field_key: t.field_key,
            label: t.label,
            missing
          });
        }
      });

      auditResults[code] = {
        total_templates: templates.length,
        duplicate_field_keys: Object.values(fieldKeyMap).filter((v, i, arr) => arr.indexOf(v) !== i).length,
        duplicate_labels: Object.values(labelMap).filter((v, i, arr) => arr.indexOf(v) !== i).length,
        missing_metadata: missingMetadata.length,
        details: {
          field_keys: templates.map(t => t.field_key),
          labels: templates.map(t => t.label),
          duplicates_by_field_key: Object.entries(fieldKeyMap)
            .filter(([_, id]) => templates.filter(t => t.field_key === _).length > 1)
            .map(([key, id]) => ({
              field_key: key,
              instances: templates.filter(t => t.field_key === key).length,
              ids: templates.filter(t => t.field_key === key).map(t => t.id)
            }))
        }
      };

      console.log(`[AUDIT] ${code}: ${templates.length} templates, ${auditResults[code].details.duplicates_by_field_key.length} duplicate field_keys`);
    }

    console.log('[AUDIT] Audit complete');

    return Response.json({
      success: true,
      audit_results: auditResults,
      summary: {
        total_entry_types: entryTypeCodes.length,
        entry_types_with_duplicates: Object.entries(auditResults)
          .filter(([_, result]) => result.details.duplicates_by_field_key.length > 0)
          .map(([code, _]) => code)
      }
    });

  } catch (error) {
    console.error('[AUDIT ERROR]', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});