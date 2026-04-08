import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Rebuild ReportFieldTemplate records from actual USOR form structure.
 * This replaces duplicates with properly mapped, non-duplicated questions.
 * 
 * Mapping:
 * - job_coaching -> USOR95
 * - job_development -> USOR96
 * - life_skills / csb_hours -> USOR148
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[REBUILD] Starting VR form template rebuild...');

    // Define USOR95 Job Coaching form structure
    const usor95_templates = [
      // HEADER-LEVEL: Collected from client profile, auth, staff profile
      // These are NOT asked on time entry form - populated at report generation
      {
        entry_type_code: 'job_coaching',
        field_key: 'client_name',
        label: 'Client Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Client Name',
        source_form_section: 'Header',
        order: 1,
        help_text: 'Auto-populated from client profile'
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'authorization_number',
        label: 'Authorization Number',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Authorization #',
        source_form_section: 'Header',
        order: 2,
        help_text: 'From service authorization'
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'vr_counselor_name',
        label: 'VR Counselor Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Counselor Name',
        source_form_section: 'Header',
        order: 3
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'employer_name',
        label: 'Employer Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Employer',
        source_form_section: 'Header',
        order: 4,
        help_text: 'Name of employer/worksite'
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'job_title',
        label: 'Job Title',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Job Title',
        source_form_section: 'Header',
        order: 5
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'month_year',
        label: 'Reporting Month/Year',
        field_type: 'date',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Month/Year',
        source_form_section: 'Header',
        order: 6
      },
      // ROW-LEVEL: Asked on time entry form
      {
        entry_type_code: 'job_coaching',
        field_key: 'coaching_date',
        label: 'Coaching Date',
        field_type: 'date',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Date',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        order: 10
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'coaching_hours',
        label: 'Hours of Coaching',
        field_type: 'number',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Hours',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        order: 11
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'job_coach_name',
        label: 'Job Coach Name',
        field_type: 'text',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR95',
        source_form_field_name: 'Coach Name',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        order: 12
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'primary_service_code',
        label: 'Primary Service Code',
        field_type: 'select',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Primary Service',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        options: ['JC01', 'JC02', 'JC03', 'JC04', 'JC05'],
        order: 13
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'secondary_service_code',
        label: 'Secondary Service Code',
        field_type: 'select',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR95',
        source_form_field_name: 'Secondary Service',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        options: ['', 'JC01', 'JC02', 'JC03', 'JC04', 'JC05'],
        order: 14
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'coaching_activities',
        label: 'Coaching Activities & Observations',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR95',
        source_form_field_name: 'Activities',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        order: 15,
        help_text: 'What tasks were performed? What progress was made?'
      },
      {
        entry_type_code: 'job_coaching',
        field_key: 'client_performance_notes',
        label: 'Client Performance & Notes',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR95',
        source_form_field_name: 'Performance Notes',
        source_form_section: 'Details',
        row_group: 'coaching_session',
        order: 16
      }
    ];

    // Define USOR96 Job Development form structure
    const usor96_templates = [
      // HEADER-LEVEL
      {
        entry_type_code: 'job_development',
        field_key: 'client_name',
        label: 'Client Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Client Name',
        source_form_section: 'Header',
        order: 1
      },
      {
        entry_type_code: 'job_development',
        field_key: 'authorization_number',
        label: 'Authorization Number',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Authorization #',
        source_form_section: 'Header',
        order: 2
      },
      {
        entry_type_code: 'job_development',
        field_key: 'vr_counselor_name',
        label: 'VR Counselor Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Counselor Name',
        source_form_section: 'Header',
        order: 3
      },
      {
        entry_type_code: 'job_development',
        field_key: 'job_goal',
        label: 'Job Goal',
        field_type: 'textarea',
        pdf_context: 'header',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Job Goal',
        source_form_section: 'Header',
        order: 4
      },
      {
        entry_type_code: 'job_development',
        field_key: 'crp_company_name',
        label: 'CRP Company Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR96',
        source_form_field_name: 'CRP Company',
        source_form_section: 'Header',
        order: 5
      },
      {
        entry_type_code: 'job_development',
        field_key: 'crp_contact_phone',
        label: 'CRP Contact Phone',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR96',
        source_form_field_name: 'CRP Phone',
        source_form_section: 'Header',
        order: 6
      },
      {
        entry_type_code: 'job_development',
        field_key: 'month_year',
        label: 'Reporting Month/Year',
        field_type: 'date',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Month/Year',
        source_form_section: 'Header',
        order: 7
      },
      // ROW-LEVEL
      {
        entry_type_code: 'job_development',
        field_key: 'development_date',
        label: 'Development Activity Date',
        field_type: 'date',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Date',
        source_form_section: 'Activities',
        row_group: 'development_activity',
        order: 10
      },
      {
        entry_type_code: 'job_development',
        field_key: 'development_hours',
        label: 'Hours Spent',
        field_type: 'number',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Hours',
        source_form_section: 'Activities',
        row_group: 'development_activity',
        order: 11
      },
      {
        entry_type_code: 'job_development',
        field_key: 'development_activity',
        label: 'Activity Description',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Activity',
        source_form_section: 'Activities',
        row_group: 'development_activity',
        order: 12,
        help_text: 'e.g., Job search, employer contact, interview prep'
      },
      {
        entry_type_code: 'job_development',
        field_key: 'activity_outcome',
        label: 'Outcome/Result',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR96',
        source_form_field_name: 'Outcome',
        source_form_section: 'Activities',
        row_group: 'development_activity',
        order: 13
      },
      {
        entry_type_code: 'job_development',
        field_key: 'next_steps',
        label: 'Next Steps',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR96',
        source_form_field_name: 'Next Steps',
        source_form_section: 'Activities',
        row_group: 'development_activity',
        order: 14
      },
      // SUMMARY-LEVEL (collected at report generation, not on time entry)
      {
        entry_type_code: 'job_development',
        field_key: 'summary_information',
        label: 'Summary of Other Pertinent Information',
        field_type: 'textarea',
        pdf_context: 'summary',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Summary Information',
        source_form_section: 'Summary',
        order: 20
      },
      {
        entry_type_code: 'job_development',
        field_key: 'barriers_to_cie',
        label: 'Barriers to Competitive Integrated Employment',
        field_type: 'textarea',
        pdf_context: 'summary',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR96',
        source_form_field_name: 'Barriers',
        source_form_section: 'Summary',
        order: 21
      }
    ];

    // Define USOR148 Life Skills / CSB form structure
    const usor148_templates = [
      // HEADER-LEVEL
      {
        entry_type_code: 'life_skills',
        field_key: 'client_name',
        label: 'Client Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Client Name',
        source_form_section: 'Header',
        order: 1
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'authorization_number',
        label: 'Authorization Number',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Authorization #',
        source_form_section: 'Header',
        order: 2
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'vr_counselor_name',
        label: 'VR Counselor Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Counselor Name',
        source_form_section: 'Header',
        order: 3
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'job_goal',
        label: 'Job Goal',
        field_type: 'textarea',
        pdf_context: 'header',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Job Goal',
        source_form_section: 'Header',
        order: 4
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'crp_company_name',
        label: 'CRP Company Name',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR148',
        source_form_field_name: 'CRP Company',
        source_form_section: 'Header',
        order: 5
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'crp_contact_phone',
        label: 'CRP Contact Phone',
        field_type: 'text',
        pdf_context: 'header',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR148',
        source_form_field_name: 'CRP Phone',
        source_form_section: 'Header',
        order: 6
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'month_year',
        label: 'Reporting Month/Year',
        field_type: 'date',
        pdf_context: 'header',
        is_reportable: true,
        is_internal_only: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Month/Year',
        source_form_section: 'Header',
        order: 7
      },
      // ROW-LEVEL (billable hours)
      {
        entry_type_code: 'life_skills',
        field_key: 'billable_date',
        label: 'Billable Service Date',
        field_type: 'date',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Date',
        source_form_section: 'Billable Hours',
        row_group: 'billable_service',
        order: 10
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'billable_hours',
        label: 'Billable Hours',
        field_type: 'number',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Hours',
        source_form_section: 'Billable Hours',
        row_group: 'billable_service',
        order: 11
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'billable_activity',
        label: 'Activity Description',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: true,
        source_form_code: 'USOR148',
        source_form_field_name: 'Activity',
        source_form_section: 'Billable Hours',
        row_group: 'billable_service',
        order: 12,
        help_text: 'e.g., Life skills training, transportation, childcare support'
      },
      {
        entry_type_code: 'life_skills',
        field_key: 'billable_observations',
        label: 'Observations & Comments',
        field_type: 'textarea',
        pdf_context: 'row',
        is_reportable: true,
        is_required: false,
        source_form_code: 'USOR148',
        source_form_field_name: 'Observations',
        source_form_section: 'Billable Hours',
        row_group: 'billable_service',
        order: 13
      }
    ];

    // Combine all templates
    const allTemplates = [...usor95_templates, ...usor96_templates, ...usor148_templates];

    // Delete old duplicated templates for these entry types
    console.log('[REBUILD] Deleting old templates...');
    for (const code of ['job_coaching', 'job_development', 'life_skills', 'csb_hours']) {
      const old = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: code
      });
      for (const template of old) {
        await base44.entities.ReportFieldTemplate.delete(template.id);
      }
    }
    console.log('[REBUILD] Old templates deleted');

    // Get org_id and entry_type_id mapping from EntryType records
    const entryTypes = await base44.entities.EntryType.filter({
      is_active: true
    });
    const entryTypeMap = {};
    entryTypes.forEach(et => {
      entryTypeMap[et.code] = { id: et.id, org_id: et.org_id };
    });

    // Create new templates
    console.log('[REBUILD] Creating new templates...');
    let created = 0;
    for (const template of allTemplates) {
      const etInfo = entryTypeMap[template.entry_type_code];
      if (!etInfo) {
        console.warn(`[REBUILD] Entry type ${template.entry_type_code} not found, skipping`);
        continue;
      }
      const data = {
        ...template,
        entry_type_id: etInfo.id,
        org_id: etInfo.org_id,
        is_active: true,
        schema_version: 1
      };
      await base44.entities.ReportFieldTemplate.create(data);
      created++;
    }

    console.log(`[REBUILD] Created ${created} new templates`);

    // Verify no duplicates
    console.log('[REBUILD] Verifying...');
    const verification = {};
    for (const code of ['job_coaching', 'job_development', 'life_skills']) {
      const templates = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: code,
        is_active: true
      });
      const fieldKeys = templates.map(t => t.field_key);
      const duplicates = fieldKeys.filter((v, i, a) => a.indexOf(v) !== i);
      verification[code] = {
        total: templates.length,
        duplicates: duplicates.length,
        unique_fields: new Set(fieldKeys).size
      };
    }

    return Response.json({
      success: true,
      message: 'VR form templates rebuilt successfully',
      created_count: created,
      verification
    });

  } catch (error) {
    console.error('[REBUILD ERROR]', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});