import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * clientAIAssistant — AI-powered CRM coaching and recommendations
 *
 * Uses compact structured grounding to replace text-heavy context injection.
 * Loads data once, builds a structured context object, and reuses it across actions.
 *
 * Actions:
 *   - summarize: Client situation overview
 *   - suggest_tasks: Actionable follow-up tasks
 *   - draft_email: Personalized client communication
 *   - engagement_insights: Activity and trend analysis
 *   - coaching_recommendations: Coaching priorities and job matches
 *   - save_coaching_plan: Persist coaching plan as goals, notes, task
 *   - save_job_recommendations: Persist job matches as batch records
 */
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

    // --- Load and compile structured client context ---
    const context = await loadClientContext(base44, clientId);
    if (!context.client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // --- Build action-specific prompt from structured context ---
    const { prompt, responseSchema, dataSourcesUsed } = buildPrompt(action, context, body);
    if (!prompt) return Response.json({ error: 'Unknown action' }, { status: 400 });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema
    });

    return Response.json({
      success: true,
      data: result,
      action,
      metadata: {
        assessments_used: context.assessments.map(a => a.id),
        client_fields_used: ['first_name', 'last_name', 'target_role', 'industry', 'location', 'client_type'],
        data_sources_used: dataSourcesUsed,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('clientAIAssistant error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Context Loader ───────────────────────────────────────────────────────────
// Loads data once and builds a compact structured context object for all actions.
// Batch ReportFieldAnswer lookups to avoid N+1 queries.

async function loadClientContext(base44, clientId) {
  const [
    client,
    goals,
    assessments,
    applications,
    notes,
    timeEntries,
    jobRecommendations
  ] = await Promise.all([
    base44.entities.Client.filter({ id: clientId }).then(r => r[0] || null),
    base44.entities.Goal.filter({ client_id: clientId }),
    base44.entities.Assessment.filter({ client_id: clientId }, '-created_date', 10),
    base44.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 15),
    base44.entities.SupportNote.filter({ client_id: clientId }, '-created_date', 15),
    base44.entities.TimeEntry.filter({ client_id: clientId }, '-date', 30).catch(() => []),
    base44.entities.JobRecommendation.filter({ client_id: clientId }, '-created_date', 10).catch(() => [])
  ]);

  // Batch lookup ReportFieldAnswer records for recent time entries
  const recentEntryIds = timeEntries.slice(0, 15).map(e => e.id);
  const fieldAnswers = recentEntryIds.length > 0
    ? await base44.entities.ReportFieldAnswer.filter({ time_entry_id: { $in: recentEntryIds } }).catch(() => [])
    : [];

  return {
    client,
    goals,
    assessments,
    applications,
    notes,
    timeEntries,
    fieldAnswers,
    jobRecommendations
  };
}

// ─── Compact Structured Grounding Builders ────────────────────────────────────
// Summarize repeated data and extract key facts. Prioritize vocational_facts_profile.

function buildClientCore(client) {
  return {
    name: `${client.first_name} ${client.last_name}`,
    type: client.client_type,
    status: client.status,
    target_role: client.target_role || null,
    industry: client.industry || null,
    location: client.location || null
  };
}

function buildVocationalFactsGround(client) {
  const vf = client.vocational_facts_profile;
  if (!vf) return null;

  // Extract only the top facts per category (max 4-6 items each for brevity)
  return {
    skills: (vf.skills || []).slice(0, 5).map(s => s.fact || s),
    barriers: (vf.barriers || []).slice(0, 4).map(b => b.fact || b),
    interests: (vf.interests || []).slice(0, 4).map(i => i.fact || i),
    support_needs: (vf.support_needs || []).slice(0, 4).map(s => s.fact || s),
    schedule_availability: (vf.schedule_availability || []).slice(0, 3).map(s => s.fact || s),
    job_readiness_level: vf.job_readiness_level ? (vf.job_readiness_level[0]?.fact || vf.job_readiness_level[0]) : null,
    conflict_count: vf.conflicts?.length || 0
  };
}

function buildGoalsSummary(goals) {
  // Active goals first, then summarize by category
  const active = goals.filter(g => g.status !== 'discontinued').slice(0, 5);
  const byCat = {};
  active.forEach(g => {
    if (!byCat[g.category]) byCat[g.category] = [];
    byCat[g.category].push({ title: g.title, status: g.status });
  });
  return byCat;
}

function buildApplicationsSummary(applications) {
  // Show recent 5, grouped by status
  const recent = applications.slice(0, 5);
  const byStatus = {};
  recent.forEach(a => {
    if (!byStatus[a.status]) byStatus[a.status] = [];
    byStatus[a.status].push(a.company);
  });
  return { count: applications.length, by_status: byStatus };
}

function buildNotesSummary(notes) {
  // Summarize recent notes by type
  const recent = notes.slice(0, 8);
  const byType = {};
  recent.forEach(n => {
    if (!byType[n.note_type]) byType[n.note_type] = [];
    byType[n.note_type].push(n.title);
  });
  return { recent_count: recent.length, total_count: notes.length, by_type: byType };
}

function buildAssessmentsSummary(assessments) {
  // Show assessment types completed, not full responses
  const types = {};
  assessments.forEach(a => {
    if (!types[a.assessment_type]) types[a.assessment_type] = 0;
    types[a.assessment_type]++;
  });
  return types;
}

function buildTimeEntrySummary(timeEntries, fieldAnswers = []) {
  // Summarize entry stats and recent activity
  const byType = {};
  timeEntries.forEach(te => {
    const k = te.entry_type_code || te.category || 'other';
    if (!byType[k]) byType[k] = { count: 0, total_hours: 0, entries: [] };
    byType[k].count++;
    byType[k].total_hours += (te.duration_minutes || 0) / 60;
    byType[k].entries.push(te.date);
  });

  const summary = {};
  Object.entries(byType).forEach(([type, data]) => {
    summary[type] = {
      count: data.count,
      total_hours: Math.round(data.total_hours * 10) / 10,
      recent_dates: data.entries.slice(0, 3)
    };
  });

  return {
    total_entries: timeEntries.length,
    entry_types: summary,
    has_field_answers: fieldAnswers.length > 0,
    completed_field_answers: fieldAnswers.filter(f => f.required_fields_complete).length
  };
}

function buildRecommendationsSummary(recommendations) {
  // Show recent recommendations and their status
  if (recommendations.length === 0) return null;
  
  const recent = recommendations.slice(0, 5);
  const byStatus = {};
  recent.forEach(r => {
    if (!byStatus[r.status]) byStatus[r.status] = [];
    byStatus[r.status].push(r.job_title);
  });

  return {
    total_count: recommendations.length,
    recent_by_status: byStatus,
    requires_review: recommendations.filter(r => r.requires_staff_review).length
  };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────
// Builds action-specific prompts using compact structured context.
// Returns { prompt, responseSchema, dataSourcesUsed } for full traceability.

function buildPrompt(action, context, body) {
  const {
    client,
    goals,
    assessments,
    applications,
    notes,
    timeEntries,
    fieldAnswers,
    jobRecommendations
  } = context;

  const clientCore = buildClientCore(client);
  const vocFacts = buildVocationalFactsGround(client);
  const dataSourcesUsed = [];

  // Helper to track which sources were actually included
  const trackSource = (source, hasData) => {
    if (hasData) dataSourcesUsed.push(source);
  };

  trackSource('vocational_facts_profile', vocFacts);
  trackSource('assessments', assessments.length > 0);
  trackSource('goals', goals.length > 0);
  trackSource('support_notes', notes.length > 0);
  trackSource('job_applications', applications.length > 0);
  trackSource('time_entries', timeEntries.length > 0);

  if (action === 'summarize') {
    const payload = {
      client: clientCore,
      vocational_facts: vocFacts,
      goals_by_category: buildGoalsSummary(goals),
      applications_by_status: buildApplicationsSummary(applications),
      notes_by_type: buildNotesSummary(notes),
      assessments_completed: buildAssessmentsSummary(assessments)
    };
    return {
      prompt: `You are a CRM AI assistant. Using the structured client data below, produce a brief situation summary.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Cover: (1) current situation, (2) progress highlights, (3) main concerns, (4) engagement level.`,
      responseSchema: {
        type: 'object',
        properties: {
          overview: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
          concerns: { type: 'array', items: { type: 'string' } },
          engagement_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          engagement_reasoning: { type: 'string' }
        }
      },
      dataSourcesUsed
    };
  }

  if (action === 'suggest_tasks') {
    const payload = {
      client: clientCore,
      goals_by_category: buildGoalsSummary(goals),
      applications_summary: buildApplicationsSummary(applications),
      recent_notes: buildNotesSummary(notes)
    };
    return {
      prompt: `You are a CRM AI assistant. Based on the data below, suggest 3-5 specific actionable follow-up tasks for the next 1-2 weeks.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Focus on: pending applications, stalled goals, support gaps.`,
      responseSchema: {
        type: 'object',
        properties: {
          suggested_tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                category: { type: 'string' },
                suggested_due_in_days: { type: 'number' }
              }
            }
          }
        }
      },
      dataSourcesUsed
    };
  }

  if (action === 'draft_email') {
    const { emailPurpose, emailContext: emailCtx } = body;
    const payload = {
      client: clientCore,
      recent_applications: buildApplicationsSummary(applications)
    };
    return {
      prompt: `Draft a professional, personalized email from an employment specialist to this client.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Purpose: ${emailPurpose || 'general check-in'}
Context: ${emailCtx || 'none'}

Requirements: Personal, specific, 150-250 words, clear subject.`,
      responseSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' }
        }
      },
      dataSourcesUsed
    };
  }

  if (action === 'engagement_insights') {
    const payload = {
      client: clientCore,
      time_entry_summary: buildTimeEntrySummary(timeEntries, fieldAnswers),
      notes_summary: buildNotesSummary(notes),
      applications_summary: buildApplicationsSummary(applications)
    };
    return {
      prompt: `Analyze engagement patterns for this client.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Analyze: activity frequency, trends, what works, risk signals, recommendations.`,
      responseSchema: {
        type: 'object',
        properties: {
          activity_pattern: { type: 'string' },
          trend: { type: 'string', enum: ['Improving', 'Declining', 'Steady', 'Inconsistent', 'New Client'] },
          trend_detail: { type: 'string' },
          effective_supports: { type: 'array', items: { type: 'string' } },
          risk_signals: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      dataSourcesUsed
    };
  }

  if (action === 'coaching_recommendations') {
    const payload = {
      client: clientCore,
      vocational_facts: vocFacts,
      goals_by_category: buildGoalsSummary(goals),
      assessments_completed: buildAssessmentsSummary(assessments),
      time_entry_summary: buildTimeEntrySummary(timeEntries, fieldAnswers),
      previous_recommendations: buildRecommendationsSummary(jobRecommendations)
    };
    return {
      prompt: `You are an expert job coach. Using the structured client data, provide a targeted coaching plan.

CLIENT DATA:
${JSON.stringify(payload, null, 2)}

Provide: (1) coaching priorities, (2) job search strategy, (3) skill gaps, (4) recommended accommodations, (5) 3-5 job role recommendations grounded in the data.`,
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
      },
      dataSourcesUsed
    };
  }

  return { prompt: null, responseSchema: null };
}

