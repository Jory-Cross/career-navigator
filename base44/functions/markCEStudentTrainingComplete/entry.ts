import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const SETTLED_TRAINING_REGISTRATION_STATUSES = new Set([
  "paid",
  "waived",
]);

const PAID_TRAINING_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const ALLOWED_COHORT_STATUSES = new Set([
  "active",
  "completed",
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
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
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

function getRequiredString(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new RequestError(400, message);
  }

  return normalized;
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActiveRecord(caller)) {
    throw new RequestError(
      403,
      "Your account is unavailable or inactive."
    );
  }

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeIdentifier(caller?.org_id);
  const callerProfile = getRoleProfile(caller);

  if (!callerId || !isValidEmail(callerEmail)) {
    throw new RequestError(
      403,
      "Your account is missing a verified email address."
    );
  }

  if (
    !callerProfile ||
    !["admin", "management", "ce_instructor"].includes(
      callerProfile.role
    )
  ) {
    throw new RequestError(
      403,
      "You are not authorized to record CE student training completion."
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
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId,
    callerProfile,
    organizationId,
  };
}

async function resolveTrainingCohort(
  base44: any,
  organizationId: string,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    ).catch(() => null);

  if (
    !cohort ||
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !==
      "training" ||
    !ALLOWED_COHORT_STATUSES.has(
      normalizeText(cohort?.status).toLowerCase()
    ) ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      403,
      "The selected Training cohort is unavailable."
    );
  }

  return cohort;
}

async function assertCohortAuthority(
  base44: any,
  caller: any,
  callerProfile: { role: string; access_level: string },
  organizationId: string,
  cohortId: string
) {
  if (callerProfile.role === "admin") {
    return;
  }

  const memberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: caller.id,
      }
    );

  const hasAuthority = asArray(memberships).some(
    (membership: any) =>
      normalizeIdentifier(membership?.org_id) === organizationId &&
      ["manager", "trainer"].includes(
        normalizeText(membership?.cohort_role).toLowerCase()
      ) &&
      membership?.is_active !== false &&
      membership?.is_archived !== true
  );

  if (!hasAuthority) {
    throw new RequestError(
      403,
      "You must be an active manager or trainer of this Training cohort to record student training completion."
    );
  }
}

async function resolveStudentMembership(
  base44: any,
  organizationId: string,
  cohortId: string,
  membershipId: string
) {
  const membership =
    await base44.asServiceRole.entities.CETrainingCohortMember.get(
      membershipId
    ).catch(() => null);

  if (
    !membership ||
    normalizeIdentifier(membership?.org_id) !== organizationId ||
    normalizeIdentifier(membership?.cohort_id) !== cohortId ||
    normalizeText(membership?.cohort_role).toLowerCase() !==
      "member" ||
    membership?.is_active === false ||
    membership?.is_archived === true ||
    !normalizeIdentifier(membership?.user_id)
  ) {
    throw new RequestError(
      404,
      "An active CE student membership for this Training cohort was not found."
    );
  }

  return membership;
}

async function resolveStudentUser(
  base44: any,
  organizationId: string,
  studentUserId: string
) {
  const studentUser = await base44.asServiceRole.entities.User.get(
    studentUserId
  ).catch(() => null);

  const studentProfile = getRoleProfile(studentUser);
  const studentEmail = normalizeEmail(studentUser?.email);

  if (
    !studentUser ||
    !isActiveRecord(studentUser) ||
    !studentProfile ||
    studentProfile.role !== "ce_student" ||
    normalizeIdentifier(studentUser?.org_id) !== organizationId ||
    !isValidEmail(studentEmail)
  ) {
    throw new RequestError(
      409,
      "The selected cohort member is not connected to an active CE student account in this organization."
    );
  }

  return {
    studentUser,
    studentEmail,
  };
}

async function resolveEnrollmentAndSettlement(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentMembership: any,
  studentEmail: string
) {
  const studentUserId = normalizeIdentifier(studentMembership?.user_id);

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        org_id: organizationId,
        cohort_id: cohortId,
        user_id: studentUserId,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.org_id) === organizationId &&
      normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
      normalizeIdentifier(enrollment?.user_id) === studentUserId
  );

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      "This CE student membership does not have exactly one durable enrollment record."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();
  const billingEventId = normalizeIdentifier(
    enrollment?.organization_billing_event_id
  );

  const enrollmentMatches =
    enrollment?.is_active !== false &&
    enrollment?.is_archived !== true &&
    normalizeEmail(enrollment?.student_email) === studentEmail &&
    normalizeIdentifier(enrollment?.cohort_member_id) ===
      normalizeIdentifier(studentMembership?.id) &&
    !!normalizeIdentifier(enrollment?.pending_role_assignment_id) &&
    !!normalizeText(enrollment?.payment_settled_at) &&
    !!normalizeText(enrollment?.registered_at) &&
    !!billingEventId &&
    ["active", "training_completed"].includes(enrollmentStatus);

  if (!enrollmentMatches) {
    throw new RequestError(
      409,
      "The durable CE enrollment is incomplete or is not safely linked to this active student membership."
    );
  }

  const billingEvent =
    await base44.asServiceRole.entities.OrganizationBillingEvent.get(
      billingEventId
    ).catch(() => null);

  const billingMatches =
    billingEvent &&
    normalizeIdentifier(billingEvent?.organization_id) ===
      organizationId &&
    normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
    normalizeIdentifier(billingEvent?.subject_user_id) ===
      studentUserId &&
    normalizeEmail(billingEvent?.subject_verified_email) ===
      studentEmail &&
    normalizeText(billingEvent?.billing_subject_type) ===
      "student" &&
    PAID_TRAINING_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    ) &&
    SETTLED_TRAINING_REGISTRATION_STATUSES.has(
      normalizeText(billingEvent?.event_status).toLowerCase()
    );

  if (!billingMatches) {
    throw new RequestError(
      409,
      "A matching settled CE registration record is required before training completion can be recorded."
    );
  }

  return {
    enrollment,
    enrollmentStatus,
  };
}

