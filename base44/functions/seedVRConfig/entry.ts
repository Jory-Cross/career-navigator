import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * seedVRConfig
 *
 * Migrates VR configuration from vrFormConfig.js to database entities.
 * Creates EntryType and ReportFieldTemplate records from seed data.
 *
 * Actions:
 *   - preview: Show what would be created (no changes)
 *   - execute: Create all missing EntryType and ReportFieldTemplate records
 *   - reset: Delete all auto-migrated records (ADMIN ONLY)
 *
 * Safety:
 *   - Never overwrites existing records
 *   - Tracks origin via _migrated_from field
 *   - Provides detailed reports on successes and skips
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can run migrations
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Load VR config from file dynamically
    const VR_ENTRY_TYPES = await loadVREntryTypes();

    if (action === 'preview') {
      return await previewMigration(base44, VR_ENTRY_TYPES);
    }

    if (action === 'execute') {
      return await executeMigration(base44, user, VR_ENTRY_TYPES);
    }

    if (action === 'reset') {
      return await resetMigration(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('seedVRConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Config Loader ───────────────────────────────────────────────────────────

async function loadVREntryTypes() {
  // Inline VR_ENTRY_TYPES from vrFormConfig
  // This is the seed data source
  return {
    job_development: {
      name: "Job Development",
      code: "job_development",
      description: "Employer contacts, job leads, placement activities (USOR96)",
      color: "#3B82F6",
      fields: [
        { key: "jd_date", label: "Service Date", type: "date", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "jd_hours", label: "Hours", type: "number", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "jd_activity", label: "JD Activity", type: "textarea", required: true, section: "Activity", pdf_context: "repeating_row" },
        { key: "jd_outcome", label: "Outcome", type: "select", options: ["Job Offer Extended", "Interview Scheduled", "Possible Interest", "Not Interested", "Other"], required: true, section: "Outcome", pdf_context: "repeating_row" },
        { key: "jd_next_steps", label: "Next Steps", type: "textarea", required: false, section: "Outcome", pdf_context: "repeating_row" },
        { key: "jd_barrier_to_cie", label: "Barrier to CIE", type: "boolean", required: false, section: "Notes", pdf_context: "summary_field" },
        { key: "jd_barrier_description", label: "Barrier Description", type: "textarea", required: false, section: "Notes", pdf_context: "summary_field" },
        { key: "jd_internal_notes", label: "Internal Notes (not on report)", type: "textarea", required: false, section: "Internal", pdf_context: "none" }
      ]
    },
    job_coaching: {
      name: "Job Coaching",
      code: "job_coaching",
      description: "On-site job coaching and support (USOR95)",
      color: "#8B5CF6",
      fields: [
        { key: "jc_date", label: "Service Date", type: "date", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "jc_job_coach_name", label: "Job Coach Name", type: "text", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "jc_hours", label: "Hours", type: "number", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "jc_employer_name", label: "Employer Name", type: "text", required: false, section: "Work Site", pdf_context: "repeating_row" },
        { key: "jc_primary_service_code", label: "Primary Service Code", type: "select", options: Array.from({length: 15}, (_, i) => `${i+1}`), required: true, section: "Service Codes", pdf_context: "repeating_row" },
        { key: "jc_secondary_service_code", label: "Secondary Service Code", type: "select", options: ["", ...Array.from({length: 15}, (_, i) => `${i+1}`)], required: false, section: "Service Codes", pdf_context: "repeating_row" },
        { key: "jc_total_client_hours_worked", label: "Total Client Hours Worked", type: "number", required: false, section: "Calculations", pdf_context: "header_field" },
        { key: "jc_internal_notes", label: "Internal Notes (not on report)", type: "textarea", required: false, section: "Internal", pdf_context: "none" }
      ]
    },
    life_skills: {
      name: "Life Skills",
      code: "life_skills",
      description: "Life skills training and development (USOR148)",
      color: "#EC4899",
      fields: [
        { key: "billable_date", label: "Service Date", type: "date", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "billable_hours", label: "Hours", type: "number", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "billable_activity", label: "Activity", type: "textarea", required: true, section: "Service", pdf_context: "repeating_row" },
        { key: "billable_observations", label: "CRP Observations", type: "textarea", required: false, section: "Service", pdf_context: "repeating_row" },
        { key: "billable_summary", label: "Summary", type: "textarea", required: false, section: "Summary", pdf_context: "summary_field" },
        { key: "billable_internal_notes", label: "Internal Notes", type: "textarea", required: false, section: "Internal", pdf_context: "none" }
      ]
    },
    csb_hours: {
      name: "CSB Hours",
      code: "csb_hours",
      description: "Community Services Board hours (USOR148)",
      color: "#F59E0B",
      fields: [
        { key: "csb_date", label: "Service Date", type: "date", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "csb_hours", label: "Hours", type: "number", required: true, section: "Core", pdf_context: "repeating_row" },
        { key: "csb_activity", label: "Activity", type: "textarea", required: true, section: "Service", pdf_context: "repeating_row" },
        { key: "csb_observations", label: "Observations", type: "textarea", required: false, section: "Service", pdf_context: "repeating_row" },
        { key: "csb_service_setting", label: "Service Setting", type: "select", options: ["Community-Based", "Home", "School", "Work Site", "Virtual"], required: false, section: "Internal", pdf_context: "none" },
        { key: "csb_group_or_individual", label: "Group or Individual", type: "select", options: ["Individual", "Group"], required: false, section: "Internal", pdf_context: "none" },
        { key: "csb_internal_notes", label: "Internal Notes", type: "textarea", required: false, section: "Internal", pdf_context: "none" }
      ]
    },
    pre_ets: {
      name: "Pre-ETS",
      code: "pre_ets",
      description: "Pre-Employment Transition Services",
      color: "#10B981",
      fields: [
        { key: "preets_date", label: "Service Date", type: "date", required: true, section: "Core" },
        { key: "preets_hours", label: "Hours", type: "number", required: true, section: "Core" },
        { key: "preets_service_category", label: "Service Category", type: "select", options: ["Job Exploration", "Workplace Readiness", "Work-Based Learning", "Counseling", "Work Incentive Planning"], required: true, section: "Service" },
        { key: "preets_activity", label: "Activity", type: "textarea", required: true, section: "Service" },
        { key: "preets_skills_addressed", label: "Skills Addressed", type: "textarea", required: false, section: "Service" },
        { key: "preets_student_participation", label: "Student Participation", type: "select", options: ["Full", "Partial", "Minimal", "Observation"], required: true, section: "Participation" },
        { key: "preets_progress", label: "Progress", type: "textarea", required: false, section: "Outcomes" }
      ]
    },
    wsa: {
      name: "WSA",
      code: "wsa",
      description: "Work Study Assessment",
      color: "#06B6D4",
      fields: [
        { key: "wsa_date", label: "Service Date", type: "date", required: true, section: "Core" },
        { key: "wsa_hours", label: "Hours", type: "number", required: true, section: "Core" },
        { key: "wsa_worksite", label: "Worksite", type: "text", required: true, section: "Work Site" },
        { key: "wsa_supervisor", label: "Supervisor Name", type: "text", required: false, section: "Work Site" },
        { key: "wsa_tasks_completed", label: "Tasks Completed", type: "textarea", required: true, section: "Activity" }
      ]
    },
    admin_time: {
      name: "Admin Time",
      code: "admin_time",
      description: "Administrative and documentation time",
      color: "#6B7280",
      fields: [
        { key: "admin_date", label: "Date", type: "date", required: true, section: "Core" },
        { key: "admin_hours", label: "Hours", type: "number", required: true, section: "Core" },
        { key: "admin_category", label: "Category", type: "select", options: ["Documentation", "Training", "Supervision", "Team Meeting", "Planning"], required: true, section: "Details" },
        { key: "admin_description", label: "Description", type: "textarea", required: true, section: "Details" }
      ]
    },
    misc: {
      name: "Misc",
      code: "misc",
      description: "Miscellaneous activities",
      color: "#9CA3AF",
      fields: [
        { key: "misc_date", label: "Date", type: "date", required: true, section: "Core" },
        { key: "misc_hours", label: "Hours", type: "number", required: true, section: "Core" },
        { key: "misc_activity_type", label: "Activity Type", type: "text", required: true, section: "Details" },
        { key: "misc_description", label: "Description", type: "textarea", required: true, section: "Details" }
      ]
    }
  };
}

// ─── Preview Migration ───────────────────────────────────────────────────────

async function previewMigration(base44, VR_ENTRY_TYPES) {
  const existingEntryTypes = await base44.entities.EntryType.list();
  const existingTemplates = await base44.entities.ReportFieldTemplate.list();

  const existingCodes = new Set(existingEntryTypes.map(e => e.code));
  const existingFieldKeys = new Set(existingTemplates.map(t => `${t.entry_type_code}:${t.field_key}`));

  const toCreate = {
    entryTypes: [],
    templates: []
  };

  // Preview EntryTypes
  Object.entries(VR_ENTRY_TYPES).forEach(([code, config]) => {
    if (!existingCodes.has(code)) {
      toCreate.entryTypes.push({
        code,
        name: config.name,
        description: config.description
      });
    }
  });

  // Preview ReportFieldTemplates
  Object.entries(VR_ENTRY_TYPES).forEach(([code, config]) => {
    config.fields.forEach((field, order) => {
      const key = `${code}:${field.key}`;
      if (!existingFieldKeys.has(key)) {
        toCreate.templates.push({
          entry_type_code: code,
          field_key: field.key,
          label: field.label,
          section: field.section || 'Other'
        });
      }
    });
  });

  return Response.json({
    success: true,
    action: 'preview',
    summary: {
      existing_entry_types: existingEntryTypes.length,
      existing_field_templates: existingTemplates.length,
      entry_types_to_create: toCreate.entryTypes.length,
      templates_to_create: toCreate.templates.length
    },
    to_create: toCreate,
    can_execute: true
  });
}

// ─── Execute Migration ───────────────────────────────────────────────────────

async function executeMigration(base44, user, VR_ENTRY_TYPES) {
  const orgId = user.org_id || 'default';
  const migrationTimestamp = new Date().toISOString();

  const existingEntryTypes = await base44.entities.EntryType.list();
  const existingTemplates = await base44.entities.ReportFieldTemplate.list();

  const existingCodes = new Set(existingEntryTypes.map(e => e.code));
  const existingFieldKeys = new Set(existingTemplates.map(t => `${t.entry_type_code}:${t.field_key}`));

  const results = {
    entryTypes: { created: [], skipped: [], errors: [] },
    templates: { created: [], skipped: [], errors: [] },
    timestamp: migrationTimestamp,
    migrated_by: user.email
  };

  // Create EntryTypes
  for (const [code, config] of Object.entries(VR_ENTRY_TYPES)) {
    if (existingCodes.has(code)) {
      results.entryTypes.skipped.push({
        code,
        reason: 'EntryType with this code already exists'
      });
      continue;
    }

    try {
      const created = await base44.asServiceRole.entities.EntryType.create({
        org_id: orgId,
        name: config.name,
        code: code,
        description: config.description,
        program_type: 'vr',
        is_active: true,
        color: config.color || '#6B7280',
        _migrated_from: 'vrFormConfig.VR_ENTRY_TYPES',
        _migrated_at: migrationTimestamp,
        _migrated_by: user.email
      });

      results.entryTypes.created.push({
        id: created.id,
        code: code,
        name: config.name
      });

      console.log(`[seedVRConfig] Created EntryType: ${code}`);
    } catch (e) {
      results.entryTypes.errors.push({
        code,
        error: e.message
      });
      console.error(`[seedVRConfig] Failed to create EntryType ${code}:`, e.message);
    }
  }

  // Create ReportFieldTemplates
  for (const [code, config] of Object.entries(VR_ENTRY_TYPES)) {
    const entryTypeId = results.entryTypes.created.find(et => et.code === code)?.id
      || existingEntryTypes.find(et => et.code === code)?.id;

    if (!entryTypeId) {
      console.warn(`[seedVRConfig] Skipping templates for ${code}: EntryType not found`);
      continue;
    }

    for (let order = 0; order < config.fields.length; order++) {
      const field = config.fields[order];
      const key = `${code}:${field.key}`;

      if (existingFieldKeys.has(key)) {
        results.templates.skipped.push({
          entry_type_code: code,
          field_key: field.key,
          reason: 'Field template already exists'
        });
        continue;
      }

      try {
        const created = await base44.asServiceRole.entities.ReportFieldTemplate.create({
          org_id: orgId,
          entry_type_id: entryTypeId,
          entry_type_code: code,
          field_key: field.key,
          label: field.label,
          field_type: field.type || 'text',
          section: field.section || 'Other',
          order: order + 1,
          is_required: field.required || false,
          options: field.options || [],
          placeholder: field.placeholder || null,
          help_text: field.help_text || null,
          is_reportable: field.pdf_context !== 'none',
          is_internal_only: field.pdf_context === 'none' || field.section === 'Internal',
          pdf_context: field.pdf_context || 'none',
          schema_version: 1,
          is_active: true,
          _migrated_from: 'vrFormConfig.VR_ENTRY_TYPES',
          _migrated_at: migrationTimestamp,
          _migrated_by: user.email
        });

        results.templates.created.push({
          id: created.id,
          entry_type_code: code,
          field_key: field.key,
          label: field.label
        });

        console.log(`[seedVRConfig] Created ReportFieldTemplate: ${code}.${field.key}`);
      } catch (e) {
        results.templates.errors.push({
          entry_type_code: code,
          field_key: field.key,
          error: e.message
        });
        console.error(`[seedVRConfig] Failed to create template ${code}.${field.key}:`, e.message);
      }
    }
  }

  return Response.json({
    success: true,
    action: 'execute',
    results,
    summary: {
      entry_types_created: results.entryTypes.created.length,
      entry_types_skipped: results.entryTypes.skipped.length,
      entry_types_errors: results.entryTypes.errors.length,
      templates_created: results.templates.created.length,
      templates_skipped: results.templates.skipped.length,
      templates_errors: results.templates.errors.length
    }
  });
}

// ─── Reset Migration (Admin Only) ────────────────────────────────────────────

async function resetMigration(base44, user) {
  // Safety check: require explicit confirmation
  const body = await new Request('').json().catch(() => ({}));
  if (body.confirmed_reset !== true) {
    return Response.json({
      error: 'Reset requires explicit confirmation. Pass { confirmed_reset: true }',
      warning: 'This will delete all auto-migrated EntryType and ReportFieldTemplate records'
    }, { status: 400 });
  }

  const entryTypes = await base44.asServiceRole.entities.EntryType.list();
  const templates = await base44.asServiceRole.entities.ReportFieldTemplate.list();

  const migratedEntryTypes = entryTypes.filter(et => et._migrated_from === 'vrFormConfig.VR_ENTRY_TYPES');
  const migratedTemplates = templates.filter(t => t._migrated_from === 'vrFormConfig.VR_ENTRY_TYPES');

  let deletedEntryTypes = 0;
  let deletedTemplates = 0;

  for (const et of migratedEntryTypes) {
    await base44.asServiceRole.entities.EntryType.delete(et.id).catch(e => console.error(`Failed to delete EntryType ${et.id}:`, e));
    deletedEntryTypes++;
  }

  for (const t of migratedTemplates) {
    await base44.asServiceRole.entities.ReportFieldTemplate.delete(t.id).catch(e => console.error(`Failed to delete template ${t.id}:`, e));
    deletedTemplates++;
  }

  return Response.json({
    success: true,
    action: 'reset',
    deleted: {
      entry_types: deletedEntryTypes,
      templates: deletedTemplates
    },
    warning: 'Reset complete. Auto-migrated records have been deleted.'
  });
}