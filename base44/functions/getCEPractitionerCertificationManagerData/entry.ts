import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";
const TRAINING_COHORT_TYPE = "training";
const STUDENT_COHORT_ROLE = "member";

const TRAINING_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const VALID_CERTIFICATION_STATUSES = new Set([
  "pending_verification",
  "verified",
  "revoked",
]);

const CONTROLLED_TEST_WAIVER_BILLING_EVENT_PREFIX =
  "test_waived_training_registration";
const CONTROLLED_TEST_WAIVER_AMOUNT_CENTS = 4900;

const PIPELINE_STATUS_ORDER: Record<string, number> = {
  in_training: 1,
  pending_certification: 2,
  certified: 3,
  revoked: 4,
};

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
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActiveRecord(record: any) {
  return Boolean(
    record &&
      record.is_active !== false &&
      record.is_archived !== true
  );
}

function buildControlledTestWaiverBillingEventKey(
  organizationId: string,
  cohortId: string,
  studentUserId: string
) {
  return [
    CONTROLLED_TEST_WAIVER_BILLING_EVENT_PREFIX,
    organizationId,
    cohortId,
    studentUserId,
  ].join(":");
}

function buildEnrollmentKey(
  organizationId: string,
  cohortId: string,
  studentEmail: string
) {
  return [
    "ce_training_enrollment",
    organizationId,
    cohortId,
    studentEmail,
  ].join(":");
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeEmail(user?.email) ||
    "Unnamed CE student"
  );
}

function normalizeUser(user: any) {
  return {
    id: normalizeIdentifier(user?.id),
    full_name: normalizeText(user?.full_name),
    email: normalizeEmail(user?.email),
    display_name: getDisplayName(user),
    role: normalizeText(user?.role) || null,
    access_level: normalizeText(user?.access_level) || null,
    is_active: isActiveRecord(user),
  };
}

function normalizeTrainingStatus(member: any) {
  const status = normalizeText(member?.training_status).toLowerCase();

  if (["in_training", "completed", "withdrawn"].includes(status)) {
    return status;
  }

  return "in_training";
}

function getRecordTimestamp(record: any) {
  const rawValue =
    record?.training_completed_at ||
    record?.status_updated_at ||
    record?.registered_at ||
    record?.joined_at ||
    record?.completed_at ||
    record?.updated_date ||
    record?.created_date ||
    "";

  const timestamp = Date.parse(String(rawValue));

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortNewestFirst(left: any, right: any) {
  return getRecordTimestamp(right) - getRecordTimestamp(left);
}

function getPipelineStatus(certification: any, chain: any) {
  const certificationStatus = normalizeText(
    certification?.certification_status
  ).toLowerCase();

  if (certificationStatus === "verified") {
    return "certified";
  }

  if (certificationStatus === "revoked") {
    return "revoked";
  }

  if (certificationStatus === "pending_verification") {
    return "pending_certification";
  }

  return chain?.is_training_completed
    ? "pending_certification"
    : "in_training";
}

function getPipelineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    in_training: "In Training",
    pending_certification: "Pending Certification",
    certified: "Certified",
    revoked: "Revoked",
  };

  return labels[status] || "Unknown";
}

function serializeCertification(record: any, user: any) {
  return {
    id: normalizeIdentifier(record?.id),
    user_id: normalizeIdentifier(record?.user_id),
    practitioner_name: user?.display_name || "Unknown CE student",
    practitioner_email: user?.email || "",
    practitioner_is_active: user ? user.is_active !== false : null,
    certification_status:
      normalizeText(record?.certification_status) || null,
    completed_at: record?.completed_at || null,
    verified_at: record?.verified_at || null,
    verified_by_user_id:
      normalizeIdentifier(record?.verified_by_user_id) || null,
    revoked_at: record?.revoked_at || null,
    revoked_by_user_id:
      normalizeIdentifier(record?.revoked_by_user_id) || null,
    certification_source:
      normalizeText(record?.certification_source) || null,
    source_cohort_id:
      normalizeIdentifier(record?.source_cohort_id) || null,
    notes: normalizeText(record?.notes),
  };
}

