import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const OPEN_PENDING_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  client: "client_portal",
  pre_ets: "client_portal",
  dspd: "client_portal",
  pre_ets_employer: "pre_ets_employer_portal",
  ce_instructor: "ce_training_portal",
  ce_student: "ce_training_portal",
};

const CLIENT_LINKED_ROLES = new Set([
  "client",
  "pre_ets",
  "dspd",
]);

const CLIENT_ASSIGNMENT_ROLES = new Set([
  "client",
  "pre_ets",
  "dspd",
  "pre_ets_employer",
]);

const STAFF_ROLES = new Set([
  "employee",
  "management",
]);

const SETTLED_CE_REGISTRATION_STATUSES = new Set([
  "paid",
  "waived",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function isActiveClient(client: any) {
  return (
    client &&
    client.status === "active" &&
    client.is_active !== false &&
    client.is_archived !== true
  );
}

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level);
  const organizationId = normalizeIdentifier(user?.org_id);
  const managerId = normalizeIdentifier(user?.manager_id);
  const linkedClientId = normalizeIdentifier(
    user?.linked_client_id
  );
  const cohortId = normalizeIdentifier(user?.cohort_id);
  const cohortRole = normalizeText(user?.cohort_role);

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !organizationId &&
    !managerId &&
    !linkedClientId &&
    !cohortId &&
    !cohortRole
  );
}

function isClearlyAssignedAccount(user: any) {
  return Boolean(
    normalizeText(user?.role) &&
      normalizeText(user?.access_level) &&
      normalizeIdentifier(user?.org_id)
  );
}

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
}

function normalizeAssignment(record: any) {
  const role = normalizeText(record?.role).toLowerCase();
  const accessLevel = normalizeText(
    record?.access_level
  ).toLowerCase();

  const organizationId = normalizeIdentifier(record?.org_id);
  const clientId = normalizeIdentifier(record?.client_id);
  const cohortId = normalizeIdentifier(record?.cohort_id);
  const inviterId = normalizeIdentifier(record?.invited_by_id);

  if (
    !role ||
    !accessLevel ||
    !organizationId ||
    !ROLE_ACCESS_LEVELS[role] ||
    ROLE_ACCESS_LEVELS[role] !== accessLevel
  ) {
    return null;
  }

  if (CLIENT_ASSIGNMENT_ROLES.has(role) && !clientId) {
    return null;
  }

  if (role === "ce_student" && !cohortId) {
    return null;
  }

  if (!inviterId) {
    return null;
  }

  return {
    ...record,
    role,
    access_level: accessLevel,
    org_id: organizationId,
    client_id: clientId,
    cohort_id: cohortId,
    invited_by_id: inviterId,
  };
}

function getAssignmentFingerprint(assignment: any) {
  return [
    normalizeText(assignment?.role).toLowerCase(),
    normalizeText(assignment?.access_level).toLowerCase(),
    normalizeIdentifier(assignment?.org_id),
    normalizeIdentifier(assignment?.client_id),
    normalizeIdentifier(assignment?.cohort_id),
  ].join("::");
}

function sortMostRecent<T = any>(records: T[]) {
  return [...records].sort((left: any, right: any) => {
    const leftTime = new Date(
      left?.invited_at ||
        left?.updated_date ||
        left?.created_date ||
        0
    ).getTime();

    const rightTime = new Date(
      right?.invited_at ||
        right?.updated_date ||
        right?.created_date ||
        0
    ).getTime();

    return rightTime - leftTime;
  });
}

function canInviteTargetRole(
  inviterProfile: { role: string; access_level: string } | null,
  targetRole: string
) {
  if (!inviterProfile) {
    return false;
  }

  if (inviterProfile.role === "admin") {
    return true;
  }

  if (inviterProfile.role === "management") {
    return [
      "employee",
      "client",
      "pre_ets",
      "dspd",
      "pre_ets_employer",
      "ce_instructor",
      "ce_student",
    ].includes(targetRole);
  }

  if (inviterProfile.role === "employee") {
    return [
      "client",
      "pre_ets",
      "dspd",
      "pre_ets_employer",
    ].includes(targetRole);
  }

  if (inviterProfile.role === "ce_instructor") {
    return targetRole === "ce_student";
  }

  return false;
}