async function assertNoCertificationReviewStarted(
  base44: any,
  studentUserId: string
) {
  const certificationRows =
    await base44.asServiceRole.entities.CEPractitionerCertification.filter(
      {
        user_id: studentUserId,
      }
    );

  if (asArray(certificationRows).length > 0) {
    throw new RequestError(
      409,
      "This student already has a certification record. Training completion cannot be changed after certification review has begun."
    );
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student training-completion request must use POST.",
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
            "Please sign in before recording CE student training completion.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    if (normalizeText(body?.action) !== "mark_completed") {
      return Response.json(
        {
          ok: false,
          error: "Only the mark_completed action is supported.",
        },
        { status: 400 }
      );
    }

    const cohortId = getRequiredString(
      body?.cohort_id,
      "A Training cohort must be selected."
    );
    const membershipId = getRequiredString(
      body?.membership_id,
      "A CE student membership must be selected."
    );

    const {
      caller,
      callerId,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    await resolveTrainingCohort(
      base44,
      organizationId,
      cohortId
    );

    await assertCohortAuthority(
      base44,
      caller,
      callerProfile,
      organizationId,
      cohortId
    );

    const studentMembership = await resolveStudentMembership(
      base44,
      organizationId,
      cohortId,
      membershipId
    );

    const {
      studentUser,
      studentEmail,
    } = await resolveStudentUser(
      base44,
      organizationId,
      normalizeIdentifier(studentMembership?.user_id)
    );

    const {
      enrollment,
      enrollmentStatus,
    } = await resolveEnrollmentAndSettlement(
      base44,
      organizationId,
      cohortId,
      studentMembership,
      studentEmail
    );

    await assertNoCertificationReviewStarted(
      base44,
      normalizeIdentifier(studentMembership?.user_id)
    );

    const membershipTrainingStatus = normalizeText(
      studentMembership?.training_status
    ).toLowerCase();

    if (
      membershipTrainingStatus === "withdrawn" ||
      ["withdrawn", "revoked"].includes(enrollmentStatus)
    ) {
      throw new RequestError(
        409,
        "This student is withdrawn or revoked and cannot be marked as training-complete."
      );
    }

    const membershipIsCompleted =
      membershipTrainingStatus === "completed";
    const enrollmentIsCompleted =
      enrollmentStatus === "training_completed";

    if (membershipIsCompleted && enrollmentIsCompleted) {
      return Response.json({
        ok: true,
        already_completed: true,
        message: "This student's training completion is already recorded.",
        membership_id: studentMembership.id,
        enrollment_id: enrollment.id,
        cohort_id: cohortId,
      });
    }

    if (membershipIsCompleted !== enrollmentIsCompleted) {
      throw new RequestError(
        409,
        "The student membership and durable enrollment have inconsistent training-completion states and require administrator review."
      );
    }

    if (
      membershipTrainingStatus &&
      membershipTrainingStatus !== "in_training"
    ) {
      throw new RequestError(
        409,
        "This student's cohort membership is not in a state that can be marked complete."
      );
    }

    if (enrollmentStatus !== "active") {
      throw new RequestError(
        409,
        "This student's durable CE enrollment is not active and cannot be marked training-complete."
      );
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
      enrollment.id,
      {
        enrollment_status: "training_completed",
        training_completed_at: now,
        status_updated_at: now,
      }
    );

    try {
      await base44.asServiceRole.entities.CETrainingCohortMember.update(
        studentMembership.id,
        {
          training_status: "completed",
          training_completed_at: now,
          training_completed_by_user_id: callerId,
        }
      );
    } catch (membershipUpdateError) {
      console.error(
        "[markCEStudentTrainingComplete] Membership update failed after enrollment update:",
        membershipUpdateError instanceof Error
          ? membershipUpdateError.message
          : membershipUpdateError
      );

      try {
        await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
          enrollment.id,
          {
            enrollment_status: "active",
            training_completed_at: null,
            status_updated_at: new Date().toISOString(),
          }
        );
      } catch (rollbackError) {
        console.error(
          "[markCEStudentTrainingComplete] Enrollment rollback failed:",
          rollbackError instanceof Error
            ? rollbackError.message
            : rollbackError
        );
      }

      throw new RequestError(
        500,
        "Training completion could not be recorded consistently. No certification review should begin until an organization administrator reviews this student."
      );
    }

    return Response.json({
      ok: true,
      already_completed: false,
      message:
        `${normalizeText(studentUser?.full_name) || studentEmail} is now ready for Pending Certification review.`,
      membership_id: studentMembership.id,
      enrollment_id: enrollment.id,
      cohort_id: cohortId,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[markCEStudentTrainingComplete] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "CE student training completion could not be recorded. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});
