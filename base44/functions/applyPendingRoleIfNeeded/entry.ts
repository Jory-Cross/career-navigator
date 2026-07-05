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

const CLIENT_LINKED_ROLES = new Set(["client", "pre_ets", "dspd"]);
const CLIENT_ASSIGNMENT_ROLES = new Set([
  "client",
  "pre_ets",
  "dspd",
  "pre_ets_employer",
]);
const STAFF_ROLES = new Set(["employee", "management"]);
const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);
const SETTLED_CE_REGISTRATION_STATUSES = new Set(["paid", "waived"]);
const ACTIVATABLE_CE_ENROLLMENT_STATUSES = new Set([
  "payment_settled_registration_pending",
  "active",
  "training_completed",
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

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (role === "admin" && accessLevel === "admin") return role;
  if (
    ["management", "employee"].includes(role) &&
    accessLevel === "staff"
  ) {
    return role;
  }

  return "";
}

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return { role, access_level: accessLevel };
}

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level);
  const organizationId = normalizeIdentifier(user?.org_id);
  const managerId = normalizeIdentifier(user?.manager_id);
  const linkedClientId = normalizeIdentifier(user?.linked_client_id);
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

function normalizeAssignment(record: any) {
  const role = normalizeText(record?.role).toLowerCase();
  const accessLevel = normalizeText(record?.access_level).toLowerCase();
  const organizationId = normalizeIdentifier(record?.org_id);
  const clientId = normalizeIdentifier(record?.client_id);
  const cohortId = normalizeIdentifier(record?.cohort_id);
  const inviterId = normalizeIdentifier(record?.invited_by_id);

  if (
    !role ||
    !accessLevel ||
    !organizationId ||
    !ROLE_ACCESS_LEVELS[role] ||
    ROLE_ACCESS_LEVELS[role] !== accessLevel ||
    !inviterId
  ) {
    return null;
  }

  if (CLIENT_ASSIGNMENT_ROLES.has(role) && !clientId) return null;
  if (role === "ce_student" && !cohortId) return null;

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
      left?.invited_at || left?.updated_date || left?.created_date || 0
    ).getTime();
    const rightTime = new Date(
      right?.invited_at || right?.updated_date || right?.created_date || 0
    ).getTime();
    return rightTime - leftTime;
  });
}

function inviterMayInviteTargetRole(
  inviterProfile: { role: string; access_level: string } | null,
  targetRole: string
) {
  if (!inviterProfile) return false;
  if (inviterProfile.role === "admin") return true;

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
    return ["client", "pre_ets", "dspd", "pre_ets_employer"].includes(
      targetRole
    );
  }

  return (
    inviterProfile.role === "ce_instructor" && targetRole === "ce_student"
  );
}

async function getCanonicalAuthenticatedUser(
  base44: any,
  authenticatedUserId: string
) {
  const user = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!user || !isActiveRecord(user)) {
    throw new RequestError(403, "Your account could not be verified as active.");
  }

  const userId = normalizeIdentifier(user?.id);
  const email = normalizeEmail(user?.email);

  if (!userId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(
      403,
      "Your account is missing a verified email address."
    );
  }

  return { user, userId, email };
}

async function getOpenAssignmentsForEmail(
  base44: any,
  rawEmail: string,
  normalizedEmail: string
) {
  const lookupEmails = [
    ...new Set([normalizeText(rawEmail), normalizedEmail].filter(Boolean)),
  ];

  const resultSets = await Promise.all(
    lookupEmails.map((email) =>
      base44.asServiceRole.entities.PendingRoleAssignment.filter({ email })
    )
  );

  const recordsById = new Map<string, any>();
  for (const resultSet of resultSets) {
    for (const assignment of asArray(resultSet)) {
      const assignmentId = normalizeIdentifier(assignment?.id);
      if (assignmentId) recordsById.set(assignmentId, assignment);
    }
  }

  return [...recordsById.values()].filter(
    (assignment) =>
      normalizeEmail(assignment?.email) === normalizedEmail &&
      OPEN_PENDING_ASSIGNMENT_STATUSES.has(
        normalizeText(assignment?.status).toLowerCase()
      )
  );
}

