import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Check USOR95 coaching field mappings and provide reclassification recommendation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      coaching_field_audit: {},
      pdf_templates_available: [],
      field_mapping_status: {},
      recommendation: null
    };

    // ── Check what PDF templates exist ──────────────────────────────────────
    console.log('[CHECK] Listing available PDF templates...');
    const allTemplates = await base44.entities.PDFTemplate.filter({});
    result.pdf_templates_available = allTemplates.map(t => ({
      id: t.id,
      name: t.name,
      entry_type_code: t.entry_type_code,
      report_mode: t.report_mode,
      field_names_count: t.field_names?.length || 0
    }));

    // ── Get job_coaching fields ────────────────────────────────────────────
    console.log('[CHECK] Fetching job_coaching field templates...');
    const jobCoachingFields = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching',
      is_active: true
    });

    // Find our target fields
    const coachingActivity = jobCoachingFields.find(f => f.field_key === 'coaching_activities');
    const perfNotes = jobCoachingFields.find(f => f.field_key === 'client_performance_notes');

    result.coaching_field_audit = {
      coaching_activities: coachingActivity ? {
        id: coachingActivity.id,
        label: coachingActivity.label,
        field_type: coachingActivity.field_type,
        pdf_context: coachingActivity.pdf_context,
        is_internal_only: coachingActivity.is_internal_only,
        is_reportable: coachingActivity.is_reportable,
        is_required: coachingActivity.is_required,
        pdf_field_name: coachingActivity.pdf_field_name,
        maps_to_form_code: coachingActivity.maps_to_form_code
      } : null,
      client_performance_notes: perfNotes ? {
        id: perfNotes.id,
        label: perfNotes.label,
        field_type: perfNotes.field_type,
        pdf_context: perfNotes.pdf_context,
        is_internal_only: perfNotes.is_internal_only,
        is_reportable: perfNotes.is_reportable,
        is_required: perfNotes.is_required,
        pdf_field_name: perfNotes.pdf_field_name,
        maps_to_form_code: perfNotes.maps_to_form_code
      } : null
    };

    // ── Check PDFFieldMap (if any exist) ───────────────────────────────────
    console.log('[CHECK] Checking PDFFieldMap for mappings...');
    const allMappings = await base44.entities.PDFFieldMap.filter({});
    
    const coachingActivityMaps = allMappings.filter(m =>
      m.source_field?.includes('coaching_activities') ||
      m.source_field === 'answers.coaching_activities'
    );
    
    const perfNotesMaps = allMappings.filter(m =>
      m.source_field?.includes('client_performance_notes') ||
      m.source_field === 'answers.client_performance_notes'
    );

    result.field_mapping_status = {
      coaching_activities: {
        has_pdf_mapping: coachingActivityMaps.length > 0,
        mapping_count: coachingActivityMaps.length,
        mappings: coachingActivityMaps.map(m => ({
          pdf_field_name: m.pdf_field_name,
          mapping_scope: m.mapping_scope,
          source_field: m.source_field
        }))
      },
      client_performance_notes: {
        has_pdf_mapping: perfNotesMaps.length > 0,
        mapping_count: perfNotesMaps.length,
        mappings: perfNotesMaps.map(m => ({
          pdf_field_name: m.pdf_field_name,
          mapping_scope: m.mapping_scope,
          source_field: m.source_field
        }))
      }
    };

    // ── DIAGNOSIS & RECOMMENDATION ────────────────────────────────────────
    const coachingActivityHasCleanMapping = coachingActivityMaps.some(m => m.mapping_scope === 'row');
    const perfNotesHasCleanMapping = perfNotesMaps.some(m => m.mapping_scope === 'row');

    result.diagnosis = {
      coaching_activities: {
        current_status: coachingActivity?.is_internal_only ? 'internal_only' : 'reportable_row_field',
        has_clean_pdf_mapping: coachingActivityHasCleanMapping,
        assessment: coachingActivityHasCleanMapping
          ? '✅ CONFIRMED: Maps to USOR95 PDF row section'
          : '⚠️ WARNING: No direct PDF row mapping found',
        action: coachingActivityHasCleanMapping
          ? 'KEEP as reportable row field'
          : 'RECOMMEND: Reclassify to internal_only'
      },
      client_performance_notes: {
        current_status: perfNotes?.is_internal_only ? 'internal_only' : 'reportable_row_field',
        has_clean_pdf_mapping: perfNotesHasCleanMapping,
        assessment: perfNotesHasCleanMapping
          ? '✅ CONFIRMED: Maps to USOR95 PDF row section'
          : '⚠️ WARNING: No direct PDF row mapping found',
        action: perfNotesHasCleanMapping
          ? 'KEEP as reportable row field'
          : 'RECOMMEND: Reclassify to internal_only'
      }
    };

    // ── Apply reclassifications ────────────────────────────────────────────
    const changes = [];

    if (!coachingActivityHasCleanMapping && coachingActivity && !coachingActivity.is_internal_only) {
      console.log('[CHECK] Reclassifying coaching_activities → internal_only');
      await base44.entities.ReportFieldTemplate.update(coachingActivity.id, {
        is_internal_only: true,
        is_reportable: false,
        pdf_context: 'none'
      });
      changes.push({
        field_key: 'coaching_activities',
        change: 'Reclassified to internal_only',
        reason: 'No clean PDF row field mapping found'
      });
    }

    if (!perfNotesHasCleanMapping && perfNotes && !perfNotes.is_internal_only) {
      console.log('[CHECK] Reclassifying client_performance_notes → internal_only');
      await base44.entities.ReportFieldTemplate.update(perfNotes.id, {
        is_internal_only: true,
        is_reportable: false,
        pdf_context: 'none'
      });
      changes.push({
        field_key: 'client_performance_notes',
        change: 'Reclassified to internal_only',
        reason: 'No clean PDF row field mapping found'
      });
    }

    result.changes_applied = changes;

    result.final_status = {
      coaching_activities: coachingActivityHasCleanMapping ? 'REPORTABLE ROW FIELD' : 'INTERNAL ONLY',
      client_performance_notes: perfNotesHasCleanMapping ? 'REPORTABLE ROW FIELD' : 'INTERNAL ONLY'
    };

    return Response.json(result);

  } catch (error) {
    console.error('[CHECK ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});