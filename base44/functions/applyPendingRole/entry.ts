import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by "Apply Role on Pending Assignment Created" entity automation,
// and also used as an admin bulk-repair utility.
//
// Only applies VALID assignments — those with role + access_level + org_id.
// Client-portal roles (client/pre_ets/dspd) also require client_id.
// Incomplete assignments are skipped and logged.
// Accepted assignments are kept for audit — never deleted.

const CLIENT_ROLES = ['client', 'pre_ets', 'dspd'];

function isValidAssignment(assignment) {
  if (!assignment.role || !assignment.access_level || !assignment.org_id) return false;
  if (CLIENT_ROLES.includes(assignment.role) && !assignment.client_id) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // List only pending assignments
    const allPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ status: 'pending' });
    if (!allPending || allPending.length === 0) {
      return Response.json({ skipped: true, message: 'No pending assignments' });
    }

    console.log(`[applyPendingRole] Found ${allPending.length} pending role assignments`);

    const results = [];
    const skipped = [];
    const invalid = [];

    for (const assignment of allPending) {
      // Skip incomplete/invalid assignments
      if (!isValidAssignment(assignment)) {
        console.warn(`[applyPendingRole] Skipping incomplete assignment id=${assignment.id} email=${assignment.email} role=${assignment.role} access_level=${assignment.access_level} org_id=${assignment.org_id} client_id=${assignment.client_id}`);
        invalid.push({ id: assignment.id, email: assignment.email, reason: 'missing required fields' });
        continue;
      }

      // Find the registered user by email
      const users = await base44.asServiceRole.entities.User.filter({ email: assignment.email });
      if (users.length === 0) {
        console.log(`[applyPendingRole] User not yet registered: ${assignment.email}`);
        skipped.push(assignment.email);
        continue;
      }

      const user = users[0];
      const updateData = {
        role: assignment.role,
        access_level: assignment.access_level,
        org_id: assignment.org_id,
      };
      if (assignment.invited_by_id) updateData.manager_id = assignment.invited_by_id;
      if (assignment.client_id) updateData.linked_client_id = assignment.client_id;

      console.log(`[applyPendingRole] Applying role='${assignment.role}' access_level='${assignment.access_level}' to ${user.email}`);
      await base44.asServiceRole.entities.User.update(user.id, updateData);

      // Mark as accepted — keep for audit, do NOT delete
      await base44.asServiceRole.entities.PendingRoleAssignment.update(assignment.id, { status: 'accepted' });

      results.push({ email: assignment.email, role: assignment.role, access_level: assignment.access_level });
    }

    return Response.json({ success: true, applied: results, skipped, invalid });
  } catch (error) {
    console.error('[applyPendingRole] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});