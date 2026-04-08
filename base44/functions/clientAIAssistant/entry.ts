import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 });

    // --- Handle save/persist actions first (no LLM needed) ---

    if (action === 'save_coaching_plan') {
      return await saveCoachingPlan(base44, user, clientId, body);
    }

    if (action === 'save_job_recommendations') {
      return await saveJobRecommendations(base44, user, clientId, body);
    }

    // --- Load structured client context (compact, targeted) ---
    const context = await loadClientContext(base44, clientId, action);
    if (!context.client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // --- Build action-specific prompt from structured context ---
    const { prompt, responseSchema } = buildPrompt(action, context, body);
    if (!prompt) return Response.json({ error: 'Unknown action' }, { status: 400 });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema
    });

    return Response.json({ success: true, data: result, action });

  } catch (error) {
    console.error('clientAIAssistant error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Context Loader ───────────────────────────────────────────────────────────
// Loads only what each action needs. Avoids fetching time entries for email drafts, etc.

async function loadClientContext(base44, clientId, action) {
  const needsApplications = ['summarize', 'suggest_tasks', 'coaching_recommendations', 'engagement_insights'].includes(action);
  const needsAssessments  = ['summarize', 'coaching_recommendations'].includes(action);
  const needsNotes        = ['summarize', 'suggest_tasks', 'engagement_insights'].includes(action);
  const needsGoals        = ['summarize', 'coaching_recommendations', 'suggest_tasks'].includes(action);
  const needsTimeEntries  = ['engagement_insights', 'coaching_recommendations'].includes(action);

  const fetches = {
    client:       base44.entities.Client.filter({ id: clientId }).then(r => r[0] || null),
    goals:        needsGoals        ? base44.entities.Goal.filter({ client_id: clientId }) : Promise.resolve([]),
    assessments:  needsAssessments  ? base44.entities.Assessment.filter({ client_id: clientId }, '-created_date', 5) : Promise.resolve([]),
    applications: needsApplications ? base44.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 10) : Promise.resolve([]),
    notes:        needsNotes        ? base44.entities.SupportNote.filter({ client_id: clientId }, '-created_date', 8) : Promise.resolve([]),
    timeEntries:  needsTimeEntries  ? base44.entities.TimeEntry.filter({ client_id: clientId }, '-date', 20) : Promise.resolve([]),
  };

  const [client, goals, assessments, applications, notes, timeEntries] = await Promise.all([
    fetches.client, fetches.goals, fetches.assessments,
    fetches.applications, fetches.notes, fetches.timeEntries
  ]);

  return { client, goals, assessments, applications, notes, timeEntries };
}

// ─── Grounding Payload Builders ───────────────────────────────────────────────
// Each builder returns only the fields the LLM actually needs — no raw text blobs.

function buildClientCore(client) {
  return {
    name: `${client.first_name} ${client.last_name}`,
    type: client.client_type,
    status: client.status,
    target_role: client.target_role || null,
    industry: client.industry || null,
    location: client.location || null,
  };
}

function buildVocationalFacts(client) {
  const vf = client.vocational_facts_profile;
  if (!vf) return null;
  const keys = ['skills', 'barriers', 'interests', 'preferred_tasks', 'schedule_availability', 'support_needs'];
  const result = {};
  keys.forEach(k => {
    const items = vf[k] || [];
    if (items.length) result[k] = items.map(i => i.fact || i).slice(0, 6);
  });
  return Object.keys(result).length ? result : null;
}

function buildGoalsSummary(goals) {
  return goals.map(g => ({ category: g.category, title: g.title, status: g.status }));
}

function buildApplicationsSummary(applications) {
  return applications.map(a => ({
    company: a.company,
    position: a.position,
    status: a.status,
    applied_date: a.applied_date || null
  }));
}

function buildNotesSummary(notes) {
  return notes.map(n => ({ date: n.date, type: n.note_type, title: n.title }));
}

function buildAssessmentsSummary(assessments) {
  return assessments.map(a => ({ type: a.assessment_type, completed_by: a.completed_by }));
}

function buildTimeEntrySummary(timeEntries) {
  const byType = {};
  timeEntries.forEach(te => {
    const k = te.entry_type_code || te.category || 'other';
    if (!byType[k]) byType[k] = { count: 0, total_hours: 0 };
    byType[k].count++;
    byType[k].total_hours += (te.duration_minutes || 0) / 60;
  });
  return {
    total_entries: timeEntries.length,
    recent_dates: timeEntries.slice(0, 5).map(te => te.date),
    by_type: Object.entries(byType).map(([type, s]) => ({
      type,
      count: s.count,
      total_hours: Math.round(s.total_hours * 10) / 10
    }))
  };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(action, context, body) {
  const { client, goals, assessments, applications, notes, timeEntries } = context;

  const clientCore       = buildClientCore(client);
  const vocationalFacts  = buildVocationalFacts(client);

  if (action === 'summarize') {
    const payload = {
      client: clientCore,
      vocational_facts: vocationalFacts,
      goals: buildGoalsSummary(goals),
      recent_applications: buildApplicationsSummary(applications).slice(0, 5),
      recent_notes: buildNotesSummary(notes).slice(0, 5),
      assessments_on_file: buildAssessmentsSummary(assessments)
    };
    return {
      prompt: `You are a CRM AI assistant for an employment services organization. Using the structured client data below, produce a concise situation summary for the employment specialist.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Return a structured summary covering:
1. Current situation (2-3 sentences)
2. Key progress highlights (from goals, applications)
3. Main concerns (from notes, missing data, stalled applications)
4. Engagement level (High/Medium/Low) with brief reasoning`,
      responseSchema: {
        type: "object",
        properties: {
          overview: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          concerns: { type: "array", items: { type: "string" } },
          engagement_level: { type: "string", enum: ["High", "Medium", "Low"] },
          engagement_reasoning: { type: "string" }
        }
      }
    };
  }

  if (action === 'suggest_tasks') {
    const payload = {
      client: clientCore,
      goals: buildGoalsSummary(goals),
      applications: buildApplicationsSummary(applications),
      notes: buildNotesSummary(notes)
    };
    return {
      prompt: `You are a CRM AI assistant for an employment services organization. Based on the structured client data below, suggest 3-5 specific, actionable follow-up tasks for the next 1-2 weeks.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Focus on: pending applications needing follow-up, stalled goals, gaps noted in support notes. Be specific.`,
      responseSchema: {
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
      }
    };
  }

  if (action === 'draft_email') {
    const { emailPurpose, emailContext: emailCtx } = body;
    const payload = {
      client: clientCore,
      recent_applications: buildApplicationsSummary(applications).slice(0, 3)
    };
    return {
      prompt: `You are a CRM AI assistant. Draft a professional, personalized email from an employment specialist to this client.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Email purpose: ${emailPurpose || 'general check-in'}
Additional context: ${emailCtx || 'none'}

Requirements: Sound human and personalized. Reference specific details. 150-250 words. Clear subject.`,
      responseSchema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      }
    };
  }

  if (action === 'engagement_insights') {
    const payload = {
      client: clientCore,
      time_entry_summary: buildTimeEntrySummary(timeEntries),
      recent_notes: buildNotesSummary(notes),
      application_statuses: buildApplicationsSummary(applications).map(a => a.status)
    };
    return {
      prompt: `You are a CRM AI assistant. Analyze engagement patterns for this client using structured data below.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Analyze: activity frequency, trends, what's working, risk signals, and recommendations to improve engagement.`,
      responseSchema: {
        type: "object",
        properties: {
          activity_pattern: { type: "string" },
          trend: { type: "string", enum: ["Improving", "Declining", "Steady", "Inconsistent", "New Client"] },
          trend_detail: { type: "string" },
          effective_supports: { type: "array", items: { type: "string" } },
          risk_signals: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } }
        }
      }
    };
  }

  if (action === 'coaching_recommendations') {
    const payload = {
      client: clientCore,
      vocational_facts: vocationalFacts,
      goals: buildGoalsSummary(goals),
      assessments_on_file: buildAssessmentsSummary(assessments),
      time_entry_summary: buildTimeEntrySummary(timeEntries)
    };
    return {
      prompt: `You are an expert job coach. Using the structured client data below, provide a targeted coaching plan.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Provide:
1. Coaching priorities (based on barriers, goals, support needs from vocational_facts)
2. Job search strategy tailored to their skills and interests
3. Skill gaps to address before next interview
4. Recommended accommodations
5. 3-5 specific job role recommendations with reasoning grounded in the data`,
      responseSchema: {
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
                data_basis: { type: 'string' }
              }
            }
          },
          next_coaching_session_focus: { type: 'string' }
        }
      }
    };
  }

  return { prompt: null, responseSchema: null };
}

