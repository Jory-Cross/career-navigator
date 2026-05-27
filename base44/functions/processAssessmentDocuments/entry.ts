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
      const docList = targetDocs.map(d =>
        `  - ${d.title} (${d.category}, ${d.file_type || 'unknown type'})`
      ).join('\n');

      // Build structured resume data section from pre-extracted Document fields
      const resumeDocs = targetDocs.filter(d => d.category === 'resume');
      const structuredResumeSection = resumeDocs.length > 0
        ? resumeDocs.map(d => {
            const parts = [`[RESUME: ${d.title}]`];

            if (d.job_titles?.length) {
              parts.push(`Job Titles: ${d.job_titles.join(', ')}`);
            }
            if (d.resume_skills?.length) {
              parts.push(`Skills: ${d.resume_skills.join(', ')}`);
            }
            if (d.work_history?.length) {
              parts.push(`Work History:\n` + d.work_history.map(w =>
                `  - ${w.title || ''} at ${w.employer || ''} (${w.start_date || ''}${w.end_date ? ' – ' + w.end_date : ' – present'})${w.description ? ': ' + w.description : ''}`
              ).join('\n'));
            }
            if (d.education_history?.length) {
              parts.push(`Education:\n` + d.education_history.map(e =>
                `  - ${e.degree || ''} in ${e.field || ''} from ${e.institution || ''} (${e.graduation_year || ''})`
              ).join('\n'));
            }
            if (d.certifications?.length) {
              parts.push(`Certifications:\n` + d.certifications.map(c =>
                `  - ${c.name || ''} (${c.issuer || ''}, ${c.year || ''})`
              ).join('\n'));
            }
            if (d.extracted_text && !d.job_titles?.length && !d.resume_skills?.length) {
              // Fall back to raw extracted text only if no structured fields available
              parts.push(`Raw Text (excerpt):\n${d.extracted_text.slice(0, 3000)}`);
            }

            return parts.join('\n');
          }).join('\n\n')
        : null;

      const extractionPrompt = `You are an expert vocational rehabilitation specialist. Your task is to analyze ALL available client assessment data and uploaded documents, then extract a comprehensive, structured vocational profile.

CLIENT: ${client.first_name} ${client.last_name}
CLIENT TYPE: ${client.client_type || 'N/A'}
LOCATION: ${client.location || 'Not specified'}
TARGET ROLE (on record): ${client.target_role || 'Not specified'}
CLIENT NOTES: ${client.notes || 'None'}

=== STRUCTURED RESUME DATA ===

${structuredResumeSection || 'No structured resume data available'}

=== STRUCTURED ASSESSMENT DATA ===

${assessments.length > 0
  ? assessments.map(a => {
      const responses = Object.entries(a.responses || {})
        .filter(([k, v]) => v && !k.startsWith("_"))
        .map(([k, v]) =>
          `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : v}`
        )
        .join("\n");

      return `Assessment: ${a.assessment_type}\n${responses}`;
    }).join("\n\n")
  : "No assessment data available"}

=== UPLOADED DOCUMENTS AVAILABLE (${targetDocs.length} documents) ===
${docList || 'None'}

=== INSTRUCTIONS ===
Analyze everything above and extract a structured vocational facts profile. For each category:
1. Extract all relevant facts from structured assessments AND any document content visible to you
2. Note the SOURCE of each fact (e.g., "from Career Goals assessment", "from Skills Audit", "from resume", "from staff notes")
3. If two sources CONFLICT on the same topic, do NOT pick one — flag it in the conflicts array
4. Convert all extracted information into clear, usable, plain-language facts.

DO NOT return labels like "WSA — other observations" or "Career Goals Assessment".
Instead, extract the actual meaning behind the data.

Examples:
- Instead of: "WSA — other observations"
  Return: "Client has difficulty with interpersonal social interactions"
- Instead of: "WSA — computer skill observations"
  Return: "Client demonstrates basic typing and computer navigation skills"

Every fact must be written as a complete, human-readable statement describing the client.
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

console.log("VFP SENDING TO LLM:", {
  documents: targetDocs.length,
  assessments: assessments.length
});
      
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: extractionPrompt,
        add_context_from_internet: false,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
  type: "object",
  additionalProperties: true
}
});
      
      let raw =
  llmResponse?.data ||
  llmResponse?.result ||
  llmResponse?.output ||
  llmResponse ||
  {};

let result = raw;

// If LLM returned string → parse it
if (typeof raw === "string") {
  try {
    result = JSON.parse(raw);
  } catch (e) {
    console.error("VFP PARSE FAILED:", raw);
    result = {};
  }
}

// If result is nested under "profile", unwrap it
if (result?.profile) {
  result = result.profile;
}

// Final safety: ensure it's an object
if (!result || typeof result !== "object") {
  result = {};
}

console.log("VFP FINAL RESULT:", result);

      console.log("VFP NORMALIZED LLM RESULT:", result);

      console.log("VFP RAW LLM RESPONSE:", llmResponse);
      
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

      // Preserve existing profile if newer extraction is weaker.
      // IMPORTANT:
      // Client.list() may not always include the full vocational_facts_profile payload,
      // so fetch the full current Client record before deciding whether to overwrite.
      const currentClientForExisting = await base44.asServiceRole.entities.Client.get(clientId);

      const existingProfile = currentClientForExisting?.vocational_facts_profile || null;
      const existingMetadata = currentClientForExisting?.vocational_facts_metadata || {};

      const countFacts = (profile) => {
        if (!profile || typeof profile !== "object") return 0;

        return [
          ...(profile.skills || []),
          ...(profile.interests || []),
          ...(profile.preferred_tasks || []),
          ...(profile.work_environment_preferences || []),
          ...(profile.schedule_availability || []),
          ...(profile.transportation || []),
          ...(profile.social_communication_needs || []),
          ...(profile.sensory_environmental_needs || []),
          ...(profile.physical_restrictions || []),
          ...(profile.support_needs || []),
          ...(profile.job_readiness_level || []),
          ...(profile.employer_preferences || []),
          ...(profile.barriers || []),
          ...(profile.goals || []),

          // Include known alias fields used elsewhere in the app.
          ...(profile.preferred_work_environment || []),
          ...(profile.schedule_constraints || []),
          ...(profile.transportation_reliability || []),
          ...(profile.transportation_limitations || []),
          ...(profile.communication_style || []),
          ...(profile.social_tolerance || []),
          ...(profile.social_supports || []),
          ...(profile.sensory_limitations || []),
          ...(profile.accommodation_needs || []),
          ...(profile.medication_side_effect_flags || []),
          ...(profile.safety_risk_flags || []),
          ...(profile.stamina_endurance_concerns || []),
          ...(profile.benefits_considerations || []),
          ...(profile.work_goal_themes || []),
        ].length;
      };

      const existingScore = existingMetadata?.data_quality_score || existingProfile?.data_quality_score || 0;
      const newScore = result?.data_quality_score || 0;

      const existingFactCount = countFacts(existingProfile);
      const newFactCount = countFacts(result);

      const shouldUpdate =
        newFactCount > 0 &&
        (
          !existingProfile ||
          existingFactCount === 0 ||
          newScore >= existingScore ||
          newFactCount >= existingFactCount
        );

      const returnedProfile = shouldUpdate ? result : existingProfile;
      const returnedMetadata = shouldUpdate ? extractionMetadata : existingMetadata;

      // Save the vocational facts profile to the client record
      const profilePayload = {
        vocational_facts_profile: result,
        vocational_facts_metadata: extractionMetadata,
        vocational_facts_last_updated_at: new Date().toISOString(),
      };

     let updateResult = null;

if (shouldUpdate) {
  updateResult = await base44.asServiceRole.entities.Client.update(
    clientId,
    profilePayload
  );

  console.log("VFP SAVE RESULT:", updateResult);

  console.log(
    `[processAssessmentDocuments] Profile saved for client ${clientId}, quality: ${result.data_quality_score}`
  );
} else {
  console.log(
    `[processAssessmentDocuments] Skipped weaker VFP extraction for client ${clientId}`
  );
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
        data_quality_score: result.data_quality_score || 0,
        update_status: shouldUpdate || !existingProfile ? "updated" : "skipped_weaker_profile"
      });
    }

    // ── ACTION: get_vocational_facts ──────────────────────────────────────────
    // Returns full profile with metadata for review UI
    if (action === 'get_vocational_facts') {
      const client = await base44.asServiceRole.entities.Client.get(clientId);
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
      const client = await base44.asServiceRole.entities.Client.get(clientId);
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
      const client = await base44.asServiceRole.entities.Client.get(clientId);
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