async function resolveAuthorizedInvitation(base44: any, assignment: any) {
  const organizationId = normalizeIdentifier(assignment?.org_id);
  const inviterId = normalizeIdentifier(assignment?.invited_by_id);

  const [organization, inviter] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.User.get(inviterId).catch(() => null),
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
  if (!inviterMayInviteTargetRole(inviterProfile, assignment.role)) {
    throw new RequestError(
      403,
      "The invitation was not created by an account authorized for this role."
    );
  }

  return { organization, inviter, organizationId, inviterProfile };
}

async function inviterCanAccessClient(
  base44: any,
  inviter: any,
  inviterProfile: any,
  organizationId: string,
  client: any
) {
  if (inviterProfile?.role === "admin") return true;

  const inviterId = normalizeIdentifier(inviter?.id);
  const assignedStaffId = normalizeIdentifier(client?.assigned_employee_id);

  if (!inviterId || !assignedStaffId) return false;

  const assignedStaff = await base44.asServiceRole.entities.User.get(
    assignedStaffId
  ).catch(() => null);

  if (
    !assignedStaff ||
    !isActiveRecord(assignedStaff) ||
    normalizeIdentifier(assignedStaff?.id) !== assignedStaffId ||
    normalizeIdentifier(assignedStaff?.org_id) !== organizationId ||
    !getCanonicalStaffRole(assignedStaff)
  ) {
    return false;
  }

  if (assignedStaffId === inviterId) return true;
  if (inviterProfile?.role !== "management") return false;

  const managerAssignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: inviterId,
      employee_user_id: assignedStaffId,
    });

  return asArray(managerAssignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeIdentifier(assignment?.org_id) === organizationId &&
      normalizeIdentifier(assignment?.manager_user_id) === inviterId &&
      normalizeIdentifier(assignment?.employee_user_id) === assignedStaffId
  );
}

async function resolveLinkedClient(
  base44: any,
  assignment: any,
  inviter: any,
  inviterProfile: any,
  organizationId: string
) {
  if (!CLIENT_ASSIGNMENT_ROLES.has(assignment.role)) return null;

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
    ["pre_ets", "pre_ets_employer"].includes(assignment.role) &&
    clientType !== "pre_ets"
  ) {
    throw new RequestError(409, "The invitation requires an active Pre-ETS client.");
  }

  if (assignment.role === "dspd" && clientType !== "dspd") {
    throw new RequestError(409, "The invitation requires an active DSPD client.");
  }

  if (
    !(await inviterCanAccessClient(
      base44,
      inviter,
      inviterProfile,
      organizationId,
      client
    ))
  ) {
    throw new RequestError(
      403,
      "The invitation creator is not authorized for the linked client."
    );
  }

  return client;
}

async function prepareManagerEmployeeAssignment(
  base44: any,
  assignment: any,
  organizationId: string,
  userId: string
) {
  if (!STAFF_ROLES.has(assignment.role)) return null;

  const existingRows =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: assignment.invited_by_id,
      employee_user_id: userId,
    });

  const existing = asArray(existingRows).find(
    (row: any) => row?.is_archived !== true
  );

  if (existing?.is_active === true) {
    return { id: existing.id, rollback: null };
  }

  if (existing) {
    const previousIsActive = existing.is_active;
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
      existing.id,
      { is_active: true }
    );

    return {
      id: existing.id,
      rollback: async () => {
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
          existing.id,
          { is_active: previousIsActive }
        );
      },
    };
  }

  const created =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
      org_id: organizationId,
      manager_user_id: assignment.invited_by_id,
      employee_user_id: userId,
      is_active: true,
    });

  return {
    id: created.id,
    rollback: async () => {
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
        created.id,
        { is_active: false }
      );
    },
  };
}

