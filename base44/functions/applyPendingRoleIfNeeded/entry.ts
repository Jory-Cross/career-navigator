import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called on login for any authenticated user.
// If the user has role="user" or blank access_level AND a valid pending PendingRoleAssignment exists,
// upgrade their account. Safe to call repeatedly — no-ops if already upgraded.
//
// A "valid" assignment MUST have:
//   - role (non-empty)
//   - access_level (non-empty)
//   - org_id (non-empty)
//   - client_id (non-empty, required for client/pre_ets/dspd roles)
//
// Incomplete assignments (missing any of the above) are IGNORED to prevent bad upgrades.

const CLIENT_ROLES = ['client', 'pre_ets', 'dspd'];

function isValidAssignment(assignment) {
  if (!assignment.role || !assignment.access_level || !assignment.org_id) {
    return false;
  }
  // Client portal roles must also have a client_id
  if (CLIENT_ROLES.includes(assignment.role) && !assignment.client_id) {
    return false;
  }
  return true;
}

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

    // Block deactivated users — they must never be re-activated by an old invite
    if (user.is_active === false) {
      console.log(`[applyPendingRoleIfNeeded] ${email} is deactivated (is_active=false) — blocking upgrade.`);
      return Response.json({ upgraded: false, reason: 'deactivated' });
    }

    // Only attempt upgrade if the user is in a "default/blank" state
    const needsUpgrade = !currentRole || currentRole === 'user' || !currentAccess;
    if (!needsUpgrade) {
      console.log(`[applyPendingRoleIfNeeded] ${email} already has role=${currentRole} access=${currentAccess} — no upgrade needed.`);
      return Response.json({ upgraded: false, reason: 'already_assigned' });
    }

    console.log(`[applyPendingRoleIfNeeded] ── Invite upgrade check ──`);
    console.log(`[applyPendingRoleIfNeeded] Invited email: ${email} | current role=${currentRole} | access=${currentAccess}`);

    // Look up pending assignments case-insensitively.
    // Some invite records may have been saved with uppercase letters or extra spaces.
    const allAssignments = await base44.asServiceRole.entities.PendingRoleAssignment.list();
    const pending = (allAssignments || []).filter(p =>
      String(p.email || '').toLowerCase().trim() === email
    );

    const pendingOnly = pending.filter(p =>
      p.status === 'pending' || p.status === 'invite_email_sent' || p.status === 'pending_email_failed'
    );

    // Filter to only VALID assignments (complete records)
    const validPending = pendingOnly.filter(isValidAssignment);

    if (validPending.length === 0) {
      const invalidCount = pendingOnly.length;
      if (invalidCount > 0) {
        console.warn(`[applyPendingRoleIfNeeded] Found ${invalidCount} pending assignment(s) for ${email} but all are incomplete (missing access_level/org_id/client_id). Skipping upgrade.`);
        // Log the bad ones for debugging
        pendingOnly.forEach(p => {
          console.warn(`  [invalid] id=${p.id} role=${p.role} access_level=${p.access_level} org_id=${p.org_id} client_id=${p.client_id}`);
        });
      } else {
        console.log(`[applyPendingRoleIfNeeded] No pending assignment for ${email}.`);
      }
      return Response.json({ upgraded: false, reason: 'no_valid_pending_assignment' });
    }

    // Most recent VALID assignment wins
    const assignment = validPending.sort((a, b) => {
      const bTime = new Date(b.invited_at || b.created_date || 0).getTime();
      const aTime = new Date(a.invited_at || a.created_date || 0).getTime();
      return bTime - aTime;
    })[0];

    console.log(`[applyPendingRoleIfNeeded] Matching PendingRoleAssignment found: id=${assignment.id} role=${assignment.role} access_level=${assignment.access_level} org_id=${assignment.org_id} invited_by_id=${assignment.invited_by_id}`);
    console.log(`[applyPendingRoleIfNeeded] Applying role=${assignment.role} access_level=${assignment.access_level} to ${email}`);

    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: assignment.org_id,
      manager_id: assignment.invited_by_id || undefined,
      linked_client_id: assignment.client_id || undefined,
    };

    // Use the authenticated user's own ID directly — no need to filter by email
    // (base44.auth.me() already returned the correct user object with their id)
    const userId = user.id;
    if (!userId) {
      return Response.json({ error: 'Could not determine user ID from session' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(userId, updateData);
    console.log(`[applyPendingRoleIfNeeded] Updated user id=${userId} email=${email}:`, updateData);

    // Create ManagerEmployeeAssignment for staff roles with a manager link
    const staffRoles = ['employee', 'management'];
    if (staffRoles.includes(assignment.role) && assignment.invited_by_id) {
     try {
       const existing = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
         manager_user_id: assignment.invited_by_id,
         employee_user_id: userId,
       });
       if (!existing || existing.length === 0) {
         await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
           org_id: assignment.org_id,
           manager_user_id: assignment.invited_by_id,
           employee_user_id: userId,
           is_active: true,
         });
         console.log(`[applyPendingRoleIfNeeded] Created ManagerEmployeeAssignment manager=${assignment.invited_by_id} employee=${userId}`);
       } else {
         console.log(`[applyPendingRoleIfNeeded] ManagerEmployeeAssignment already exists, skipping.`);
       }
     } catch (assignErr) {
       console.warn('[applyPendingRoleIfNeeded] ManagerEmployeeAssignment error:', assignErr.message);
     }
    }
    // Create CETrainingCohortMember for CE students with a cohort assignment.
    // Cohort Detail displays active students as cohort_role === "member".
    if (assignment.role === 'ce_student' && assignment.cohort_id) {
     try {
       const existing = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
         cohort_id: assignment.cohort_id,
         user_id: userId,
       });

       if (!existing || existing.length === 0) {
         await base44.asServiceRole.entities.CETrainingCohortMember.create({
           org_id: assignment.org_id,
           cohort_id: assignment.cohort_id,
           user_id: userId,
           cohort_role: 'member',
           is_active: true,
           joined_at: new Date().toISOString(),
           added_by: assignment.invited_by_id,
         });
         console.log(`[applyPendingRoleIfNeeded] Created CETrainingCohortMember cohort=${assignment.cohort_id} user=${userId} role=member`);
       } else {
         const existingMembership = existing[0];

         if (existingMembership.cohort_role !== 'member' || existingMembership.is_active === false) {
           await base44.asServiceRole.entities.CETrainingCohortMember.update(existingMembership.id, {
             cohort_role: 'member',
             is_active: true,
             joined_at: existingMembership.joined_at || new Date().toISOString(),
             added_by: existingMembership.added_by || assignment.invited_by_id,
           });
           console.log(`[applyPendingRoleIfNeeded] Updated existing CETrainingCohortMember cohort=${assignment.cohort_id} user=${userId} role=member`);
         } else {
           console.log(`[applyPendingRoleIfNeeded] CETrainingCohortMember already exists as member, skipping.`);
         }
       }
     } catch (cohortErr) {
       console.warn('[applyPendingRoleIfNeeded] CETrainingCohortMember error:', cohortErr.message);
     }
    }
    // Mark the applied assignment as accepted — keep it for audit, do NOT delete
    await base44.asServiceRole.entities.PendingRoleAssignment.update(assignment.id, { status: 'accepted' });

    console.log(`[applyPendingRoleIfNeeded] ✓ User ${email} upgraded: role=${updateData.role} access_level=${updateData.access_level} org_id=${updateData.org_id}`);
    console.log(`[applyPendingRoleIfNeeded] ✓ PendingRoleAssignment ${assignment.id} marked accepted`);
    console.log(`[applyPendingRoleIfNeeded] ► Employee must sign out and back in for session claims to refresh`);

    return Response.json({ upgraded: true, applied: updateData });
  } catch (error) {
    console.error('[applyPendingRoleIfNeeded] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});