import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Audit function to trace barriers AI clarification data through the entire VFP extraction pipeline.
 * 
 * Inspects:
 * 1. Raw IntakeSection data saved by BarriersAIClarify
 * 2. Exact AI clarify fields and values
 * 3. extractVFPFromIntake input and output
 * 4. Final support_needs in vocational_facts_profile
 * 5. VFP panel display filtering
 * 
 * Returns detailed trace for debugging.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    const logs = [];
    const pipeline = {};

    // ── STEP 1: Fetch the client and their barriers_support intake section ──
    logs.push('[STEP 1] Fetching client and barriers_support intake section...');
    
    const clients = await base44.entities.Client.list();
    const client = clients.find(c => c.id === client_id);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    logs.push(`[STEP 1] Client found: ${client.first_name} ${client.last_name} (${client.email})`);

    const intakeSections = await base44.entities.IntakeSection.filter({ client_id });
    const barriersSection = intakeSections.find(s => s.section_key === 'barriers_support');

    if (!barriersSection) {
      logs.push('[STEP 1] No barriers_support section found');
      return Response.json({
        client_id,
        client_name: `${client.first_name} ${client.last_name}`,
        error: 'No barriers_support intake section found',
        logs
      });
    }

    logs.push(`[STEP 1] barriers_support section found: status=${barriersSection.status}`);
    logs.push(`[STEP 1] barriers_support.answers keys: ${Object.keys(barriersSection.answers || {}).join(', ')}`);

    // ── STEP 2: Inspect raw AI clarify fields ──
    logs.push('[STEP 2] Inspecting saved AI clarify fields in barriers_support.answers...');

    const answers = barriersSection.answers || {};
    const aiFields = {
      ai_clarified_barriers: answers.ai_clarified_barriers,
      ai_vocational_impact: answers.ai_vocational_impact,
      ai_support_recommendations: answers.ai_support_recommendations,
      ai_vfp_keywords: answers.ai_vfp_keywords
    };

    pipeline.ai_clarify_fields_saved = aiFields;

    Object.entries(aiFields).forEach(([key, value]) => {
      if (value) {
        logs.push(`[STEP 2] ${key}: ${typeof value === 'string' ? value.substring(0, 80) : value}${typeof value === 'string' && value.length > 80 ? '...' : ''}`);
      } else {
        logs.push(`[STEP 2] ${key}: NOT SAVED`);
      }
    });

    // ── STEP 3: Check if support recommendations exist and parse them ──
    logs.push('[STEP 3] Parsing support recommendations...');

    const supportRecs = answers.ai_support_recommendations || '';
    if (supportRecs.length > 0) {
      logs.push(`[STEP 3] ai_support_recommendations length: ${supportRecs.length} chars`);
      logs.push(`[STEP 3] Raw text:\n${supportRecs}`);
      
      // Parse as the extraction function would
      const lines = supportRecs.split(/[\n-•*]+/).filter(line => line.trim().length > 2);
      logs.push(`[STEP 3] Parsed into ${lines.length} recommendation lines:`);
      lines.forEach((line, i) => {
        logs.push(`[STEP 3]   [${i}] "${line.trim()}"`);
      });

      pipeline.parsed_support_recommendations = lines.map(l => l.trim());
      
      // Test corrected parsing approach (extract content AFTER the bullet)
      const correctedLines = supportRecs.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 2);
      logs.push(`[STEP 3] Corrected parse (extract after bullet) = ${correctedLines.length} lines:`);
      correctedLines.forEach((line, i) => {
        logs.push(`[STEP 3]   [${i}] "${line}"`);
      });
    } else {
      logs.push('[STEP 3] ai_support_recommendations is empty or missing');
      pipeline.parsed_support_recommendations = [];
    }

    // ── STEP 4: Run extractVFPFromIntake and capture output ──
    logs.push('[STEP 4] Running extractVFPFromIntake...');

    let extractionResult = null;
    try {
      const res = await base44.functions.invoke('extractVFPFromIntake', { client_id });
      extractionResult = res?.data || null;
      logs.push('[STEP 4] extractVFPFromIntake succeeded');
    } catch (e) {
      logs.push(`[STEP 4] extractVFPFromIntake failed: ${e.message}`);
      return Response.json({
        client_id,
        error: `Extraction failed: ${e.message}`,
        logs
      });
    }

    if (!extractionResult) {
      logs.push('[STEP 4] No data returned from extractVFPFromIntake');
      return Response.json({
        client_id,
        error: 'Extraction returned no data',
        logs
      });
    }

    // ── STEP 5: Inspect extracted support_needs ──
    logs.push('[STEP 5] Inspecting extracted support_needs from extractVFPFromIntake...');

    const extractedSignals = extractionResult.extracted_signals || {};
    const extractedSupportNeeds = extractedSignals.support_needs || [];

    logs.push(`[STEP 5] Extracted support_needs count: ${extractedSupportNeeds.length}`);
    extractedSupportNeeds.forEach((need, i) => {
      logs.push(`[STEP 5]   [${i}] "${need}"`);
    });

    pipeline.extracted_support_needs = extractedSupportNeeds;
    pipeline.extraction_source_metadata = extractionResult.source_metadata?.support_needs;

    // ── STEP 6: Check client's current vocational_facts_profile ──
    logs.push('[STEP 6] Inspecting client vocational_facts_profile from database...');

    const currentVFP = client.vocational_facts_profile || {};
    const savedSupportNeeds = currentVFP.support_needs || [];

    logs.push(`[STEP 6] Current support_needs in VFP count: ${savedSupportNeeds.length}`);
    savedSupportNeeds.forEach((need, i) => {
      logs.push(`[STEP 6]   [${i}] "${need}"`);
    });

    pipeline.current_vfp_support_needs = savedSupportNeeds;
    pipeline.vfp_extraction_metadata = currentVFP.vocational_facts_extracted_at;
    pipeline.vfp_extracted_by = currentVFP.vocational_facts_extracted_by;

    // ── STEP 7: Compare extracted vs saved ──
    logs.push('[STEP 7] Comparing extracted vs saved support_needs...');

    const extractedSet = new Set(extractedSupportNeeds.map(s => s.toLowerCase()));
    const savedSet = new Set(savedSupportNeeds.map(s => s.toLowerCase()));

    const inExtractedNotSaved = Array.from(extractedSet).filter(s => !savedSet.has(s));
    const inSavedNotExtracted = Array.from(savedSet).filter(s => !extractedSet.has(s));

    logs.push(`[STEP 7] In extracted but NOT in saved (${inExtractedNotSaved.length}):`);
    inExtractedNotSaved.forEach(s => logs.push(`[STEP 7]   - "${s}"`));

    logs.push(`[STEP 7] In saved but NOT in extracted (${inSavedNotExtracted.length}):`);
    inSavedNotExtracted.forEach(s => logs.push(`[STEP 7]   - "${s}"`));

    pipeline.discrepancies = {
      extracted_not_saved: inExtractedNotSaved,
      saved_not_extracted: inSavedNotExtracted
    };

    // ── STEP 8: Check if VFP panel might filter ──
    logs.push('[STEP 8] Checking VocationalFactsPanel mapping...');

    logs.push('[STEP 8] VocationalFactsPanel maps support_needs to:');
    logs.push('[STEP 8]   - support_needs (direct)');
    logs.push('[STEP 8]   - medication_side_effect_flags (via support_needs alias)');
    logs.push('[STEP 8]   - safety_risk_flags (via support_needs alias)');
    logs.push('[STEP 8] No filtering expected unless display aliases are missing');

    // ── STEP 9: Identify root cause ──
    logs.push('[STEP 9] Root cause analysis:');

    if (extractedSupportNeeds.length === 0) {
      logs.push('[STEP 9] ❌ ISSUE: extractVFPFromIntake extracted NO support_needs');
      logs.push('[STEP 9] This means the parsing logic is not identifying support phrases');
    } else if (inExtractedNotSaved.length > 0) {
      logs.push(`[STEP 9] ❌ ISSUE: ${inExtractedNotSaved.length} supports extracted but NOT saved to VFP`);
      logs.push('[STEP 9] This means extraction is working but client VFP was not updated');
      logs.push(`[STEP 9] Last extracted: ${pipeline.vfp_extraction_metadata}`);
      logs.push('[STEP 9] Check if extraction was run or if save failed');
    } else if (extractedSupportNeeds.length === savedSupportNeeds.length) {
      logs.push('[STEP 9] ✓ MATCH: All extracted supports are saved in VFP');
      logs.push('[STEP 9] VFP panel should be displaying them. Check panel mapping or component display logic.');
    }

    return Response.json({
      client_id,
      client_name: `${client.first_name} ${client.last_name}`,
      pipeline,
      logs,
      summary: {
        ai_clarifications_saved: Object.values(aiFields).filter(v => v).length > 0,
        support_recommendations_exist: supportRecs.length > 0,
        parsed_recommendations_count: pipeline.parsed_support_recommendations.length,
        extracted_support_needs_count: extractedSupportNeeds.length,
        saved_support_needs_count: savedSupportNeeds.length,
        discrepancies_count: inExtractedNotSaved.length + inSavedNotExtracted.length,
        status: inExtractedNotSaved.length > 0 ? 'EXTRACTION_NOT_SAVED' : 
                extractedSupportNeeds.length === 0 ? 'NO_EXTRACTION' : 
                'OK'
      }
    });

  } catch (error) {
    console.error('[auditBarriersAIClarifyPipeline] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});