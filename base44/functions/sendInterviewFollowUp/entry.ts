import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { applicationId, clientId, manual } = await req.json();

    if (!applicationId || !clientId) {
      return Response.json({ error: 'Missing applicationId or clientId' }, { status: 400 });
    }

    // Fetch application and client
    const [allApps, allClients] = await Promise.all([
      base44.asServiceRole.entities.JobApplication.filter({ client_id: clientId }),
      base44.asServiceRole.entities.Client.list()
    ]);

    const app = allApps.find(a => a.id === applicationId);
    const client = allClients.find(c => c.id === clientId);

    if (!app || !client) {
      return Response.json({ error: 'Application or client not found' }, { status: 404 });
    }

    // Determine follow-up type based on status
    const statusLabels = {
      phone_screen: 'phone screen',
      interview: 'interview',
      final_round: 'final round interview'
    };

    const interviewType = statusLabels[app.status] || 'interview';

    // Generate personalized follow-up email using AI
    const emailPrompt = `Draft a professional, warm thank-you follow-up email after a job ${interviewType}.

Candidate: ${client.first_name} ${client.last_name}
Position: ${app.position}
Company: ${app.company}
Contact Name: ${app.contact_name || 'Hiring Manager'}

Write a concise, genuine thank-you email (3 short paragraphs):
1. Express gratitude for the opportunity and mention the specific role
2. Reinforce interest and briefly highlight 1 key strength
3. Next steps / staying in touch

Keep it under 150 words. Professional but not robotic. Do not use placeholders in brackets.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: emailPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' }
        }
      }
    });

    // If there's a contact email, send it
    if (app.contact_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: app.contact_email,
        subject: result.subject,
        body: result.body,
        from_name: `${client.first_name} ${client.last_name}`
      });

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        activity_type: 'email_sent',
        title: `Follow-up email sent: ${app.position} at ${app.company}`,
        description: `Auto-sent ${manual ? 'manual' : 'automated'} follow-up after ${interviewType}. Sent to ${app.contact_email}.`,
        metadata: {
          related_entity_id: applicationId,
          related_entity_type: 'JobApplication'
        }
      });

      return Response.json({
        success: true,
        sent: true,
        to: app.contact_email,
        subject: result.subject,
        body: result.body
      });
    } else {
      // No contact email — save draft as a task note
      await base44.asServiceRole.entities.Task.create({
        client_ids: [clientId],
        title: `Send follow-up email: ${app.position} at ${app.company}`,
        description: `DRAFT SUBJECT: ${result.subject}\n\nDRAFT BODY:\n${result.body}`,
        category: 'follow_up',
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });

      return Response.json({
        success: true,
        sent: false,
        reason: 'No contact email — draft saved as task',
        subject: result.subject,
        body: result.body
      });
    }

  } catch (error) {
    console.error('sendInterviewFollowUp error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});