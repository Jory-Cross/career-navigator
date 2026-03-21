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
    await base44.users.inviteUser(email, inviteRole);

    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error inviting employee:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});