// ─── Structured Save Actions ───────────────────────────────────────────────────

async function saveCoachingPlan(base44, user, clientId, body) {
  const {
    coaching_priorities,
    job_search_strategy,
    recommended_accommodations,
    skill_gaps,
    next_session_focus,
    assessments_used = [],
    client_fields_used = [],
    data_sources_used = []
  } = body;

  const savedAt = new Date().toISOString();
  const savedGoals = [];

  // Store as structured Goal records instead of a raw file blob
  if (coaching_priorities?.length) {
    for (const priority of coaching_priorities.slice(0, 3)) {
      const g = await base44.asServiceRole.entities.Goal.create({
        client_id: clientId,
        title: priority,
        category: 'employment',
        status: 'in_progress',
        progress_notes: `AI coaching priority (${new Date().toLocaleDateString()}) — grounded in: ${data_sources_used.join(', ')}`
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
      data_sources_used.length > 0 ? `\nGenerated using: ${data_sources_used.join(', ')}` : null
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

  // Log the plan creation with metadata
  await base44.asServiceRole.entities.Activity.create({
    client_id: clientId,
    activity_type: 'note_added',
    title: `AI Coaching Plan Created — ${coaching_priorities?.length || 0} priorities`,
    description: `${coaching_priorities?.length || 0} coaching priorities generated by ${user.email}. Data sources: ${data_sources_used.join(', ')}`,
    metadata: {
      created_at: savedAt,
      created_by: user.email,
      assessments_used: assessments_used,
      client_fields_used: client_fields_used,
      data_sources_used: data_sources_used,
      goal_ids: savedGoals,
      note_id: planNote.id,
      task_id: taskId
    }
  });

  return Response.json({
    success: true,
    message: 'Coaching plan saved as goals, support note, and task',
    note_id: planNote.id,
    goal_ids: savedGoals,
    task_id: taskId,
    metadata: {
      assessments_used: assessments_used,
      client_fields_used: client_fields_used,
      data_sources_used: data_sources_used
    }
  });
}

async function saveJobRecommendations(base44, user, clientId, body) {
  const {
    job_recommendations,
    source_search_batch_id,
    assessments_used = [],
    client_fields_used = [],
    search_terms_used = [],
    data_sources_used = []
  } = body;

  if (!job_recommendations || job_recommendations.length === 0) {
    return Response.json({ error: 'No job recommendations to save' }, { status: 400 });
  }

  const batchId = source_search_batch_id || `batch_${Date.now()}`;
  const savedAt = new Date().toISOString();
  const saved = [];

  for (const job of job_recommendations) {
    const fitReason = job.data_basis ? `${job.why_fit}\n\nData basis: ${job.data_basis}` : job.why_fit;

    const rec = await base44.asServiceRole.entities.JobRecommendation.create({
      client_id: clientId,
      batch_id: batchId,
      job_title: job.job_title,
      employer: job.employer || 'To be researched',
      location: job.location || '',
      pay: job.pay || '',
      schedule: job.schedule || '',
      source_url: job.source_url || '',
      fit_reason: fitReason,
      fit_score: job.fit_score || 75,
      status: 'suggested',
      generated_by_ai: true,
      generated_by: user.email,
      reviewed_by_staff: false,
      assessments_used: assessments_used,
      client_fields_used: client_fields_used,
      search_terms_used: search_terms_used
    });
    saved.push(rec);
  }

  // Audit log with full metadata
  await base44.asServiceRole.entities.Activity.create({
    client_id: clientId,
    activity_type: 'note_added',
    title: `AI Coaching Job Recommendations — ${saved.length} jobs`,
    description: `${saved.length} AI-generated job recommendations from ${user.full_name || user.email}. Data sources: ${data_sources_used.join(', ')}.`
  });

  return Response.json({
    success: true,
    saved_count: saved.length,
    batch_id: batchId,
    metadata: {
      assessments_used,
      client_fields_used,
      search_terms_used,
      data_sources_used,
      timestamp: savedAt
    }
  });
}