// ─── Structured Save Actions ───────────────────────────────────────────────────

async function saveCoachingPlan(base44, user, clientId, body) {
  const { coaching_priorities, job_search_strategy, recommended_accommodations, skill_gaps, next_session_focus } = body;

  // Store as structured Goal records instead of a raw file blob
  const savedGoals = [];
  if (coaching_priorities?.length) {
    for (const priority of coaching_priorities.slice(0, 3)) {
      const g = await base44.asServiceRole.entities.Goal.create({
        client_id: clientId,
        title: priority,
        category: 'employment',
        status: 'in_progress',
        progress_notes: `AI coaching priority — ${new Date().toLocaleDateString()}`
      });
      savedGoals.push(g.id);
    }
  }

  // Save plan summary as a support note (searchable, structured)
  const planNote = await base44.asServiceRole.entities.SupportNote.create({
    client_id: clientId,
    note_type: 'progress_update',
    title: `AI Coaching Plan — ${new Date().toLocaleDateString()}`,
    content: [
      job_search_strategy ? `Job Search Strategy: ${job_search_strategy}` : null,
      skill_gaps?.length ? `Skill Gaps: ${skill_gaps.join(', ')}` : null,
      recommended_accommodations?.length ? `Accommodations: ${recommended_accommodations.join(', ')}` : null,
    ].filter(Boolean).join('\n\n'),
    date: new Date().toISOString().split('T')[0],
    follow_up_required: !!next_session_focus,
    follow_up_notes: next_session_focus || null
  });

  // Create a task for next session focus
  let taskId = null;
  if (next_session_focus) {
    const task = await base44.asServiceRole.entities.Task.create({
      title: `Coaching Session: ${next_session_focus.substring(0, 60)}`,
      description: next_session_focus,
      status: 'pending',
      category: 'follow_up',
      priority: 'high',
      client_ids: [clientId],
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    });
    taskId = task.id;
  }

  return Response.json({
    success: true,
    message: 'Coaching plan saved as goals, support note, and task',
    note_id: planNote.id,
    goal_ids: savedGoals,
    task_id: taskId
  });
}

async function saveJobRecommendations(base44, user, clientId, body) {
  const { job_recommendations } = body;
  const batchId = `batch_${Date.now()}`;
  const saved = [];

  for (const job of (job_recommendations || [])) {
    const rec = await base44.asServiceRole.entities.JobRecommendation.create({
      client_id: clientId,
      job_title: job.job_title,
      employer: job.employer || 'To be researched',
      fit_reason: job.why_fit,
      fit_score: 75,
      status: 'suggested',
      generated_by: user.email,
      batch_id: batchId,
      client_fields_used: ['vocational_facts_profile', 'goals']
    });
    saved.push(rec);
  }

  return Response.json({ success: true, saved_count: saved.length, batch_id: batchId, data: saved });
}