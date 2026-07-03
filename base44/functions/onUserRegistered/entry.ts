import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CLIENT_ROLES = [
  "client",
  "pre_ets",
  "dspd",
  "pre_ets_employer",
];
const OPEN_PENDING_ASSIGNMENT_STATUSES = [
  "pending",
  "invite_email_sent",
  "pending_email_failed",
];

const SETTLED_CE_REGISTRATION_STATUSES = new Set([
  "paid",
  "waived",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidAssignment(assignment) {
  const role = normalizeText(assignment?.role);
  const accessLevel = normalizeText(assignment?.access_level);
  const orgId = normalizeText(assignment?.org_id);
  const clientId = normalizeText(assignment?.client_id);

  if (!role || !accessLevel || !orgId) {
    return false;
  }

  if (CLIENT_ROLES.includes(role) && !clientId) {
    return false;
  }

  if (
    role === "pre_ets_employer" &&
    accessLevel !== "pre_ets_employer_portal"
  ) {
    return false;
  }

  return true;
}

function getMostRecentAssignment(assignments) {
  return [...assignments].sort((a, b) => {
    const bTime = new Date(
      b.invited_at || b.created_date || 0
    ).getTime();

    const aTime = new Date(
      a.invited_at || a.created_date || 0
    ).getTime();

    return bTime - aTime;
  })[0];
}

async function getSettledCeStudentRegistration({
  base44,
  assignment,
  user,
  email,
}) {
  const cohortId = normalizeText(assignment?.cohort_id);
  const orgId = normalizeText(assignment?.org_id);
  const userId = normalizeText(user?.id);
  const normalizedEmail = normalizeEmail(email);

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      organization_id: orgId,
    });

  const matchingEvents = (
    Array.isArray(billingRows) ? billingRows : []
  ).filter((billingEvent) => {
    const matchesOrganization =
      normalizeText(billingEvent?.organization_id) === orgId;

    const isStudentRegistration =
      billingEvent?.billing_subject_type === "student" &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      );

    const isSettled =
      SETTLED_CE_REGISTRATION_STATUSES.has(
        normalizeText(billingEvent?.event_status)
      );

    const matchesVerifiedEmail =
      normalizeEmail(billingEvent?.subject_verified_email) ===
      normalizedEmail;

    const matchesCohort =
      !cohortId ||
      normalizeText(billingEvent?.cohort_id) === cohortId;

    return (
      matchesOrganization &&
      isStudentRegistration &&
      isSettled &&
      matchesVerifiedEmail &&
      matchesCohort
    );
  });

  if (matchingEvents.length === 0) {
    return {
      settled: false,
      reason: "ce_student_registration_not_settled",
    };
  }

  if (matchingEvents.length > 1) {
    return {
      settled: false,
      reason: "multiple_matching_ce_registration_events",
    };
  }

  const billingEvent = matchingEvents[0];
  const billedUserId = normalizeText(billingEvent.subject_user_id);

  if (billedUserId && billedUserId !== userId) {
    return {
      settled: false,
      reason: "ce_registration_is_bound_to_a_different_user",
    };
  }

  return {
    settled: true,
    billingEvent,
  };
}

