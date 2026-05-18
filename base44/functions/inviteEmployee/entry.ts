import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log(`[inviteEmployee] Authenticated user: ${user?.email} role=${user?.role}`);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json({ error: 'Forbidden: admin or management role required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role, manager_id: explicitManagerId } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = role || 'employee';
    const accessLevel = inviteRole === 'admin' ? 'admin' : 'staff';
    const now = new Date().toISOString();

    console.log(`[inviteEmployee] Normalized email: ${normalizedEmail}, inviteRole: ${inviteRole}, explicitManagerId: ${explicitManagerId || 'none'}`);

    // ── Resolve org_id ────────────────────────────────────────────────────
    let orgId = user.org_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      orgId = orgs[0]?.id || null;
    }

    // ── Resolve inviter's User record ─────────────────────────────────────
    // Use case-insensitive search: fetch all users and match by normalized email.
    // This is the critical fix: manager.email from auth.me() must match stored email.
    let inviterId = null;
    const allUsers = await base44.asServiceRole.entities.User.list();
    const inviterRecord = allUsers.find(u => u.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    if (inviterRecord) {
      inviterId = inviterRecord.id;
      console.log(`[inviteEmployee] Resolved inviter User record: id=${inviterId} email=${inviterRecord.email} role=${inviterRecord.role}`);
    } else {
      console.warn(`[inviteEmployee] WARNING: Could not find User record for authenticated user ${user.email}. manager_id will be null unless overridden.`);
    }

    // For managers: resolvedManagerId = their own id (inviterId).
    // For admins:   resolvedManagerId = explicitManagerId if provided, else their own id.
    const resolvedManagerId = explicitManagerId || inviterId;
    console.log(`[inviteEmployee] resolvedManagerId: ${resolvedManagerId}`);

    // ── Check if account already exists for this email ────────────────────
    const existingUser = allUsers.find(u => u.email?.toLowerCase().trim() === normalizedEmail);

    if (existingUser) {
      console.log(`[inviteEmployee] User already exists for ${normalizedEmail} (id=${existingUser.id}), updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: inviteRole,
        access_level: accessLevel,
        org_id: orgId,
        ...(resolvedManagerId ? { manager_id: resolvedManagerId } : {}),
      });

      if (resolvedManagerId) {
        const existingAssignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: resolvedManagerId,
          employee_user_id: existingUser.id,
        });
        if (!existingAssignments || existingAssignments.length === 0) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
            org_id: orgId,
            manager_user_id: resolvedManagerId,
            employee_user_id: existingUser.id,
            is_active: true,
          });
          console.log(`[inviteEmployee] Created ManagerEmployeeAssignment: manager=${resolvedManagerId} employee=${existingUser.id}`);
        } else {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(existingAssignments[0].id, { is_active: true });
          console.log(`[inviteEmployee] Reactivated ManagerEmployeeAssignment id=${existingAssignments[0].id}`);
        }
      }

      // Re-send the invite email so they can set their password
      try {
        const base44Role = inviteRole === 'admin' ? 'admin' : 'user';
        await base44.users.inviteUser(normalizedEmail, base44Role);
        console.log(`[inviteEmployee] Re-sent invite for existing user ${normalizedEmail}`);
      } catch (inviteErr) {
        console.warn(`[inviteEmployee] inviteUser for existing user failed (non-fatal): ${inviteErr.message}`);
      }

      return Response.json({ success: true, message: 'Existing account updated and invitation re-sent', linked_existing: true });
    }

    // ── Upsert PendingRoleAssignment ──────────────────────────────────────
    const existingPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const samePending = (existingPending || []).find(p =>
      p.status === 'pending' && p.role === inviteRole && p.access_level === accessLevel
    );

    if (samePending) {
      console.log(`[inviteEmployee] Updating existing PendingRoleAssignment ${samePending.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(samePending.id, {
        org_id: orgId,
        invited_by_id: resolvedManagerId,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
      });
    } else {
      const created = await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role: inviteRole,
        access_level: accessLevel,
        status: 'pending',
        invited_at: now,
        org_id: orgId,
        invited_by_id: resolvedManagerId,
        invited_by_name: user.full_name || user.email,
      });
      console.log(`[inviteEmployee] Created PendingRoleAssignment id=${created?.id} for ${normalizedEmail}, invited_by_id=${resolvedManagerId}`);
    }

    // ── Send the invitation ───────────────────────────────────────────────
    const base44Role = inviteRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(normalizedEmail, base44Role);
    console.log(`[inviteEmployee] inviteUser succeeded for ${normalizedEmail} as ${base44Role}`);

    return Response.json({ success: true, message: 'Invitation sent successfully' });

  } catch (error) {
    console.error('[inviteEmployee] Unhandled error:', error.message, error.stack);
    return Response.json({ error: error.message || 'Unexpected error', success: false }, { status: 500 });
  }
});