async function activateExistingPaidCEStudentIfEligible(
  base44: any,
  billingRecord: any
) {
  const subjectUserId = normalizeText(billingRecord?.subject_user_id);
  const organizationId = normalizeText(billingRecord?.organization_id);
  const studentEmail = normalizeEmail(
    billingRecord?.subject_verified_email
  );

  if (!subjectUserId || !organizationId || !studentEmail) {
    return {
      activated: false,
      reason: "no_existing_registered_user_to_activate",
    };
  }

  const userRows = await base44.asServiceRole.entities.User.filter({
    id: subjectUserId,
  });

  const registeredUser = Array.isArray(userRows) ? userRows[0] : null;

  if (!registeredUser) {
    return {
      activated: false,
      reason: "subject_user_not_found",
    };
  }

  if (
    normalizeEmail(registeredUser.email) !== studentEmail ||
    registeredUser.is_active === false
  ) {
    return {
      activated: false,
      reason: "subject_user_is_not_an_eligible_email_match",
    };
  }

  const inviteRows =
    await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      org_id: organizationId,
      role: "ce_student",
    });

  const matchingOpenAssignments = (
    Array.isArray(inviteRows) ? inviteRows : []
  ).filter(
    (assignment) =>
      normalizeEmail(assignment?.email) === studentEmail &&
      OPEN_CE_ASSIGNMENT_STATUSES.has(assignment?.status)
  );

  if (matchingOpenAssignments.length !== 1) {
    return {
      activated: false,
      reason:
        matchingOpenAssignments.length === 0
          ? "no_open_ce_student_assignment_found"
          : "multiple_open_ce_student_assignments_found",
    };
  }

  const assignment = getMostRecentAssignment(
    matchingOpenAssignments
  );

  if (
    registeredUser.role === "ce_student" &&
    normalizeText(registeredUser.org_id) &&
    normalizeText(registeredUser.org_id) !== organizationId
  ) {
    return {
      activated: false,
      reason: "existing_ce_student_belongs_to_different_organization",
    };
  }

  if (
    registeredUser.role !== "ce_student" &&
    !isNeutralExistingAccount(registeredUser)
  ) {
    return {
      activated: false,
      reason: "existing_user_is_not_safe_to_repurpose",
    };
  }

  if (registeredUser.role !== "ce_student") {
    await base44.asServiceRole.entities.User.update(
      registeredUser.id,
      {
        role: "ce_student",
        access_level: "ce_training_portal",
        org_id: organizationId,
        manager_id: assignment.invited_by_id || undefined,
      }
    );
  }

  const cohortMembership =
    await ensurePaidCeStudentCohortMembership(
      base44,
      assignment,
      registeredUser,
      organizationId
    );

  await base44.asServiceRole.entities.PendingRoleAssignment.update(
    assignment.id,
    {
      status: "accepted",
    }
  );

  return {
    activated: true,
    user_id: registeredUser.id,
    pending_assignment_id: assignment.id,
    cohort_membership: cohortMembership,
  };
}
