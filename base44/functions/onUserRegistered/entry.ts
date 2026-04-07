import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Triggered by entity automation when a new User record is created.
// 1. Applies any pending role assignment
// 2. Stamps the user's org_id based on their inviter's org
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
      console.log(`No pending role for ${email}`);
      return Response.json({ skipped: true, message: 'No pending role assignment' });
    }

    const assignment = pending[0];
    console.log(`Applying role '${assignment.role}' to ${email}`);

    const updateData = { role: assignment.role };

    // Stamp org_id from the pending assignment if present
    if (assignment.org_id) {
      updateData.org_id = assignment.org_id;
      console.log(`Stamping org_id ${assignment.org_id} on user ${email}`);
    }

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    await base44.asServiceRole.entities.PendingRoleAssignment.delete(assignment.id);

    return Response.json({ success: true, email, role: assignment.role, org_id: assignment.org_id });
  } catch (error) {
    console.error('onUserRegistered error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});