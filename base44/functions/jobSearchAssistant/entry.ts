import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Grounded job search assistant with batch tracking and staff review workflow.
 *
 * Every recommendation is:
 *   - Grounded in stored client factors (vocational facts profile)
 *   - Linked to a batch for group review
 *   - Traced with search filters, terms, assessments, and sources
 *   - Subject to staff review before action
 *
 * Actions:
 *   - generate_vocational_profile: Create profile from client data
 *   - find_jobs: Search and return recommendations (not yet saved)
 *   - save_recommendations: Create batch + JobRecommendation records
 *   - get_saved_recommendations: Retrieve with batch grouping
 *   - review_recommendation: Staff review workflow
 *   - update_recommendation_status: Track employment outcome
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 });

    // ── Lightweight actions (no full client load needed) ──────────────────────
    if (action === 'get_saved_recommendations') {
      const recs = await base44.asServiceRole.entities.JobRecommendation.filter(
        { client_id: clientId }, '-created_date', 100
      );
      return Response.json({
        success: true,
        recommendations: recs,
        total: recs.length
      });
    }

    if (action === 'get_batch_details') {
      const { batchId } = body;
      if (!batchId) return Response.json({ error: 'batchId required' }, { status: 400 });

      const [batch, recommendations] = await Promise.all([
        base44.asServiceRole.entities.JobRecommendationBatch.get(batchId).catch(() => null),
        base44.asServiceRole.entities.JobRecommendation.filter({ batch_id: batchId }, '-created_date')
      ]);

      if (!batch) return Response.json({ error: 'Batch not found' }, { status: 404 });

      return Response.json({
        success: true,
        batch,
        recommendations
      });
    }

    if (action === 'update_recommendation_status') {
      const { recommendationId, status } = body;
      const VALID_STATUSES = [
        'suggested', 'staff_reviewed', 'shared_with_client',
        'applied', 'interview', 'closed_not_fit', 'closed_declined', 'hired'
      ];
      if (!VALID_STATUSES.includes(status)) {
        return Response.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      await base44.asServiceRole.entities.JobRecommendation.update(recommendationId, { status });
      return Response.json({ success: true, status });
    }

    if (action === 'review_recommendation') {
      const { recommendationId, approved, review_notes } = body;
      if (!recommendationId) {
        return Response.json({ error: 'Missing recommendationId' }, { status: 400 });
      }
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.JobRecommendation.update(recommendationId, {
        reviewed_by_staff: true,
        reviewed_by: user.email,
        reviewed_at: now,
        review_notes: review_notes || null,
        status: approved ? 'staff_reviewed' : 'suggested' // Only move to reviewed if approved
      });
      return Response.json({ success: true, reviewed_at: now });
    }

    // ── Load full client context ──────────────────────────────────────────────
    const [client, assessments, documents, applications, goals, notes, timeEntries] = await Promise.all([
      base44.asServiceRole.entities.Client.get(clientId),
      base44.asServiceRole.entities.Assessment.filter({ client_id: clientId }),
      base44.asServiceRole.entities.Document.filter({ client_id: clientId }).catch(() => []),
      base44.asServiceRole.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 15),
      base44.asServiceRole.entities.Goal.filter({ client_id: clientId }).catch(() => []),
      base44.asServiceRole.entities.SupportNote.filter({ client_id: clientId }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.TimeEntry.filter({ client_id: clientId }, '-date', 20).catch(() => []),
    ]);

    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const assessmentIds = assessments.map(a => a.id);

    // ── Build structured assessment context ───────────────────────────────────
    const structuredAssessmentText = assessments.map(a => {
      const type = a.assessment_type.replace(/_/g, ' ').toUpperCase();
      const lines = Object.entries(a.responses || {})
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
      return `[${type} — ID:${a.id}]\nDate: ${a.created_date || 'unknown'}\n${lines || '  (no responses recorded)'}`;
    }).join('\n\n');

    // ── Vocational facts profile (pre-extracted from documents) ───────────────
    const vfp = client.vocational_facts_profile || null;
    const hasVFP = vfp && Object.keys(vfp).length > 0;

    const buildFactsText = (factsObj) => {
      if (!factsObj) return 'Not extracted yet — run document preprocessing first.';
      const CATEGORIES = [
        ['skills', 'Skills'],
        ['interests', 'Interests'],
        ['preferred_tasks', 'Preferred Tasks'],
        ['work_environment_preferences', 'Work Environment Preferences'],
        ['schedule_availability', 'Schedule Availability'],
        ['transportation', 'Transportation'],
        ['social_communication_needs', 'Social/Communication Needs'],
        ['sensory_environmental_needs', 'Sensory/Environmental Needs'],
        ['physical_restrictions', 'Physical Restrictions'],
        ['support_needs', 'Support Needs'],
        ['job_readiness_level', 'Job Readiness Level'],
        ['employer_preferences', 'Employer Preferences'],
        ['barriers', 'Barriers'],
        ['goals', 'Goals'],
      ];
      return CATEGORIES.map(([key, label]) => {
        const items = factsObj[key] || [];
        if (!items.length) return `${label}: [none documented]`;
        return `${label}:\n${items.map(i => `  • ${i.fact} [source: ${i.source}]`).join('\n')}`;
      }).join('\n\n');
    };

    const conflictsText = hasVFP && vfp.conflicts?.length > 0
      ? `\n⚠️ DOCUMENTED CONFLICTS REQUIRING STAFF REVIEW (${vfp.conflicts.length}):\n` +
        vfp.conflicts.map((c, i) =>
          `  ${i + 1}. ${c.topic}:\n     - ${c.source_a} says: "${c.value_a}"\n     - ${c.source_b} says: "${c.value_b}"`
        ).join('\n')
      : '';

    const clientBaseContext = `
NAME: ${client.first_name} ${client.last_name}
CLIENT TYPE: ${client.client_type || 'N/A'}
STATUS: ${client.status}
LOCATION: ${client.location || 'Not specified'}
TARGET ROLE (on record): ${client.target_role || 'Not specified'}
TARGET INDUSTRY: ${client.industry || 'Not specified'}
CLIENT NOTES: ${client.notes || 'None'}
EMPLOYMENT START DATE: ${client.employment_start_date || 'N/A'}`.trim();

    const goalsText = goals.length
      ? goals.map(g => `  • [${g.category}] ${g.title} (${g.status}): ${g.description || ''}`).join('\n')
      : '  None recorded';

    const notesText = notes.length
      ? notes.map(n => `  • [${n.date}] ${n.note_type}: ${n.title} — ${n.content.slice(0, 200)}`).join('\n')
      : '  None';

    const appsText = applications.length
      ? applications.slice(0, 8).map(a => `  • ${a.company} / ${a.position} (${a.status})`).join('\n')
      : '  No applications yet';

    const clientFieldsUsed = [];
    const addField = (label, val) => { if (val) clientFieldsUsed.push(label); };
    addField('target_role', client.target_role);
    addField('industry', client.industry);
    addField('location', client.location);
    addField('notes', client.notes);
    addField('client_type', client.client_type);
    if (hasVFP) addField('vocational_facts_profile', true);

    // ── ACTION: generate_vocational_profile ───────────────────────────────────
    if (action === 'generate_vocational_profile') {
      const prompt = `You are an expert vocational rehabilitation counselor. Synthesize ALL available data for this client into a structured vocational profile to guide job search.

=== CLIENT BASE PROFILE ===
${clientBaseContext}

=== VOCATIONAL FACTS PROFILE (extracted from assessments + documents) ===
${buildFactsText(vfp)}
${conflictsText}
Data Quality Score: ${hasVFP ? (vfp.data_quality_score || 'N/A') : 'Not assessed'}%
Profile last extracted: ${client.vocational_facts_extracted_at ? new Date(client.vocational_facts_extracted_at).toLocaleDateString() : 'Never'}
Documents analyzed: ${client.vocational_facts_document_count || 0} | Assessments analyzed: ${client.vocational_facts_assessment_count || 0}

=== STRUCTURED ASSESSMENT RESPONSES (${assessments.length} on file) ===
${structuredAssessmentText || 'No assessments on file'}

=== EMPLOYMENT GOALS ===
${goalsText}

=== SUPPORT NOTES ===
${notesText}

=== PREVIOUS JOB APPLICATIONS ===
${appsText}

=== INSTRUCTIONS ===
1. Synthesize all data into a clear vocational profile. Use information from the vocational facts profile as the primary source since it incorporates documents and assessments.
2. Identify top strengths relevant to employment — cite which source documents/assessments each strength comes from.
3. Identify key barriers and support needs — cite sources.
4. Determine realistic job targets based on the data.
5. Note work restrictions, schedule limits, transportation constraints, sensory/environment needs.
6. List optimal work environment characteristics.
7. Flag missing information that would improve recommendations.
8. If conflicts exist in the data, include them in a conflicts_to_review field — do NOT resolve them by guessing.
9. Be strengths-based and realistic. Do NOT make assumptions based on disability labels.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            data_sources_used: { type: 'array', items: { type: 'string' }, description: 'List of sources used (assessment names, document types, etc.)' },
            strengths: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, source: { type: 'string' } } } },
            barriers: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, source: { type: 'string' } } } },
            support_needs: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, source: { type: 'string' } } } },
            work_environment_preferences: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, source: { type: 'string' } } } },
            schedule_constraints: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, source: { type: 'string' } } } },
            transportation_notes: { type: 'string' },
            sensory_notes: { type: 'string' },
            suggested_job_targets: { type: 'array', items: { type: 'string' } },
            benefits_considerations: { type: 'string' },
            conflicts_to_review: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, source_a: { type: 'string' }, value_a: { type: 'string' }, source_b: { type: 'string' }, value_b: { type: 'string' } } } },
            missing_information: { type: 'array', items: { type: 'string' } },
            recommended_search_terms: { type: 'array', items: { type: 'string' } },
            has_extracted_facts: { type: 'boolean', description: 'Whether a pre-extracted vocational facts profile was available' }
          }
        }
      });

      // Track which data sources were actually used
      const dataSourcesUsed = [
        ...(result.data_sources_used || []),
        ...assessmentIds.map(id => `Assessment-${id}`),
        ...(hasVFP ? ['vocational_facts_profile'] : []),
        ...(goals.length > 0 ? ['goals'] : []),
        ...(notes.length > 0 ? ['support_notes'] : [])
      ];

      return Response.json({
        success: true,
        data: { ...result, has_extracted_facts: hasVFP },
        assessments_used: assessmentIds,
        client_fields_used: clientFieldsUsed,
        data_sources_used: [...new Set(dataSourcesUsed)],
        has_vocational_facts: hasVFP,
        data_quality_score: hasVFP ? vfp.data_quality_score : null,
        conflicts_count: hasVFP ? (vfp.conflicts?.length || 0) : 0,
      });
    }

    // ── ACTION: find_jobs ─────────────────────────────────────────────────────
    if (action === 'find_jobs') {
      const { profile, customInstructions, filters } = body;
      
      // Extract filter preferences (all optional)
      const locationRadius = filters?.locationRadius || '50 miles';
      const workType = filters?.workType || 'any'; // 'remote', 'hybrid', 'onsite', 'any'
      const employmentType = filters?.employmentType || 'any'; // 'full-time', 'part-time', 'contract', 'any'
      const industry = filters?.industry || null;
      const payMin = filters?.payMin || null;
      const payMax = filters?.payMax || null;
      const schedule = filters?.schedule || null;

      // Build a precise, grounded constraints brief
      const scheduleConstraints = profile?.schedule_constraints?.map(s => `• ${s.item} [${s.source}]`).join('\n') || 'None documented';
      const envPrefs = profile?.work_environment_preferences?.map(s => `• ${s.item} [${s.source}]`).join('\n') || 'Not specified';
      const supportNeeds = profile?.support_needs?.map(s => `• ${s.item} [${s.source}]`).join('\n') || 'None documented';
      const barriers = profile?.barriers?.map(s => `• ${s.item} [${s.source}]`).join('\n') || 'None documented';
      const strengths = profile?.strengths?.map(s => `• ${s.item} [${s.source}]`).join('\n') || 'Not specified';
      const jobTargets = profile?.suggested_job_targets || [client.target_role || 'general employment'];
      const conflictsNote = profile?.conflicts_to_review?.length > 0
        ? `\n⚠️ UNRESOLVED CONFLICTS — DO NOT assume either answer, acknowledge in recommendations:\n${profile.conflicts_to_review.map(c => `  • ${c.topic}: "${c.value_a}" vs "${c.value_b}"`).join('\n')}`
        : '';

      // Pull key hard constraints directly from the vocational facts profile for extra grounding
      const hardConstraints = hasVFP ? [
        ...(vfp.transportation || []).map(f => `TRANSPORTATION: ${f.fact} [${f.source}]`),
        ...(vfp.schedule_availability || []).map(f => `SCHEDULE: ${f.fact} [${f.source}]`),
        ...(vfp.physical_restrictions || []).map(f => `PHYSICAL: ${f.fact} [${f.source}]`),
        ...(vfp.sensory_environmental_needs || []).map(f => `SENSORY: ${f.fact} [${f.source}]`),
      ].join('\n') : 'Vocational facts not yet extracted — rely on profile above';

      // Build location preference string
      let locationPref = '';
      if (client.location) {
        if (workType === 'remote') {
          locationPref = `Remote positions (anywhere)`;
        } else if (workType === 'hybrid') {
          locationPref = `Hybrid positions at or near ${client.location}, ${locationRadius} radius`;
        } else {
          locationPref = `In-person positions at or near ${client.location}, ${locationRadius} radius. Remote only if explicitly allowed.`;
        }
      } else {
        locationPref = workType === 'remote' ? 'Remote positions only' : 'Any location with location data available';
      }

      // Build employment type preference
      let empTypePref = '';
      if (employmentType !== 'any') {
        empTypePref = `Prioritize ${employmentType} positions.`;
      } else {
        empTypePref = 'Any employment type (full-time, part-time, contract).';
      }

      // Build schedule preference if provided
      let schedulePref = '';
      if (schedule) {
        schedulePref = `\nSchedule preference: ${schedule}`;
      }

      // Build pay range filter
      let payPref = '';
      if (payMin || payMax) {
        payPref = `Pay range: $${payMin || '0'}/hour - $${payMax || 'any'}/hour.`;
      }

      // Build industry filter
      let industryPref = '';
      if (industry) {
        industryPref = `\nIndustry focus: ${industry}`;
      }

      const prompt = `You are a specialized job placement assistant for adults with disabilities. Every recommendation you make MUST be grounded in the documented client facts below. You are NOT permitted to recommend jobs that violate any documented constraint.

=== CLIENT ===
Name: ${client.first_name} ${client.last_name}
Location: ${client.location || 'Not specified'}
Client Type: ${client.client_type || 'N/A'}

=== GROUNDED VOCATIONAL PROFILE (cite these in your recommendations) ===
Job Targets: ${jobTargets.join(', ')}

Documented Strengths (with source):
${strengths}

Documented Barriers (with source):
${barriers}

Support Needs (with source):
${supportNeeds}

Work Environment Preferences (with source):
${envPrefs}

Schedule Constraints (with source):
${scheduleConstraints}

Transportation & Schedule Hard Constraints:
${hardConstraints}

Sensory/Environment notes: ${profile?.sensory_notes || 'Not specified'}
Transportation notes: ${profile?.transportation_notes || 'Not specified'}
Benefits considerations: ${profile?.benefits_considerations || 'Unknown'}
${conflictsNote}

=== STAFF-APPLIED SEARCH FILTERS ===
Location Preference: ${locationPref}
Employment Type: ${empTypePref}
${payPref}
${schedulePref}
${industryPref}

=== ADDITIONAL STAFF INSTRUCTIONS ===
${customInstructions || 'None'}

=== YOUR TASK ===
Search the internet RIGHT NOW for REAL, CURRENTLY AVAILABLE job postings matching this client's profile at their location.

FILTERING RULES (apply these strictly):
${employmentType !== 'any' ? `- Only return ${employmentType} positions` : ''}
${workType === 'remote' ? `- Only return remote positions` : workType === 'onsite' ? `- Only return in-person positions` : `- Prefer nearby positions within ${locationRadius}; remote only if explicitly mentioned in job posting`}
${payMin ? `- Only return jobs paying at least $${payMin}/hour` : ''}
${payMax ? `- Only return jobs paying at most $${payMax}/hour` : ''}
${industry ? `- Only return jobs in: ${industry}` : ''}
- Do NOT recommend jobs that definitively violate documented physical restrictions, transportation limits, or schedule constraints
- If a job requires commute beyond documented transportation limits, exclude it
- If you're unsure whether a constraint applies, flag it for staff review rather than ignoring it

For EACH job recommendation you provide, you MUST:
1. Give the exact job title, employer, location, pay, schedule, and direct application URL
2. In "fit_reason": cite SPECIFIC client factors (name the source document/assessment) that make this a good fit
3. In "cited_factors": list each specific factor from the profile that matches — include the source
4. In "concerns": list specific concerns based on documented barriers/needs
5. In "support_strategy": recommend specific accommodations tied to documented support needs
6. In "constraint_violations": list any documented constraints this job conflicts with (if none, empty array)
7. If any UNRESOLVED CONFLICTS affect this job, note them in concerns and recommend staff review

TARGET: 5-8 diverse, realistic recommendations that genuinely exist or existed recently`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_1_pro',
        response_json_schema: {
          type: 'object',
          properties: {
            search_summary: { type: 'string' },
            search_terms_used: { type: 'array', items: { type: 'string' } },
            grounding_note: { type: 'string', description: 'Brief note on how the vocational facts profile was used to filter/prioritize jobs' },
            jobs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  job_title: { type: 'string' },
                  employer: { type: 'string' },
                  location: { type: 'string' },
                  pay: { type: 'string' },
                  schedule: { type: 'string' },
                  source_url: { type: 'string' },
                  fit_reason: { type: 'string' },
                  cited_factors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        factor: { type: 'string' },
                        source: { type: 'string' },
                        relevance: { type: 'string' }
                      }
                    }
                  },
                  concerns: { type: 'string' },
                  support_strategy: { type: 'string' },
                  constraint_violations: { type: 'array', items: { type: 'string' } },
                  requires_staff_review: { type: 'boolean' },
                  review_reason: { type: 'string' },
                  fit_score: { type: 'number' }
                }
              }
            },
            unresolved_conflicts_affecting_search: { type: 'array', items: { type: 'string' } },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Track all data sources used in the recommendation
      const dataSourcesUsed = [
        ...(assessmentIds.length > 0 ? [`${assessmentIds.length} assessment(s)`] : []),
        ...(hasVFP ? ['vocational_facts_profile'] : []),
        ...(goals.length > 0 ? ['goals'] : []),
        ...(notes.length > 0 ? ['support_notes'] : []),
        ...(applications.length > 0 ? ['job_applications'] : [])
      ];

      return Response.json({
        success: true,
        data: result,
        assessments_used: assessmentIds,
        client_fields_used: clientFieldsUsed,
        search_terms_used: result.search_terms_used || [],
        data_sources_used: dataSourcesUsed,
        has_vocational_facts: hasVFP,
        data_quality_score: hasVFP ? vfp.data_quality_score : null,
      });
    }

    // ── ACTION: save_recommendations ──────────────────────────────────────────
    // Create batch record + linked JobRecommendation records with full provenance
    if (action === 'save_recommendations') {
      const {
        jobs, assessmentsUsed, clientFieldsUsed: fields, searchTermsUsed,
        dataSourcesUsed, filters, has_vocational_facts, vocational_profile_version,
        search_summary, grounding_note, custom_instructions, data_quality_score
      } = body;

      if (!jobs || jobs.length === 0) {
        return Response.json({ error: 'No jobs to save' }, { status: 400 });
      }

      // Step 1: Create the batch record (new entity: JobRecommendationBatch)
      const savedAt = new Date().toISOString();
      const batch = await base44.asServiceRole.entities.JobRecommendationBatch.create({
        client_id: clientId,
        search_summary: search_summary || '',
        grounding_note: grounding_note || '',
        custom_instructions: custom_instructions || '',
        search_filters: filters || {},
        search_terms_used: searchTermsUsed || [],
        assessments_used: assessmentsUsed || [],
        client_fields_used: fields || [],
        data_sources_used: dataSourcesUsed || [],
        vocational_profile_version: vocational_profile_version || 1,
        has_vocational_facts: has_vocational_facts || false,
        data_quality_score: data_quality_score || 0,
        job_count: jobs.length,
        generated_by: user.email,
        generated_at: savedAt,
        status: 'pending_review' // Batch status: pending_review → fully_reviewed → actioned
      });

      console.log(`[jobSearchAssistant] Created batch ${batch.id} with ${jobs.length} jobs`);

      // Step 2: Create JobRecommendation records linked to batch
      const saved = [];
      for (const job of jobs) {
        const fitReason = job.cited_factors?.length > 0
          ? (job.fit_reason || '') + '\n\nCited Factors:\n' +
            job.cited_factors.map(f => `• ${f.factor} [${f.source}]: ${f.relevance}`).join('\n')
          : (job.fit_reason || '');

        const rec = await base44.asServiceRole.entities.JobRecommendation.create({
          client_id: clientId,
          batch_id: batch.id,
          job_title: job.job_title,
          employer: job.employer,
          location: job.location || '',
          pay: job.pay || '',
          schedule: job.schedule || '',
          source_url: job.source_url || '',
          fit_reason: fitReason,
          concerns: job.concerns || '',
          support_strategy: job.support_strategy || '',
          fit_score: job.fit_score || 0,
          status: 'suggested',
          generated_by_ai: true,
          generated_by: user.email,
          reviewed_by_staff: false,
          requires_staff_review: job.requires_staff_review || false,
          review_reason: job.review_reason || null,
          constraint_violations: job.constraint_violations || [],
          assessments_used: assessmentsUsed || [],
          client_fields_used: fields || [],
          search_terms_used: searchTermsUsed || [],
        });
        saved.push(rec);
      }

      // Step 3: Log batch as activity for audit trail
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        activity_type: 'note_added',
        title: `AI Job Search Batch Created — ${saved.length} recommendations`,
        description: `Batch ${batch.id}: ${saved.length} grounded recommendations generated by ${user.full_name || user.email}. ${has_vocational_facts ? 'VFP grounded. ' : ''}Search terms: ${(searchTermsUsed || []).slice(0, 3).join(', ')}. Status: PENDING STAFF REVIEW.`,
      });

      return Response.json({
        success: true,
        batch_id: batch.id,
        saved_count: saved.length,
        batch_status: 'pending_review'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('jobSearchAssistant error:', error);
    console.error('Error data:', JSON.stringify(error.data || {}));
    return Response.json({ error: error.message }, { status: 500 });
  }
});