async function resolveCanonicalPlatformOwner(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);

  if (
    !caller ||
    !isActiveRecord(caller) ||
    !callerId ||
    !isValidEmail(callerEmail)
  ) {
    throw new RequestError(
      403,
      "Your platform account is unavailable or does not have a verified email address."
    );
  }

  const platformOwnerRows =
    await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: callerId,
      platform_role: PLATFORM_OWNER_ROLE,
      is_active: true,
    });

  const isPlatformOwner = asArray(platformOwnerRows).some(
    (record: any) =>
      normalizeIdentifier(record?.user_id) === callerId &&
      normalizeText(record?.platform_role).toLowerCase() ===
        PLATFORM_OWNER_ROLE &&
      record?.is_active !== false &&
      record?.is_archived !== true
  );

  if (!isPlatformOwner) {
    throw new RequestError(
      403,
      "Only an active Platform Owner may view CE practitioner certification administration."
    );
  }

  return {
    caller,
    platformRoles: [PLATFORM_OWNER_ROLE],
  };
}

function isAcceptedCEStudentInvitation(
  invitation: any,
  enrollment: any,
  organizationId: string,
  cohortId: string,
  studentEmail: string
) {
  const enrollmentPaymentResponsibility =
    normalizeText(enrollment?.payment_responsibility) ||
    "student_paid";
  const invitationPaymentResponsibility =
    normalizeText(invitation?.payment_responsibility) ||
    "student_paid";

  const enrollmentInstructorPaymentMode =
    enrollmentPaymentResponsibility === "instructor_paid"
      ? normalizeText(enrollment?.instructor_payment_mode)
      : "";
  const invitationInstructorPaymentMode =
    invitationPaymentResponsibility === "instructor_paid"
      ? normalizeText(invitation?.instructor_payment_mode)
      : "";

  const invitationCohortRole = normalizeText(
    invitation?.cohort_role
  ).toLowerCase();

  return Boolean(
    invitation &&
      invitation?.is_archived !== true &&
      normalizeText(invitation?.status).toLowerCase() === "accepted" &&
      normalizeText(invitation?.role).toLowerCase() === "ce_student" &&
      normalizeText(invitation?.access_level).toLowerCase() ===
        "ce_training_portal" &&
      normalizeIdentifier(invitation?.org_id) === organizationId &&
      normalizeIdentifier(invitation?.cohort_id) === cohortId &&
      normalizeEmail(invitation?.email) === studentEmail &&
      !normalizeIdentifier(invitation?.client_id) &&
      ["", "member", "student"].includes(invitationCohortRole) &&
      invitationPaymentResponsibility ===
        enrollmentPaymentResponsibility &&
      invitationInstructorPaymentMode ===
        enrollmentInstructorPaymentMode
  );
}

function isControlledTestWaiverBillingEvent(
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string,
  studentEmail: string,
  activePlatformOwnerIds: Set<string>
) {
  const waivedByUserId = normalizeIdentifier(
    billingEvent?.waived_by_user_id
  );

  return Boolean(
    waivedByUserId &&
      activePlatformOwnerIds.has(waivedByUserId) &&
      normalizeText(billingEvent?.billing_event_key) ===
        buildControlledTestWaiverBillingEventKey(
          organizationId,
          cohortId,
          studentUserId
        ) &&
      normalizeText(billingEvent?.event_status).toLowerCase() ===
        "waived" &&
      normalizeText(billingEvent?.fee_kind).toLowerCase() ===
        "training_registration" &&
      normalizeText(billingEvent?.billing_subject_type).toLowerCase() ===
        "student" &&
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeIdentifier(billingEvent?.subject_user_id) ===
        studentUserId &&
      normalizeEmail(billingEvent?.subject_verified_email) ===
        studentEmail &&
      Number(billingEvent?.unit_amount_cents) ===
        CONTROLLED_TEST_WAIVER_AMOUNT_CENTS &&
      Number(billingEvent?.amount_cents) ===
        CONTROLLED_TEST_WAIVER_AMOUNT_CENTS &&
      normalizeText(billingEvent?.currency).toUpperCase() === "USD" &&
      !!normalizeText(billingEvent?.waived_at) &&
      !!normalizeText(billingEvent?.waiver_reason) &&
      !normalizeIdentifier(billingEvent?.stripe_checkout_session_id) &&
      !normalizeIdentifier(billingEvent?.stripe_payment_intent_id) &&
      !normalizeIdentifier(billingEvent?.stripe_invoice_id)
  );
}