async function getCanonicalAuthenticatedUser(
  base44: any,
  authenticatedUserId: string
) {
  const user = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!user || !isActiveRecord(user)) {
    throw new RequestError(
      403,
      "Your account could not be verified as active."
    );
  }

  const userId = normalizeIdentifier(user?.id);
  const email = normalizeEmail(user?.email);

  if (!userId || !email) {
    throw new RequestError(
      403,
      "Your account is missing a verified email address."
    );
  }

  return {
    user,
    userId,
    email,
  };
}

async function getOpenAssignmentsForEmail(
  base44: any,
  rawEmail: string,
  normalizedEmail: string
) {
  const lookupEmails = [
    ...new Set(
      [normalizeText(rawEmail), normalizedEmail].filter(Boolean)
    ),
  ];

  const resultSets = await Promise.all(
    lookupEmails.map((email) =>
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email,
      })
    )
  );

  const byId = new Map<string, any>();

  for (const resultSet of resultSets) {
    for (const assignment of asArray(resultSet)) {
      const assignmentId = normalizeIdentifier(assignment?.id);

      if (assignmentId) {
        byId.set(assignmentId, assignment);
      }
    }
  }

  return [...byId.values()].filter(
    (assignment) =>
      normalizeEmail(assignment?.email) === normalizedEmail &&
      OPEN_PENDING_ASSIGNMENT_STATUSES.has(
        normalizeText(assignment?.status).toLowerCase()
      )
  );
}

async function resolveAuthorizedInvitation(
  base44: any,
  assignment: any
) {
  const organizationId = normalizeIdentifier(assignment?.org_id);
  const inviterId = normalizeIdentifier(assignment?.invited_by_id);

  const [organization, inviter] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.User.get(inviterId).catch(
      () => null
    ),
  ]);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "The organization connected to this invitation is inactive or unavailable."
    );
  }

  if (
    !inviter ||
    !isActiveRecord(inviter) ||
    normalizeIdentifier(inviter?.org_id) !== organizationId
  ) {
    throw new RequestError(
      403,
      "The invitation does not have a valid active organization inviter."
    );
  }

  const inviterProfile = getRoleProfile(inviter);

  if (!canInviteTargetRole(inviterProfile, assignment.role)) {
    throw new RequestError(
      403,
      "The invitation was not created by an account authorized for this role."
    );
  }

  return {
    organization,
    inviter,
    organizationId,
  };
}

async function inviterCanAccessClient(
  base44: any,
  inviter: any,
  organizationId: string,
  client: any
) {
  const inviterProfile = getRoleProfile(inviter);

  if (!inviterProfile) {
    return false;
  }

  if (inviterProfile.role === "admin") {
    return true;
  }

  const inviterId = normalizeIdentifier(inviter?.id);
  const visibleStaffIds = new Set<string>([inviterId]);

  if (inviterProfile.role === "management") {
    const managerAssignments =
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
        {
          org_id: organizationId,
          manager_user_id: inviterId,
        }
      );

    for (const managerAssignment of asArray(managerAssignments)) {
      if (
        managerAssignment?.is_active === true &&
        managerAssignment?.is_archived !== true
      ) {
        const employeeId = normalizeIdentifier(
          managerAssignment?.employee_user_id
        );

        if (employeeId) {
          visibleStaffIds.add(employeeId);
        }
      }
    }
  }

  const organizationUsers =
    await base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    });

  const visibleStaffEmails = new Set(
    asArray(organizationUsers)
      .filter(
        (user: any) =>
          isActiveRecord(user) &&
          visibleStaffIds.has(normalizeIdentifier(user?.id))
      )
      .map((user: any) => normalizeEmail(user?.email))
      .filter(Boolean)
  );

  const ownershipValues = [
    normalizeIdentifier(client?.assigned_employee_id),
    normalizeIdentifier(client?.created_by),
  ];

  return ownershipValues.some(
    (value) =>
      visibleStaffIds.has(value) ||
      visibleStaffEmails.has(normalizeEmail(value))
  );
}

