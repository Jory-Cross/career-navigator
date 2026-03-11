import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    // Get Outlook OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    // Send email via Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: body
          },
          toRecipients: [
            { emailAddress: { address: to } }
          ]
        },
        saveToSentItems: true
      })
    });

    if (!graphResponse.ok) {
      const errText = await graphResponse.text();
      throw new Error(`Graph API error: ${graphResponse.status} - ${errText}`);
    }

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
      message: 'Email sent successfully via Outlook'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});