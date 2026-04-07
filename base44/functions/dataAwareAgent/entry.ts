import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Data-Aware AI Agent
 * Enforces client data usage for all AI responses
 * - No generic recommendations without data
 * - All outputs stored to JobRecommendation or ClientDocument
 * - Full context loaded before any LLM call
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) {
      return Response.json({ error: 'clientId required' }, { status: 400 });
    }

    // ===== STEP 1: Load full client context =====
    const clientContext = await loadClientContext(base44, clientId);
    if (clientContext.error) {
      return Response.json(clientContext, { status: 404 });
    }

    const {
      client,
      timeEntries,
      fieldAnswers,
      assessments,
      jobApplications,
      recommendations,
      tasks,
      goals,
      documents,
      activities
    } = clientContext;

    // ===== STEP 2: Validate sufficient data exists =====
    const dataValidation = validateSufficientData(clientContext);
    if (!dataValidation.isValid && !body.force) {
      return Response.json({
        error: 'Insufficient data',
        message: dataValidation.message,
        gaps: dataValidation.gaps
      }, { status: 422 });
    }

    // ===== STEP 3: Build context string =====
    const contextStr = buildContextString(clientContext);

    // ===== STEP 4: Generate response based on action =====
    let result;
    if (action === 'job_recommendations') {
      result = await generateJobRecommendations(base44, user, clientId, clientContext, contextStr, body);
    } else if (action === 'progress_summary') {
      result = await generateProgressSummary(base44, user, clientId, clientContext, contextStr, body);
    } else if (action === 'service_suggestions') {
      result = await generateServiceSuggestions(base44, user, clientId, clientContext, contextStr, body);
    } else if (action === 'coaching_plan') {
      result = await generateCoachingPlan(base44, user, clientId, clientContext, contextStr, body);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('dataAwareAgent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ===== DATA LOADING =====

async function loadClientContext(base44, clientId) {
  try {
    const [client, timeEntries, assessments, jobApplications, recommendations, tasks, goals, documents, activities, fieldAnswers] = await Promise.all([
      base44.entities.Client.list().then(all => all.find(c => c.id === clientId)),
      base44.entities.TimeEntry.filter({ client_id: clientId }, '-created_date', 50),
      base44.entities.Assessment.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 30),
      base44.entities.JobRecommendation.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.Task.list().then(all => all.filter(t => t.client_ids?.includes(clientId))),
      base44.entities.Goal.filter({ client_id: clientId }),
      base44.entities.Document.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.Activity.filter({ client_id: clientId }, '-created_date', 30),
      base44.entities.ReportFieldAnswer.list() // Load all, then filter by time_entry_id
    ]);

    if (!client) {
      return { error: 'Client not found' };
    }

    // Enrich time entries with structured field answers
    const enrichedTimeEntries = await Promise.all(
      timeEntries.map(async (te) => {
        const answer = fieldAnswers.find(a => a.time_entry_id === te.id);
        return { ...te, structured_answers: answer?.answers || {} };
      })
    );

    return {
      client,
      timeEntries: enrichedTimeEntries,
      fieldAnswers,
      assessments,
      jobApplications,
      recommendations,
      tasks,
      goals,
      documents,
      activities
    };
  } catch (error) {
    console.error('Error loading client context:', error);
    return { error: 'Failed to load client context' };
  }
}

// ===== DATA VALIDATION =====

function validateSufficientData(context) {
  const gaps = [];

  if (!context.client) gaps.push('Client profile missing');
  if (!context.timeEntries || context.timeEntries.length === 0) gaps.push('No time entries logged');
  if (!context.assessments || context.assessments.length === 0) gaps.push('No assessments completed');
  if (!context.fieldAnswers || context.fieldAnswers.length === 0) gaps.push('No structured report answers');

  return {
    isValid: gaps.length === 0,
    gaps,
    message: gaps.length > 0 ? `Insufficient data: ${gaps.join('; ')}` : 'Data validation passed'
  };
}

// ===== CONTEXT BUILDING =====

function buildContextString(context) {
  const { client, timeEntries, assessments, jobApplications, recommendations, tasks, goals } = context;

  const assessmentSummary = assessments
    .slice(0, 5)
    .map(a => {
      const keys = Object.keys(a.responses || {}).slice(0, 3);
      return `• ${a.assessment_type}: ${keys.join(', ')}`;
    })
    .join('\n');

  const timeEntrySummary = timeEntries
    .slice(0, 10)
    .map(te => {
      const answers = Object.entries(te.structured_answers || {}).slice(0, 2);
      const answerStr = answers.map(([k, v]) => `${k}=${v}`).join(' | ');
      return `• ${te.date}: ${te.category} (${(te.duration_minutes / 60).toFixed(1)}h)${answerStr ? ` - ${answerStr}` : ''}`;
    })
    .join('\n');

  return `
=== CLIENT PROFILE ===
Name: ${client.first_name} ${client.last_name}
Type: ${client.client_type}
Status: ${client.status}
Location: ${client.location || 'Not specified'}
Target Role: ${client.target_role || 'Not specified'}
Industry: ${client.industry || 'Not specified'}

=== VOCATIONAL FACTS ===
${client.vocational_facts_profile ? Object.entries(client.vocational_facts_profile).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`).join('\n') : 'No vocational facts extracted'}