async function resolveLinkedClient(
  base44: any,
  assignment: any,
  inviter: any,
  organizationId: string
) {
  if (!CLIENT_ASSIGNMENT_ROLES.has(assignment.role)) {
    return null;
  }

  const client = await base44.asServiceRole.entities.Client.get(
    assignment.client_id
  ).catch(() => null);

  if (
    !isActiveClient(client) ||
    normalizeIdentifier(client?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The client connected to this invitation is unavailable."
    );
  }

  const clientType = normalizeText(client?.client_type).toLowerCase();

  if (
    ["pre_ets", "pre_ets_employer"].includes(
      assignment.role
    ) &&
    clientType !== "pre_ets"
  ) {
    throw new RequestError(
      409,
      "The invitation requires an active Pre-ETS client."
    );
  }

  if (assignment.role === "dspd" && clientType !== "dspd") {
    throw new RequestError(
      409,
      "The invitation requires an active DSPD client."
    );
  }

  const inviterHasClientAccess = await inviterCanAccessClient(
    base44,
    inviter,
    organizationId,
    client
  );

  if (!inviterHasClientAccess) {
    throw new RequestError(
      403,
      "The invitation creator is not authorized for the linked client."
    );
  }

  return client;
}

async function preparePreEtsEmployerAssociation(
  base44: any,
  assignment: any,
  client: any,
  userId: string
) {
  if (assignment.role !== "pre_ets_employer") {
    return null;
  }

  const assignedEmployerId = normalizeIdentifier(
    client?.assigned_employer_id
  );

  if (assignedEmployerId && assignedEmployerId !== userId) {
    throw new RequestError(
      409,
      "This Pre-ETS client is already assigned to another employer account."
    );
  }

  if (assignedEmployerId !== userId) {
    await base44.asServiceRole.entities.Client.update(client.id, {
      assigned_employer_id: userId,
    });
  }

  return client.id;
}

async function prepareManagerEmployeeAssignment(
  base44: any,
  assignment: any,
  organizationId: string,
  userId: string
) {
  if (!STAFF_ROLES.has(assignment.role)) {
    return null;
  }

  const existingRows =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
      {
        org_id: organizationId,
        manager_user_id: assignment.invited_by_id,
        employee_user_id: userId,
      }
    );

  const existingRowsArray = asArray(existingRows);

  const activeAssignment = existingRowsArray.find(
    (managerAssignment: any) =>
      managerAssignment?.is_active === true &&
      managerAssignment?.is_archived !== true
  );

  if (activeAssignment) {
    return activeAssignment.id;
  }

  const inactiveAssignment = existingRowsArray.find(
    (managerAssignment: any) =>
      managerAssignment?.is_archived !== true
  );

  if (inactiveAssignment) {
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
      inactiveAssignment.id,
      {
        is_active: true,
      }
    );

    return inactiveAssignment.id;
  }

  const createdAssignment =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.create(
      {
        org_id: organizationId,
        manager_user_id: assignment.invited_by_id,
        employee_user_id: userId,
        is_active: true,
      }
    );

  return createdAssignment.id;
}

