import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    const base44Role = inviteRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(email, base44Role);

    // Resolve the inviter's org_id
    let orgId = user.org_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      orgId = orgs[0]?.id || null;
    }

    // Resolve the inviter's actual User entity ID (for manager_id assignment)
    let inviterId = null;
    const inviterUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (inviterUsers?.[0]) {
      inviterId = inviterUsers[0].id;
    }

    // access_level for staff roles
    const accessLevel = inviteRole === 'admin' ? 'admin' : 'staff';

    // Store pending role + access_level + org_id so all are applied when they register
    await base44.asServiceRole.entities.PendingRoleAssignment.create({
      email,
      role: inviteRole,
      access_level: accessLevel,
      status: 'pending',
      invited_at: new Date().toISOString(),
      org_id: orgId,
      invited_by_id: inviterId,
      invited_by_name: user.full_name || user.email,
    });

    console.log(`Invited ${email} as ${inviteRole} for org ${orgId}, manager will be ${inviterId}`);
    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error inviting employee:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});