=== ASSESSMENTS (${assessments.length} completed) ===
${assessmentSummary || 'No assessments'}

=== TIME ENTRIES (${timeEntries.length} total) ===
${timeEntrySummary || 'No entries'}

=== STRUCTURED REPORT DATA ===
${context.fieldAnswers.length > 0 ? `${context.fieldAnswers.length} structured report answers recorded` : 'No structured reports'}

=== EMPLOYMENT GOALS (${goals.length} total) ===
${goals.map(g => `• ${g.title} (${g.category}) - ${g.status}`).join('\n') || 'No goals'}

=== JOB APPLICATIONS (${jobApplications.length} total) ===
${jobApplications.slice(0, 5).map(a => `• ${a.company} / ${a.position} - ${a.status}`).join('\n') || 'No applications'}

=== PENDING TASKS (${tasks.filter(t => t.status === 'pending').length} of ${tasks.length}) ===
${tasks.filter(t => t.status === 'pending').slice(0, 5).map(t => `• ${t.title} (due: ${t.due_date || 'N/A'})`).join('\n') || 'All caught up'}
  `.trim();
}

// ===== ACTION: JOB RECOMMENDATIONS =====

async function generateJobRecommendations(base44, user, clientId, context, contextStr, body) {
  const { client, assessments, timeEntries, goals } = context;

  const prompt = `You are an expert vocational counselor. Using ONLY the following client data, generate 5-7 specific job recommendations that match this client's vocational profile, assessments, work history, and goals.

${contextStr}

For each recommendation, provide:
1. Job title (specific, market-relevant)
2. Why this role fits (reference specific data: skills, interests, barriers, work history, goals)
3. Data basis (which client data informed this)
4. Required support or accommodations

CRITICAL: Every recommendation MUST be justified by specific data above. Do not make generic suggestions.`;

  const schema = {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            job_title: { type: 'string' },
            employer_type: { type: 'string', description: 'Type/industry of employer' },
            why_fit: { type: 'string', description: 'Specific reasons based on client data' },
            data_basis: { type: 'string', description: 'Which data points informed this' },
            support_needs: { type: 'array', items: { type: 'string' } },
            fit_score: { type: 'number', description: '0-100' }
          }
        }
      },
      reasoning: { type: 'string', description: 'Overall strategy based on profile' }
    }
  };

  const llmResult = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: schema
  });

  // Save to JobRecommendation table
  const batchId = `batch_${Date.now()}`;
  const saved = [];

  for (const rec of (llmResult.recommendations || [])) {
    const saved_rec = await base44.asServiceRole.entities.JobRecommendation.create({
      client_id: clientId,
      job_title: rec.job_title,
      employer: rec.employer_type,
      fit_reason: rec.why_fit,
      fit_score: rec.fit_score || 75,
      support_strategy: rec.support_needs?.join('; ') || '',
      status: 'suggested',
      generated_by: user.email,
      batch_id: batchId,
      assessments_used: assessments.map(a => a.id),
      client_fields_used: [
        'vocational_facts_profile',
        'target_role',
        'industry',
        'goals'
      ]
    });
    saved.push(saved_rec);
  }

  return {
    success: true,
    action: 'job_recommendations',
    recommendations: saved,
    batch_id: batchId,
    reasoning: llmResult.reasoning
  };
}

// ===== ACTION: PROGRESS SUMMARY =====

async function generateProgressSummary(base44, user, clientId, context, contextStr, body) {
  const { client, timeEntries, activities } = context;

  const prompt = `You are a vocational rehabilitation counselor. Analyze this client's progress data and provide a comprehensive summary.

${contextStr}

Provide:
1. Current situation snapshot (2-3 sentences)
2. Progress in last 30 days (specific data-driven)
3. Key achievements or wins
4. Barriers or blockers
5. Engagement level assessment (High/Medium/Low)
6. Recommended next steps`;

  const schema = {
    type: 'object',
    properties: {
      situation_snapshot: { type: 'string' },
      recent_progress: { type: 'array', items: { type: 'string' } },
      achievements: { type: 'array', items: { type: 'string' } },
      barriers: { type: 'array', items: { type: 'string' } },
      engagement_level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
      next_steps: { type: 'array', items: { type: 'string' } }
    }
  };

  const llmResult = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: schema
  });

  // Save summary as document
  const doc = await base44.asServiceRole.entities.Document.create({
    client_id: clientId,
    title: `Progress Summary - ${new Date().toLocaleDateString()}`,
    file_url: `data:text/plain;base64,${btoa(JSON.stringify(llmResult, null, 2))}`,
    file_name: `progress-summary-${clientId}-${Date.now()}.json`,
    category: 'reference',
    tags: ['ai-generated', 'summary', 'progress'],
    notes: `Generated by AI on ${new Date().toISOString()} based on time entries (${timeEntries.length}), activities (${context.activities?.length || 0}), and assessments.`
  });

  return {
    success: true,
    action: 'progress_summary',
    document_id: doc.id,
    data: llmResult
  };
}

// ===== ACTION: SERVICE SUGGESTIONS =====

async function generateServiceSuggestions(base44, user, clientId, context, contextStr, body) {
  const { client, timeEntries, tasks, recommendations } = context;

  const prompt = `You are a vocational rehabilitation supervisor. Based on this client's data, what additional services or support would accelerate their progress?