async function prepareCeStudentActivation(
  base44: any,
  assignment: any,
  user: any,
  organizationId: string,
  email: string
) {
  if (assignment.role !== "ce_student") {
    return null;
  }

  const cohortId = normalizeIdentifier(assignment?.cohort_id);

  const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(
    cohortId
  ).catch(() => null);

  if (
    !cohort ||
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !== "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    cohort?.is_active === false
  ) {
    throw new RequestError(
      409,
      "The Training cohort connected to this CE invitation is unavailable."
    );
  }

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        organization_id: organizationId,
      }
    );

  const matchingBillingEvents = asArray(billingRows).filter(
    (billingEvent: any) => {
      return (
        normalizeIdentifier(billingEvent?.organization_id) ===
          organizationId &&
        billingEvent?.billing_subject_type === "student" &&
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind)
        ) &&
        SETTLED_CE_REGISTRATION_STATUSES.has(
          normalizeText(billingEvent?.event_status)
        ) &&
        normalizeEmail(billingEvent?.subject_verified_email) ===
          email &&
        normalizeIdentifier(billingEvent?.cohort_id) === cohortId
      );
    }
  );

  if (matchingBillingEvents.length === 0) {
    throw new RequestError(
      409,
      "CE training access remains blocked until the matching registration payment is settled."
    );
  }

  if (matchingBillingEvents.length > 1) {
    throw new RequestError(
      409,
      "More than one settled CE registration was found. This enrollment requires review before access can be activated."
    );
  }

  const billingEvent = matchingBillingEvents[0];
  const billedUserId = normalizeIdentifier(
    billingEvent?.subject_user_id
  );

  if (billedUserId && billedUserId !== user.id) {
    throw new RequestError(
      409,
      "The settled CE registration is already connected to a different account."
    );
  }

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        organization_billing_event_id: billingEvent.id,
      }
    );

  const enrollments = asArray(enrollmentRows);

  if (enrollments.length === 0) {
    throw new RequestError(
      409,
      "The paid CE registration does not have a durable enrollment record."
    );
  }

  if (enrollments.length > 1) {
    throw new RequestError(
      409,
      "More than one CE enrollment references this billing event. This enrollment requires review before access can be activated."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  const enrollmentMatches =
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === email &&
    normalizeIdentifier(
      enrollment?.organization_billing_event_id
    ) === normalizeIdentifier(billingEvent?.id);

  const pendingAssignmentId = normalizeIdentifier(
    enrollment?.pending_role_assignment_id
  );

  if (
    !enrollmentMatches ||
    (pendingAssignmentId && pendingAssignmentId !== assignment.id)
  ) {
    throw new RequestError(
      409,
      "The paid CE enrollment does not match this invitation."
    );
  }

  if (
    enrollment?.is_active === false ||
    ["withdrawn", "revoked"].includes(enrollmentStatus)
  ) {
    throw new RequestError(
      409,
      "This CE enrollment is no longer active."
    );
  }

  const enrolledUserId = normalizeIdentifier(enrollment?.user_id);

  if (enrolledUserId && enrolledUserId !== user.id) {
    throw new RequestError(
      409,
      "This CE enrollment is already connected to a different account."
    );
  }

  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: user.id,
        cohort_role: "member",
      }
    );

  const memberships = asArray(membershipRows);

  const invalidMembership = memberships.find(
    (membership: any) =>
      normalizeIdentifier(membership?.org_id) !== organizationId
  );

  if (invalidMembership) {
    throw new RequestError(
      409,
      "An existing CE cohort membership has an invalid organization scope."
    );
  }

  let cohortMembership = memberships.find(
    (membership: any) =>
      membership?.is_active !== false &&
      membership?.is_archived !== true
  );

  const now = new Date().toISOString();

  if (!cohortMembership && memberships.length > 0) {
    const inactiveMembership = memberships[0];

    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      inactiveMembership.id,
      {
        is_active: true,
        joined_at: inactiveMembership.joined_at || now,
        added_by: assignment.invited_by_id,
      }
    );

    cohortMembership = {
      ...inactiveMembership,
      is_active: true,
    };
  }

  if (!cohortMembership) {
    cohortMembership =
      await base44.asServiceRole.entities.CETrainingCohortMember.create(
        {
          org_id: organizationId,
          cohort_id: cohortId,
          user_id: user.id,
          cohort_role: "member",
          is_active: true,
          training_status: "in_training",
          joined_at: now,
          added_by: assignment.invited_by_id,
        }
      );
  }

  const existingCohortMemberId = normalizeIdentifier(
    enrollment?.cohort_member_id
  );

  if (
    existingCohortMemberId &&
    existingCohortMemberId !== cohortMembership.id
  ) {
    throw new RequestError(
      409,
      "This CE enrollment is already connected to a different cohort membership."
    );
  }

  if (!billedUserId) {
    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        subject_user_id: user.id,
      }
    );
  }

  const enrollmentUpdates: Record<string, unknown> = {};

  if (!enrolledUserId) {
    enrollmentUpdates.user_id = user.id;
  }

  if (!existingCohortMemberId) {
    enrollmentUpdates.cohort_member_id = cohortMembership.id;
  }

  if (!normalizeText(enrollment?.payment_settled_at)) {
    enrollmentUpdates.payment_settled_at =
      normalizeText(billingEvent?.paid_at) ||
      normalizeText(billingEvent?.waived_at) ||
      now;
  }

  if (!normalizeText(enrollment?.registered_at)) {
    enrollmentUpdates.registered_at = now;
  }

  if (enrollmentStatus !== "training_completed") {
    enrollmentUpdates.enrollment_status = "active";
    enrollmentUpdates.status_updated_at = now;
  }

  if (Object.keys(enrollmentUpdates).length > 0) {
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
      enrollment.id,
      enrollmentUpdates
    );
  }

  return {
    billing_event_id: billingEvent.id,
    enrollment_id: enrollment.id,
    cohort_membership_id: cohortMembership.id,
  };
}

