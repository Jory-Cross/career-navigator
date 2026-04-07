import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, clientId } = await req.json();

    // Gather client context
    const [clients, activities, tasks, applications, meetings, timeEntries, notes] = await Promise.all([
      base44.entities.Client.list(),
      base44.entities.Activity.filter({ client_id: clientId }, "-created_date", 30),
      base44.entities.Task.list(),
      base44.entities.JobApplication.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.Meeting.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.TimeEntry.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.SupportNote.filter({ client_id: clientId }, "-created_date", 20),
    ]);

    const client = clients.find(c => c.id === clientId);
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const clientTasks = tasks.filter(t => t.client_ids?.includes(clientId));

    const contextSummary = `
CLIENT PROFILE:
Name: ${client.first_name} ${client.last_name}
Email: ${client.email}
Type: ${client.client_type}
Status: ${client.status}
Target Role: ${client.target_role || 'Not specified'}
Industry: ${client.industry || 'Not specified'}
Location: ${client.location || 'Not specified'}
Notes: ${client.notes || 'None'}
Onboarding: ${client.onboarding_status}

RECENT ACTIVITIES (last 30):
${activities.slice(0, 15).map(a => `- [${new Date(a.created_date).toLocaleDateString()}] ${a.title}: ${a.description || ''}`).join('\n') || 'None'}

SUPPORT NOTES:
${notes.slice(0, 10).map(n => `- [${n.date}] ${n.note_type}: ${n.title} — ${n.content}`).join('\n') || 'None'}

JOB APPLICATIONS (${applications.length} total):
${applications.slice(0, 8).map(a => `- ${a.company} / ${a.position} — Status: ${a.status} (applied: ${a.applied_date || 'N/A'})`).join('\n') || 'None'}

TASKS (${clientTasks.length} total, ${clientTasks.filter(t => t.status === 'pending').length} pending):
${clientTasks.slice(0, 8).map(t => `- [${t.status}] ${t.title} (due: ${t.due_date || 'no date'}, priority: ${t.priority})`).join('\n') || 'None'}

MEETINGS (${meetings.length} total):
${meetings.slice(0, 8).map(m => `- ${m.title} — ${m.meeting_type} on ${m.start_datetime ? new Date(m.start_datetime).toLocaleDateString() : 'N/A'} (${m.status})`).join('\n') || 'None'}

TIME LOGGED: ${timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)} minutes total across ${timeEntries.length} sessions
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});