function hasValidPaidBillingEvent(
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string,
  studentEmail: string
) {
  return Boolean(
    billingEvent &&
      normalizeText(billingEvent?.event_status).toLowerCase() === "paid" &&
      !!normalizeText(billingEvent?.paid_at) &&
      normalizeText(billingEvent?.billing_subject_type).toLowerCase() ===
        "student" &&
      TRAINING_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind).toLowerCase()
      ) &&
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeIdentifier(billingEvent?.subject_user_id) ===
        studentUserId &&
      normalizeEmail(billingEvent?.subject_verified_email) ===
        studentEmail
  );
}

function getEnrollmentChainKey(
  organizationId: string,
  cohortId: string,
  userId: string
) {
  return `${organizationId}::${cohortId}::${userId}`;
}

function getUserCohortKey(userId: string, cohortId: string) {
  return `${userId}::${cohortId}`;
}

function getValidatedEnrollmentChain(
  enrollment: any,
  context: {
    userById: Map<string, any>;
    organizationById: Map<string, any>;
    cohortById: Map<string, any>;
    membershipById: Map<string, any>;
    billingEventById: Map<string, any>;
    invitationById: Map<string, any>;
    activePlatformOwnerIds: Set<string>;
  }
) {
  const enrollmentId = normalizeIdentifier(enrollment?.id);
  const organizationId = normalizeIdentifier(enrollment?.org_id);
  const cohortId = normalizeIdentifier(enrollment?.cohort_id);
  const userId = normalizeIdentifier(enrollment?.user_id);
  const studentEmail = normalizeEmail(enrollment?.student_email);
  const membershipId = normalizeIdentifier(enrollment?.cohort_member_id);
  const billingEventId = normalizeIdentifier(
    enrollment?.organization_billing_event_id
  );
  const pendingRoleAssignmentId = normalizeIdentifier(
    enrollment?.pending_role_assignment_id
  );
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  if (
    !enrollmentId ||
    !organizationId ||
    !cohortId ||
    !userId ||
    !isValidEmail(studentEmail) ||
    !membershipId ||
    !billingEventId ||
    !normalizeText(enrollment?.payment_settled_at) ||
    !normalizeText(enrollment?.registered_at) ||
    normalizeText(enrollment?.enrollment_key) !==
      buildEnrollmentKey(
        organizationId,
        cohortId,
        studentEmail
      ) ||
    enrollment?.is_archived === true ||
    ![
      "active",
      "training_completed",
      "withdrawn",
      "revoked",
    ].includes(enrollmentStatus)
  ) {
    return null;
  }

  const user = context.userById.get(userId) || null;
  const organization = context.organizationById.get(organizationId) || null;
  const cohort = context.cohortById.get(cohortId) || null;
  const membership = context.membershipById.get(membershipId) || null;
  const billingEvent =
    context.billingEventById.get(billingEventId) || null;
  const invitation = pendingRoleAssignmentId
    ? context.invitationById.get(pendingRoleAssignmentId) || null
    : null;

  const userMatches =
    user &&
    normalizeIdentifier(user?.id) === userId &&
    normalizeIdentifier(user?.org_id) === organizationId &&
    normalizeEmail(user?.email) === studentEmail;

  const organizationMatches =
    organization &&
    normalizeIdentifier(organization?.id) === organizationId &&
    organization?.is_archived !== true;

  const cohortMatches =
    cohort &&
    normalizeIdentifier(cohort?.id) === cohortId &&
    normalizeIdentifier(cohort?.org_id) === organizationId &&
    normalizeText(cohort?.cohort_type).toLowerCase() ===
      TRAINING_COHORT_TYPE;

  const membershipMatches =
    membership &&
    normalizeIdentifier(membership?.id) === membershipId &&
    normalizeIdentifier(membership?.org_id) === organizationId &&
    normalizeIdentifier(membership?.cohort_id) === cohortId &&
    normalizeIdentifier(membership?.user_id) === userId &&
    normalizeText(membership?.cohort_role).toLowerCase() ===
      STUDENT_COHORT_ROLE &&
    membership?.is_archived !== true;

  const isControlledTestWaiver =
    !pendingRoleAssignmentId &&
    isControlledTestWaiverBillingEvent(
      billingEvent,
      organizationId,
      cohortId,
      userId,
      studentEmail,
      context.activePlatformOwnerIds
    );

  const hasAcceptedInvitation = pendingRoleAssignmentId
    ? isAcceptedCEStudentInvitation(
        invitation,
        enrollment,
        organizationId,
        cohortId,
        studentEmail
      )
    : false;

  const hasValidSettlement =
    hasValidPaidBillingEvent(
      billingEvent,
      organizationId,
      cohortId,
      userId,
      studentEmail
    ) || isControlledTestWaiver;

  if (
    !userMatches ||
    !organizationMatches ||
    !cohortMatches ||
    !membershipMatches ||
    !hasValidSettlement ||
    (!hasAcceptedInvitation && !isControlledTestWaiver)
  ) {
    return null;
  }

  const trainingStatus = normalizeTrainingStatus(membership);
  const isTrainingCompleted =
    enrollmentStatus === "training_completed" &&
    trainingStatus === "completed" &&
    !!normalizeText(enrollment?.training_completed_at) &&
    !!normalizeText(membership?.training_completed_at);

  const cohortStatus = normalizeText(cohort?.status).toLowerCase();

  const isOperational =
    isActiveRecord(enrollment) &&
    isActiveRecord(user) &&
    isActiveRecord(organization) &&
    isActiveRecord(cohort) &&
    isActiveRecord(membership) &&
    ["active", "training_completed"].includes(enrollmentStatus) &&
    ["active", "completed"].includes(cohortStatus) &&
    trainingStatus !== "withdrawn";

  const isHistoricalCertificationEligible =
    isTrainingCompleted &&
    [
      "active",
      "training_completed",
      "withdrawn",
      "revoked",
    ].includes(enrollmentStatus);

  return {
    enrollment_id: enrollmentId,
    organization_id: organizationId,
    cohort_id: cohortId,
    user_id: userId,
    student_email: studentEmail,
    membership_id: membershipId,
    billing_event_id: billingEventId,
    enrollment_status: enrollmentStatus,
    training_status: trainingStatus,
    training_completed_at:
      membership?.training_completed_at ||
      enrollment?.training_completed_at ||
      null,
    joined_at: membership?.joined_at || enrollment?.registered_at || null,
    membership_is_active: isActiveRecord(membership),
    is_operational: isOperational,
    is_training_completed: isTrainingCompleted,
    is_historical_certification_eligible:
      isHistoricalCertificationEligible,
    is_controlled_test_waiver: isControlledTestWaiver,
    cohort_name:
      normalizeText(cohort?.name) || "Unnamed CE training cohort",
    course_name: normalizeText(cohort?.course_name),
    course_version: normalizeText(cohort?.course_version),
    cohort_status: normalizeText(cohort?.status) || null,
  };
}

