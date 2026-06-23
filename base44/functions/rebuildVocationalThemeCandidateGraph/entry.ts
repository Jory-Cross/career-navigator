import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_id, candidate_theme_name } = await req.json();
    if (!client_id || !candidate_theme_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify client exists
    const client = await base44.entities.Client.get(client_id);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch all assessments for this client
    const assessments = await base44.entities.Assessment.filter({
      client_id,
      status: 'completed'
    });

    // Extract all evidence and concepts from assessments
    const allEvidence = [];
    const conceptMap = new Map(); // concept_name -> { type, count }
    const themeMap = new Map(); // theme_name -> { evidence_count, concept_count }
    const sourceTypeSet = new Set();
    const evidenceIdSet = new Set();

    for (const assessment of assessments) {
      if (!assessment.structured_evidence) continue;

      sourceTypeSet.add(assessment.assessment_type);

      for (const evidence of assessment.structured_evidence) {
        // Only include evidence that relates to the candidate
        if (isCandidateRelated(evidence, candidate_theme_name)) {
          allEvidence.push(evidence);
          evidenceIdSet.add(evidence.question_id || `${assessment.id}-${evidence.label}`);

          // Extract concepts from implications
          if (evidence.implications && Array.isArray(evidence.implications)) {
            for (const implication of evidence.implications) {
              const conceptType = getConceptType(implication);
              const conceptName = normalizeConceptName(implication);
              if (conceptName) {
                if (!conceptMap.has(conceptName)) {
                  conceptMap.set(conceptName, { type: conceptType, count: 0 });
                }
                conceptMap.get(conceptName).count += 1;
              }
            }
          }

          // Extract themes from evidence label
          const themeName = extractThemeName(evidence.label);
          if (themeName && themeName.toLowerCase() !== candidate_theme_name.toLowerCase()) {
            if (!themeMap.has(themeName)) {
              themeMap.set(themeName, { evidence_count: 0, concept_count: 0 });
            }
            themeMap.get(themeName).evidence_count += 1;
          }
        }
      }
    }

    // Count concepts per theme
    for (const [themeName, themeData] of themeMap) {
      let conceptCount = 0;
      for (const [conceptName, conceptData] of conceptMap) {
        if (conceptName.toLowerCase().includes(themeName.toLowerCase()) ||
            themeName.toLowerCase().includes(conceptName.toLowerCase())) {
          conceptCount += 1;
        }
      }
      themeData.concept_count = conceptCount;
    }

    // Fetch feedback for consensus
    const feedbackRecords = await base44.entities.VocationalThemeCandidateFeedback.filter({
      client_id,
      candidate_theme_name,
      is_active: true
    });

    // Get consensus status by directly calculating from feedback
    let consensusStatus = 'No Feedback';
    if (feedbackRecords.length > 0) {
      const supportedCount = feedbackRecords.filter(f => f.staff_validation === 'supported').length;
      const needsMoreCount = feedbackRecords.filter(f => f.staff_validation === 'needs_more_discovery').length;
      const notRelevantCount = feedbackRecords.filter(f => f.staff_validation === 'not_relevant').length;
      const supportedPct = (supportedCount / feedbackRecords.length) * 100;
      const notRelevantPct = (notRelevantCount / feedbackRecords.length) * 100;
      const needsMorePct = (needsMoreCount / feedbackRecords.length) * 100;

      if (supportedPct >= 75 && feedbackRecords.length >= 2) {
        consensusStatus = 'Strongly Supported';
      } else if (supportedCount > notRelevantCount && needsMorePct < 50) {
        consensusStatus = 'Emerging Support';
      } else if (notRelevantPct > 50) {
        consensusStatus = 'Weak Support';
      } else if (needsMorePct >= 50) {
        consensusStatus = 'Needs More Discovery';
      } else {
        consensusStatus = 'Mixed Feedback';
      }
    }

    // Build supporting_concepts array
    const supportingConcepts = Array.from(conceptMap).map(([name, data]) => ({
      concept_name: name,
      concept_type: data.type,
      evidence_count: data.count
    }));

    // Build supporting_themes array
    const supportingThemes = Array.from(themeMap).map(([name, data]) => ({
      theme_name: name,
      evidence_count: data.evidence_count,
      concept_count: data.concept_count
    }));

    // Fetch category_label from first candidate definition
    let categoryLabel = 'Unknown';
    for (const assessment of assessments) {
      if (!assessment.structured_evidence) continue;
      for (const evidence of assessment.structured_evidence) {
        if (isCandidateRelated(evidence, candidate_theme_name)) {
          categoryLabel = evidence.evidence_category || 'Vocational Themes Evidence';
          break;
        }
      }
      if (categoryLabel !== 'Unknown') break;
    }

    // Check if graph already exists
    const existingGraphs = await base44.entities.VocationalThemeCandidateGraph.filter({
      client_id,
      candidate_theme_name
    });

    const graphData = {
      org_id: client.org_id || "COMOP",
      client_id,
      candidate_theme_name,
      category_label: categoryLabel,
      supporting_themes: supportingThemes,
      supporting_concepts: supportingConcepts,
      supporting_source_types: Array.from(sourceTypeSet),
      supporting_evidence_ids: Array.from(evidenceIdSet),
      supporting_evidence_count: evidenceIdSet.size,
      supporting_concept_count: conceptMap.size,
      supporting_theme_count: themeMap.size,
      supporting_source_count: sourceTypeSet.size,
      feedback_count: feedbackRecords.length,
      consensus_status: consensusStatus,
      last_rebuilt_date: new Date().toISOString(),
      is_active: true
    };

    let graphRecord;
    if (existingGraphs.length > 0) {
      // Update existing
      graphRecord = await base44.entities.VocationalThemeCandidateGraph.update(
        existingGraphs[0].id,
        graphData
      );
    } else {
      // Create new
      graphRecord = await base44.entities.VocationalThemeCandidateGraph.create(graphData);
    }

    return Response.json({
      ok: true,
      graph_id: graphRecord.id,
      candidate_theme_name,
      supporting_evidence_count: graphData.supporting_evidence_count,
      supporting_concept_count: graphData.supporting_concept_count,
      supporting_theme_count: graphData.supporting_theme_count,
      supporting_source_count: graphData.supporting_source_count,
      feedback_count: graphData.feedback_count,
      consensus_status: consensusStatus,
      message: existingGraphs.length > 0 ? 'Graph updated' : 'Graph created'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Check if evidence relates to candidate
function isCandidateRelated(evidence, candidateName) {
  if (!evidence) return false;
  const label = (evidence.label || '').toLowerCase();
  const name = (candidateName || '').toLowerCase();
  return label.includes(name) || (evidence.implications && evidence.implications.some(i => String(i).toLowerCase().includes(name)));
}

// Helper: Extract concept type from implication
function getConceptType(implication) {
  const str = String(implication).toLowerCase();
  if (str.includes('skill')) return 'skill';
  if (str.includes('interest')) return 'interest';
  if (str.includes('value')) return 'value';
  if (str.includes('condition')) return 'condition_for_success';
  if (str.includes('barrier')) return 'barrier';
  return 'skill';
}

// Helper: Normalize concept name
function normalizeConceptName(implication) {
  const str = String(implication).trim();
  if (!str || str.length < 2) return null;
  return str.replace(/^[A-Z]+:\s*/i, '').substring(0, 100);
}

// Helper: Extract theme name from evidence label
function extractThemeName(label) {
  if (!label) return null;
  // Remove common prefixes
  const cleaned = label.replace(/^(evidence|skill|interest|concept):\s*/i, '');
  // Take first phrase before dash or parenthesis
  const match = cleaned.match(/^([^-()]+)/);
  return match ? match[1].trim() : null;
}