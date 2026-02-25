import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, email_type, context } = await req.json();
    
    if (!client_id || !email_type) {
      return Response.json({ error: 'client_id and email_type required' }, { status: 400 });
    }

    const client = await base44.entities.Client.get(client_id);
    
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get recent activities
    const applications = await base44.entities.JobApplication.filter({ client_id });
    const recentApps = applications.slice(0, 3);
    const tasks = await base44.entities.Task.filter({});
    const clientTasks = tasks.filter(t => t.client_ids?.includes(client_id));
    const meetings = await base44.entities.Meeting.filter({ client_id });

    let prompt = '';
    
    if (email_type === 'follow_up') {
      prompt = `Generate a professional follow-up email for a career consulting client.

Client: ${client.first_name} ${client.last_name}
Target Role: ${client.target_role || 'Not specified'}
Status: ${client.status}

Recent Activities:
- Applications: ${recentApps.length} active applications
${recentApps.map(a => `  • ${a.position} at ${a.company} (${a.status})`).join('\n')}
- Pending tasks: ${clientTasks.filter(t => t.status !== 'completed').length}

Context: ${context || 'General check-in'}

Generate a warm, professional email that:
1. Checks in on their progress
2. References specific applications
3. Offers help with next steps
4. Maintains an encouraging tone`;
    } else if (email_type === 'meeting_confirmation') {
      const upcomingMeeting = meetings.sort((a, b) => 
        new Date(a.start_datetime) - new Date(b.start_datetime)
      )[0];
      
      prompt = `Generate a meeting confirmation email.

Client: ${client.first_name} ${client.last_name}
Meeting: ${upcomingMeeting?.title || context?.meeting_title || 'Career consultation'}
Date/Time: ${upcomingMeeting?.start_datetime || context?.datetime || 'TBD'}
Location: ${upcomingMeeting?.location || context?.location || 'TBD'}

Generate a professional confirmation email that:
1. Confirms the meeting details
2. Mentions what will be covered
3. Asks them to confirm attendance
4. Provides contact info for rescheduling`;
    } else if (email_type === 'progress_update') {
      prompt = `Generate a progress update email for a client.

Client: ${client.first_name} ${client.last_name}
Onboarding Status: ${client.onboarding_status}
Target Role: ${client.target_role || 'Not specified'}

Progress Summary:
- Total applications: ${applications.length}
- Applications by status:
${applications.reduce((acc, app) => {
  acc[app.status] = (acc[app.status] || 0) + 1;
  return acc;
}, {})}
- Completed tasks: ${clientTasks.filter(t => t.status === 'completed').length}/${clientTasks.length}

Generate an encouraging progress update email that:
1. Highlights their achievements
2. Shows specific metrics
3. Suggests next steps
4. Maintains motivation`;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      }
    });

    return Response.json({ 
      success: true,
      subject: result.subject,
      body: result.body,
      client_email: client.email
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});