import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

const TRAINING_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const WAIVABLE_ENROLLMENT_STATUSES = new Set([
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
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function getRequiredString(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new RequestError(400, message);
  }

  return normalized;
}

function appendAuditNote(existingNote: unknown, addition: string) {
  const existing = normalizeText(existingNote);

  return existing
    ? `${existing}\n\n${addition}`
    : addition;
}

function getStudentDisplayName(student: any) {
  return (
    normalizeText(student?.full_name) ||
    normalizeEmail(student?.email) ||
    "CE student"
  );
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
      "Your platform account is unavailable or inactive."
    );
  }

  const platformRoleRows =
    await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: callerId,
      platform_role: PLATFORM_OWNER_ROLE,
      is_active: true,
    });

  const isPlatformOwner = asArray(platformRoleRows).some(
    (record: any) =>
      normalizeIdentifier(record?.user_id) === callerId &&
      normalizeText(record?.platform_role) ===
        PLATFORM_OWNER_ROLE &&
      record?.is_active !== false
  );

  if (!isPlatformOwner) {
    throw new RequestError(
      403,
      "Only an active Platform Owner may record a CE student test registration waiver."
    );
  }

  return {
    caller,
    callerId,
  };
}

async function resolveTrainingCohort(
  base44: any,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    ).catch(() => null);

  const organizationId = normalizeIdentifier(cohort?.org_id);
  const cohortStatus = normalizeText(
    cohort?.status
  ).toLowerCase();

  if (
    !cohort ||
    !organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !==
      "training" ||
    !["active", "completed"].includes(cohortStatus) ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      409,
      "The selected Training cohort is unavailable for a test registration waiver."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      409,
      "The organization connected to this Training cohort is unavailable or inactive."
    );
  }

  return {
    cohort,
    organization,
    organizationId,
  };
}

async function resolveActiveCEStudent(
  base44: any,
  studentUserId: string,
  organizationId: string
) {
  const student = await base44.asServiceRole.entities.User.get(
    studentUserId
  ).catch(() => null);

  const studentEmail = normalizeEmail(student?.email);

  if (
    !student ||
    !isActiveRecord(student) ||
    normalizeIdentifier(student?.id) !== studentUserId ||
    normalizeIdentifier(student?.org_id) !== organizationId ||
    normalizeText(student?.role).toLowerCase() !== "ce_student" ||
    normalizeText(student?.access_level).toLowerCase() !==
      "ce_training_portal" ||
    !isValidEmail(studentEmail)
  ) {
    throw new RequestError(
      409,
      "The selected user is not an active CE student account in this Training cohort organization."
    );
  }

  return {
    student,
    studentEmail,
  };
}

async function resolveStudentMembership(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string
) {
  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: studentUserId,
      }
    );

  const memberships = asArray(membershipRows).filter(
    (membership: any) =>
      normalizeIdentifier(membership?.org_id) === organizationId &&
      normalizeIdentifier(membership?.cohort_id) === cohortId &&
      normalizeIdentifier(membership?.user_id) === studentUserId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        "member"
  );

  if (memberships.length !== 1) {
    throw new RequestError(
      409,
      "This CE student does not have exactly one cohort membership in the selected Training cohort."
    );
  }

  const membership = memberships[0];

  if (!isActiveRecord(membership)) {
    throw new RequestError(
      409,
      "The selected CE student cohort membership is inactive or archived."
    );
  }

  return membership;
}

async function resolveExactEnrollment(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string,
  studentEmail: string,
  membershipId: string
) {
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
      "This CE student account does not have exactly one durable enrollment for the selected Training cohort."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  const enrollmentMatches =
    isActiveRecord(enrollment) &&
    normalizeEmail(enrollment?.student_email) === studentEmail &&
    normalizeIdentifier(enrollment?.cohort_member_id) ===
      membershipId &&
    !!normalizeIdentifier(enrollment?.pending_role_assignment_id) &&
    !!normalizeText(enrollment?.registered_at) &&
    WAIVABLE_ENROLLMENT_STATUSES.has(enrollmentStatus);

  if (!enrollmentMatches) {
    throw new RequestError(
      409,
      "The durable CE enrollment is incomplete, inactive, or is not safely linked to this active student membership."
    );
  }

  if (
    normalizeIdentifier(
      enrollment?.organization_billing_event_id
    )
  ) {
    throw new RequestError(
      409,
      "This durable CE enrollment is already linked to a billing record and cannot receive a new test registration waiver."
    );
  }

  if (normalizeText(enrollment?.payment_settled_at)) {
    throw new RequestError(
      409,
      "This durable CE enrollment already has a recorded payment-settlement time and requires billing review rather than a test waiver."
    );
  }

  return enrollment;
}

