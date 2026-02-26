import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, clientId } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send the email using Core integration
    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body
    });

    // Log activity if clientId is provided
    if (clientId) {
      await base44.entities.Activity.create({
        client_id: clientId,
        activity_type: 'email_sent',
        title: `Email sent: ${subject}`,
        description: `Email sent to ${to}`,
        metadata: {
          subject,
          recipient: to
        }
      });
    }

    return Response.json({ 
      success: true,
      message: 'Email sent successfully' 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});