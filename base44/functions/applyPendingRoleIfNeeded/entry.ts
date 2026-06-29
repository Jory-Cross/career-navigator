import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// Called on login for any authenticated user.
//
// Normal pending-role upgrades remain unchanged for employees, management,
// clients, Pre-ETS, DSPD, and other supported roles.
//
// CE student upgrades have an additional hard requirement:
// - A matching CE registration/re-activation billing event must be paid or waived.
// - No ce_student role, CE portal access, cohort membership, or accepted invite
//   status is granted before that settlement exists.

const CLIENT_ROLES = ["client", "pre_ets", "dspd"];

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

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isValidAssignment(assignment: any) {
  if (
    !assignment?.role ||
    !assignment?.access_level ||
    !assignment?.org_id
  ) {
    return false;
  }

  if (
    CLIENT_ROLES.includes(assignment.role) &&
    !assignment.client_id
  ) {
    return false;
  }

  return true;
}

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role);
  const accessLevel = normalizeText(user?.access_level);
  const orgId = normalizeText(user?.org_id);
  const managerId = normalizeText(user?.manager_id);
  const linkedClientId = normalizeText(user?.linked_client_id);

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !orgId &&
    !managerId &&
    !linkedClientId
  );
}

function getMostRecentAssignment(assignments: any[]) {
  return [...assignments].sort((a, b) => {
    const bTime = new Date(
      b?.invited_at || b?.created_date || 0
    ).getTime();

    const aTime = new Date(
      a?.invited_at || a?.created_date || 0
    ).getTime();

    return bTime - aTime;
  })[0];
}