async function markAssignmentAccepted(
  base44: any,
  assignmentId: string
) {
  try {
    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignmentId,
      {
        status: "accepted",
      }
    );

    return true;
  } catch (error) {
    console.error(
      "[applyPendingRoleIfNeeded] Could not mark assignment accepted:",
      error?.message || error
    );

    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          upgraded: false,
          reason: "method_not_allowed",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          upgraded: false,
          reason: "unauthorized",
        },
        { status: 401 }
      );
    }

    const {
      user,
      userId,
      email,
    } = await getCanonicalAuthenticatedUser(
      base44,
      authenticatedUser.id
    );

    if (!isNeutralExistingAccount(user)) {
      return Response.json({
        upgraded: false,
        reason: isClearlyAssignedAccount(user)
          ? "already_assigned"
          : "existing_account_not_safe_to_repurpose",
      });
    }

    const rawUserEmail = normalizeText(user?.email);

    const openAssignments = await getOpenAssignmentsForEmail(
      base44,
      rawUserEmail,
      email
    );

    const validAssignments = openAssignments
      .map(normalizeAssignment)
      .filter(Boolean);

    if (validAssignments.length === 0) {
      return Response.json({
        upgraded: false,
        reason: "no_valid_pending_assignment",
      });
    }

    const assignmentFingerprints = new Set(
      validAssignments.map(getAssignmentFingerprint)
    );

    if (assignmentFingerprints.size > 1) {
      return Response.json({
        upgraded: false,
        reason: "ambiguous_pending_assignments",
      });
    }

    const assignment = sortMostRecent(validAssignments)[0];

    const {
      inviter,
      organizationId,
    } = await resolveAuthorizedInvitation(base44, assignment);

    const linkedClient = await resolveLinkedClient(
      base44,
      assignment,
      inviter,
      organizationId
    );

    const ceActivation = await prepareCeStudentActivation(
      base44,
      assignment,
      user,
      organizationId,
      email
    );

    const managerEmployeeAssignmentId =
      await prepareManagerEmployeeAssignment(
        base44,
        assignment,
        organizationId,
        userId
      );

    const assignedEmployerClientId =
      await preparePreEtsEmployerAssociation(
        base44,
        assignment,
        linkedClient,
        userId
      );

    const userUpdateData: Record<string, unknown> = {
      role: assignment.role,
      access_level: assignment.access_level,
      org_id: organizationId,
    };

    if (STAFF_ROLES.has(assignment.role)) {
      userUpdateData.manager_id = assignment.invited_by_id;
    }

    if (CLIENT_LINKED_ROLES.has(assignment.role)) {
      userUpdateData.linked_client_id = assignment.client_id;
    }

    await base44.asServiceRole.entities.User.update(
      userId,
      userUpdateData
    );

    const assignmentAccepted = await markAssignmentAccepted(
      base44,
      assignment.id
    );

    console.log(
      `[applyPendingRoleIfNeeded] Activated account ${email} as ${assignment.role} in org ${organizationId}.`
    );

    return Response.json({
      upgraded: true,
      applied: userUpdateData,
      pending_assignment_accepted: assignmentAccepted,
      manager_employee_assignment_id:
        managerEmployeeAssignmentId || null,
      assigned_employer_client_id:
        assignedEmployerClientId || null,
      ce_activation: ceActivation,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const reason =
      error instanceof RequestError
        ? error.message
        : "Unable to apply the pending role assignment.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[applyPendingRoleIfNeeded] Unexpected error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        upgraded: false,
        reason,
      },
      { status }
    );
  }
});
