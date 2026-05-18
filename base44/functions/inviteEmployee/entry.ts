import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

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

    console.log(`[inviteEmployee] Caller: ${user.email} role=${user.role} | inviting: ${normalizedEmail} as ${inviteRole}`);

    // ── Resolve org_id ────────────────────────────────────────────────────
    let orgId = user.org_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      orgId = orgs[0]?.id || null;
    }

    // ── Resolve inviter's User record id ─────────────────────────────────
    const allUsers = await base44.asServiceRole.entities.User.list();
    const inviterRecord = allUsers.find(u => u.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    const inviterId = inviterRecord?.id || null;
    if (inviterId) {
      console.log(`[inviteEmployee] Resolved inviter id=${inviterId} email=${inviterRecord.email}`);
    } else {
      console.warn(`[inviteEmployee] WARNING: Could not find User record for inviter ${user.email}`);
    }

    // Managers become the overseeing manager automatically; admins can override
    const resolvedManagerId = explicitManagerId || inviterId;
    console.log(`[inviteEmployee] resolvedManagerId: ${resolvedManagerId}`);

    // ── Check if account already exists ───────────────────────────────────
    const existingUser = allUsers.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
    if (existingUser) {
      console.log(`[inviteEmployee] User already exists id=${existingUser.id}, updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: inviteRole,
        access_level: accessLevel,
        org_id: orgId,
        ...(resolvedManagerId ? { manager_id: resolvedManagerId } : {}),
      });
      if (resolvedManagerId) {
        const existing = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: resolvedManagerId,
          employee_user_id: existingUser.id,
        });
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
            org_id: orgId,
            manager_user_id: resolvedManagerId,
            employee_user_id: existingUser.id,
            is_active: true,
          });
        } else {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(existing[0].id, { is_active: true });
        }
      }
      return Response.json({ success: true, message: 'Existing account updated', linked_existing: true });
    }

    // ── Upsert PendingRoleAssignment ──────────────────────────────────────
    // This is the source of truth. onUserRegistered will apply role+manager when they sign up.
    const existingPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const samePending = (existingPending || []).find(p =>
      p.status === 'pending' && p.role === inviteRole && p.access_level === accessLevel
    );

    let pendingId;
    if (samePending) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(samePending.id, {
        org_id: orgId,
        invited_by_id: resolvedManagerId,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
      });
      pendingId = samePending.id;
      console.log(`[inviteEmployee] Updated existing PendingRoleAssignment id=${pendingId}`);
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
      pendingId = created?.id;
      console.log(`[inviteEmployee] Created PendingRoleAssignment id=${pendingId}`);
    }

    // ── Send the platform invite email ────────────────────────────────────
    // base44.auth.inviteUser() requires the CALLER to be an admin on the platform.
    // - Admin callers: this works directly.
    // - Manager callers: this returns 403 "Only admins can invite users to private apps".
    //   There is no service-role equivalent. Managers cannot send invite emails directly.
    //   The PendingRoleAssignment is saved — the employee can self-register at the app URL
    //   and will automatically receive their role via onUserRegistered.
    const base44Role = inviteRole === 'admin' ? 'admin' : 'user';

    if (user.role === 'admin') {
      // Admin path: inviteUser works with the admin's token
      await base44.auth.inviteUser(normalizedEmail, base44Role);
      console.log(`[inviteEmployee] inviteUser succeeded for ${normalizedEmail}`);
      return Response.json({ success: true, message: 'Invitation sent successfully', pending_id: pendingId });
    } else {
      // Manager path: platform restriction prevents sending invite email.
      // PendingRoleAssignment is saved — role will be applied on self-registration.
      console.log(`[inviteEmployee] Manager path: PendingRoleAssignment saved (id=${pendingId}). Email invite requires admin.`);
      return Response.json({
        success: false,
        pending_saved: true,
        pending_id: pendingId,
        error: `The invitation record for ${normalizedEmail} was saved. However, sending the invite email requires an admin account. Please ask your administrator to send the invite, or share the app link directly so ${normalizedEmail} can register — they will automatically receive ${inviteRole} access under your supervision.`,
      }, { status: 403 });
    }

  } catch (error) {
    console.error('[inviteEmployee] Unhandled error:', error.message, error.stack);
    return Response.json({ error: error.message || 'Unexpected error', success: false }, { status: 500 });
  }
});