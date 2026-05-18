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

    // List all actionable assignments (pending, sent, or failed-email)
    const [p1, p2, p3] = await Promise.all([
      base44.asServiceRole.entities.PendingRoleAssignment.filter({ status: 'pending' }),
      base44.asServiceRole.entities.PendingRoleAssignment.filter({ status: 'invite_email_sent' }),
      base44.asServiceRole.entities.PendingRoleAssignment.filter({ status: 'pending_email_failed' }),
    ]);
    const allPending = [...(p1 || []), ...(p2 || []), ...(p3 || [])];
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

      // Create ManagerEmployeeAssignment for staff roles with a manager link
      const staffRoles = ['employee', 'management'];
      if (staffRoles.includes(assignment.role) && assignment.invited_by_id) {
        try {
          const existing = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
            manager_user_id: assignment.invited_by_id,
            employee_user_id: user.id,
          });
          if (!existing || existing.length === 0) {
            await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
              org_id: assignment.org_id,
              manager_user_id: assignment.invited_by_id,
              employee_user_id: user.id,
              is_active: true,
            });
            console.log(`[applyPendingRole] Created ManagerEmployeeAssignment manager=${assignment.invited_by_id} employee=${user.id}`);
          }
        } catch (err) {
          console.warn('[applyPendingRole] ManagerEmployeeAssignment error:', err.message);
        }
      }

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