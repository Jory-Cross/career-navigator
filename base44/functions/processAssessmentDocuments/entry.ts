import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Preprocessing workflow for uploaded assessment documents.
 * Extracts 14 employment-related fact categories with full provenance,
 * saves structured metadata, and provides reusable AI-grounding payloads.
 *
 * Actions:
 *   - extract_from_documents: Process documents/assessments and extract profile
 *   - get_vocational_facts: Retrieve current profile with metadata
 *   - get_ai_grounding: Compact profile for AI job recommendations and coaching
 *   - get_profile_provenance: Facts with source document/assessment IDs
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 });

    // ── ACTION: extract_from_documents ───────────────────────────────────────
    if (action === 'extract_from_documents') {
      const { documentIds } = body;

      // Fetch client + all documents + assessments
      const [allClients, allDocsRaw, assessmentsRaw] = await Promise.all([
  base44.asServiceRole.entities.Client.list(),
  base44.asServiceRole.entities.Document.list(),
  base44.asServiceRole.entities.Assessment.list(),
]);

const allDocs = (allDocsRaw || []).filter(
  (d) => d.client_id === clientId || d.clientId === clientId
);

const assessments = (assessmentsRaw || []).filter(
  (a) => a.client_id === clientId || a.clientId === clientId
);

      const client = allClients.find(c => c.id === clientId);
      if (!client) {
        return Response.json({ error: 'Client not found' }, { status: 404 });
      }

      const targetDocs = documentIds?.length
        ? allDocs.filter(d => documentIds.includes(d.id))
        : allDocs.filter(d => !d.is_archived);

      if (!targetDocs.length && !assessments.length) {
        return Response.json({ error: 'No documents or assessments found for this client' }, { status: 400 });
      }

      // Build assessment text context
      const assessmentText = assessments.map(a => {
        const type = a.assessment_type.replace(/_/g, ' ').toUpperCase();
        const lines = Object.entries(a.responses || {})
          .filter(([k, v]) => v && !k.startsWith('_'))
          .map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
        return `[STRUCTURED ASSESSMENT: ${type}]\nCompleted: ${a.created_date || 'unknown'}\n${lines}`;
      }).join('\n\n');

      // Build document file list for LLM analysis
      const docFileUrls = targetDocs
  .filter(d => d.file_url)
  .map(d => d.file_url);

      const docList = targetDocs.map(d =>
        `  - ${d.title} (${d.category}, ${d.file_type || 'unknown type'})`
      ).join('\n');

      const extractionPrompt = `You are an expert vocational rehabilitation specialist. Your task is to analyze ALL available client assessment data and uploaded documents, then extract a comprehensive, structured vocational profile.

CLIENT: ${client.first_name} ${client.last_name}
CLIENT TYPE: ${client.client_type || 'N/A'}
LOCATION: ${client.location || 'Not specified'}
TARGET ROLE (on record): ${client.target_role || 'Not specified'}
CLIENT NOTES: ${client.notes || 'None'}

=== STRUCTURED ASSESSMENT RESPONSES (${assessments.length} assessments) ===
${assessmentText || 'No structured assessments on file'}

=== UPLOADED DOCUMENTS AVAILABLE (${targetDocs.length} documents) ===
${docList || 'None'}

=== INSTRUCTIONS ===
Analyze everything above and extract a structured vocational facts profile. For each category:
1. Extract all relevant facts from structured assessments AND any document content visible to you
2. Note the SOURCE of each fact (e.g., "from Career Goals assessment", "from Skills Audit", "from resume", "from staff notes")
3. If two sources CONFLICT on the same topic, do NOT pick one — flag it in the conflicts array
4. Only include what is explicitly stated — do NOT infer or assume
5. If a category has no data, return an empty array for that field

Extract the following 14 categories:

- skills: Documented skills, abilities, competencies (with sources)
- interests: Expressed interests, hobbies, career interests (with sources)
- preferred_tasks: Specific tasks, activities, or duties client prefers (with sources)
- work_environment_preferences: Indoor/outdoor, noise level, pace, structure, team vs solo, etc. (with sources)
- schedule_availability: Days, hours, shifts available; start/end time preferences (with sources)
- transportation: How client gets to work, distance limits, bus/car/walking, limitations (with sources)
- social_communication_needs: Communication style preferences, social anxiety, support for communication (with sources)
- sensory_environmental_needs: Sensory sensitivities, accommodations needed for lighting/noise/smell/texture (with sources)
- physical_restrictions: Physical limitations, lifting limits, standing/sitting tolerance, mobility (with sources)
- support_needs: Job coaching needs, on-the-job supports, natural supports, accommodation requests (with sources)
- job_readiness_level: Overall employment readiness, previous work history, soft skills level (with sources)
- employer_preferences: Employer size, industry, culture, management style preferences (with sources)
- barriers: Documented barriers to employment — legal, transportation, health, social, skill gaps (with sources)
- goals: Employment goals, long-term career goals, short-term targets (with sources)

Also identify:
- document_types_found: What types of documents were analyzed (e.g., "Vocational Evaluation", "IEP", "Resume")
- conflicts: Any factual conflicts between sources (each conflict as: {topic, source_a, value_a, source_b, value_b})
- data_quality_score: 0-100 rating of how complete and usable this profile is
- missing_critical_data: List of important data categories with no information found`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: extractionPrompt,
        file_urls: docFileUrls.length > 0 ? docFileUrls : undefined,
        add_context_from_internet: false,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            skills: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            interests: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            preferred_tasks: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            work_environment_preferences: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            schedule_availability: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            transportation: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            social_communication_needs: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            sensory_environmental_needs: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            physical_restrictions: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            support_needs: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            job_readiness_level: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            employer_preferences: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            barriers: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            goals: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string' } } } },
            document_types_found: { type: 'array', items: { type: 'string' } },
            conflicts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  source_a: { type: 'string' },
                  value_a: { type: 'string' },
                  source_b: { type: 'string' },
                  value_b: { type: 'string' }
                }
              }
            },
            data_quality_score: { type: 'number' },
            missing_critical_data: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Build structured extraction metadata
      const extractionMetadata = {
        version: 1,
        extracted_at: new Date().toISOString(),
        extracted_by: user.email,
        source_document_ids: targetDocs.map(d => d.id),
        source_assessment_ids: assessments.map(a => a.id),
        data_quality_score: result.data_quality_score || 0,
        conflicts_count: (result.conflicts || []).length,
        missing_fields_count: (result.missing_critical_data || []).length
      };

      // Preserve existing profile if newer extraction is weaker
      const existingProfile = client.vocational_facts_profile;
      const existingMetadata = client.vocational_facts_metadata;
      const shouldUpdate = !existingMetadata || 
                          result.data_quality_score >= (existingMetadata.data_quality_score || 0) ||
                          targetDocs.length > (existingMetadata.source_document_ids?.length || 0);

      // Save the vocational facts profile to the client record
      const profilePayload = {
        vocational_facts_profile: result,
        vocational_facts_metadata: extractionMetadata,
        vocational_facts_last_updated_at: new Date().toISOString(),
      };

      // Only update if stronger or no existing profile
      if (shouldUpdate || !existingProfile) {
        await base44.asServiceRole.entities.Client.update(clientId, profilePayload);
        console.log(`[processAssessmentDocuments] Updated profile for client ${clientId}, quality: ${result.data_quality_score}`);
      } else {
        console.log(`[processAssessmentDocuments] Skipped update for client ${clientId}; existing profile is stronger (${existingMetadata.data_quality_score} vs ${result.data_quality_score})`);
      }

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        activity_type: 'note_added',
        title: 'Vocational Facts Profile Extracted',
        description: `${user.full_name || user.email} extracted employment facts from ${targetDocs.length} documents and ${assessments.length} assessments. Quality score: ${result.data_quality_score}%. ${result.conflicts?.length > 0 ? `⚠️ ${result.conflicts.length} conflict(s) flagged for review.` : ''}`,
      });

      return Response.json({
        success: true,
        profile: result,
        metadata: extractionMetadata,
        documents_processed: targetDocs.length,
        assessments_processed: assessments.length,
        conflicts_found: result.conflicts?.length || 0,
        data_quality_score: result.data_quality_score,
        update_status: shouldUpdate ? 'updated' : 'skipped_weaker_profile'
      });
    }

    // ── ACTION: get_vocational_facts ──────────────────────────────────────────
    // Returns full profile with metadata for review UI
    if (action === 'get_vocational_facts') {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const client = allClients.find(c => c.id === clientId);
      if (!client) {
        return Response.json({ error: 'Client not found' }, { status: 404 });
      }
      const metadata = client.vocational_facts_metadata || {};
      return Response.json({
        success: true,
        profile: client.vocational_facts_profile || null,
        metadata: {
          version: metadata.version || 1,
          extracted_at: metadata.extracted_at || null,
          extracted_by: metadata.extracted_by || null,
          data_quality_score: metadata.data_quality_score || 0,
          conflicts_count: metadata.conflicts_count || 0,
          missing_fields_count: metadata.missing_fields_count || 0,
          source_document_ids: metadata.source_document_ids || [],
          source_assessment_ids: metadata.source_assessment_ids || []
        },
        last_updated_at: client.vocational_facts_last_updated_at || null,
      });
    }

    // ── ACTION: get_ai_grounding ──────────────────────────────────────────────
    // Returns compact, flattened profile for job recommendations and AI coaching
    if (action === 'get_ai_grounding') {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const client = allClients.find(c => c.id === clientId);
      if (!client || !client.vocational_facts_profile) {
        return Response.json({ error: 'No vocational profile available for this client' }, { status: 404 });
      }
      const profile = client.vocational_facts_profile;
      const compact = flattenProfileForAI(profile);
      return Response.json({
        success: true,
        grounding: compact,
        quality_score: profile.data_quality_score || 0,
        conflicts: profile.conflicts || [],
        missing_data: profile.missing_critical_data || []
      });
    }

    // ── ACTION: get_profile_provenance ────────────────────────────────────────
    // Returns facts with source document/assessment IDs for traceability
    if (action === 'get_profile_provenance') {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const client = allClients.find(c => c.id === clientId);
      if (!client || !client.vocational_facts_profile) {
        return Response.json({ error: 'No vocational profile available for this client' }, { status: 404 });
      }
      const profile = client.vocational_facts_profile;
      const metadata = client.vocational_facts_metadata || {};
      const sourceDocsMap = new Map(
        (metadata.source_document_ids || []).map((id, idx) => [id, `doc_${idx + 1}`])
      );
      const sourceAssessmentsMap = new Map(
        (metadata.source_assessment_ids || []).map((id, idx) => [id, `assessment_${idx + 1}`])
      );
      
      // Group facts by category with sources
      const provenance = {};
      const CATEGORIES = [
        'skills', 'interests', 'preferred_tasks', 'work_environment_preferences',
        'schedule_availability', 'transportation', 'social_communication_needs',
        'sensory_environmental_needs', 'physical_restrictions', 'support_needs',
        'job_readiness_level', 'employer_preferences', 'barriers', 'goals'
      ];
      
      CATEGORIES.forEach(cat => {
        if (profile[cat]) {
          provenance[cat] = profile[cat].map(fact => ({
            fact: fact.fact || fact,
            source: fact.source || 'unattributed'
          }));
        }
      });

      return Response.json({
        success: true,
        provenance,
        source_document_ids: metadata.source_document_ids || [],
        source_assessment_ids: metadata.source_assessment_ids || [],
        conflicts: profile.conflicts || [],
        data_quality_score: profile.data_quality_score || 0
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('processAssessmentDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Flatten profile for AI grounding (job recommendations, coaching)
// ──────────────────────────────────────────────────────────────────────────────
function flattenProfileForAI(profile) {
  const flatten = (arr) => {
    if (!arr || arr.length === 0) return [];
    return arr.map(item => (typeof item === 'object' ? item.fact : item)).filter(Boolean);
  };

  return {
    skills: flatten(profile.skills),
    interests: flatten(profile.interests),
    preferred_tasks: flatten(profile.preferred_tasks),
    work_environment: flatten(profile.work_environment_preferences),
    schedule: flatten(profile.schedule_availability),
    transportation: flatten(profile.transportation),
    communication_needs: flatten(profile.social_communication_needs),
    sensory_environmental_needs: flatten(profile.sensory_environmental_needs),
    physical_restrictions: flatten(profile.physical_restrictions),
    support_needs: flatten(profile.support_needs),
    job_readiness: flatten(profile.job_readiness_level),
    employer_preferences: flatten(profile.employer_preferences),
    barriers: flatten(profile.barriers),
    goals: flatten(profile.goals),
  };
}
