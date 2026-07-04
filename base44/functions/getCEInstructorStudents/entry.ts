import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  ce_instructor: "ce_training_portal",
};

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const CHECKOUT_ELIGIBLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "payment_processing",
  "failed",
]);

const ACTIVE_ENROLLMENT_STATUSES = new Set([
  "active",
  "training_completed",
]);

const TEST_WAIVER_AMOUNT_CENTS = 4900;

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

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
}

function getDisplayUser(user: any) {
  return {
    id: normalizeIdentifier(user?.id),
    full_name: normalizeText(user?.full_name),
    email: normalizeEmail(user?.email),
  };
}

function getInvitePaymentResponsibility(invite: any) {
  return normalizeText(invite?.payment_responsibility) || "student_paid";
}

function getInviteInstructorPaymentMode(invite: any) {
  return getInvitePaymentResponsibility(invite) === "instructor_paid"
    ? normalizeText(invite?.instructor_payment_mode) || "pay_now"
    : "";
}

function isActiveTrainingCohort(
  cohort: any,
  organizationId: string
) {
  return (
    isActiveRecord(cohort) &&
    normalizeIdentifier(cohort?.org_id) === organizationId &&
    normalizeText(cohort?.cohort_type).toLowerCase() === "training" &&
    normalizeText(cohort?.status).toLowerCase() !== "archived"
  );
}

function isValidCEStudentInvite(
  invite: any,
  organizationId: string,
  cohortId: string,
  email: string
) {
  const cohortRole = normalizeText(invite?.cohort_role).toLowerCase();

  return (
    invite?.is_archived !== true &&
    normalizeIdentifier(invite?.org_id) === organizationId &&
    normalizeIdentifier(invite?.cohort_id) === cohortId &&
    normalizeEmail(invite?.email) === email &&
    normalizeText(invite?.role).toLowerCase() === "ce_student" &&
    normalizeText(invite?.access_level).toLowerCase() ===
      "ce_training_portal" &&
    !normalizeIdentifier(invite?.client_id) &&
    ["", "member", "student"].includes(cohortRole)
  );
}

function isValidEnrollmentForInvite(
  enrollment: any,
  invite: any,
  organizationId: string,
  cohortId: string,
  email: string
) {
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  const invitePaymentResponsibility =
    getInvitePaymentResponsibility(invite);

  const inviteInstructorPaymentMode =
    getInviteInstructorPaymentMode(invite);

  const enrollmentPaymentResponsibility = normalizeText(
    enrollment?.payment_responsibility
  );

  const enrollmentInstructorPaymentMode = normalizeText(
    enrollment?.instructor_payment_mode
  );

  return (
    isActiveRecord(enrollment) &&
    !["withdrawn", "revoked"].includes(enrollmentStatus) &&
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === email &&
    normalizeIdentifier(enrollment?.pending_role_assignment_id) ===
      normalizeIdentifier(invite?.id) &&
    normalizeIdentifier(
      enrollment?.organization_billing_event_id
    ) &&
    enrollmentPaymentResponsibility ===
      invitePaymentResponsibility &&
    enrollmentInstructorPaymentMode ===
      inviteInstructorPaymentMode
  );
}

function isBillingEventLinkedToEnrollment(
  billingEvent: any,
  enrollment: any,
  organizationId: string,
  cohortId: string,
  email: string
) {
  return (
    normalizeIdentifier(billingEvent?.id) ===
      normalizeIdentifier(
        enrollment?.organization_billing_event_id
      ) &&
    normalizeIdentifier(billingEvent?.organization_id) ===
      organizationId &&
    normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
    normalizeEmail(billingEvent?.subject_verified_email) === email &&
    normalizeText(billingEvent?.billing_subject_type) ===
      "student" &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    )
  );
}

function isValidPaidBillingEvent(
  billingEvent: any,
  userId: string
) {
  return (
    normalizeText(billingEvent?.event_status).toLowerCase() ===
      "paid" &&
    !!normalizeText(billingEvent?.paid_at) &&
    normalizeIdentifier(billingEvent?.subject_user_id) === userId
  );
}

