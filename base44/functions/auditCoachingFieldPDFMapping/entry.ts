import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Audit USOR95 coaching_activities and client_performance_notes PDF mappings.
 * Verify exact row field mappings or reclassify as internal_only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      audit: {},
      findings: {},
      actions_taken: []
    };

    // ── Step 1: Get USOR95 PDF Template ──────────────────────────────────────
    console.log('[AUDIT] Fetching USOR95 PDF template...');
    const templates = await base44.entities.PDFTemplate.filter({
      entry_type_code: 'job_coaching',
      report_mode: 'usor95_monthly'
    });
    const pdfTemplate = templates[0];

    if (!pdfTemplate) {
      return Response.json({
        error: 'USOR95 PDF template not found',
        note: 'Cannot audit mappings without template'
      }, { status: 404 });
    }

    result.audit.pdf_template = {
      id: pdfTemplate.id,
      name: pdfTemplate.name,
      field_names: pdfTemplate.field_names || [],
      max_rows: pdfTemplate.max_rows,
      row_field_prefix: pdfTemplate.row_field_prefix
    };

    console.log(`[AUDIT] USOR95 template has ${pdfTemplate.field_names?.length || 0} fields`);

    // ── Step 2: Get coaching_activities and client_performance_notes fields ──
    console.log('[AUDIT] Fetching coaching field definitions...');
    const coachingActivityField = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching',
      field_key: 'coaching_activities',
      is_active: true
    });
    const perfNotesField = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: 'job_coaching',
      field_key: 'client_performance_notes',
      is_active: true
    });

    result.audit.field_definitions = {
      coaching_activities: coachingActivityField[0] || null,
      client_performance_notes: perfNotesField[0] || null
    };

    // ── Step 3: Check PDFFieldMap for these fields ──────────────────────────
    console.log('[AUDIT] Checking PDFFieldMap entries...');
    const mappings = await base44.entities.PDFFieldMap.filter({
      pdf_template_id: pdfTemplate.id
    });

    const coachingActivityMappings = mappings.filter(m => 
      m.source_field?.includes('coaching_activities') || 
      m.source_field === 'answers.coaching_activities'
    );
    const perfNotesMappings = mappings.filter(m =>
      m.source_field?.includes('client_performance_notes') ||
      m.source_field === 'answers.client_performance_notes'
    );

    result.audit.pdf_field_mappings = {
      coaching_activities: {
        found: coachingActivityMappings.length > 0,
        mappings: coachingActivityMappings.map(m => ({
          pdf_field_name: m.pdf_field_name,
          mapping_scope: m.mapping_scope,
          source_type: m.source_type,
          source_field: m.source_field,
          row_group: m.row_group,
          row_field_key: m.row_field_key
        }))
      },
      client_performance_notes: {
        found: perfNotesMappings.length > 0,
        mappings: perfNotesMappings.map(m => ({
          pdf_field_name: m.pdf_field_name,
          mapping_scope: m.mapping_scope,
          source_type: m.source_type,
          source_field: m.source_field,
          row_group: m.row_group,
          row_field_key: m.row_field_key
        }))
      }
    };

    // ── Step 4: Determine mapping quality ──────────────────────────────────
    console.log('[AUDIT] Evaluating mapping quality...');

    const coachingActivitysMapped = coachingActivityMappings.length > 0 &&
      coachingActivityMappings.some(m => m.mapping_scope === 'row');
    
    const perfNotesMapped = perfNotesMappings.length > 0 &&
      perfNotesMappings.some(m => m.mapping_scope === 'row');

    result.findings = {
      coaching_activities: {
        is_mapped_to_pdf: coachingActivitysMapped,
        mapping_quality: coachingActivitysMapped ? 'clean_row_mapping' : 'no_direct_mapping',
        recommendation: coachingActivitysMapped 
          ? 'KEEP as reportable row field'
          : 'RECLASSIFY as internal_only',
        reason: coachingActivitysMapped
          ? 'Has direct row-level PDF field mapping'
          : 'No PDF row field mapping found - best as internal notes'
      },
      client_performance_notes: {
        is_mapped_to_pdf: perfNotesMapped,
        mapping_quality: perfNotesMapped ? 'clean_row_mapping' : 'no_direct_mapping',
        recommendation: perfNotesMapped
          ? 'KEEP as reportable row field'
          : 'RECLASSIFY as internal_only',
        reason: perfNotesMapped
          ? 'Has direct row-level PDF field mapping'
          : 'No PDF row field mapping found - best as internal notes'
      }
    };

    // ── Step 5: Apply reclassifications if needed ──────────────────────────
    console.log('[AUDIT] Applying reclassifications...');

    if (!coachingActivitysMapped && coachingActivityField[0]) {
      console.log('[AUDIT] Reclassifying coaching_activities to internal_only');
      await base44.entities.ReportFieldTemplate.update(coachingActivityField[0].id, {
        is_internal_only: true,
        is_reportable: false
      });
      result.actions_taken.push({
        field_key: 'coaching_activities',
        action: 'Reclassified to internal_only',
        reason: 'No direct PDF row field mapping'
      });
    }

    if (!perfNotesMapped && perfNotesField[0]) {
      console.log('[AUDIT] Reclassifying client_performance_notes to internal_only');
      await base44.entities.ReportFieldTemplate.update(perfNotesField[0].id, {
        is_internal_only: true,
        is_reportable: false
      });
      result.actions_taken.push({
        field_key: 'client_performance_notes',
        action: 'Reclassified to internal_only',
        reason: 'No direct PDF row field mapping'
      });
    }

    result.summary = {
      coaching_activities_status: coachingActivitysMapped ? 'CONFIRMED as reportable row field' : 'RECLASSIFIED to internal_only',
      client_performance_notes_status: perfNotesMapped ? 'CONFIRMED as reportable row field' : 'RECLASSIFIED to internal_only',
      total_actions: result.actions_taken.length
    };

    return Response.json(result);

  } catch (error) {
    console.error('[AUDIT ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});