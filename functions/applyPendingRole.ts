import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const newUser = payload.data;
    if (!newUser?.email) {
      return Response.json({ skipped: true });
    }

    // Look for a pending role assignment for this email
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: newUser.email });
    if (!pending || pending.length === 0) {
      console.log(`No pending role for ${newUser.email}`);
      return Response.json({ skipped: true });
    }

    const assignment = pending[0];
    console.log(`Applying role '${assignment.role}' to ${newUser.email}`);

    // Update the user's role
    await base44.asServiceRole.entities.User.update(newUser.id, { role: assignment.role });

    // Clean up the pending assignment
    await base44.asServiceRole.entities.PendingRoleAssignment.delete(assignment.id);

    return Response.json({ success: true, role: assignment.role });
  } catch (error) {
    console.error('applyPendingRole error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});