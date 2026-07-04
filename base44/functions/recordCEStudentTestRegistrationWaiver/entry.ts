import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

const TRAINING_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
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

async function findExistingEnrollment(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string,
  studentEmail: string
) {
  const [byUserRows, byEmailRows] = await Promise.all([
    base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        org_id: organizationId,
        cohort_id: cohortId,
        user_id: studentUserId,
      }
    ),
    base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        org_id: organizationId,
        cohort_id: cohortId,
        student_email: studentEmail,
      }
    ),
  ]);

  const byId = new Map<string, any>();

  for (const enrollment of [
    ...asArray(byUserRows),
    ...asArray(byEmailRows),
  ]) {
    const enrollmentId = normalizeIdentifier(enrollment?.id);

    if (enrollmentId) {
      byId.set(enrollmentId, enrollment);
    }
  }

  const enrollments = [...byId.values()].filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.org_id) === organizationId &&
      normalizeIdentifier(enrollment?.cohort_id) === cohortId
  );

  if (enrollments.length > 1) {
    throw new RequestError(
      409,
      "More than one durable CE enrollment exists for this student and Training cohort. Review is required before recording a test waiver."
    );
  }

  return enrollments[0] || null;
}

function validateExistingEnrollmentForTestWaiver(
  enrollment: any,
  studentUserId: string,
  studentEmail: string,
  membershipId: string
) {
  if (!enrollment) {
    return;
  }

  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  const validStatus = ["active", "training_completed"].includes(
    enrollmentStatus
  );

  const exactIdentity =
    isActiveRecord(enrollment) &&
    normalizeIdentifier(enrollment?.user_id) === studentUserId &&
    normalizeEmail(enrollment?.student_email) === studentEmail &&
    normalizeIdentifier(enrollment?.cohort_member_id) ===
      membershipId &&
    validStatus;

  if (!exactIdentity) {
    throw new RequestError(
      409,
      "The existing durable CE enrollment is incomplete or does not safely match this active test student membership."
    );
  }

  if (
    normalizeIdentifier(
      enrollment?.organization_billing_event_id
    ) ||
    normalizeText(enrollment?.payment_settled_at)
  ) {
    throw new RequestError(
      409,
      "This durable CE enrollment already has payment or billing history and cannot receive a new test registration waiver."
    );
  }
}

async function getRegistrationBillingEvents(
  base44: any,
  organizationId: string,
  cohortId: string,
  studentUserId: string,
  studentEmail: string
) {
  const [byUserRows, byEmailRows] = await Promise.all([
    base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        organization_id: organizationId,
        cohort_id: cohortId,
        subject_user_id: studentUserId,
      }
    ),
    base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        organization_id: organizationId,
        cohort_id: cohortId,
        subject_verified_email: studentEmail,
      }
    ),
  ]);

  const byId = new Map<string, any>();

  for (const billingEvent of [
    ...asArray(byUserRows),
    ...asArray(byEmailRows),
  ]) {
    const billingEventId = normalizeIdentifier(billingEvent?.id);

    if (billingEventId) {
      byId.set(billingEventId, billingEvent);
    }
  }

  return [...byId.values()].filter(
    (billingEvent: any) =>
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeText(billingEvent?.billing_subject_type) ===
        "student" &&
      TRAINING_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      ) &&
      (
        normalizeIdentifier(billingEvent?.subject_user_id) ===
          studentUserId ||
        normalizeEmail(billingEvent?.subject_verified_email) ===
          studentEmail
      )
  );
}