async function preparePreEtsEmployerAssociation(
  base44: any,
  assignment: any,
  client: any,
  userId: string
) {
  if (assignment.role !== "pre_ets_employer") return null;

  const priorEmployerId = normalizeIdentifier(client?.assigned_employer_id);
  if (priorEmployerId && priorEmployerId !== userId) {
    throw new RequestError(
      409,
      "This Pre-ETS client is already assigned to another employer account."
    );
  }

  if (priorEmployerId === userId) return { rollback: null };

  await base44.asServiceRole.entities.Client.update(client.id, {
    assigned_employer_id: userId,
  });

  return {
    rollback: async () => {
      await base44.asServiceRole.entities.Client.update(client.id, {
        assigned_employer_id: priorEmployerId || null,
      });
    },
  };
}

async function prepareCeStudentActivation(
  base44: any,
  assignment: any,
  user: any,
  organizationId: string,
  email: string
) {
  if (assignment.role !== "ce_student") return null;

  const cohortId = normalizeIdentifier(assignment?.cohort_id);
  const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(
    cohortId
  ).catch(() => null);

  if (
    !cohort ||
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !== "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      409,
      "The Training cohort connected to this CE invitation is unavailable."
    );
  }

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      organization_id: organizationId,
    });
  const matchingBillingEvents = asArray(billingRows).filter(
    (billingEvent: any) =>
      normalizeIdentifier(billingEvent?.organization_id) === organizationId &&
      billingEvent?.billing_subject_type === "student" &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      ) &&
      SETTLED_CE_REGISTRATION_STATUSES.has(
        normalizeText(billingEvent?.event_status)
      ) &&
      normalizeEmail(billingEvent?.subject_verified_email) === email &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId
  );

  if (matchingBillingEvents.length !== 1) {
    throw new RequestError(
      409,
      matchingBillingEvents.length === 0
        ? "CE training access remains blocked until the matching registration payment is settled."
        : "More than one settled CE registration was found. This enrollment requires review before access can be activated."
    );
  }

  const billingEvent = matchingBillingEvents[0];
  const billedUserId = normalizeIdentifier(billingEvent?.subject_user_id);
  if (billedUserId && billedUserId !== user.id) {
    throw new RequestError(
      409,
      "The settled CE registration is already connected to a different account."
    );
  }

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
      organization_billing_event_id: billingEvent.id,
    });
  const enrollments = asArray(enrollmentRows);

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      enrollments.length === 0
        ? "The paid CE registration does not have a durable enrollment record."
        : "More than one CE enrollment references this billing event. This enrollment requires review before access can be activated."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(enrollment?.enrollment_status).toLowerCase();
  const assignmentId = normalizeIdentifier(assignment?.id);
  const enrollmentMatches =
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === email &&
    normalizeIdentifier(enrollment?.organization_billing_event_id) ===
      normalizeIdentifier(billingEvent?.id) &&
    normalizeIdentifier(enrollment?.pending_role_assignment_id) === assignmentId;

  if (!assignmentId || !enrollmentMatches) {
    throw new RequestError(
      409,
      "The paid CE enrollment does not match this invitation."
    );
  }

  if (
    enrollment?.is_active === false ||
    ["withdrawn", "revoked"].includes(enrollmentStatus) ||
    !ACTIVATABLE_CE_ENROLLMENT_STATUSES.has(enrollmentStatus)
  ) {
    throw new RequestError(
      409,
      "This CE enrollment is not ready for account activation."
    );
  }

  const enrolledUserId = normalizeIdentifier(enrollment?.user_id);
  if (enrolledUserId && enrolledUserId !== user.id) {
    throw new RequestError(
      409,
      "This CE enrollment is already connected to a different account."
    );
  }

  const memberships = asArray(
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      cohort_id: cohortId,
      user_id: user.id,
    })
  );

  if (
    memberships.some(
      (membership: any) =>
        normalizeIdentifier(membership?.org_id) !== organizationId
    )
  ) {
    throw new RequestError(
      409,
      "An existing CE cohort membership has an invalid organization scope."
    );
  }

  if (
    memberships.some(
      (membership: any) =>
        normalizeText(membership?.cohort_role).toLowerCase() !== "member" &&
        membership?.is_active !== false &&
        membership?.is_archived !== true
    )
  ) {
    throw new RequestError(
      409,
      "This account already has a conflicting active role in the Training cohort."
    );
  }

  const memberMemberships = memberships.filter(
    (membership: any) =>
      normalizeText(membership?.cohort_role).toLowerCase() === "member"
  );

  if (memberMemberships.some((membership: any) => membership?.is_archived === true)) {
    throw new RequestError(
      409,
      "A prior CE cohort membership requires review before access can be restored."
    );
  }

  if (memberMemberships.length > 1) {
    throw new RequestError(
      409,
      "More than one CE student membership was found. This enrollment requires review before access can be activated."
    );
  }

  const existingCohortMemberId = normalizeIdentifier(enrollment?.cohort_member_id);
  const existingMember = memberMemberships[0] || null;
  if (
    existingCohortMemberId &&
    (!existingMember || normalizeIdentifier(existingMember?.id) !== existingCohortMemberId)
  ) {
    throw new RequestError(
      409,
      "This CE enrollment is linked to a different cohort membership."
    );
  }

  const now = new Date().toISOString();
  const changes: Array<() => Promise<void>> = [];
  let cohortMembership = existingMember;

  if (cohortMembership && cohortMembership?.is_active === false) {
    const prior = {
      is_active: cohortMembership.is_active,
      joined_at: cohortMembership.joined_at,
      added_by: cohortMembership.added_by,
    };
    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      cohortMembership.id,
      {
        is_active: true,
        joined_at: cohortMembership.joined_at || now,
        added_by: assignment.invited_by_id,
      }
    );
    changes.push(async () => {
      await base44.asServiceRole.entities.CETrainingCohortMember.update(
        cohortMembership.id,
        prior
      );
    });
    cohortMembership = { ...cohortMembership, is_active: true };
  }

  if (!cohortMembership) {
    cohortMembership =
      await base44.asServiceRole.entities.CETrainingCohortMember.create({
        org_id: organizationId,
        cohort_id: cohortId,
        user_id: user.id,
        cohort_role: "member",
        is_active: true,
        training_status: "in_training",
        joined_at: now,
        added_by: assignment.invited_by_id,
      });
    const createdMembershipId = cohortMembership.id;
    changes.push(async () => {
      await base44.asServiceRole.entities.CETrainingCohortMember.update(
        createdMembershipId,
        { is_active: false }
      );
    });
  }

  if (!billedUserId) {
    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      { subject_user_id: user.id }
    );
    changes.push(async () => {
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        { subject_user_id: null }
      );
    });
  }

  const enrollmentUpdates: Record<string, unknown> = {};
  const enrollmentRollback: Record<string, unknown> = {};
  if (!enrolledUserId) {
    enrollmentUpdates.user_id = user.id;
    enrollmentRollback.user_id = enrollment.user_id || null;
  }
  if (!existingCohortMemberId) {
    enrollmentUpdates.cohort_member_id = cohortMembership.id;
    enrollmentRollback.cohort_member_id = enrollment.cohort_member_id || null;
  }
  if (!normalizeText(enrollment?.payment_settled_at)) {
    enrollmentUpdates.payment_settled_at =
      normalizeText(billingEvent?.paid_at) ||
      normalizeText(billingEvent?.waived_at) ||
      now;
    enrollmentRollback.payment_settled_at = enrollment.payment_settled_at || null;
  }
  if (!normalizeText(enrollment?.registered_at)) {
    enrollmentUpdates.registered_at = now;
    enrollmentRollback.registered_at = enrollment.registered_at || null;
  }
  if (enrollmentStatus !== "training_completed") {
    enrollmentUpdates.enrollment_status = "active";
    enrollmentUpdates.status_updated_at = now;
    enrollmentRollback.enrollment_status = enrollment.enrollment_status || null;
    enrollmentRollback.status_updated_at = enrollment.status_updated_at || null;
  }

  if (Object.keys(enrollmentUpdates).length > 0) {
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
      enrollment.id,
      enrollmentUpdates
    );
    changes.push(async () => {
      await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
        enrollment.id,
        enrollmentRollback
      );
    });
  }

  return {
    cohortMembershipId: cohortMembership.id,
    enrollmentId: enrollment.id,
    billingEventId: billingEvent.id,
    rollback: async () => {
      for (const change of [...changes].reverse()) {
        try {
          await change();
        } catch (error) {
          console.error(
            "[applyPendingRoleIfNeeded] Could not roll back CE activation:",
            error
          );
        }
      }
    },
  };
}

