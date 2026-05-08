import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when a new User record is created.
// 1. Finds matching PendingRoleAssignment by email
// 2. Applies role, access_level, org_id, linked_client_id, manager_id
// 3. Marks the PendingRoleAssignment as accepted (soft-keep for audit) or deletes it
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data, event } = body;

    let user = data;
    if (!user && event?.entity_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: event.entity_id });
      user = users?.[0];
    }

    if (!user?.email) {
      console.log('No user email found in payload, skipping.');
      return Response.json({ skipped: true });
    }

    const email = user.email;
    console.log(`New user registered: ${email}`);

    // Find pending role assignment
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email });
    if (!pending || pending.length === 0) {
      console.log(`No pending role assignment for ${email} — no access granted.`);
      return Response.json({ skipped: true, message: 'No pending role assignment — user gets no elevated access.' });
    }

    const assignment = pending[0];
    console.log(`Applying: role=${assignment.role} access_level=${assignment.access_level} to ${email}`);

    const updateData = { role: assignment.role };

    if (assignment.access_level) {
      updateData.access_level = assignment.access_level;
    }

    if (assignment.org_id) {
      updateData.org_id = assignment.org_id;
    }

    if (assignment.invited_by_id) {
      updateData.manager_id = assignment.invited_by_id;
    }

    // Link user to client record if this is a client portal invite
    if (assignment.client_id) {
      updateData.linked_client_id = assignment.client_id;
    }

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    console.log(`User ${email} updated:`, updateData);

    // Mark invitation as accepted (keep for audit trail)
    await base44.asServiceRole.entities.PendingRoleAssignment.update(assignment.id, {
      status: 'accepted',
    });

    return Response.json({
      success: true,
      email,
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: assignment.org_id,
      linked_client_id: assignment.client_id,
    });
  } catch (error) {
    console.error('onUserRegistered error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});