function isValidControlledTestWaiver(
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  userId: string,
  email: string,
  platformOwnerUserIds: Set<string>
) {
  const expectedBillingEventKey =
    `test_waived_training_registration:` +
    `${organizationId}:${cohortId}:${userId}`;

  const waiverActorId = normalizeIdentifier(
    billingEvent?.waived_by_user_id
  );

  return (
    normalizeText(billingEvent?.event_status).toLowerCase() ===
      "waived" &&
    normalizeText(billingEvent?.billing_event_key) ===
      expectedBillingEventKey &&
    normalizeIdentifier(billingEvent?.subject_user_id) === userId &&
    normalizeEmail(billingEvent?.subject_verified_email) === email &&
    normalizeText(billingEvent?.fee_kind) ===
      "training_registration" &&
    Number(billingEvent?.amount_cents) ===
      TEST_WAIVER_AMOUNT_CENTS &&
    !!normalizeText(billingEvent?.waived_at) &&
    !!waiverActorId &&
    platformOwnerUserIds.has(waiverActorId)
  );
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeIdentifier(caller?.org_id);
  const roleProfile = getRoleProfile(caller);

  if (
    !caller ||
    !isActiveRecord(caller) ||
    !callerId ||
    !isValidEmail(callerEmail)
  ) {
    throw new RequestError(
      403,
      "Your account is unavailable or does not have a verified email address."
    );
  }

  if (!roleProfile) {
    throw new RequestError(
      403,
      "Your current role does not allow CE student access."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is unavailable or inactive."
    );
  }

  return {
    caller,
    callerId,
    organizationId,
    roleProfile,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student directory request must use POST.",
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
            "Please sign in before viewing CE students.",
        },
        { status: 401 }
      );
    }

    const {
      caller,
      callerId,
      organizationId,
      roleProfile,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const [
      cohortRows,
      membershipRows,
      inviteRows,
      enrollmentRows,
      billingEventRows,
      userRows,
      platformOwnerRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohort.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        org_id: organizationId,
        is_active: true,
      }),
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: organizationId,
        role: "ce_student",
      }),
      base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: organizationId,
      }),
      base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.PlatformAdmin.filter({
        platform_role: "platform_owner",
        is_active: true,
      }).catch(() => []),
    ]);

    const organizationCohorts = asArray(cohortRows).filter(
      (cohort: any) =>
        isActiveTrainingCohort(cohort, organizationId)
    );

    const cohortById = new Map(
      organizationCohorts.map((cohort: any) => [
        normalizeIdentifier(cohort?.id),
        cohort,
      ])
    );

    const activeMemberships = asArray(membershipRows).filter(
      (membership: any) =>
        isActiveRecord(membership) &&
        normalizeIdentifier(membership?.org_id) ===
          organizationId &&
        cohortById.has(
          normalizeIdentifier(membership?.cohort_id)
        )
    );

    const canViewAllOrganizationCohorts =
      roleProfile.role === "admin" ||
      roleProfile.role === "management";

    const visibleCohortIds = canViewAllOrganizationCohorts
      ? new Set(cohortById.keys())
      : new Set(
          activeMemberships
            .filter(
              (membership: any) =>
                normalizeIdentifier(membership?.user_id) ===
                  callerId &&
                ["manager", "trainer"].includes(
                  normalizeText(
                    membership?.cohort_role
                  ).toLowerCase()
                )
            )
            .map((membership: any) =>
              normalizeIdentifier(membership?.cohort_id)
            )
            .filter(Boolean)
        );

    const cohorts = organizationCohorts.filter((cohort: any) =>
      visibleCohortIds.has(normalizeIdentifier(cohort?.id))
    );

    const platformOwnerUserIds = new Set(
      asArray(platformOwnerRows)
        .filter(
          (record: any) =>
            normalizeText(record?.platform_role) ===
              "platform_owner" &&
            record?.is_active !== false
        )
        .map((record: any) =>
          normalizeIdentifier(record?.user_id)
        )
        .filter(Boolean)
    );

    const usersById = new Map(
      asArray(userRows)
        .filter(
          (user: any) =>
            isActiveRecord(user) &&
            normalizeIdentifier(user?.org_id) === organizationId
        )
        .map((user: any) => [
          normalizeIdentifier(user?.id),
          user,
        ])
    );

    const billingEventsById = new Map(
      asArray(billingEventRows)
        .filter(
          (billingEvent: any) =>
            normalizeIdentifier(
              billingEvent?.organization_id
            ) === organizationId
        )
        .map((billingEvent: any) => [
          normalizeIdentifier(billingEvent?.id),
          billingEvent,
        ])
    );

    const allInvites = asArray(inviteRows).filter(
      (invite: any) =>
        invite?.is_archived !== true &&
        normalizeIdentifier(invite?.org_id) === organizationId &&
        normalizeText(invite?.role).toLowerCase() ===
          "ce_student"
    );

    const invitesById = new Map(
      allInvites
        .filter((invite: any) => normalizeIdentifier(invite?.id))
        .map((invite: any) => [
          normalizeIdentifier(invite?.id),
          invite,
        ])
    );

    const allEnrollments = asArray(enrollmentRows).filter(
      (enrollment: any) =>
        normalizeIdentifier(enrollment?.org_id) ===
        organizationId
    );

    const enrollmentsByInviteId = new Map<string, any[]>();

    for (const enrollment of allEnrollments) {
      const inviteId = normalizeIdentifier(
        enrollment?.pending_role_assignment_id
      );

      if (!inviteId) {
        continue;
      }

      if (!enrollmentsByInviteId.has(inviteId)) {
        enrollmentsByInviteId.set(inviteId, []);
      }

      enrollmentsByInviteId.get(inviteId)?.push(enrollment);
    }

    const memberById = new Map(
      activeMemberships
        .filter(
          (membership: any) =>
            normalizeText(
              membership?.cohort_role
            ).toLowerCase() === "member" &&
            normalizeIdentifier(membership?.id)
        )
        .map((membership: any) => [
          normalizeIdentifier(membership?.id),
          membership,
        ])
    );

    const enrollmentCountsByUserAndCohort = new Map<
      string,
      number
    >();

    for (const enrollment of allEnrollments) {
      const enrollmentUserId = normalizeIdentifier(
        enrollment?.user_id
      );
      const enrollmentCohortId = normalizeIdentifier(
        enrollment?.cohort_id
      );

      if (!enrollmentUserId || !enrollmentCohortId) {
        continue;
      }

      const key = `${enrollmentUserId}:${enrollmentCohortId}`;

      enrollmentCountsByUserAndCohort.set(
        key,
        (enrollmentCountsByUserAndCohort.get(key) || 0) + 1
      );
    }

    const pending = allInvites
      .filter((invite: any) =>
        OPEN_INVITE_STATUSES.has(
          normalizeText(invite?.status).toLowerCase()
        )
      )
      .filter((invite: any) => {
        const cohortId = normalizeIdentifier(invite?.cohort_id);

        return (
          !!cohortId &&
          visibleCohortIds.has(cohortId) &&
          isValidCEStudentInvite(
            invite,
            organizationId,
            cohortId,
            normalizeEmail(invite?.email)
          )
        );
      })
      .map((invite: any) => {
        const inviteId = normalizeIdentifier(invite?.id);
        const cohortId = normalizeIdentifier(invite?.cohort_id);
        const email = normalizeEmail(invite?.email);

        const relatedEnrollments =
          enrollmentsByInviteId.get(inviteId) || [];

        const validEnrollments = relatedEnrollments.filter(
          (enrollment: any) =>
            isValidEnrollmentForInvite(
              enrollment,
              invite,
              organizationId,
              cohortId,
              email
            )
        );

        const enrollment =
          validEnrollments.length === 1
            ? validEnrollments[0]
            : null;

        const billingEvent = enrollment
          ? billingEventsById.get(
              normalizeIdentifier(
                enrollment?.organization_billing_event_id
              )
            ) || null
          : null;

        const billingEventMatches =
          !!enrollment &&
          !!billingEvent &&
          isBillingEventLinkedToEnrollment(
            billingEvent,
            enrollment,
            organizationId,
            cohortId,
            email
          );

        const paymentResponsibility =
          getInvitePaymentResponsibility(invite);

        const instructorPaymentMode =
          getInviteInstructorPaymentMode(invite) || null;

        const requiresFutureInvoice =
          paymentResponsibility === "instructor_paid" &&
          instructorPaymentMode === "invoice_with_cohort";

        const billingStatus = billingEventMatches
          ? normalizeText(
              billingEvent?.event_status
            ).toLowerCase()
          : null;

        return {
          id: inviteId,
          email,
          user: null,
          cohorts: [],
          status: "pending",
          payment_responsibility: paymentResponsibility,
          instructor_payment_mode: instructorPaymentMode,
          billing_event_id: billingEventMatches
            ? normalizeIdentifier(billingEvent?.id)
            : null,
          billing_event_status: billingStatus,
          billing_event_amount_cents: billingEventMatches
            ? Number.isFinite(
                Number(billingEvent?.amount_cents)
              )
              ? Number(billingEvent.amount_cents)
              : null
            : null,
          billing_event_currency: billingEventMatches
            ? normalizeText(billingEvent?.currency) || null
            : null,
          billing_event_triggered_at: billingEventMatches
            ? normalizeText(billingEvent?.triggered_at) || null
            : null,
          billing_event_missing:
            validEnrollments.length === 0 ||
            !billingEventMatches,
          billing_event_conflict:
            relatedEnrollments.length > 1 ||
            validEnrollments.length > 1,
          checkout_available:
            billingEventMatches &&
            !requiresFutureInvoice &&
            !!billingStatus &&
            CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
              billingStatus
            ),
        };
      })
      .sort((left: any, right: any) =>
        left.email.localeCompare(right.email)
      );

    const activeByUserId = new Map<string, any>();

    for (const enrollment of allEnrollments) {
      const cohortId = normalizeIdentifier(enrollment?.cohort_id);
      const userId = normalizeIdentifier(enrollment?.user_id);
      const email = normalizeEmail(enrollment?.student_email);
      const enrollmentStatus = normalizeText(
        enrollment?.enrollment_status
      ).toLowerCase();

      if (
        !visibleCohortIds.has(cohortId) ||
        !userId ||
        !email ||
        !isActiveRecord(enrollment) ||
        !ACTIVE_ENROLLMENT_STATUSES.has(enrollmentStatus) ||
        !normalizeText(enrollment?.payment_settled_at) ||
        !normalizeText(enrollment?.registered_at)
      ) {
        continue;
      }

      if (
        enrollmentCountsByUserAndCohort.get(
          `${userId}:${cohortId}`
        ) !== 1
      ) {
        continue;
      }

      const cohort = cohortById.get(cohortId);
      const user = usersById.get(userId);
      const membership = memberById.get(
        normalizeIdentifier(enrollment?.cohort_member_id)
      );
      const billingEvent = billingEventsById.get(
        normalizeIdentifier(
          enrollment?.organization_billing_event_id
        )
      );
      const invite = invitesById.get(
        normalizeIdentifier(
          enrollment?.pending_role_assignment_id
        )
      );

      const validStudentUser =
        !!user &&
        normalizeIdentifier(user?.org_id) === organizationId &&
        normalizeEmail(user?.email) === email &&
        normalizeText(user?.role).toLowerCase() ===
          "ce_student" &&
        normalizeText(user?.access_level).toLowerCase() ===
          "ce_training_portal";

      const validMembership =
        !!membership &&
        isActiveRecord(membership) &&
        normalizeIdentifier(membership?.org_id) ===
          organizationId &&
        normalizeIdentifier(membership?.cohort_id) === cohortId &&
        normalizeIdentifier(membership?.user_id) === userId &&
        normalizeText(membership?.cohort_role).toLowerCase() ===
          "member";

      const validBillingBase =
        !!billingEvent &&
        isBillingEventLinkedToEnrollment(
          billingEvent,
          enrollment,
          organizationId,
          cohortId,
          email
        );

      const validPaidBilling =
        validBillingBase &&
        isValidPaidBillingEvent(billingEvent, userId);

      const validTestWaiver =
        validBillingBase &&
        isValidControlledTestWaiver(
          billingEvent,
          organizationId,
          cohortId,
          userId,
          email,
          platformOwnerUserIds
        );

      const validNormalInvite =
        !!invite &&
        normalizeText(invite?.status).toLowerCase() ===
          "accepted" &&
        isValidCEStudentInvite(
          invite,
          organizationId,
          cohortId,
          email
        ) &&
        normalizeIdentifier(invite?.id) ===
          normalizeIdentifier(
            enrollment?.pending_role_assignment_id
          );

      if (
        !cohort ||
        !validStudentUser ||
        !validMembership ||
        (!validPaidBilling && !validTestWaiver) ||
        (!validNormalInvite && !validTestWaiver)
      ) {
        continue;
      }

      if (!activeByUserId.has(userId)) {
        activeByUserId.set(userId, {
          id: userId,
          email,
          user: getDisplayUser(user),
          cohorts: [],
          status: "active",
        });
      }

      const activeStudent = activeByUserId.get(userId);

      if (
        !activeStudent.cohorts.some(
          (existingCohort: any) =>
            normalizeIdentifier(existingCohort?.id) === cohortId
        )
      ) {
        activeStudent.cohorts.push(cohort);
      }
    }

    const active = [...activeByUserId.values()]
      .map((student: any) => ({
        ...student,
        cohorts: student.cohorts.sort(
          (left: any, right: any) =>
            normalizeText(left?.name).localeCompare(
              normalizeText(right?.name)
            )
        ),
      }))
      .sort((left: any, right: any) =>
        left.email.localeCompare(right.email)
      );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      cohorts,
      active,
      pending,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[getCEInstructorStudents] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "CE students could not be loaded. Refresh the page or contact your organization administrator.",
      },
      { status }
    );
  }
});
