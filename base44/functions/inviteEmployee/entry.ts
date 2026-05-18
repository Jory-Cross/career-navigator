import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Normalize email to prevent duplicate accounts
    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = role || 'employee';
    const accessLevel = inviteRole === 'admin' ? 'admin' : 'staff';
    const now = new Date().toISOString();

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

    // Check if a User account already exists for this email — if so, update in place
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      console.log(`[inviteEmployee] User already exists for ${normalizedEmail} (id=${existingUser.id}), updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: inviteRole,
        access_level: accessLevel,
        org_id: orgId,
        manager_id: inviterId,
      });
      return Response.json({ success: true, message: 'Existing account updated with new role', linked_existing: true });
    }

    // Upsert PendingRoleAssignment — avoid duplicate pending entries for same email+role
    const existingPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const samePending = (existingPending || []).find(p =>
      p.status === 'pending' && p.role === inviteRole && p.access_level === accessLevel
    );

    if (samePending) {
      console.log(`[inviteEmployee] Updating existing pending assignment ${samePending.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(samePending.id, {
        org_id: orgId,
        invited_by_id: inviterId,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
      });
    } else {
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role: inviteRole,
        access_level: accessLevel,
        status: 'pending',
        invited_at: now,
        org_id: orgId,
        invited_by_id: inviterId,
        invited_by_name: user.full_name || user.email,
      });
    }

    const base44Role = inviteRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(normalizedEmail, base44Role);

    console.log(`[inviteEmployee] Invited ${normalizedEmail} as ${inviteRole} for org ${orgId}, manager will be ${inviterId}`);
    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('[inviteEmployee] Error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});