async function resolveAcceptedInvitation(
  base44: any,
  enrollment: any,
  organizationId: string,
  cohortId: string,
  studentEmail: string
) {
  const invitationId = normalizeIdentifier(
    enrollment?.pending_role_assignment_id
  );

  const invitation =
    await base44.asServiceRole.entities.PendingRoleAssignment.get(
      invitationId
    ).catch(() => null);

  const paymentResponsibility = normalizeText(
    enrollment?.payment_responsibility
  );
  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? normalizeText(enrollment?.instructor_payment_mode)
      : "";

  const invitationPaymentResponsibility = normalizeText(
    invitation?.payment_responsibility
  );
  const invitationInstructorPaymentMode =
    invitationPaymentResponsibility === "instructor_paid"
      ? normalizeText(invitation?.instructor_payment_mode)
      : "";

  const invitationCohortRole = normalizeText(
    invitation?.cohort_role
  ).toLowerCase();

  const paymentPlanIsValid =
    ["student_paid", "instructor_paid"].includes(
      paymentResponsibility
    ) &&
    (
      paymentResponsibility === "student_paid"
        ? !instructorPaymentMode
        : ["pay_now", "invoice_with_cohort"].includes(
            instructorPaymentMode
          )
    );

  const invitationMatches =
    invitation &&
    invitation?.is_archived !== true &&
    normalizeText(invitation?.status).toLowerCase() ===
      "accepted" &&
    normalizeText(invitation?.role).toLowerCase() ===
      "ce_student" &&
    normalizeText(invitation?.access_level).toLowerCase() ===
      "ce_training_portal" &&
    normalizeIdentifier(invitation?.org_id) === organizationId &&
    normalizeIdentifier(invitation?.cohort_id) === cohortId &&
    normalizeEmail(invitation?.email) === studentEmail &&
    !normalizeIdentifier(invitation?.client_id) &&
    ["", "member"].includes(invitationCohortRole) &&
    paymentPlanIsValid &&
    invitationPaymentResponsibility === paymentResponsibility &&
    invitationInstructorPaymentMode === instructorPaymentMode;

  if (!invitationMatches) {
    throw new RequestError(
      409,
      "The CE student invitation does not safely match the durable enrollment and payment settings."
    );
  }

  return {
    invitation,
    paymentResponsibility,
    instructorPaymentMode,
  };
}

async function assertNoExistingRegistrationBilling(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string
) {
  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        organization_id: organizationId,
        cohort_id: cohortId,
        subject_user_id: studentUserId,
      }
    );

  const registrationEvents = asArray(billingRows).filter(
    (billingEvent: any) =>
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeIdentifier(billingEvent?.subject_user_id) ===
        studentUserId &&
      normalizeText(billingEvent?.billing_subject_type) ===
        "student" &&
      TRAINING_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      )
  );

  if (registrationEvents.length > 0) {
    throw new RequestError(
      409,
      "A CE registration billing record already exists for this student and Training cohort. This test waiver cannot create or overwrite billing history."
    );
  }
}

