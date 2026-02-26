import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, firstName } = await req.json();

    // Use service role to invite the user with 'client' role
    await base44.asServiceRole.users.inviteUser(email, 'client');

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