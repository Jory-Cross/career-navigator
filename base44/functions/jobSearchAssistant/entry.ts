import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId, batchId } = body;

    if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 });

    // ── Load all client context in parallel ──────────────────────────────────
    // For get_saved_recommendations we don't need the full client load
    if (action === 'get_saved_recommendations') {
      const recs = await base44.asServiceRole.entities.JobRecommendation.filter(
        { client_id: clientId }, '-created_date', 50
      );
      return Response.json({ success: true, data: recs });
    }

    // For update_recommendation_status we just need the recommendation
    if (action === 'update_recommendation_status') {
      const { recommendationId, status } = body;
      await base44.asServiceRole.entities.JobRecommendation.update(recommendationId, { status });
      return Response.json({ success: true });
    }

    const [client, assessments, documents, resumes, applications, notes, goals] = await Promise.all([
      base44.asServiceRole.entities.Client.get(clientId),
      base44.asServiceRole.entities.Assessment.filter({ client_id: clientId }),
      base44.asServiceRole.entities.Document.filter({ client_id: clientId }),
      base44.asServiceRole.entities.Resume.filter({ client_id: clientId }).catch(() => []),
      base44.asServiceRole.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 20),
      base44.asServiceRole.entities.SupportNote.filter({ client_id: clientId }, '-created_date', 15),
      base44.asServiceRole.entities.Goal.filter({ client_id: clientId }).catch(() => []),
    ]);

    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // ── Build rich assessment context ────────────────────────────────────────
    const assessmentContext = assessments.map(a => {
      const r = a.responses || {};
      const type = a.assessment_type.replace(/_/g, ' ').toUpperCase();
      const lines = Object.entries(r)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${v}`)
        .join('\n');
      return `[${type}]\n${lines}`;
    }).join('\n\n');

    const assessmentIds = assessments.map(a => a.id);

    // List of fields that are populated in the client record
    const clientFieldsUsed = [];
    const addField = (label, val) => { if (val) clientFieldsUsed.push(label); };
    addField('target_role', client.target_role);
    addField('industry', client.industry);
    addField('location', client.location);
    addField('notes', client.notes);
    addField('client_type', client.client_type);

    const clientContext = `
NAME: ${client.first_name} ${client.last_name}
CLIENT TYPE: ${client.client_type || 'N/A'}
STATUS: ${client.status}
LOCATION: ${client.location || 'Not specified'}
TARGET ROLE: ${client.target_role || 'Not specified'}
TARGET INDUSTRY: ${client.industry || 'Not specified'}
NOTES: ${client.notes || 'None'}
EMPLOYMENT START DATE: ${client.employment_start_date || 'N/A'}
`.trim();

    const goalsContext = goals.length
      ? goals.map(g => `- [${g.category}] ${g.title} (${g.status}): ${g.description || ''}`).join('\n')
      : 'No goals recorded';

    const notesContext = notes.length
      ? notes.map(n => `- [${n.date}] ${n.note_type}: ${n.title} — ${n.content}`).join('\n')
      : 'No support notes';

    const appsContext = applications.length
      ? applications.slice(0, 10).map(a => `- ${a.company} / ${a.position} (${a.status})`).join('\n')
      : 'No applications yet';

    // ── ACTION: generate_vocational_profile ──────────────────────────────────
    if (action === 'generate_vocational_profile') {
      const prompt = `You are an expert vocational rehabilitation counselor and job placement specialist. You work with adults with disabilities.

Based on the following client data, generate a thorough vocational profile summary that will be used to guide job search and recommendations.

=== CLIENT PROFILE ===
${clientContext}

=== ASSESSMENTS (${assessments.length} on file) ===
${assessmentContext || 'No formal assessments on file'}

=== EMPLOYMENT GOALS ===
${goalsContext}

=== SUPPORT NOTES ===
${notesContext}

=== PREVIOUS JOB APPLICATIONS ===
${appsContext}

Your task:
1. Synthesize all available information into a clear vocational profile
2. Identify the client's top strengths relevant to employment
3. Identify key barriers and support needs for employment
4. Determine realistic job targets based on the data
5. Note any work restrictions, schedule limits, or benefits considerations
6. List optimal work environment characteristics
7. Flag any missing information that would improve recommendations

Be supportive, strengths-based, and realistic. Do NOT make assumptions based on disability labels — only use documented strengths, needs, and preferences.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: '2-3 paragraph vocational profile summary' },
            strengths: { type: 'array', items: { type: 'string' } },
            barriers: { type: 'array', items: { type: 'string' } },
            support_needs: { type: 'array', items: { type: 'string' } },
            work_environment_preferences: { type: 'array', items: { type: 'string' } },
            suggested_job_targets: { type: 'array', items: { type: 'string' } },
            benefits_considerations: { type: 'string' },
            missing_information: { type: 'array', items: { type: 'string' } },
            recommended_search_terms: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      return Response.json({
        success: true,
        data: result,
        assessments_used: assessmentIds,
        client_fields_used: clientFieldsUsed
      });
    }

    // ── ACTION: find_jobs ──────────────────────────────────────────────────
    if (action === 'find_jobs') {
      const { profile, customInstructions } = body;

      const strengths = profile?.strengths?.join(', ') || 'See assessments';
      const barriers = profile?.barriers?.join(', ') || 'None documented';
      const searchTerms = profile?.recommended_search_terms || [];
      const jobTargets = profile?.suggested_job_targets || [client.target_role || 'general employment'];
      const supportNeeds = profile?.support_needs?.join(', ') || 'None documented';
      const envPrefs = profile?.work_environment_preferences?.join(', ') || 'Not specified';

      const prompt = `You are a specialized job placement assistant for adults with disabilities. You help employment specialists and vocational rehabilitation counselors find real, available job opportunities for their clients.

=== CLIENT VOCATIONAL PROFILE ===
Name: ${client.first_name} ${client.last_name}
Location: ${client.location || 'Not specified'}
Target Jobs: ${jobTargets.join(', ')}
Key Strengths: ${strengths}
Employment Barriers: ${barriers}
Support Needs: ${supportNeeds}
Work Environment Preferences: ${envPrefs}
Benefits Considerations: ${profile?.benefits_considerations || 'Unknown'}

=== ADDITIONAL INSTRUCTIONS FROM STAFF ===
${customInstructions || 'None'}

=== TASK ===
Search the internet right now for REAL, CURRENTLY AVAILABLE job postings that match this client's profile. Use job boards like Indeed, LinkedIn, Glassdoor, ZipRecruiter, and local employer career pages.

For each job found, provide:
1. The exact job title
2. Employer name
3. Location (city, state)
4. Pay rate / salary if listed
5. Schedule (full-time, part-time, hours)
6. Direct application URL (must be a real, working link)
7. Why this specific job matches THIS client's strengths, preferences, and needs
8. Any potential concerns or barriers this client may face in this role
9. Recommended accommodations or support strategies
10. A fit score from 0-100 based on how well it matches the client profile

IMPORTANT RULES:
- Only recommend jobs that genuinely match the client's profile
- Do NOT recommend jobs that conflict with documented barriers or restrictions
- Explain matches in simple, supportive language
- If you cannot find real current postings, provide example job titles + employer types with search guidance
- Aim for 5-8 diverse recommendations
- Prefer jobs with realistic accommodation options
- Consider transportation access: ${client.location || 'unknown location'}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_1_pro',
        response_json_schema: {
          type: 'object',
          properties: {
            search_summary: { type: 'string', description: 'Brief summary of search approach used' },
            search_terms_used: { type: 'array', items: { type: 'string' } },
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
                  concerns: { type: 'string' },
                  support_strategy: { type: 'string' },
                  fit_score: { type: 'number' }
                }
              }
            },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      return Response.json({
        success: true,
        data: result,
        assessments_used: assessmentIds,
        client_fields_used: clientFieldsUsed,
        search_terms: searchTerms
      });
    }

    // ── ACTION: save_recommendations ─────────────────────────────────────────
    if (action === 'save_recommendations') {
      const { jobs, assessmentsUsed, clientFieldsUsed: fields, searchTermsUsed } = body;
      const bId = `batch_${Date.now()}`;
      const saved = [];

      for (const job of (jobs || [])) {
        const rec = await base44.asServiceRole.entities.JobRecommendation.create({
          client_id: clientId,
          batch_id: bId,
          job_title: job.job_title,
          employer: job.employer,
          location: job.location || '',
          pay: job.pay || '',
          schedule: job.schedule || '',
          source_url: job.source_url || '',
          fit_reason: job.fit_reason || '',
          concerns: job.concerns || '',
          support_strategy: job.support_strategy || '',
          fit_score: job.fit_score || 0,
          status: 'suggested',
          generated_by: user.email,
          assessments_used: assessmentsUsed || [],
          client_fields_used: fields || [],
          search_terms_used: searchTermsUsed || [],
        });
        saved.push(rec);
      }

      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        activity_type: 'note_added',
        title: 'AI Job Recommendations Generated',
        description: `${saved.length} job recommendations generated by ${user.full_name || user.email} and saved to client record`
      });

      return Response.json({ success: true, saved_count: saved.length, batch_id: bId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('jobSearchAssistant error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});