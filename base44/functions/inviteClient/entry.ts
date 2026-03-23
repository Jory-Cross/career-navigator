import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, firstName, clientId, clientType } = await req.json();

    // Invite with role based on client type
    const role = clientType === 'pre_ets' ? 'pre_ets' : 'client';
    await base44.users.inviteUser(email, role);

    // Store the pending client invitation so we can update role after registration
    if (clientId) {
      await base44.entities.Client.update(clientId, { 
        onboarding_status: 'in_progress' 
      });
    }

    return Response.json({ 
      success: true,
      message: 'Invitation sent successfully' 
    });
  } catch (error) {
    console.error('Error inviting client:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});