async function cancelWaiverBillingEvent(
  base44: any,
  billingEvent: any,
  reason: string
) {
  try {
    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        event_status: "cancelled",
        notes: appendAuditNote(
          billingEvent?.notes,
          reason
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
        "A Platform Owner recorded an internal CE student test registration waiver.",
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

    const existingEnrollment = await findExistingEnrollment(
      base44,
      organizationId,
      cohortId,
      studentUserId,
      studentEmail
    );

    validateExistingEnrollmentForTestWaiver(
      existingEnrollment,
      studentUserId,
      studentEmail,
      normalizeIdentifier(membership?.id)
    );

    const billingEventKey =
      `test_waived_training_registration:` +
      `${organizationId}:${cohortId}:${studentUserId}`;

    const registrationBillingEvents =
      await getRegistrationBillingEvents(
        base44,
        organizationId,
        cohortId,
        studentUserId,
        studentEmail
      );

    if (registrationBillingEvents.length > 1) {
      throw new RequestError(
        409,
        "More than one CE registration billing record exists for this student and Training cohort. Review is required before any test-waiver action."
      );
    }

    if (registrationBillingEvents.length === 1) {
      const existingBillingEvent = registrationBillingEvents[0];
      const matchingExistingWaiver =
        normalizeText(existingBillingEvent?.billing_event_key) ===
          billingEventKey &&
        normalizeText(existingBillingEvent?.event_status) ===
          "waived" &&
        normalizeIdentifier(existingBillingEvent?.subject_user_id) ===
          studentUserId &&
        normalizeEmail(
          existingBillingEvent?.subject_verified_email
        ) === studentEmail;

      const linkedExistingEnrollment =
        existingEnrollment &&
        normalizeIdentifier(
          existingEnrollment?.organization_billing_event_id
        ) === normalizeIdentifier(existingBillingEvent?.id) &&
        !!normalizeText(existingEnrollment?.payment_settled_at);

      if (
        matchingExistingWaiver &&
        linkedExistingEnrollment
      ) {
        return Response.json({
          ok: true,
          action: "record_test_waiver",
          already_settled: true,
          message:
            "This CE student already has the authorized internal test registration waiver for this Training cohort.",
          billing_event: {
            id: existingBillingEvent.id,
            billing_event_key:
              existingBillingEvent.billing_event_key,
            event_status: existingBillingEvent.event_status,
            cohort_id: existingBillingEvent.cohort_id,
            subject_user_id:
              existingBillingEvent.subject_user_id,
          },
          enrollment: {
            id: existingEnrollment.id,
            payment_settled_at:
              existingEnrollment.payment_settled_at,
          },
        });
      }

      throw new RequestError(
        409,
        "A CE registration billing record already exists for this student and Training cohort. This test waiver cannot create or overwrite billing history."
      );
    }

    const now = new Date().toISOString();
    const membershipTrainingStatus = normalizeText(
      membership?.training_status
    ).toLowerCase();

    const targetEnrollmentStatus =
      membershipTrainingStatus === "completed"
        ? "training_completed"
        : "active";

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

    let enrollment = existingEnrollment;
    let enrollmentCreated = false;

    try {
      if (enrollment) {
        await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
          enrollment.id,
          {
            organization_billing_event_id:
              createdBillingEvent.id,
            payment_settled_at: now,
            registered_at:
              enrollment.registered_at ||
              membership.joined_at ||
              now,
            status_updated_at: now,
            notes: appendAuditNote(
              enrollment?.notes,
              `Internal test registration waiver recorded on ${now}. Billing event: ${createdBillingEvent.id}.`
            ),
          }
        );

        enrollment = {
          ...enrollment,
          organization_billing_event_id:
            createdBillingEvent.id,
          payment_settled_at: now,
        };
      } else {
        enrollment =
          await base44.asServiceRole.entities.CETrainingStudentEnrollment.create(
            {
              org_id: organizationId,
              enrollment_key: buildEnrollmentKey(
                organizationId,
                cohortId,
                studentEmail
              ),
              cohort_id: cohortId,
              student_email: studentEmail,
              user_id: studentUserId,
              cohort_member_id: membership.id,
              organization_billing_event_id:
                createdBillingEvent.id,
              payment_responsibility: "student_paid",
              enrollment_status: targetEnrollmentStatus,
              is_active: true,
              invited_at: membership.joined_at || now,
              payment_settled_at: now,
              registered_at: membership.joined_at || now,
              ...(targetEnrollmentStatus === "training_completed" &&
              membership.training_completed_at
                ? {
                    training_completed_at:
                      membership.training_completed_at,
                  }
                : {}),
              created_by_user_id: callerId,
              status_updated_at: now,
              notes:
                "Created by the controlled Platform Owner test-registration-waiver path for a legacy CE test student. No student payment was collected.",
            }
          );

        enrollmentCreated = true;
      }
    } catch (enrollmentError) {
      console.error(
        "[recordCEStudentTestRegistrationWaiver] Enrollment link failed after waiver creation:",
        enrollmentError instanceof Error
          ? enrollmentError.message
          : enrollmentError
      );

      await cancelWaiverBillingEvent(
        base44,
        createdBillingEvent,
        "Automatically cancelled because the durable enrollment could not be created or linked to this test waiver."
      );

      throw new RequestError(
        500,
        "The test registration waiver could not be linked to a durable CE enrollment. The waiver was cancelled and requires review before any further action."
      );
    }

    await writeAuditLog(
      base44,
      callerId,
      createdBillingEvent.id,
      {
        exception_type:
          "platform_owner_controlled_test_registration_waiver",
        organization_id: organizationId,
        organization_name:
          normalizeText(organization?.name) || null,
        cohort_id: cohortId,
        cohort_name: normalizeText(cohort?.name) || null,
        enrollment_id: enrollment.id,
        durable_enrollment_created: enrollmentCreated,
        cohort_member_id: membership.id,
        student_user_id: studentUserId,
        student_name: getStudentDisplayName(student),
        student_email: studentEmail,
        billing_event_key: billingEventKey,
        waiver_reason: waiverReason,
        amount_cents: TEST_WAIVER_AMOUNT_CENTS,
      }
    );

    return Response.json({
      ok: true,
      action: "record_test_waiver",
      already_settled: false,
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
        created_for_legacy_test_student: enrollmentCreated,
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