async function ensureCeStudentCohortMembership({
  base44,
  assignment,
  user,
}) {
  const cohortId = normalizeText(assignment?.cohort_id);

  if (!cohortId) {
    return {
      membership_created: false,
      membership_reactivated: false,
      membership_status: "no_cohort_selected",
      membership_id: null,
    };
  }

  const cohortRows =
    await base44.asServiceRole.entities.CETrainingCohort.filter({
      id: cohortId,
    });

  const cohort = Array.isArray(cohortRows)
    ? cohortRows[0]
    : null;

  if (!cohort) {
    throw new Error(
      "The Training cohort connected to this CE enrollment could not be found."
    );
  }

  if (
    normalizeText(cohort.org_id) !==
    normalizeText(assignment.org_id)
  ) {
    throw new Error(
      "The Training cohort connected to this CE enrollment belongs to a different organization."
    );
  }

  if (cohort.cohort_type !== "training") {
    throw new Error(
      "Only Training cohorts may receive CE student enrollment members."
    );
  }

  if (cohort.is_active === false) {
    throw new Error(
      "The Training cohort connected to this CE enrollment is inactive."
    );
  }

  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      cohort_id: cohortId,
      user_id: user.id,
      cohort_role: "member",
    });

  const memberships = Array.isArray(membershipRows)
    ? membershipRows
    : [];

  const activeMembership = memberships.find(
    (membership) => membership.is_active !== false
  );

  if (activeMembership) {
    return {
      membership_created: false,
      membership_reactivated: false,
      membership_status: "already_active",
      membership_id: activeMembership.id,
    };
  }

  const existingMembership = memberships[0];
  const now = new Date().toISOString();

  if (existingMembership) {
    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      existingMembership.id,
      {
        is_active: true,
        joined_at: existingMembership.joined_at || now,
        added_by: assignment.invited_by_id || undefined,
      }
    );

    return {
      membership_created: false,
      membership_reactivated: true,
      membership_status: "reactivated",
      membership_id: existingMembership.id,
    };
  }

  const createdMembership =
    await base44.asServiceRole.entities.CETrainingCohortMember.create({
      org_id: assignment.org_id,
      cohort_id: cohortId,
      user_id: user.id,
      cohort_role: "member",
      is_active: true,
      joined_at: now,
      added_by: assignment.invited_by_id || undefined,
    });

  return {
    membership_created: true,
    membership_reactivated: false,
    membership_status: "created",
    membership_id: createdMembership.id,
  };
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
        reason: "no_user_email",
      });
    }

    const email = normalizeEmail(user.email);

    const allUsers = await base44.asServiceRole.entities.User.list();

    const matchingUsers = (allUsers || []).filter(
      (candidate) => normalizeEmail(candidate.email) === email
    );

    if (matchingUsers.length > 1) {
      const sortedUsers = [...matchingUsers].sort((a, b) => {
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
        OPEN_PENDING_ASSIGNMENT_STATUSES.includes(
          assignment.status
        )
      )
      .filter(isValidAssignment);

    if (validPending.length === 0) {
      return Response.json({
        skipped: true,
        reason: "no_valid_pending_assignment",
      });
    }

    const assignment = getMostRecentAssignment(validPending);

    let ceRegistration = null;
    let cohortMembership = null;

    if (assignment.role === "ce_student") {
      ceRegistration = await getSettledCeStudentRegistration({
        base44,
        assignment,
        user,
        email,
      });

      if (!ceRegistration.settled) {
        return Response.json({
          skipped: true,
          reason: ceRegistration.reason,
          email,
          user_id: user.id,
          pending_assignment_id: assignment.id,
        });
      }

      cohortMembership =
        await ensureCeStudentCohortMembership({
          base44,
          assignment,
          user,
        });
    }

    const updateData = {
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: assignment.org_id,
      manager_id: assignment.invited_by_id || undefined,
      linked_client_id: assignment.client_id || undefined,
    };

    await base44.asServiceRole.entities.User.update(
      user.id,
      updateData
    );

    if (
      assignment.role === "ce_student" &&
      ceRegistration?.billingEvent
    ) {
      const billedUserId = normalizeText(
        ceRegistration.billingEvent.subject_user_id
      );

      if (!billedUserId) {
        await base44.asServiceRole.entities.OrganizationBillingEvent.update(
          ceRegistration.billingEvent.id,
          {
            subject_user_id: user.id,
          }
        );
      }
    }

    const staffRoles = ["employee", "management"];

    if (
      staffRoles.includes(assignment.role) &&
      assignment.invited_by_id
    ) {
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
        status: "accepted",
      }
    );

    return Response.json({
      success: true,
      email,
      user_id: user.id,
      applied: updateData,
      ce_registration_billing_event_id:
        ceRegistration?.billingEvent?.id || null,
      cohort_membership: cohortMembership,
    });
  } catch (error) {
    console.error("[onUserRegistered] Error:", error.message);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
});
