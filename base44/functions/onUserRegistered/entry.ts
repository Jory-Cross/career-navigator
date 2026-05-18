import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when a new User record is created.
// Finds a matching VALID PendingRoleAssignment by email and applies:
//   role, access_level, org_id, linked_client_id, manager_id
//
// A "valid" assignment MUST have:
//   - role (non-empty)
//   - access_level (non-empty)
//   - org_id (non-empty)
//   - client_id (non-empty, for client/pre_ets/dspd roles)
//
// Incomplete assignments are ignored to prevent bad upgrades.

const CLIENT_ROLES = ['client', 'pre_ets', 'dspd'];

function isValidAssignment(assignment) {
  if (!assignment.role || !assignment.access_level || !assignment.org_id) {
    return false;
  }
  if (CLIENT_ROLES.includes(assignment.role) && !assignment.client_id) {
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data, event } = body;

    // Resolve the user — prefer payload data, fallback to entity fetch
    // (declared with let so we can reassign to canonical account if duplicate detected)
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

    // Duplicate account guard: if multiple User records share this email, skip the newer one
    const allUsersForEmail = await base44.asServiceRole.entities.User.filter({ email });
    if (allUsersForEmail.length > 1) {
      // Sort by created_date ascending — oldest is the canonical account
      const sorted = allUsersForEmail.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const canonical = sorted[0];
      if (canonical.id !== user.id) {
        console.warn(`[onUserRegistered] Duplicate account detected for ${email}. Canonical id=${canonical.id}, this id=${user.id}. Applying pending role to canonical account only.`);
        user = canonical;
      }
    }

    // Find all pending role assignments for this email
    const pending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email });
    const pendingOnly = (pending || []).filter(p => p.status === 'pending');

    // Filter to only VALID (complete) assignments
    const validPending = pendingOnly.filter(isValidAssignment);

    if (validPending.length === 0) {
      if (pendingOnly.length > 0) {
        console.warn(`[onUserRegistered] Found ${pendingOnly.length} pending assignment(s) for ${email} but all are incomplete. Skipping.`);
        pendingOnly.forEach(p => {
          console.warn(`  [invalid] id=${p.id} role=${p.role} access_level=${p.access_level} org_id=${p.org_id} client_id=${p.client_id}`);
        });
      } else {
        console.log(`[onUserRegistered] No pending assignment for ${email} — leaving role unchanged.`);
      }
      return Response.json({
        skipped: true,
        message: 'No valid pending role assignment — user gets no elevated access.',
      });
    }

    // Use the most recent VALID pending assignment
    const assignment = validPending.sort(
      (a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date)
    )[0];

    console.log(`[onUserRegistered] Applying: role=${assignment.role} access_level=${assignment.access_level} org_id=${assignment.org_id} client_id=${assignment.client_id} to ${email}`);

    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: assignment.org_id,
    };

    if (assignment.invited_by_id) {
      updateData.manager_id = assignment.invited_by_id;
    }

    if (assignment.client_id) {
      updateData.linked_client_id = assignment.client_id;
    }

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    console.log(`[onUserRegistered] Updated user ${email}:`, updateData);

    // If this is a staff role with a manager link, create/upsert ManagerEmployeeAssignment
    const staffRoles = ['employee', 'management'];
    if (staffRoles.includes(assignment.role) && assignment.invited_by_id) {
      try {
        const existingAssignment = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: assignment.invited_by_id,
          employee_user_id: user.id,
        });
        if (!existingAssignment || existingAssignment.length === 0) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
            org_id: assignment.org_id,
            manager_user_id: assignment.invited_by_id,
            employee_user_id: user.id,
            is_active: true,
          });
          console.log(`[onUserRegistered] Created ManagerEmployeeAssignment: manager=${assignment.invited_by_id} employee=${user.id}`);
        } else {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(existingAssignment[0].id, { is_active: true });
        }
      } catch (assignErr) {
        console.warn('[onUserRegistered] Could not create ManagerEmployeeAssignment:', assignErr.message);
      }
    }

    // Mark assignment as accepted — keep for audit trail, do NOT delete
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