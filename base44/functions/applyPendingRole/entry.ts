import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all pending role assignments using service role (no user auth needed for scheduled tasks)
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.list();
    if (!pending || pending.length === 0) {
      return Response.json({ skipped: true, message: 'No pending assignments' });
    }

    console.log(`Found ${pending.length} pending role assignments`);

    const results = [];
    const skipped = [];

    for (const assignment of pending) {
      // Find the registered user by email
      const users = await base44.asServiceRole.entities.User.filter({ email: assignment.email });
      if (users.length === 0) {
        console.log(`User not yet registered: ${assignment.email}`);
        skipped.push(assignment.email);
        continue;
      }

      const user = users[0];
      const updateData = { role: assignment.role };
      if (assignment.org_id) updateData.org_id = assignment.org_id;
      if (assignment.invited_by_id) updateData.manager_id = assignment.invited_by_id;

      console.log(`Applying role '${assignment.role}' to ${user.email}`);
      await base44.asServiceRole.entities.User.update(user.id, updateData);
      await base44.asServiceRole.entities.PendingRoleAssignment.delete(assignment.id);
      results.push({ email: assignment.email, role: assignment.role });
    }

    return Response.json({ success: true, applied: results, skipped });
  } catch (error) {
    console.error('applyPendingRole error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});