import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Triggered by entity automation when a new User record is created.
// Looks up any pending role assignment for their email and applies it immediately.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data, event } = body;

    // data may be null if payload_too_large; fetch manually
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

    await base44.asServiceRole.entities.User.update(user.id, { role: assignment.role });
    await base44.asServiceRole.entities.PendingRoleAssignment.delete(assignment.id);

    return Response.json({ success: true, email, role: assignment.role });
  } catch (error) {
    console.error('onUserRegistered error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});