function choosePrimaryChain(chains: any[], certification: any) {
  const sourceCohortId = normalizeIdentifier(
    certification?.source_cohort_id
  );

  if (sourceCohortId) {
    const sourceChain = chains.find(
      (chain) => chain.cohort_id === sourceCohortId
    );

    if (sourceChain) {
      return sourceChain;
    }
  }

  const completedOperationalChains = chains
    .filter(
      (chain) =>
        chain.is_operational && chain.is_training_completed
    )
    .sort(sortNewestFirst);

  if (completedOperationalChains[0]) {
    return completedOperationalChains[0];
  }

  return chains
    .filter((chain) => chain.is_operational)
    .sort(sortNewestFirst)[0] || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE practitioner certification-manager request must use POST.",
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
          ok: false,
          error:
            "Please sign in before viewing CE practitioner certification administration.",
        },
        { status: 401 }
      );
    }

    const {
      caller,
      platformRoles,
    } = await resolveCanonicalPlatformOwner(
      base44,
      authenticatedUser.id
    );

    const [
      userRows,
      organizationRows,
      cohortRows,
      membershipRows,
      enrollmentRows,
      billingEventRows,
      invitationRows,
      certificationRows,
      platformOwnerRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.CETrainingCohort.list(),
      base44.asServiceRole.entities.CETrainingCohortMember.list(),
      base44.asServiceRole.entities.CETrainingStudentEnrollment.list(),
      base44.asServiceRole.entities.OrganizationBillingEvent.list(),
      base44.asServiceRole.entities.PendingRoleAssignment.list(),
      base44.asServiceRole.entities.CEPractitionerCertification.list(),
      base44.asServiceRole.entities.PlatformAdmin.filter({
        platform_role: PLATFORM_OWNER_ROLE,
        is_active: true,
      }),
    ]);

    const rawUsers = asArray(userRows).filter(
      (record: any) => Boolean(normalizeIdentifier(record?.id))
    );

    const userById = new Map(
      rawUsers.map((record: any) => [
        normalizeIdentifier(record.id),
        record,
      ])
    );

    const normalizedUserById = new Map(
      rawUsers.map((record: any) => {
        const normalized = normalizeUser(record);
        return [normalized.id, normalized];
      })
    );

    const organizationById = new Map(
      asArray(organizationRows)
        .filter((record: any) =>
          Boolean(normalizeIdentifier(record?.id))
        )
        .map((record: any) => [
          normalizeIdentifier(record.id),
          record,
        ])
    );

    const cohortById = new Map(
      asArray(cohortRows)
        .filter((record: any) =>
          Boolean(normalizeIdentifier(record?.id))
        )
        .map((record: any) => [
          normalizeIdentifier(record.id),
          record,
        ])
    );

    const membershipById = new Map(
      asArray(membershipRows)
        .filter((record: any) =>
          Boolean(normalizeIdentifier(record?.id))
        )
        .map((record: any) => [
          normalizeIdentifier(record.id),
          record,
        ])
    );

    const billingEventById = new Map(
      asArray(billingEventRows)
        .filter((record: any) =>
          Boolean(normalizeIdentifier(record?.id))
        )
        .map((record: any) => [
          normalizeIdentifier(record.id),
          record,
        ])
    );

    const invitationById = new Map(
      asArray(invitationRows)
        .filter((record: any) =>
          Boolean(normalizeIdentifier(record?.id))
        )
        .map((record: any) => [
          normalizeIdentifier(record.id),
          record,
        ])
    );

    const activePlatformOwnerIds = new Set(
      asArray(platformOwnerRows)
        .filter(
          (record: any) =>
            normalizeText(record?.platform_role).toLowerCase() ===
              PLATFORM_OWNER_ROLE &&
            record?.is_active !== false &&
            record?.is_archived !== true
        )
        .map((record: any) =>
          normalizeIdentifier(record?.user_id)
        )
        .filter(Boolean)
    );

    const rawChains = asArray(enrollmentRows)
      .map((enrollment: any) =>
        getValidatedEnrollmentChain(enrollment, {
          userById,
          organizationById,
          cohortById,
          membershipById,
          billingEventById,
          invitationById,
          activePlatformOwnerIds,
        })
      )
      .filter(Boolean);

    const chainsByKey = new Map<string, any[]>();

    for (const chain of rawChains) {
      const key = getEnrollmentChainKey(
        chain.organization_id,
        chain.cohort_id,
        chain.user_id
      );

      const existing = chainsByKey.get(key) || [];
      existing.push(chain);
      chainsByKey.set(key, existing);
    }

    const ambiguousEnrollmentChainKeys = new Set(
      Array.from(chainsByKey.entries())
        .filter(([, chains]) => chains.length !== 1)
        .map(([key]) => key)
    );

    const validChains = rawChains.filter(
      (chain) =>
        !ambiguousEnrollmentChainKeys.has(
          getEnrollmentChainKey(
            chain.organization_id,
            chain.cohort_id,
            chain.user_id
          )
        )
    );

    const chainByUserCohort = new Map(
      validChains.map((chain) => [
        getUserCohortKey(chain.user_id, chain.cohort_id),
        chain,
      ])
    );

    const chainsByUserId = new Map<string, any[]>();

    for (const chain of validChains) {
      const existing = chainsByUserId.get(chain.user_id) || [];
      existing.push(chain);
      chainsByUserId.set(chain.user_id, existing);
    }

    const rawCertifications = asArray(certificationRows).filter(
      (record: any) =>
        Boolean(normalizeIdentifier(record?.id)) &&
        Boolean(normalizeIdentifier(record?.user_id))
    );

    const certificationRowsByUserId = new Map<string, any[]>();

    for (const certification of rawCertifications) {
      const userId = normalizeIdentifier(certification.user_id);
      const existing = certificationRowsByUserId.get(userId) || [];
      existing.push(certification);
      certificationRowsByUserId.set(userId, existing);
    }

    const duplicateCertificationUserIds = Array.from(
      certificationRowsByUserId.entries()
    )
      .filter(([, records]) => records.length > 1)
      .map(([userId]) => userId)
      .sort();

    const duplicateCertificationUserIdSet = new Set(
      duplicateCertificationUserIds
    );

    const validCertificationByUserId = new Map<string, any>();

    for (const certification of rawCertifications) {
      const userId = normalizeIdentifier(certification.user_id);

      if (duplicateCertificationUserIdSet.has(userId)) {
        continue;
      }

      const certificationStatus = normalizeText(
        certification?.certification_status
      ).toLowerCase();
      const sourceCohortId = normalizeIdentifier(
        certification?.source_cohort_id
      );
      const chain = sourceCohortId
        ? chainByUserCohort.get(
            getUserCohortKey(userId, sourceCohortId)
          ) || null
        : null;

      const sourceIsEligible =
        chain &&
        (
          certificationStatus === "verified" ||
          certificationStatus === "revoked"
            ? chain.is_historical_certification_eligible
            : chain.is_operational &&
              chain.is_training_completed
        );

      if (
        !VALID_CERTIFICATION_STATUSES.has(certificationStatus) ||
        !sourceIsEligible
      ) {
        continue;
      }

      validCertificationByUserId.set(userId, {
        record: certification,
        chain,
      });
    }

    const blockedUserIds = new Set<string>([
      ...duplicateCertificationUserIds,
      ...rawCertifications
        .filter((certification: any) => {
          const userId = normalizeIdentifier(certification?.user_id);

          return (
            !duplicateCertificationUserIdSet.has(userId) &&
            !validCertificationByUserId.has(userId)
          );
        })
        .map((certification: any) =>
          normalizeIdentifier(certification?.user_id)
        )
        .filter(Boolean),
    ]);

    const normalizedCertifications = Array.from(
      validCertificationByUserId.values()
    )
      .map(({ record }) =>
        serializeCertification(
          record,
          normalizedUserById.get(
            normalizeIdentifier(record?.user_id)
          ) || null
        )
      )
      .sort((left, right) => {
        const nameComparison = left.practitioner_name.localeCompare(
          right.practitioner_name,
          undefined,
          { sensitivity: "base" }
        );

        if (nameComparison !== 0) {
          return nameComparison;
        }

        return left.id.localeCompare(right.id);
      });

    const operationalChainsByUserId = new Map<string, any[]>();

    for (const chain of validChains) {
      if (!chain.is_operational || blockedUserIds.has(chain.user_id)) {
        continue;
      }

      const existing =
        operationalChainsByUserId.get(chain.user_id) || [];
      existing.push(chain);
      operationalChainsByUserId.set(chain.user_id, existing);
    }

    const pipelineUserIds = new Set<string>([
      ...operationalChainsByUserId.keys(),
      ...validCertificationByUserId.keys(),
    ]);

    const people = Array.from(pipelineUserIds)
      .map((userId) => {
        const normalizedUser = normalizedUserById.get(userId) || null;

        if (!normalizedUser) {
          return null;
        }

        const validCertification =
          validCertificationByUserId.get(userId) || null;
        const certification = validCertification?.record || null;

        const availableChains = validCertification
          ? (chainsByUserId.get(userId) || []).filter(
              (chain) =>
                chain.is_operational ||
                chain.is_historical_certification_eligible
            )
          : operationalChainsByUserId.get(userId) || [];

        const primaryChain =
          validCertification?.chain ||
          choosePrimaryChain(availableChains, certification);

        if (!primaryChain) {
          return null;
        }

        const pipelineStatus = getPipelineStatus(
          certification,
          primaryChain
        );

        return {
          ...normalizedUser,
          certification_record_id:
            normalizeIdentifier(certification?.id) || null,
          certification_status:
            normalizeText(certification?.certification_status) ||
            "none",
          certification_source:
            normalizeText(certification?.certification_source) || null,
          certification_completed_at:
            certification?.completed_at || null,
          certification_verified_at:
            certification?.verified_at || null,
          pipeline_status: pipelineStatus,
          pipeline_status_label: getPipelineStatusLabel(pipelineStatus),
          cohort_id: primaryChain.cohort_id,
          cohort_name: primaryChain.cohort_name,
          course_name: primaryChain.course_name || null,
          course_version: primaryChain.course_version || null,
          cohort_status: primaryChain.cohort_status,
          membership_is_active:
            primaryChain.membership_is_active === false
              ? false
              : true,
          training_status: primaryChain.training_status,
          training_completed_at:
            primaryChain.training_completed_at || null,
          paid_training_enrollment_count: (
            chainsByUserId.get(userId) || []
          ).filter(
            (chain) =>
              chain.is_operational ||
              chain.is_historical_certification_eligible
          ).length,
          is_controlled_test_waiver:
            primaryChain.is_controlled_test_waiver,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const statusDifference =
          (PIPELINE_STATUS_ORDER[left.pipeline_status] || 99) -
          (PIPELINE_STATUS_ORDER[right.pipeline_status] || 99);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return left.display_name.localeCompare(
          right.display_name,
          undefined,
          { sensitivity: "base" }
        );
      });

    return Response.json({
      ok: true,
      viewer: {
        user_id: normalizeIdentifier(caller?.id),
        platform_roles: platformRoles,
        can_manage_certifications: true,
      },
      people,
      certifications: normalizedCertifications,
      integrity: {
        duplicate_certification_user_ids:
          duplicateCertificationUserIds,
        duplicate_certification_count:
          duplicateCertificationUserIds.length,
        ambiguous_enrollment_chain_count:
          ambiguousEnrollmentChainKeys.size,
        excluded_non_pipeline_certification_count:
          rawCertifications.length - normalizedCertifications.length,
      },
      counts: {
        people_count: people.length,
        in_training_count: people.filter(
          (person) => person.pipeline_status === "in_training"
        ).length,
        pending_certification_count: people.filter(
          (person) =>
            person.pipeline_status === "pending_certification"
        ).length,
        certified_count: people.filter(
          (person) => person.pipeline_status === "certified"
        ).length,
        revoked_count: people.filter(
          (person) => person.pipeline_status === "revoked"
        ).length,
      },
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[getCEPractitionerCertificationManagerData] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to load CE practitioner certification administration data. Please try again or contact a Platform Owner.",
      },
      { status }
    );
  }
});
