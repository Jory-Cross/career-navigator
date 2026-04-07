import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Preprocessing workflow for uploaded assessment documents.
 * Detects document type, extracts 14 employment-related fact categories,
 * and saves a structured VocationalFactsProfile to the client record.
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

      // Fetch client + all documents (or specific ones)
      const [client, allDocs, assessments] = await Promise.all([
        base44.asServiceRole.entities.Client.get(clientId),
        base44.asServiceRole.entities.Document.filter({ client_id: clientId }),
        base44.asServiceRole.entities.Assessment.filter({ client_id: clientId }),
      ]);

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
        .filter(d => d.file_url && (
          d.file_type?.includes('pdf') ||
          d.file_type?.includes('image') ||
          d.file_type?.includes('doc') ||
          d.category === 'other' ||
          d.category === 'reference' ||
          d.category === 'notes' ||
          d.category === 'certification'
        ))
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

      // Save the vocational facts profile to the client record
      const profilePayload = {
        vocational_facts_profile: result,
        vocational_facts_extracted_at: new Date().toISOString(),
        vocational_facts_extracted_by: user.email,
        vocational_facts_document_count: targetDocs.length,
        vocational_facts_assessment_count: assessments.length,
      };

      await base44.asServiceRole.entities.Client.update(clientId, profilePayload);

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        activity_type: 'note_added',
        title: 'Vocational Facts Profile Extracted',
        description: `${user.full_name || user.email} extracted employment facts from ${targetDocs.length} documents and ${assessments.length} assessments. Quality score: ${result.data_quality_score || 'N/A'}%. ${result.conflicts?.length > 0 ? `⚠️ ${result.conflicts.length} conflict(s) flagged for review.` : ''}`,
      });

      return Response.json({
        success: true,
        profile: result,
        documents_processed: targetDocs.length,
        assessments_processed: assessments.length,
        conflicts_found: result.conflicts?.length || 0,
        data_quality_score: result.data_quality_score,
      });
    }

    // ── ACTION: get_vocational_facts ──────────────────────────────────────────
    if (action === 'get_vocational_facts') {
      const client = await base44.asServiceRole.entities.Client.get(clientId);
      return Response.json({
        success: true,
        profile: client.vocational_facts_profile || null,
        extracted_at: client.vocational_facts_extracted_at || null,
        extracted_by: client.vocational_facts_extracted_by || null,
        document_count: client.vocational_facts_document_count || 0,
        assessment_count: client.vocational_facts_assessment_count || 0,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('processAssessmentDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});