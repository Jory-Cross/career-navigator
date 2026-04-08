import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * agentContextGrounding
 * 
 * Loads structured client context for AI agents without embedding in user message.
 * Returns:
 * - grounding: structured summary of all available data
 * - sources: which data sources were used
 * - warnings: missing critical data
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return Response.json({ error: 'clientId required' }, { status: 400 });
    }

    // Load structured client context
    const context = await loadClientContext(base44, clientId);
    if (context.error) {
      return Response.json(context, { status: 404 });
    }

    // Build structured grounding
    const grounding = buildStructuredGrounding(context);
    const sources = identifyDataSources(context);
    const warnings = identifyDataGaps(context);

    return Response.json({
      success: true,
      grounding,
      sources,
      warnings,
      data_quality_score: calculateDataQuality(context)
    });

  } catch (error) {
    console.error('agentContextGrounding error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadClientContext(base44, clientId) {
  try {
    const [
      client,
      timeEntries,
      assessments,
      jobApplications,
      recommendations,
      tasks,
      goals,
      documents,
      activities,
      fieldAnswers
    ] = await Promise.all([
      base44.entities.Client.filter({ id: clientId }).then(r => r[0] || null),
      base44.entities.TimeEntry.filter({ client_id: clientId }, '-date', 50),
      base44.entities.Assessment.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.JobApplication.filter({ client_id: clientId }, '-created_date', 30),
      base44.entities.JobRecommendation.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.Task.list().then(all => all.filter(t => t.client_ids?.includes(clientId))),
      base44.entities.Goal.filter({ client_id: clientId }),
      base44.entities.Document.filter({ client_id: clientId }, '-created_date', 20),
      base44.entities.Activity.filter({ client_id: clientId }, '-created_date', 30),
      base44.entities.ReportFieldAnswer.list()
    ]);

    if (!client) {
      return { error: 'Client not found' };
    }

    // Enrich time entries with field answers
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
    console.error('Error loading context:', error);
    return { error: 'Failed to load client context' };
  }
}

// ─── Structured Grounding Builder ────────────────────────────────────────────

function buildStructuredGrounding(context) {
  const { client, timeEntries, assessments, jobApplications, goals, recommendations, tasks } = context;

  return {
    client_profile: {
      name: `${client.first_name} ${client.last_name}`,
      type: client.client_type,
      status: client.status,
      location: client.location || null,
      target_role: client.target_role || null,
      industry: client.industry || null,
      case_number: client.case_number || null
    },

    vocational_facts: client.vocational_facts_profile ? {
      extracted_at: client.vocational_facts_extracted_at,
      extracted_by: client.vocational_facts_extracted_by,
      document_count: client.vocational_facts_document_count || 0,
      assessment_count: client.vocational_facts_assessment_count || 0,
      quality_score: calculateVFPQuality(client.vocational_facts_profile),
      summary: extractTopFacts(client.vocational_facts_profile)
    } : null,

    activity_summary: {
      time_entries_total: timeEntries.length,
      time_entries_recent: timeEntries.slice(0, 5).map(te => ({
        date: te.date,
        type: te.entry_type_code,
        hours: (te.duration_minutes / 60).toFixed(1)
      })),
      total_hours: (timeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0) / 60).toFixed(1),
      assessments_completed: assessments.length,
      assessment_types: [...new Set(assessments.map(a => a.assessment_type))]
    },

    employment_progress: {
      goals_total: goals.length,
      goals_active: goals.filter(g => g.status !== 'discontinued').length,
      goals_achieved: goals.filter(g => g.status === 'achieved').length,
      applications_total: jobApplications.length,
      application_status: jobApplications.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      recommendations_total: recommendations.length,
      recommendations_by_status: recommendations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {})
    },

    pending_tasks: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      recent_pending: tasks.filter(t => t.status === 'pending').slice(0, 5).map(t => ({
        title: t.title,
        due_date: t.due_date,
        priority: t.priority
      }))
    }
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function extractTopFacts(vfp) {
  if (!vfp) return null;

  return {
    skills: (vfp.skills || []).slice(0, 4).map(s => s.fact || s),
    interests: (vfp.interests || []).slice(0, 3).map(i => i.fact || i),
    barriers: (vfp.barriers || []).slice(0, 3).map(b => b.fact || b),
    support_needs: (vfp.support_needs || []).slice(0, 3).map(s => s.fact || s),
    job_readiness: vfp.job_readiness_level?.[0]?.fact || vfp.job_readiness_level?.[0] || null
  };
}

function calculateVFPQuality(vfp) {
  if (!vfp) return 0;
  let score = 0;
  const categories = ['skills', 'interests', 'barriers', 'support_needs', 'work_environment_preferences', 'schedule_availability'];
  const filledCategories = categories.filter(cat => vfp[cat]?.length > 0).length;
  return Math.round((filledCategories / categories.length) * 100);
}

function identifyDataSources(context) {
  const sources = [];
  
  if (context.client?.vocational_facts_profile) sources.push('vocational_facts_profile');
  if (context.assessments?.length > 0) sources.push(`assessments (${context.assessments.length})`);
  if (context.timeEntries?.length > 0) sources.push(`time_entries (${context.timeEntries.length})`);
  if (context.jobApplications?.length > 0) sources.push(`job_applications (${context.jobApplications.length})`);
  if (context.recommendations?.length > 0) sources.push(`recommendations (${context.recommendations.length})`);
  if (context.goals?.length > 0) sources.push(`goals (${context.goals.length})`);
  if (context.tasks?.length > 0) sources.push(`tasks (${context.tasks.length})`);
  if (context.fieldAnswers?.length > 0) sources.push(`structured_field_answers (${context.fieldAnswers.length})`);
  if (context.documents?.length > 0) sources.push(`documents (${context.documents.length})`);
  if (context.activities?.length > 0) sources.push(`activities (${context.activities.length})`);

  return sources;
}

function identifyDataGaps(context) {
  const warnings = [];

  if (!context.client?.vocational_facts_profile) {
    warnings.push({
      type: 'critical',
      message: 'No vocational facts profile extracted — run "Extract Facts" in the client details for more grounded recommendations'
    });
  }

  if (!context.assessments || context.assessments.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'No assessments completed — assessment data would improve recommendations'
    });
  }

  if (!context.timeEntries || context.timeEntries.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'No time entries logged — work history would inform better recommendations'
    });
  }

  if (context.goals?.length === 0) {
    warnings.push({
      type: 'info',
      message: 'No employment goals recorded'
    });
  }

  if (context.jobApplications?.length === 0) {
    warnings.push({
      type: 'info',
      message: 'No job applications yet'
    });
  }

  return warnings;
}

function calculateDataQuality(context) {
  let score = 0;
  const maxScore = 100;

  // Vocational facts: 30 pts
  if (context.client?.vocational_facts_profile) score += 30;

  // Assessments: 20 pts
  if (context.assessments?.length > 0) score += Math.min(20, context.assessments.length * 5);

  // Time entries: 20 pts
  if (context.timeEntries?.length > 0) score += Math.min(20, context.timeEntries.length * 2);

  // Goals + applications: 15 pts
  if (context.goals?.length > 0) score += 7;
  if (context.jobApplications?.length > 0) score += 8;

  // Tasks + activities: 15 pts
  if (context.tasks?.length > 0) score += 7;
  if (context.activities?.length > 0) score += 8;

  return Math.min(score, maxScore);
}