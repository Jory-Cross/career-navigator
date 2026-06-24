import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CLIENT_ROLES = ['client', 'pre_ets', 'dspd'];

function normalizeEmail(value) {
  return String(value || '').toLowerCase().trim();
}

function isValidAssignment(assignment) {
  if (!assignment.role || !assignment.access_level || !assignment.org_id) {
    return false;
  }

  if (CLIENT_ROLES.includes(assignment.role) && !assignment.client_id) {
    return false;
  }

  return true;
}

function getMostRecentAssignment(assignments) {
  return assignments.sort((a, b) => {
    const bTime = new Date(b.invited_at || b.created_date || 0).getTime();
    const aTime = new Date(a.invited_at || a.created_date || 0).getTime();

    return bTime - aTime;
  })[0];
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
      return Response.json({
        skipped: true,
        reason: 'no_user_email',
      });
    }

    const email = normalizeEmail(user.email);

    const allUsers = await base44.asServiceRole.entities.User.list();

    const matchingUsers = (allUsers || []).filter(
      (candidate) => normalizeEmail(candidate.email) === email
    );

    if (matchingUsers.length > 1) {
      const sortedUsers = matchingUsers.sort((a, b) => {
        const aTime = new Date(a.created_date || 0).getTime();
        const bTime = new Date(b.created_date || 0).getTime();

        return aTime - bTime;
      });

      const canonicalUser =
        sortedUsers.find((candidate) => candidate.is_active !== false) ||
        sortedUsers[0];

      if (canonicalUser?.id) {
        user = canonicalUser;
      }
    }

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.list();

    const validPending = (pendingAssignments || [])
      .filter(
        (assignment) => normalizeEmail(assignment.email) === email
      )
      .filter((assignment) =>
        [
          'pending',
          'invite_email_sent',
          'pending_email_failed',
        ].includes(assignment.status)
      )
      .filter(isValidAssignment);

    if (validPending.length === 0) {
      return Response.json({
        skipped: true,
        reason: 'no_valid_pending_assignment',
      });
    }

    const assignment = getMostRecentAssignment(validPending);

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
          {
            is_active: true,
          }
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
      user_id: user.id,
      applied: updateData,
    });
  } catch (error) {
    console.error('[onUserRegistered] Error:', error.message);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
});