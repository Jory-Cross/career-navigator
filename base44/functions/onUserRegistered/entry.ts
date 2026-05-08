import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when a new User record is created.
// Finds a matching PendingRoleAssignment by email and applies:
//   role, access_level, org_id, linked_client_id, manager_id
// Works even if the platform initially creates the user as role="user" (blank access_level).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data, event } = body;

    // Resolve the user — prefer payload data, fallback to entity fetch
    let user = data;
    if (!user?.email && event?.entity_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: event.entity_id });
      user = users?.[0];
    }

    if (!user?.email) {
      console.log('[onUserRegistered] No user email in payload, skipping.');
      return Response.json({ skipped: true });
    }

    const email = user.email.toLowerCase().trim();
    console.log(`[onUserRegistered] Processing: ${email} (current role=${user.role}, access_level=${user.access_level})`);

    // Find pending role assignment for this email
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email });
    const validPending = (pending || []).filter(p => p.status === 'pending');

    if (validPending.length === 0) {
      console.log(`[onUserRegistered] No pending assignment for ${email} — leaving role unchanged.`);
      return Response.json({
        skipped: true,
        message: 'No pending role assignment — user gets no elevated access.',
      });
    }

    // Use the most recent pending assignment
    const assignment = validPending.sort(
      (a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date)
    )[0];

    console.log(`[onUserRegistered] Applying: role=${assignment.role} access_level=${assignment.access_level} client_id=${assignment.client_id} to ${email}`);

    // Build the update payload — all fields must be explicit and non-null
    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level || null,
    };

    if (assignment.org_id) {
      updateData.org_id = assignment.org_id;
    }

    if (assignment.invited_by_id) {
      updateData.manager_id = assignment.invited_by_id;
    }

    if (assignment.client_id) {
      updateData.linked_client_id = assignment.client_id;
    }

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    console.log(`[onUserRegistered] Updated user ${email}:`, updateData);

    // Mark assignment as accepted (keep for audit trail)
    await base44.asServiceRole.entities.PendingRoleAssignment.update(assignment.id, {
      status: 'accepted',
    });

    return Response.json({
      success: true,
      email,
      applied: updateData,
    });
  } catch (error) {
    console.error('[onUserRegistered] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});