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

    // Collect ALL vocationalThemesEvidence (same as CustomizedEmploymentPanel)
    const allVocationalEvidence = collectVocationalThemesEvidence(assessments);

    const sourceTypeSet = new Set();
    const evidenceIdSet = new Set();
    const allConcepts = new Set();
    const allThemes = new Map(); // theme_name -> evidence_set

    allVocationalEvidence.forEach(item => {
      sourceTypeSet.add(item.source);
      evidenceIdSet.add(`${item.recordId}-${item.field}`);
      
      // Extract concepts and map to themes
      const concepts = extractConcepts(item.text);
      concepts.forEach(concept => {
        allConcepts.add(concept);
        
        // Map to themes
        const key = normalizeConceptKey(concept);
        const themeNames = matchConceptToThemes(key);
        themeNames.forEach(themeName => {
          if (!allThemes.has(themeName)) {
            allThemes.set(themeName, new Set());
          }
          allThemes.get(themeName).add(item.text);
        });
      });
    });

    // Check if this candidate's required themes are all present
    const candidateThemesRequired = getCandidateRequiredThemes(candidate_theme_name);
    const hasAllRequiredThemes = candidateThemesRequired.every(t => allThemes.has(t));

    // If candidate doesn't match, return empty graph
    if (!hasAllRequiredThemes) {
      return Response.json({
        ok: true,
        graph_id: null,
        candidate_theme_name,
        supporting_evidence_count: 0,
        supporting_concept_count: 0,
        supporting_theme_count: 0,
        supporting_source_count: 0,
        feedback_count: 0,
        consensus_status: 'No Feedback',
        message: 'Candidate does not match available themes'
      });
    }

    // Candidate evidence = all evidence items that contribute to supporting themes
    const candidateEvidence = [];
    const candidateEvidenceSeen = new Set();
    
    allVocationalEvidence.forEach(item => {
      // Check if this item contributes to any required theme
      const concepts = extractConcepts(item.text);
      const contributesToCandidate = concepts.some(concept => {
        const key = normalizeConceptKey(concept);
        const themeNames = matchConceptToThemes(key);
        return themeNames.some(t => candidateThemesRequired.includes(t));
      });
      
      if (contributesToCandidate) {
        const key = `${item.recordId}-${item.field}-${item.text}`;
        if (!candidateEvidenceSeen.has(key)) {
          candidateEvidenceSeen.add(key);
          candidateEvidence.push(item);
        }
      }
    });

    // Count concepts per supporting theme (from allVocationalEvidence)
    const conceptsByTheme = new Map(); // theme_name -> set of unique concepts
    candidateThemesRequired.forEach(themeName => {
      conceptsByTheme.set(themeName, new Set());
    });

    allVocationalEvidence.forEach(item => {
      const concepts = extractConcepts(item.text);
      concepts.forEach(concept => {
        const key = normalizeConceptKey(concept);
        const themeNames = matchConceptToThemes(key);
        themeNames.forEach(themeName => {
          if (candidateThemesRequired.includes(themeName)) {
            conceptsByTheme.get(themeName).add(concept);
          }
        });
      });
    });

    // Fetch feedback for consensus
    const feedbackRecords = await base44.entities.VocationalThemeCandidateFeedback.filter({
      client_id,
      candidate_theme_name,
      is_active: true
    });

    // Calculate consensus status
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

    // Build supporting_concepts array (all unique concepts from candidate's themes)
    const allConceptsForCandidate = new Set();
    for (const conceptSet of conceptsByTheme.values()) {
      conceptSet.forEach(c => allConceptsForCandidate.add(c));
    }

    const supportingConcepts = Array.from(allConceptsForCandidate).map(concept => ({
      concept_name: concept,
      concept_type: 'skill',
      evidence_count: allVocationalEvidence.filter(i => 
        i.text.toLowerCase().includes(concept.toLowerCase())
      ).length
    }));

    // Build supporting_themes array (only themes required for this candidate)
    const supportingThemes = candidateThemesRequired.map(themeName => ({
      theme_name: themeName,
      evidence_count: allThemes.get(themeName)?.size || 0,
      concept_count: conceptsByTheme.get(themeName)?.size || 0
    }));

    // Check if graph already exists
    const existingGraphs = await base44.entities.VocationalThemeCandidateGraph.filter({
      client_id,
      candidate_theme_name
    });

    const graphData = {
      org_id: client.org_id || "COMOP",
      client_id,
      candidate_theme_name,
      category_label: 'Vocational Themes Evidence',
      supporting_themes: supportingThemes,
      supporting_concepts: supportingConcepts,
      supporting_source_types: Array.from(sourceTypeSet),
      supporting_evidence_ids: Array.from(evidenceIdSet),
      supporting_evidence_count: candidateEvidence.length,
      supporting_concept_count: allConceptsForCandidate.size,
      supporting_theme_count: candidateThemesRequired.length,
      supporting_source_count: sourceTypeSet.size,
      feedback_count: feedbackRecords.length,
      consensus_status: consensusStatus,
      last_rebuilt_date: new Date().toISOString(),
      is_active: true
    };

    let graphRecord;
    if (existingGraphs.length > 0) {
      graphRecord = await base44.entities.VocationalThemeCandidateGraph.update(
        existingGraphs[0].id,
        graphData
      );
    } else {
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
      supporting_themes: graphData.supporting_themes,
      supporting_concepts: graphData.supporting_concepts,
      message: existingGraphs.length > 0 ? 'Graph updated' : 'Graph created'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Collect vocational themes evidence from assessments (same as CustomizedEmploymentPanel)
function collectVocationalThemesEvidence(assessments) {
  const evidence = [];

  // Filter by assessment type
  const homeDiscovery = assessments.find(r => r.assessment_type === 'home_community_discovery');
  const discoveryInterviews = assessments.filter(r => r.assessment_type === 'discovery_interview');
  const informationalInterviews = assessments.filter(r => r.assessment_type === 'informational_interview');
  const discoveryActivities = assessments.filter(r => r.assessment_type === 'discovery_activity');

  // Collect from Home & Community Discovery
  if (homeDiscovery?.responses) {
    const fields = [
      'preferred_activities', 'observable_interests', 'observable_skills', 'observable_talents',
      'emerging_vocational_themes', 'potential_businesses_or_settings', 'possible_discovery_leads',
      'discovery_hypotheses', 'emerging_patterns'
    ];
    fields.forEach(field => {
      const items = splitEvidence(homeDiscovery.responses[field]);
      items.forEach(text => {
        evidence.push({
          text, source: 'Home & Community Discovery',
          field, recordId: homeDiscovery.id, status: homeDiscovery.status,
          updatedDate: homeDiscovery.updated_date || homeDiscovery.created_date
        });
      });
    });
  }

  // Collect from Discovery Interviews
  discoveryInterviews.forEach(record => {
    const fields = [
      'positive_qualities', 'contributions', 'known_for', 'favorite_activities',
      'preferred_activities', 'people_or_connections', 'businesses_or_places_to_explore',
      'jobs_client_might_enjoy', 'possible_vocational_themes'
    ];
    fields.forEach(field => {
      const items = splitEvidence(record.responses?.[field]);
      items.forEach(text => {
        evidence.push({
          text, source: 'Discovery Interview',
          field, recordId: record.id, status: record.status,
          updatedDate: record.updated_date || record.created_date
        });
      });
    });
  });

  // Collect from Informational Interviews
  informationalInterviews.forEach(record => {
    const fields = [
      'customized_employment_possibilities', 'job_carving_opportunities',
      'business_organization', 'employer_needs_identified', 'key_takeaways',
      'connection_to_vocational_themes'
    ];
    fields.forEach(field => {
      const items = splitEvidence(record.responses?.[field]);
      items.forEach(text => {
        evidence.push({
          text, source: 'Informational Interview',
          field, recordId: record.id, status: record.status,
          updatedDate: record.updated_date || record.created_date
        });
      });
    });
  });

  // Collect from Discovery Activities
  discoveryActivities.forEach(record => {
    const fields = [
      'signs_of_interest', 'skills_demonstrated', 'preferred_activities_tools_materials',
      'conditions_associated_with_success', 'engagement_patterns',
      'discovery_hypotheses_confirmed', 'customized_employment_possibilities'
    ];
    fields.forEach(field => {
      const items = splitEvidence(record.responses?.[field]);
      items.forEach(text => {
        evidence.push({
          text, source: 'Discovery Activity',
          field, recordId: record.id, status: record.status,
          updatedDate: record.updated_date || record.created_date
        });
      });
    });
  });

  return evidence;
}

// Helper: Split evidence text (same as CustomizedEmploymentPanel)
function splitEvidence(value) {
  if (!value || typeof value !== 'string') return [];
  const cleanedValue = value.trim();
  if (!cleanedValue) return [];
  return cleanedValue
    .split(/\n|•|;/)
    .flatMap((part) => {
      const trimmed = part.trim();
      const sentenceCount = (trimmed.match(/[.!?]/g) || []).length;
      if (sentenceCount > 1) return [trimmed];
      return trimmed.split(",");
    })
    .map((part) => part.trim().replace(/^and\s+/i, "").replace(/\.$/, ""))
    .filter((part) => part.length > 2);
}

// Helper: Extract concepts from evidence text
function extractConcepts(text) {
  const concepts = [];
  const words = text.toLowerCase().split(/[,;]/).map(w => w.trim());
  words.forEach(word => {
    if (word.length > 2) {
      const titleCased = word.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      concepts.push(titleCased);
    }
  });
  return concepts;
}

// Helper: Normalize concept key for matching
function normalizeConceptKey(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Helper: Get required themes for a vocational candidate
function getCandidateRequiredThemes(candidateName) {
  const CANDIDATES = {
    'Library Materials & Information Organization': [
      'Organization & Inventory Systems',
      'Libraries & Information Organization',
      'Routine Structured Work'
    ],
    'Routine Operational Support': [
      'Organization & Inventory Systems',
      'Routine Structured Work'
    ],
    'Administrative Records Support': [
      'Organization & Inventory Systems',
      'Administrative & Clerical Support'
    ]
  };

  return CANDIDATES[candidateName] || [];
}

// Helper: Match concept to themes using keyword dictionary
function matchConceptToThemes(normalizedKey) {
  const THEME_KEYWORDS = {
    'Organization & Inventory Systems': [
      'inventory', 'tracking', 'track', 'label', 'sort', 'organize',
      'stock', 'shelf', 'supply', 'supplies', 'record', 'catalog', 'list', 'checklist'
    ],
    'Libraries & Information Organization': [
      'library', 'libraries', 'books', 'book', 'catalog', 'records',
      'information', 'file', 'filing', 'archive'
    ],
    'Routine Structured Work': [
      'routine', 'predictable', 'schedule', 'structured', 'consistency',
      'consistent', 'step', 'written', 'instruction', 'procedure'
    ]
  };

  const matched = [];
  const tokens = normalizedKey.split(' ');
  
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (tokens.some(t => keywords.includes(t)) || 
        keywords.some(kw => kw.includes(' ') && normalizedKey.includes(kw))) {
      matched.push(theme);
    }
  }
  
  return matched;
}