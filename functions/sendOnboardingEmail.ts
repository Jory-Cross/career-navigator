import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, email_type } = await req.json();
    
    if (!client_id || !email_type) {
      return Response.json({ error: 'client_id and email_type required' }, { status: 400 });
    }

    const client = await base44.entities.Client.get(client_id);
    
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    let subject, body;
    
    if (email_type === 'welcome') {
      subject = `Welcome to Our Career Services - Let's Get Started!`;
      body = `Dear ${client.first_name},

Welcome! We're excited to partner with you on your career journey.

To get started, we'll need a few things:
- Your current resume (if available)
- Information about your career goals and target roles
- Any specific industries or companies you're interested in

Please reply to this email with any documents or information you can share, and we'll schedule your initial consultation.

Looking forward to working with you!

Best regards,
Your Career Team`;
    } else if (email_type === 'request_info') {
      subject = `Action Required: Complete Your Profile`;
      body = `Hi ${client.first_name},

To help us provide the best service, we need some additional information:

1. Your most recent resume
2. Target job titles and industries
3. Your LinkedIn profile (if available)
4. Any specific companies you're targeting

Please send these at your earliest convenience so we can move forward with your job search strategy.

Thank you!`;
    } else if (email_type === 'consultation_reminder') {
      subject = `Reminder: Schedule Your Initial Consultation`;
      body = `Hi ${client.first_name},

This is a friendly reminder to schedule your initial consultation with us.

During this session, we'll:
- Review your career goals
- Discuss your target roles and industries
- Create a personalized action plan
- Answer any questions you have

Please reply with your availability, and we'll get you scheduled.

Best regards!`;
    }

    await base44.integrations.Core.SendEmail({
      to: client.email,
      subject,
      body
    });

    return Response.json({ 
      success: true, 
      message: 'Email sent successfully' 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});