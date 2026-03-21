import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const inviteRole = role || 'employee';
    // Base44 only accepts 'user' or 'admin' for inviteUser
    // We invite as 'user' and the autoAssignClientRole function handles setting the real role
    // We store the intended role in a temp way by using 'admin' only for admin role
    const base44Role = inviteRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(email, base44Role);
    
    // If a non-admin role is intended, we need to update the user's role after they register
    // For now, store a pending role assignment - handled by the autoAssignClientRole automation

    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error inviting employee:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});