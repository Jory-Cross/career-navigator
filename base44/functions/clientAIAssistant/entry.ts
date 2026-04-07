import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId } = body;

    // Load FULL client context via data-aware pattern
    const [client, assessments, timeEntries, applications, recommendations, tasks, goals, notes] = await Promise.all([
      base44.entities.Client.list().then(all => all.find(c => c.id === clientId)),
      base44.entities.Assessment.filter({ client_id: clientId }, "-created_date", 10),
      base44.entities.TimeEntry.filter({ client_id: clientId }, "-created_date", 30),
      base44.entities.JobApplication.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.JobRecommendation.filter({ client_id: clientId }, "-created_date", 15),
      base44.entities.Task.filter({ ...(Array.isArray(body.client_ids) ? { client_ids: clientId } : {}) }, "-created_date", 20),
      base44.entities.Goal.filter({ client_id: clientId }),
      base44.entities.SupportNote.filter({ client_id: clientId }, "-created_date", 15),
    ]);

    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Enrich time entries with structured field answers
    const enrichedTimeEntries = await Promise.all(
      timeEntries.map(async (te) => {
        const answer = await base44.entities.ReportFieldAnswer.filter({ time_entry_id: te.id }).then(a => a[0]);
        return { ...te, structured_answers: answer?.answers || {} };
      })
    );

    const clientTasks = tasks.filter(t => t.client_ids?.includes(clientId));

    // Build vocational context from assessments and extracted facts
    const vocationalContext = client.vocational_facts_profile
      ? `
VOCATIONAL FACTS (extracted from assessments):
${['skills', 'barriers', 'interests', 'preferred_tasks', 'schedule_availability', 'support_needs']
  .map(key => {
    const items = client.vocational_facts_profile[key] || [];
    if (!items.length) return null;
    return `${key.toUpperCase().replace(/_/g, ' ')}:\n${items.map(i => `  • ${i.fact || i} [${i.source || 'assessment'}]`).join('\n')}`;
  })
  .filter(Boolean)
  .join('\n\n')}`
      : 'No vocational facts extracted yet — run assessment preprocessing to enable data-driven recommendations.';

    const contextSummary = `
=== CLIENT PROFILE ===
Name: ${client.first_name} ${client.last_name}
Email: ${client.email}
Type: ${client.client_type}
Status: ${client.status}
Location: ${client.location || 'Not specified'}
Target Role: ${client.target_role || 'Not specified'}
Industry: ${client.industry || 'Not specified'}
Barriers: ${client.barriers?.join(', ') || 'Not documented'}

=== EMPLOYMENT GOALS ===
${goals.length > 0 ? goals.map(g => `• [${g.category}] ${g.title} (${g.status})`).join('\n') : 'No goals set'}

=== STRUCTURED TIME ENTRIES (${enrichedTimeEntries.length} total) ===
${enrichedTimeEntries.slice(0, 10).map(te => {
  const activity = Object.values(te.structured_answers).slice(0, 2).join(' | ');
  return `• ${te.date}: ${te.category} (${(te.duration_minutes / 60).toFixed(1)}h) - ${activity || 'logged'}`;
}).join('\n')}

=== VOCATIONAL CONTEXT (DATA-DRIVEN) ===
${vocationalContext}

=== JOB APPLICATIONS (${applications.length} total) ===
${applications.slice(0, 8).map(a => `• ${a.company} / ${a.position} — ${a.status} (${a.applied_date || 'N/A'})`).join('\n') || 'No applications'}

=== SAVED JOB RECOMMENDATIONS (${recommendations.length} total) ===
${recommendations.slice(0, 5).map(r => `• ${r.job_title} @ ${r.employer} (fit: ${r.fit_score}/100)`).join('\n') || 'No recommendations yet'}

=== SUPPORT NOTES ===
${notes.slice(0, 5).map(n => `• [${n.date}] ${n.note_type}: ${n.title}`).join('\n') || 'None'}

=== PENDING TASKS ===
${clientTasks.filter(t => t.status === 'pending').slice(0, 5).map(t => `• ${t.title} (due: ${t.due_date || 'no date'})`).join('\n') || 'All caught up!'}
    `.trim();

    let prompt = '';
    let responseSchema = null;

    if (action === 'summarize') {
      prompt = `You are a CRM AI assistant for an employment services organization. Based on the following client data, provide a concise, insightful summary of this client's situation, progress, and key highlights. Focus on what matters most for the employment specialist.

${contextSummary}

Provide a structured summary with:
1. Current situation overview (2-3 sentences)
2. Key progress highlights
3. Main challenges or concerns
4. Overall engagement level (High/Medium/Low) with brief reasoning

Keep it practical and actionable for a job coach.`;
      responseSchema = {
        type: "object",
        properties: {
          overview: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          concerns: { type: "array", items: { type: "string" } },
          engagement_level: { type: "string", enum: ["High", "Medium", "Low"] },
          engagement_reasoning: { type: "string" }
        }
      };
    } else if (action === 'suggest_tasks') {
      prompt = `You are a CRM AI assistant for an employment services organization. Based on the following client data, suggest 3-5 specific, actionable follow-up tasks or actions the employment specialist should take in the next 1-2 weeks.

${contextSummary}

Consider: pending applications needing follow-up, upcoming deadlines, gaps in support, or logical next steps in the job search process. Be specific and time-sensitive.`;
      responseSchema = {
        type: "object",
        properties: {
          suggested_tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                category: { type: "string" },
                suggested_due_in_days: { type: "number" }
              }
            }
          }
        }
      };
    } else if (action === 'draft_email') {
      const { emailPurpose, emailContext } = await req.json().catch(() => ({}));
      const purpose = emailPurpose || 'general check-in';
      prompt = `You are a CRM AI assistant for an employment services organization. Draft a professional, warm, and personalized email from the employment specialist to this client.

${contextSummary}

Email purpose: ${purpose}
Additional context: ${emailContext || 'None'}

Draft a professional email that:
- Sounds personalized and human, not generic
- References specific details from their profile/history when relevant
- Has a clear subject line
- Is concise (150-250 words max)
- Has a friendly but professional tone`;
      responseSchema = {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      };
    } else if (action === 'engagement_insights') {
      prompt = `You are a CRM AI assistant for an employment services organization. Analyze the engagement patterns for this client and provide insights to help the employment specialist better support them.

${contextSummary}

Provide insights on:
1. Activity frequency and consistency patterns
2. Response/engagement trends (improving, declining, steady)
3. Which types of support seem most effective
4. Risk signals or red flags (if any)
5. Recommendations to boost engagement`;
      responseSchema = {
        type: "object",
        properties: {
          activity_pattern: { type: "string" },
          trend: { type: "string", enum: ["Improving", "Declining", "Steady", "Inconsistent", "New Client"] },
          trend_detail: { type: "string" },
          effective_supports: { type: "array", items: { type: "string" } },
          risk_signals: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } }
        }
      };
    } else if (action === 'coaching_recommendations') {
      prompt = `You are an expert job coach. Based on this client's profile, assessments, time entries, and work history, provide specific coaching recommendations and job search strategy.

${contextSummary}

Provide:
1. Key coaching priorities for this client based on their barriers and goals
2. Specific job search strategy tailored to their vocational facts
3. Skill gaps to address before next interview
4. Support accommodations that would help them succeed
5. 3-5 specific job roles (titles + key reasons why they'd fit based on the data)`;
      responseSchema = {
        type: 'object',
        properties: {
          coaching_priorities: { type: 'array', items: { type: 'string' } },
          job_search_strategy: { type: 'string' },
          skill_gaps: { type: 'array', items: { type: 'string' } },
          recommended_accommodations: { type: 'array', items: { type: 'string' } },
          job_recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                job_title: { type: 'string' },
                why_fit: { type: 'string' },
                data_basis: { type: 'string', description: 'Which client data informed this recommendation' }
              }
            }
          },
          next_coaching_session_focus: { type: 'string' }
        }
      };
    } else if (action === 'save_coaching_plan') {
      const { coaching_priorities, job_search_strategy, recommended_accommodations, next_session_focus } = body;

      // Save as a structured client document/summary
      const doc = await base44.asServiceRole.entities.Document.create({
        client_id: clientId,
        title: `AI-Generated Coaching Plan - ${new Date().toLocaleDateString()}`,
        file_url: `data:text/plain;base64,${btoa(JSON.stringify({coaching_priorities, job_search_strategy, recommended_accommodations}, null, 2))}`,
        file_name: `coaching-plan-${clientId}.json`,
        category: 'reference',
        tags: ['ai-generated', 'coaching', 'plan'],
        notes: `Generated by AI assistant on ${new Date().toISOString()} by ${user.email}. Based on client vocational facts, assessments, and time entries.`
      });

      // Create task for next session focus
      if (next_session_focus) {
        await base44.asServiceRole.entities.Task.create({
          title: `Coaching Session: ${next_session_focus.substring(0, 50)}`,
          description: next_session_focus,
          status: 'pending',
          category: 'follow_up',
          priority: 'high',
          client_ids: [clientId],
          due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
        });
      }

      return Response.json({
        success: true,
        message: 'Coaching plan saved to Documents and task created',
        document_id: doc.id,
        data: { coaching_priorities, job_search_strategy, recommended_accommodations }
      });

    } else if (action === 'save_job_recommendations') {
      const { job_recommendations, data_basis } = body;
      const batchId = `batch_${Date.now()}`;
      const saved = [];

      for (const job of (job_recommendations || [])) {
        const rec = await base44.asServiceRole.entities.JobRecommendation.create({
          client_id: clientId,
          job_title: job.job_title,
          employer: job.employer || 'To be researched',
          fit_reason: job.why_fit,
          fit_score: 75,
          support_needs: job.recommended_accommodations || [],
          status: 'suggested',
          generated_by: user.email,
          batch_id: batchId,
          assessments_used: assessments.map(a => a.id),
          client_fields_used: ['vocational_facts_profile', 'barriers', 'goals']
        });
        saved.push(rec);
      }

      return Response.json({
        success: true,
        saved_count: saved.length,
        batch_id: batchId,
        data: saved
      });

    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema
    });

    return Response.json({ success: true, data: result, action });
  } catch (error) {
    console.error('clientAIAssistant error:', error);
    console.error('Error details:', error.data || error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});