async function writeAuditLog(
  base44: any,
  actorUserId: string,
  billingEventId: string,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: actorUserId,
      event_key: "ce_student_test_registration_waived",
      event_summary:
        "A CE student test registration waiver was recorded for a complete durable enrollment.",
      actor_type: "platform_admin",
      target_entity: "OrganizationBillingEvent",
      target_record_id: billingEventId,
      tenant_visible: false,
      occurred_at: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error(
      "[recordCEStudentTestRegistrationWaiver] Could not write audit log:",
      error instanceof Error ? error.message : error
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
            "This CE student test registration-waiver request must use POST.",
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
            "Please sign in before recording a CE student test registration waiver.",
        },
        { status: 401 }
      );
    }

    const { callerId } = await resolveCanonicalPlatformOwner(
      base44,
      authenticatedUser.id
    );

    const body = await req.json().catch(() => ({}));

    if (normalizeText(body?.action) !== "record_test_waiver") {
      return Response.json(
        {
          ok: false,
          error:
            "Only the record_test_waiver action is supported.",
        },
        { status: 400 }
      );
    }

    const cohortId = getRequiredString(
      body?.cohort_id,
      "A Training cohort must be selected."
    );
    const studentUserId = getRequiredString(
      body?.user_id,
      "A CE student account must be selected."
    );
    const waiverReason = getRequiredString(
      body?.waiver_reason,
      "A test-waiver reason is required."
    );

    const {
      cohort,
      organization,
      organizationId,
    } = await resolveTrainingCohort(
      base44,
      cohortId
    );

    const {
      student,
      studentEmail,
    } = await resolveActiveCEStudent(
      base44,
      studentUserId,
      organizationId
    );

    const membership = await resolveStudentMembership(
      base44,
      organizationId,
      cohortId,
      studentUserId
    );

    const enrollment = await resolveExactEnrollment(
      base44,
      organizationId,
      cohortId,
      studentUserId,
      studentEmail,
      normalizeIdentifier(membership?.id)
    );

    const {
      paymentResponsibility,
      instructorPaymentMode,
    } = await resolveAcceptedInvitation(
      base44,
      enrollment,
      organizationId,
      cohortId,
      studentEmail
    );

    await assertNoExistingRegistrationBilling(
      base44,
      organizationId,
      cohortId,
      studentUserId
    );

    const now = new Date().toISOString();
    const billingEventKey =
      `test_waived_training_registration:` +
      `${organizationId}:${cohortId}:${enrollment.id}`;

    const createdBillingEvent =
      await base44.asServiceRole.entities.OrganizationBillingEvent.create(
        {
          organization_id: organizationId,
          billing_event_key: billingEventKey,
          fee_kind: "training_registration",
          event_status: "waived",
          billing_subject_type: "student",
          subject_user_id: studentUserId,
          subject_verified_email: studentEmail,
          cohort_id: cohortId,
          feature_key: "ce_training_portal",
          quantity: 1,
          unit_amount_cents: TEST_WAIVER_AMOUNT_CENTS,
          amount_cents: TEST_WAIVER_AMOUNT_CENTS,
          currency: "USD",
          triggered_at: now,
          waived_at: now,
          waived_by_user_id: callerId,
          waiver_reason: waiverReason,
          notes:
            "Internal CE end-to-end test registration waiver. No payment was collected.",
        }
      );

    try {
      await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
        enrollment.id,
        {
          organization_billing_event_id: createdBillingEvent.id,
          payment_settled_at: now,
          status_updated_at: now,
          notes: appendAuditNote(
            enrollment?.notes,
            `Internal test registration waiver recorded on ${now}. Billing event: ${createdBillingEvent.id}.`
          ),
        }
      );
    } catch (enrollmentUpdateError) {
      console.error(
        "[recordCEStudentTestRegistrationWaiver] Enrollment update failed after waiver creation:",
        enrollmentUpdateError instanceof Error
          ? enrollmentUpdateError.message
          : enrollmentUpdateError
      );

      try {
        await base44.asServiceRole.entities.OrganizationBillingEvent.update(
          createdBillingEvent.id,
          {
            event_status: "cancelled",
            notes: appendAuditNote(
              createdBillingEvent?.notes,
              "Automatically cancelled because the durable enrollment could not be safely linked to this test waiver."
            ),
          }
        );
      } catch (rollbackError) {
        console.error(
          "[recordCEStudentTestRegistrationWaiver] Waiver rollback failed:",
          rollbackError instanceof Error
            ? rollbackError.message
            : rollbackError
        );
      }

      throw new RequestError(
        500,
        "The test registration waiver could not be linked to the durable enrollment. The waiver was cancelled and requires review before any further action."
      );
    }

    await writeAuditLog(
      base44,
      callerId,
      createdBillingEvent.id,
      {
        organization_id: organizationId,
        cohort_id: cohortId,
        cohort_name: normalizeText(cohort?.name) || null,
        enrollment_id: enrollment.id,
        cohort_member_id: membership.id,
        pending_role_assignment_id:
          enrollment.pending_role_assignment_id,
        student_user_id: studentUserId,
        student_name: getStudentDisplayName(student),
        student_email: studentEmail,
        billing_event_key: billingEventKey,
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode: instructorPaymentMode || null,
        waiver_reason: waiverReason,
        amount_cents: TEST_WAIVER_AMOUNT_CENTS,
        organization_name: normalizeText(organization?.name) || null,
      }
    );

    return Response.json({
      ok: true,
      action: "record_test_waiver",
      message:
        `${getStudentDisplayName(student)} now has an authorized internal test registration waiver linked to the durable CE enrollment.`,
      billing_event: {
        id: createdBillingEvent.id,
        billing_event_key: billingEventKey,
        event_status: "waived",
        fee_kind: "training_registration",
        billing_subject_type: "student",
        subject_user_id: studentUserId,
        cohort_id: cohortId,
        amount_cents: TEST_WAIVER_AMOUNT_CENTS,
        currency: "USD",
        waived_at: now,
      },
      enrollment: {
        id: enrollment.id,
        payment_settled_at: now,
      },
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[recordCEStudentTestRegistrationWaiver] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE student test registration waiver could not be recorded. Please contact a Platform Owner.",
      },
      { status }
    );
  }
});