${contextStr}

Consider:
- Gaps in current services (compare time entries to typical needs)
- Skill development needs based on goals and assessments
- Barriers that require additional support
- Next logical step in job search/retention

Suggest 3-5 specific services with justification from the data.`;

  const schema = {
    type: 'object',
    properties: {
      suggested_services: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            service_type: { type: 'string' },
            description: { type: 'string' },
            justification: { type: 'string', description: 'Why based on client data' },
            urgency: { type: 'string', enum: ['Immediate', 'Soon', 'Ongoing'] },
            expected_outcome: { type: 'string' }
          }
        }
      },
      overall_strategy: { type: 'string' }
    }
  };

  const llmResult = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: schema
  });

  // Create tasks for suggested services
  const createdTasks = [];
  for (const service of (llmResult.suggested_services || [])) {
    const task = await base44.asServiceRole.entities.Task.create({
      title: `Service: ${service.service_type}`,
      description: `${service.description}\n\nJustification: ${service.justification}\nExpected: ${service.expected_outcome}`,
      status: 'pending',
      category: 'follow_up',
      priority: service.urgency === 'Immediate' ? 'high' : 'medium',
      client_ids: [clientId],
      due_date: new Date(Date.now() + (service.urgency === 'Immediate' ? 3 : 7) * 86400000).toISOString().split('T')[0]
    });
    createdTasks.push(task);
  }

  return {
    success: true,
    action: 'service_suggestions',
    suggested_services: llmResult.suggested_services,
    created_tasks: createdTasks,
    overall_strategy: llmResult.overall_strategy
  };
}

// ===== ACTION: COACHING PLAN =====

async function generateCoachingPlan(base44, user, clientId, context, contextStr, body) {
  const { client, assessments, goals, timeEntries } = context;

  const prompt = `You are a master job coach. Design a detailed 4-week coaching plan for this client based on their data.

${contextStr}

Provide:
1. Week-by-week focus areas
2. Specific coaching goals (with success criteria)
3. Skills to develop or reinforce
4. Barriers to address
5. Job search strategy tailored to their profile
6. Accountability milestones`;

  const schema = {
    type: 'object',
    properties: {
      week_1_focus: { type: 'string' },
      week_2_focus: { type: 'string' },
      week_3_focus: { type: 'string' },
      week_4_focus: { type: 'string' },
      coaching_goals: { type: 'array', items: { type: 'string' } },
      skills_to_develop: { type: 'array', items: { type: 'string' } },
      job_search_strategy: { type: 'string' },
      barrier_mitigation: { type: 'object', additionalProperties: { type: 'string' } },
      success_metrics: { type: 'array', items: { type: 'string' } }
    }
  };

  const llmResult = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: schema
  });

  // Save plan as document
  const doc = await base44.asServiceRole.entities.Document.create({
    client_id: clientId,
    title: `4-Week Coaching Plan - ${new Date().toLocaleDateString()}`,
    file_url: `data:text/plain;base64,${btoa(JSON.stringify(llmResult, null, 2))}`,
    file_name: `coaching-plan-${clientId}-${Date.now()}.json`,
    category: 'reference',
    tags: ['ai-generated', 'coaching', 'plan'],
    notes: `Generated by ${user.email} on ${new Date().toISOString()}. Based on ${timeEntries.length} time entries, ${assessments.length} assessments, and ${goals.length} goals.`
  });

  // Create week-by-week tasks
  const startDate = new Date();
  const tasks = [];
  for (let week = 1; week <= 4; week++) {
    const weekStart = new Date(startDate.getTime() + (week - 1) * 7 * 86400000);
    const task = await base44.asServiceRole.entities.Task.create({
      title: `Coaching Week ${week}: ${['Focus', 'Focus', 'Focus', 'Focus'][week - 1]}`,
      description: llmResult[`week_${week}_focus`],
      status: 'pending',
      category: 'follow_up',
      priority: week === 1 ? 'high' : 'medium',
      client_ids: [clientId],
      due_date: weekStart.toISOString().split('T')[0]
    });
    tasks.push(task);
  }

  return {
    success: true,
    action: 'coaching_plan',
    document_id: doc.id,
    plan_data: llmResult,
    created_tasks: tasks
  };
}