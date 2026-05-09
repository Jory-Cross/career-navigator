import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called on login for any authenticated user.
// If the user has role="user" or blank access_level AND a pending PendingRoleAssignment exists,
// upgrade their account. Safe to call repeatedly — no-ops if already upgraded.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email.toLowerCase().trim();
    const currentRole = user.role;
    const currentAccess = user.access_level;

    // Only attempt upgrade if the user is in a "default/blank" state
    const needsUpgrade = !currentRole || currentRole === 'user' || !currentAccess;
    if (!needsUpgrade) {
      console.log(`[applyPendingRoleIfNeeded] ${email} already has role=${currentRole} access=${currentAccess} — no upgrade needed.`);
      return Response.json({ upgraded: false, reason: 'already_assigned' });
    }

    console.log(`[applyPendingRoleIfNeeded] Checking pending assignments for ${email} (role=${currentRole}, access=${currentAccess})`);

    // Look up pending assignments
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email });
    const validPending = (pending || []).filter(p => p.status === 'pending');

    if (validPending.length === 0) {
      console.log(`[applyPendingRoleIfNeeded] No pending assignment for ${email}.`);
      return Response.json({ upgraded: false, reason: 'no_pending_assignment' });
    }

    // Most recent assignment wins
    const assignment = validPending.sort(
      (a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date)
    )[0];

    console.log(`[applyPendingRoleIfNeeded] Applying: role=${assignment.role} access_level=${assignment.access_level} to ${email}`);

    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level || null,
    };

    if (assignment.org_id) updateData.org_id = assignment.org_id;
    if (assignment.invited_by_id) updateData.manager_id = assignment.invited_by_id;
    if (assignment.client_id) updateData.linked_client_id = assignment.client_id;

    // Find the user record by email to get their id for the update
    const users = await base44.asServiceRole.entities.User.filter({ email });
    const userRecord = users?.[0];
    if (!userRecord) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(userRecord.id, updateData);
    console.log(`[applyPendingRoleIfNeeded] Updated ${email}:`, updateData);

    await base44.asServiceRole.entities.PendingRoleAssignment.update(assignment.id, { status: 'accepted' });

    return Response.json({ upgraded: true, applied: updateData });
  } catch (error) {
    console.error('[applyPendingRoleIfNeeded] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});