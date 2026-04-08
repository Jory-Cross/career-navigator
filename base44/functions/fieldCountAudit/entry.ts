import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Audit exact field count by entry_type_code to clarify math discrepancies.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get ALL active ReportFieldTemplate records
    const allActiveFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    console.log(`[AUDIT] Total active fields found: ${allActiveFields.length}`);

    // Group by entry_type_code
    const byEntryType = {};
    const byEntryTypeId = {};
    const sharedFields = {};

    allActiveFields.forEach(field => {
      const code = field.entry_type_code || 'unknown';
      const id = field.entry_type_id || 'unknown_id';
      
      if (!byEntryType[code]) {
        byEntryType[code] = [];
      }
      if (!byEntryTypeId[id]) {
        byEntryTypeId[id] = [];
      }
      
      byEntryType[code].push({
        field_key: field.field_key,
        label: field.label,
        is_internal_only: field.is_internal_only,
        is_reportable: field.is_reportable
      });
      
      byEntryTypeId[id].push({
        field_key: field.field_key,
        label: field.label,
        is_internal_only: field.is_internal_only,
        is_reportable: field.is_reportable
      });
    });

    // Check for duplicates (same field_key across different entry types)
    const fieldKeyToTypes = {};
    allActiveFields.forEach(field => {
      const key = field.field_key;
      if (!fieldKeyToTypes[key]) {
        fieldKeyToTypes[key] = [];
      }
      fieldKeyToTypes[key].push(field.entry_type_code);
    });

    const sharedFieldKeys = Object.entries(fieldKeyToTypes)
      .filter(([key, types]) => new Set(types).size > 1)
      .map(([key, types]) => ({
        field_key: key,
        appears_in_entry_types: [...new Set(types)]
      }));

    const result = {
      total_active_fields: allActiveFields.length,
      breakdown_by_entry_type_code: {},
      breakdown_by_entry_type_id: {},
      shared_fields_across_types: sharedFieldKeys,
      field_reusability_analysis: null
    };

    // Detailed breakdown by code
    Object.entries(byEntryType).sort().forEach(([code, fields]) => {
      result.breakdown_by_entry_type_code[code] = {
        count: fields.length,
        reportable_count: fields.filter(f => f.is_reportable).length,
        internal_only_count: fields.filter(f => f.is_internal_only).length,
        fields: fields.map(f => f.field_key)
      };
    });

    // Detailed breakdown by ID
    Object.entries(byEntryTypeId).sort().forEach(([id, fields]) => {
      result.breakdown_by_entry_type_id[id] = {
        count: fields.length,
        reportable_count: fields.filter(f => f.is_reportable).length,
        internal_only_count: fields.filter(f => f.is_internal_only).length,
        fields: fields.map(f => f.field_key)
      };
    });

    // Analysis: are life_skills and csb_hours distinct or shared?
    const lifeSkillsTemplates = allActiveFields.filter(f => f.entry_type_code === 'life_skills');
    const csbHoursTemplates = allActiveFields.filter(f => f.entry_type_code === 'csb_hours');

    if (lifeSkillsTemplates.length > 0 && csbHoursTemplates.length > 0) {
      const lifeSkillsKeys = new Set(lifeSkillsTemplates.map(f => f.field_key));
      const csbHoursKeys = new Set(csbHoursTemplates.map(f => f.field_key));
      
      const shared = [...lifeSkillsKeys].filter(k => csbHoursKeys.has(k));
      const onlyInLifeSkills = [...lifeSkillsKeys].filter(k => !csbHoursKeys.has(k));
      const onlyInCsbHours = [...csbHoursKeys].filter(k => !lifeSkillsKeys.has(k));

      result.field_reusability_analysis = {
        life_skills_count: lifeSkillsTemplates.length,
        csb_hours_count: csbHoursTemplates.length,
        shared_field_keys: shared,
        shared_count: shared.length,
        only_in_life_skills: onlyInLifeSkills,
        only_in_csb_hours: onlyInCsbHours,
        are_templates_distinct: shared.length < Math.max(lifeSkillsTemplates.length, csbHoursTemplates.length),
        relationship: shared.length === lifeSkillsTemplates.length && shared.length === csbHoursTemplates.length
          ? 'IDENTICAL - Same template'
          : 'DISTINCT - Different field sets'
      };
    }

    // Summary math check
    result.math_check = {
      job_coaching_count: result.breakdown_by_entry_type_code['job_coaching']?.count || 0,
      job_development_count: result.breakdown_by_entry_type_code['job_development']?.count || 0,
      life_skills_count: result.breakdown_by_entry_type_code['life_skills']?.count || 0,
      csb_hours_count: result.breakdown_by_entry_type_code['csb_hours']?.count || 0,
      total_by_sum: (result.breakdown_by_entry_type_code['job_coaching']?.count || 0) +
                    (result.breakdown_by_entry_type_code['job_development']?.count || 0) +
                    (result.breakdown_by_entry_type_code['life_skills']?.count || 0) +
                    (result.breakdown_by_entry_type_code['csb_hours']?.count || 0)
    };

    // If life_skills and csb_hours are IDENTICAL, deduplicated count
    if (result.field_reusability_analysis?.relationship === 'IDENTICAL - Same template') {
      result.math_check.deduplicated_total = 
        result.math_check.job_coaching_count +
        result.math_check.job_development_count +
        result.math_check.life_skills_count; // Count life_skills once, not csb_hours
      result.math_check.note = 'life_skills and csb_hours are identical templates, deduplicated count is lower';
    }

    return Response.json(result);

  } catch (error) {
    console.error('[AUDIT ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});