async function markAssignmentAccepted(base44: any, assignmentId: string) {
  try {
    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignmentId,
      { status: "accepted" }
    );
    return true;
  } catch (error) {
    console.error(
      "[applyPendingRoleIfNeeded] Could not mark assignment accepted:",
      error
    );
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { upgraded: false, reason: "This request must use POST." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { upgraded: false, reason: "Please sign in before activating an invitation." },
        { status: 401 }
      );
    }

    const { user, userId, email } = await getCanonicalAuthenticatedUser(
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

    const assignments = await getOpenAssignmentsForEmail(
      base44,
      normalizeText(user?.email),
      email
    );
    const validAssignments = assignments.map(normalizeAssignment).filter(Boolean);

    if (validAssignments.length === 0) {
      return Response.json({
        upgraded: false,
        reason: "no_valid_pending_assignment",
      });
    }

    const fingerprints = new Set(
      validAssignments.map(getAssignmentFingerprint)
    );
    if (fingerprints.size > 1) {
      return Response.json({
        upgraded: false,
        reason: "ambiguous_pending_assignments",
      });
    }

    const assignment = sortMostRecent(validAssignments)[0];
    const { inviter, inviterProfile, organizationId } =
      await resolveAuthorizedInvitation(base44, assignment);

    const linkedClient = await resolveLinkedClient(
      base44,
      assignment,
      inviter,
      inviterProfile,
      organizationId
    );

    const preparedCeActivation = await prepareCeStudentActivation(
      base44,
      assignment,
      user,
      organizationId,
      email
    );

    let preparedManagerAssignment: any = null;
    let preparedEmployerAssociation: any = null;

    try {
      preparedManagerAssignment = await prepareManagerEmployeeAssignment(
        base44,
        assignment,
        organizationId,
        userId
      );
      preparedEmployerAssociation = await preparePreEtsEmployerAssociation(
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

      await base44.asServiceRole.entities.User.update(userId, userUpdateData);

      const assignmentAccepted = await markAssignmentAccepted(base44, assignment.id);

      return Response.json({
        upgraded: true,
        applied: userUpdateData,
        pending_assignment_accepted: assignmentAccepted,
        manager_employee_assignment_id: preparedManagerAssignment?.id || null,
        assigned_employer_client_id:
          assignment.role === "pre_ets_employer" && linkedClient
            ? linkedClient.id
            : null,
        ce_activation: preparedCeActivation
          ? {
              billing_event_id: preparedCeActivation.billingEventId,
              enrollment_id: preparedCeActivation.enrollmentId,
              cohort_membership_id: preparedCeActivation.cohortMembershipId,
            }
          : null,
      });
    } catch (error) {
      if (preparedEmployerAssociation?.rollback) {
        await preparedEmployerAssociation.rollback().catch(() => {});
      }
      if (preparedManagerAssignment?.rollback) {
        await preparedManagerAssignment.rollback().catch(() => {});
      }
      if (preparedCeActivation?.rollback) {
        await preparedCeActivation.rollback().catch(() => {});
      }
      throw error;
    }
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
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
      { upgraded: false, reason },
      { status }
    );
  }
});