async function getSettledCeStudentRegistration(
  base44: any,
  assignment: any,
  user: any,
  email: string
) {
  const organizationId = normalizeText(assignment?.org_id);
  const cohortId = normalizeText(assignment?.cohort_id);
  const userId = normalizeText(user?.id);
  const studentEmail = normalizeEmail(email);

  if (!organizationId || !studentEmail) {
    return {
      settled: false,
      reason: "ce_student_invite_missing_required_identity",
    };
  }

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      organization_id: organizationId,
    });

  const matchingEvents = (
    Array.isArray(billingRows) ? billingRows : []
  ).filter((billingEvent) => {
    const matchesOrganization =
      normalizeText(billingEvent?.organization_id) === organizationId;

    const isStudentRegistration =
      billingEvent?.billing_subject_type === "student" &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      );

    const isSettled =
      SETTLED_CE_REGISTRATION_STATUSES.has(
        normalizeText(billingEvent?.event_status)
      );

    const matchesEmail =
      normalizeEmail(billingEvent?.subject_verified_email) ===
      studentEmail;

    const matchesCohort =
      !cohortId ||
      normalizeText(billingEvent?.cohort_id) === cohortId;

    return (
      matchesOrganization &&
      isStudentRegistration &&
      isSettled &&
      matchesEmail &&
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
  const billedUserId = normalizeText(billingEvent?.subject_user_id);

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

async function ensureSettledCeStudentCohortMembership(
  base44: any,
  assignment: any,
  user: any
) {
  const cohortId = normalizeText(assignment?.cohort_id);
  const organizationId = normalizeText(assignment?.org_id);

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
    normalizeText(cohort.org_id) !== organizationId ||
    normalizeText(cohort.cohort_type) !== "training"
  ) {
    throw new Error(
      "The Training cohort connected to this CE enrollment is not valid for this organization."
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
      org_id: organizationId,
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

async function syncCETrainingStudentEnrollmentActivation(
  base44: any,
  assignment: any,
  user: any,
  billingEvent: any,
  cohortMembership: any
) {
  try {
    const organizationId = normalizeText(assignment?.org_id);
    const cohortId = normalizeText(assignment?.cohort_id);
    const studentEmail = normalizeEmail(user?.email);
    const billingEventId = normalizeText(billingEvent?.id);
    const cohortMemberId = normalizeText(
      cohortMembership?.membership_id
    );

    if (
      !organizationId ||
      !cohortId ||
      !studentEmail ||
      !billingEventId ||
      !cohortMemberId
    ) {
      return {
        updated: false,
        skipped: true,
        reason: "missing_durable_enrollment_activation_identity",
      };
    }

    const enrollmentRows =
      await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
        {
          organization_billing_event_id: billingEventId,
        }
      );

    const enrollments = Array.isArray(enrollmentRows)
      ? enrollmentRows
      : [];

    if (enrollments.length === 0) {
      return {
        updated: false,
        skipped: true,
        reason: "no_durable_enrollment_record_found",
      };
    }

    if (enrollments.length > 1) {
      console.error(
        `[applyPendingRoleIfNeeded] Multiple CE Training enrollment records reference billing event ${billingEventId}.`
      );

      return {
        updated: false,
        skipped: true,
        reason: "multiple_durable_enrollment_records_found",
      };
    }

    const enrollment = enrollments[0];

    const identityMatches =
      normalizeText(enrollment.org_id) === organizationId &&
      normalizeText(enrollment.cohort_id) === cohortId &&
      normalizeEmail(enrollment.student_email) === studentEmail &&
      normalizeText(enrollment.organization_billing_event_id) ===
        billingEventId;

    const storedPendingAssignmentId = normalizeText(
      enrollment.pending_role_assignment_id
    );

    const pendingAssignmentMatches =
      !storedPendingAssignmentId ||
      storedPendingAssignmentId === normalizeText(assignment.id);

    if (!identityMatches || !pendingAssignmentMatches) {
      console.error(
        `[applyPendingRoleIfNeeded] CE Training enrollment identity mismatch for billing event ${billingEventId}.`
      );

      return {
        updated: false,
        skipped: true,
        reason: "durable_enrollment_identity_mismatch",
      };
    }

    const currentStatus = normalizeText(
      enrollment.enrollment_status
    );

    if (
      enrollment.is_active === false ||
      ["withdrawn", "revoked"].includes(currentStatus)
    ) {
      return {
        updated: false,
        skipped: true,
        reason: "durable_enrollment_is_not_active",
        enrollment_id: enrollment.id,
      };
    }

    const now = new Date().toISOString();
    const paymentSettledAt =
      normalizeText(billingEvent.paid_at) ||
      normalizeText(billingEvent.waived_at) ||
      now;

    const updates: Record<string, unknown> = {};

    if (!normalizeText(enrollment.user_id)) {
      updates.user_id = user.id;
    }

    if (!normalizeText(enrollment.cohort_member_id)) {
      updates.cohort_member_id = cohortMemberId;
    }

    if (!normalizeText(enrollment.payment_settled_at)) {
      updates.payment_settled_at = paymentSettledAt;
    }

    if (!normalizeText(enrollment.registered_at)) {
      updates.registered_at = now;
    }

    if (currentStatus !== "training_completed") {
      updates.enrollment_status = "active";
      updates.status_updated_at = now;
    }

    if (Object.keys(updates).length === 0) {
      return {
        updated: false,
        skipped: true,
        reason: "durable_enrollment_already_current",
        enrollment_id: enrollment.id,
      };
    }

    await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
      enrollment.id,
      updates
    );

    return {
      updated: true,
      skipped: false,
      enrollment_id: enrollment.id,
      enrollment_status:
        updates.enrollment_status || currentStatus,
    };
  } catch (error) {
    console.error(
      "[applyPendingRoleIfNeeded] CE Training enrollment sync error:",
      error?.message || error
    );

    return {
      updated: false,
      skipped: true,
      reason: "durable_enrollment_sync_failed",
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { upgraded: false, reason: "unauthorized" },
        { status: 401 }
      );
    }

    const email = normalizeEmail(user.email);
    const currentRole = normalizeText(user.role);
    const currentAccess = normalizeText(user.access_level);

    if (user.is_active === false) {
      console.log(
        `[applyPendingRoleIfNeeded] ${email} is deactivated — blocking upgrade.`
      );

      return Response.json({
        upgraded: false,
        reason: "deactivated",
      });
    }

    const needsUpgrade =
      !currentRole ||
      currentRole === "user" ||
      !currentAccess;

    if (!needsUpgrade) {
      console.log(
        `[applyPendingRoleIfNeeded] ${email} already has role=${currentRole} access=${currentAccess} — no upgrade needed.`
      );

      return Response.json({
        upgraded: false,
        reason: "already_assigned",
      });
    }

    const allAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.list();

    const matchingAssignments = (
      Array.isArray(allAssignments) ? allAssignments : []
    ).filter(
      (assignment) =>
        normalizeEmail(assignment?.email) === email
    );

    const openAssignments = matchingAssignments.filter(
      (assignment) =>
        OPEN_PENDING_ASSIGNMENT_STATUSES.includes(
          normalizeText(assignment?.status)
        )
    );

    const validPendingAssignments =
      openAssignments.filter(isValidAssignment);

    if (validPendingAssignments.length === 0) {
      if (openAssignments.length > 0) {
        console.warn(
          `[applyPendingRoleIfNeeded] Found incomplete pending role assignment(s) for ${email}; no upgrade applied.`
        );
      }

      return Response.json({
        upgraded: false,
        reason: "no_valid_pending_assignment",
      });
    }

    const assignment = getMostRecentAssignment(
      validPendingAssignments
    );

    let ceRegistration = null;
    let cohortMembership = null;

    if (assignment.role === "ce_student") {
      const assignmentOrganizationId = normalizeText(
        assignment.org_id
      );

      if (
        currentRole === "ce_student" &&
        normalizeText(user.org_id) &&
        normalizeText(user.org_id) !== assignmentOrganizationId
      ) {
        return Response.json({
          upgraded: false,
          reason:
            "existing_ce_student_belongs_to_different_organization",
          pending_assignment_id: assignment.id,
        });
      }

      if (
        currentRole !== "ce_student" &&
        !isNeutralExistingAccount(user)
      ) {
        return Response.json({
          upgraded: false,
          reason: "existing_user_is_not_safe_to_repurpose",
          pending_assignment_id: assignment.id,
        });
      }

      ceRegistration = await getSettledCeStudentRegistration(
        base44,
        assignment,
        user,
        email
      );

      if (!ceRegistration.settled) {
        console.log(
          `[applyPendingRoleIfNeeded] CE student ${email} remains blocked: ${ceRegistration.reason}`
        );

        return Response.json({
          upgraded: false,
          reason: ceRegistration.reason,
          payment_required: true,
          pending_assignment_id: assignment.id,
        });
      }

      cohortMembership =
        await ensureSettledCeStudentCohortMembership(
          base44,
          assignment,
          user
        );
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

      await syncCETrainingStudentEnrollmentActivation(
        base44,
        assignment,
        user,
        ceRegistration.billingEvent,
        cohortMembership
      );
    }

    const staffRoles = ["employee", "management"];

    if (
      staffRoles.includes(assignment.role) &&
      assignment.invited_by_id
    ) {
      try {
        const existingRows =
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
            {
              manager_user_id: assignment.invited_by_id,
              employee_user_id: user.id,
            }
          );

        const existingAssignment = Array.isArray(existingRows)
          ? existingRows[0]
          : null;

        if (!existingAssignment) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.create(
            {
              org_id: assignment.org_id,
              manager_user_id: assignment.invited_by_id,
              employee_user_id: user.id,
              is_active: true,
            }
          );
        } else if (existingAssignment.is_active === false) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
            existingAssignment.id,
            {
              is_active: true,
            }
          );
        }
      } catch (assignmentError) {
        console.warn(
          "[applyPendingRoleIfNeeded] ManagerEmployeeAssignment error:",
          assignmentError?.message || assignmentError
        );
      }
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: "accepted",
      }
    );

    console.log(
      `[applyPendingRoleIfNeeded] User ${email} upgraded: role=${updateData.role} access=${updateData.access_level}`
    );

    return Response.json({
      upgraded: true,
      applied: updateData,
      ce_registration_billing_event_id:
        ceRegistration?.billingEvent?.id || null,
      cohort_membership: cohortMembership,
    });
  } catch (error) {
    console.error(
      "[applyPendingRoleIfNeeded] Error:",
      error?.message || error
    );

    return Response.json(
      {
        upgraded: false,
        error:
          error?.message ||
          "Unable to apply the pending role assignment.",
      },
      { status: 500 }
    );
  }
});
