import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    let user = data;

    if (!user?.email && event?.entity_id) {
      const users = await base44.asServiceRole.entities.User.filter({
        id: event.entity_id,
      });
      user = users?.[0];
    }

    if (!user?.email) {
      return Response.json({ skipped: true, reason: 'no_user_email' });
    }

    const email = String(user.email || '').toLowerCase().trim();

    const allUsersForEmail = await base44.asServiceRole.entities.User.filter({
      email,
    });

    if (allUsersForEmail.length > 1) {
      const sortedUsers = allUsersForEmail.sort((a, b) => {
        const aTime = new Date(a.created_date || 0).getTime();
        const bTime = new Date(b.created_date || 0).getTime();
        return aTime - bTime;
      });

      const canonicalUser = sortedUsers[0];

      if (canonicalUser?.id && canonicalUser.id !== user.id) {
        user = canonicalUser;
      }
    }

    const pendingAssignments = await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      email,
    });

    const validPending = (pendingAssignments || [])
      .filter((assignment) =>
        ['pending', 'invite_email_sent', 'pending_email_failed'].includes(
          assignment.status
        )
      )
      .filter(isValidAssignment);

    if (validPending.length === 0) {
      return Response.json({
        skipped: true,
        reason: 'no_valid_pending_assignment',
      });
    }

    const assignment = validPending.sort((a, b) => {
      const bTime = new Date(b.invited_at || b.created_date || 0).getTime();
      const aTime = new Date(a.invited_at || a.created_date || 0).getTime();
      return bTime - aTime;
    })[0];

    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: assignment.org_id,
      manager_id: assignment.invited_by_id || undefined,
      linked_client_id: assignment.client_id || undefined,
    };

    await base44.asServiceRole.entities.User.update(user.id, updateData);

    const staffRoles = ['employee', 'management'];

    if (staffRoles.includes(assignment.role) && assignment.invited_by_id) {
      try {
        const existingAssignment =
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
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
        } else {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
            existingAssignment[0].id,
            { is_active: true }
          );
        }
      } catch (assignErr) {
        console.warn(
          '[onUserRegistered] Could not create ManagerEmployeeAssignment:',
          assignErr.message
        );
      }
    }

    if (assignment.role === 'ce_student' && assignment.cohort_id) {
      try {
        const existingMembership =
          await base44.asServiceRole.entities.CETrainingCohortMember.filter({
            cohort_id: assignment.cohort_id,
            user_id: user.id,
          });

        if (!existingMembership || existingMembership.length === 0) {
          await base44.asServiceRole.entities.CETrainingCohortMember.create({
            org_id: assignment.org_id,
            cohort_id: assignment.cohort_id,
            user_id: user.id,
            cohort_role: 'member',
            is_active: true,
            joined_at: new Date().toISOString(),
            added_by: assignment.invited_by_id,
          });
        } else {
          await base44.asServiceRole.entities.CETrainingCohortMember.update(
            existingMembership[0].id,
            {
              cohort_role: 'member',
              is_active: true,
              joined_at:
                existingMembership[0].joined_at || new Date().toISOString(),
              added_by:
                existingMembership[0].added_by || assignment.invited_by_id,
            }
          );
        }
      } catch (cohortErr) {
        console.warn(
          '[onUserRegistered] Could not create CETrainingCohortMember:',
          cohortErr.message
        );
      }
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: 'accepted',
      }
    );

    return Response.json({
      success: true,
      email,
      applied: updateData,
    });
  } catch (error) {
    console.error('[onUserRegistered] Error:', error.message);

    return Response.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
});