import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

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

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function getRecordTimestamp(record: any) {
  return new Date(
    record?.updated_date ||
      record?.created_date ||
      record?.joined_at ||
      record?.invited_at ||
      0
  ).getTime();
}

function isActive(record: any) {
  return record?.is_active !== false;
}

async function getOneById(entity: any, id: string) {
  if (!id) {
    return null;
  }

  const rows = await entity.filter({ id });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function resolveOrganizationId(base44: any, caller: any) {
  let organizationId = normalizeText(caller?.org_id);

  if (organizationId) {
    return organizationId;
  }

  const organizations =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller?.email,
    });

  organizationId = normalizeText(organizations?.[0]?.id);

  if (!organizationId) {
    throw new RequestError(
      400,
      "Your account is not connected to an organization."
    );
  }

  return organizationId;
}

async function requireCohortAccess(
  base44: any,
  caller: any,
  organizationId: string,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    );

  if (!cohort) {
    throw new RequestError(404, "Training cohort not found.");
  }

  if (
    normalizeText(cohort.org_id) !== organizationId ||
    normalizeText(cohort.cohort_type) !== "training"
  ) {
    throw new RequestError(
      403,
      "This Training cohort does not belong to your organization."
    );
  }

  if (["admin", "management"].includes(caller.role)) {
    return cohort;
  }

  if (caller.role !== "ce_instructor") {
    throw new RequestError(
      403,
      "Only authorized CE organization users may view student details."
    );
  }

  const managerRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: caller.id,
        cohort_role: "manager",
        is_active: true,
      }
    );

  if (!Array.isArray(managerRows) || managerRows.length === 0) {
    throw new RequestError(
      403,
      "Only active cohort managers may view this student's details."
    );
  }

  return cohort;
}

function isValidEnrollmentForCohort(
  enrollment: any,
  organizationId: string,
  cohortId: string
) {
  return (
    normalizeText(enrollment?.org_id) === organizationId &&
    normalizeText(enrollment?.cohort_id) === cohortId
  );
}

function isValidMemberForCohort(
  membership: any,
  _organizationId: string,
  cohortId: string
) {
  return (
    normalizeText(membership?.cohort_id) === cohortId &&
    normalizeText(membership?.cohort_role) === "member"
  );
}

function isValidInviteForCohort(
  invite: any,
  organizationId: string,
  cohortId: string
) {
  return (
    normalizeText(invite?.org_id) === organizationId &&
    normalizeText(invite?.cohort_id) === cohortId &&
    normalizeText(invite?.role) === "ce_student"
  );
}

async function getReceiptDetails(
  checkoutSessionId: string,
  billingStatus: string
) {
  if (billingStatus === "waived") {
    return {
      status: "not_applicable_waived",
      receipt_url: null,
    };
  }

  if (billingStatus !== "paid") {
    return {
      status: "payment_not_settled",
      receipt_url: null,
    };
  }

  if (!checkoutSessionId) {
    return {
      status: "checkout_session_not_recorded",
      receipt_url: null,
    };
  }

  if (!stripe) {
    return {
      status: "stripe_not_configured",
      receipt_url: null,
    };
  }

  try {
    const checkoutSession: any =
      await stripe.checkout.sessions.retrieve(
        checkoutSessionId,
        {
          expand: ["payment_intent.latest_charge"],
        }
      );

    let paymentIntent: any = checkoutSession?.payment_intent || null;

    if (typeof paymentIntent === "string") {
      paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntent,
        {
          expand: ["latest_charge"],
        }
      );
    }

    let charge: any = paymentIntent?.latest_charge || null;

    if (typeof charge === "string") {
      charge = await stripe.charges.retrieve(charge);
    }

    const receiptUrl = normalizeText(charge?.receipt_url);

    return {
      status: receiptUrl
        ? "available"
        : "receipt_not_available",
      receipt_url: receiptUrl || null,
    };
  } catch (error) {
    console.error(
      "[getCETrainingStudentDetail] Unable to retrieve Stripe receipt:",
      error?.message || error
    );

    return {
      status: "receipt_lookup_failed",
      receipt_url: null,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      throw new RequestError(401, "Unauthorized.");
    }

    if (
      !["admin", "management", "ce_instructor"].includes(
        caller.role
      )
    ) {
      throw new RequestError(
        403,
        "Only authorized CE organization users may view student details."
      );
    }

    const body = await req.json().catch(() => ({}));

    const cohortId = normalizeText(body?.cohort_id);
    const enrollmentId = normalizeText(body?.enrollment_id);
    const cohortMemberId = normalizeText(body?.cohort_member_id);
    const pendingRoleAssignmentId = normalizeText(
      body?.pending_role_assignment_id
    );

    if (!cohortId) {
      throw new RequestError(400, "cohort_id is required.");
    }

    const selectionCount = [
      enrollmentId,
      cohortMemberId,
      pendingRoleAssignmentId,
    ].filter(Boolean).length;

    if (selectionCount !== 1) {
      throw new RequestError(
        400,
        "Provide exactly one student detail identifier: enrollment_id, cohort_member_id, or pending_role_assignment_id."
      );
    }

    const organizationId = await resolveOrganizationId(
      base44,
      caller
    );

    const cohort = await requireCohortAccess(
      base44,
      caller,
      organizationId,
      cohortId
    );

    let enrollment = null;
    let membership = null;
    let invitation = null;

    if (enrollmentId) {
      enrollment = await getOneById(
        base44.asServiceRole.entities.CETrainingStudentEnrollment,
        enrollmentId
      );

      if (
        !enrollment ||
        !isValidEnrollmentForCohort(
          enrollment,
          organizationId,
          cohortId
        )
      ) {
        throw new RequestError(
          404,
          "CE Training enrollment not found in this cohort."
        );
      }
    }

    if (cohortMemberId) {
      membership = await getOneById(
        base44.asServiceRole.entities.CETrainingCohortMember,
        cohortMemberId
      );

      if (
        !membership ||
        !isValidMemberForCohort(
          membership,
          organizationId,
          cohortId
        )
      ) {
        throw new RequestError(
          404,
          "CE student membership not found in this cohort."
        );
      }
    }

    if (pendingRoleAssignmentId) {
      invitation = await getOneById(
        base44.asServiceRole.entities.PendingRoleAssignment,
        pendingRoleAssignmentId
      );

      if (
        !invitation ||
        !isValidInviteForCohort(
          invitation,
          organizationId,
          cohortId
        )
      ) {
        throw new RequestError(
          404,
          "CE student invitation not found in this cohort."
        );
      }
    }

    if (enrollment && !membership) {
      const enrollmentMembershipId = normalizeText(
        enrollment.cohort_member_id
      );

      if (enrollmentMembershipId) {
        const enrollmentMembership = await getOneById(
          base44.asServiceRole.entities.CETrainingCohortMember,
          enrollmentMembershipId
        );

        if (
          enrollmentMembership &&
          isValidMemberForCohort(
            enrollmentMembership,
            organizationId,
            cohortId
          )
        ) {
          membership = enrollmentMembership;
        }
      }
    }

    if (enrollment && !invitation) {
      const enrollmentInviteId = normalizeText(
        enrollment.pending_role_assignment_id
      );

      if (enrollmentInviteId) {
        const enrollmentInvite = await getOneById(
          base44.asServiceRole.entities.PendingRoleAssignment,
          enrollmentInviteId
        );

        if (
          enrollmentInvite &&
          isValidInviteForCohort(
            enrollmentInvite,
            organizationId,
            cohortId
          )
        ) {
          invitation = enrollmentInvite;
        }
      }
    }

    const studentUserId = normalizeText(
      enrollment?.user_id || membership?.user_id
    );

    let studentUser = null;

    if (studentUserId) {
      studentUser = await getOneById(
        base44.asServiceRole.entities.User,
        studentUserId
      );
    }

    const studentEmail = normalizeEmail(
      enrollment?.student_email ||
        invitation?.email ||
        studentUser?.email
    );

    if (!studentEmail) {
      throw new RequestError(
        409,
        "This CE student record is missing the email required to safely load details."
      );
    }

    if (!enrollment) {
      const enrollmentRows =
        await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
          {
            org_id: organizationId,
            cohort_id: cohortId,
          }
        );

      const matchingEnrollments = (
        Array.isArray(enrollmentRows) ? enrollmentRows : []
      ).filter((candidate) => {
        const matchesEmail =
          normalizeEmail(candidate?.student_email) === studentEmail;

        const matchesMembership =
          membership &&
          normalizeText(candidate?.cohort_member_id) ===
            normalizeText(membership.id);

        const matchesInvitation =
          invitation &&
          normalizeText(
            candidate?.pending_role_assignment_id
          ) === normalizeText(invitation.id);

        return (
          matchesEmail ||
          matchesMembership ||
          matchesInvitation
        );
      });

      if (matchingEnrollments.length === 1) {
        enrollment = matchingEnrollments[0];
      }
    }

    if (!membership && enrollment?.user_id) {
      const membershipRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            cohort_id: cohortId,
            user_id: enrollment.user_id,
            cohort_role: "member",
          }
        );

      const matchingMemberships = (
        Array.isArray(membershipRows) ? membershipRows : []
      )
        .filter((candidate) =>
          isValidMemberForCohort(
            candidate,
            organizationId,
            cohortId
          )
        )
        .sort((a, b) => {
          const aActive = isActive(a) ? 1 : 0;
          const bActive = isActive(b) ? 1 : 0;

          return (
            bActive - aActive ||
            getRecordTimestamp(b) - getRecordTimestamp(a)
          );
        });

      membership = matchingMemberships[0] || null;
    }

    if (!invitation && enrollment?.pending_role_assignment_id) {
      const enrollmentInvite = await getOneById(
        base44.asServiceRole.entities.PendingRoleAssignment,
        normalizeText(enrollment.pending_role_assignment_id)
      );

      if (
        enrollmentInvite &&
        isValidInviteForCohort(
          enrollmentInvite,
          organizationId,
          cohortId
        )
      ) {
        invitation = enrollmentInvite;
      }
    }

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
        {
          organization_id: organizationId,
        }
      );

    const registrationBillingEvents = (
      Array.isArray(billingRows) ? billingRows : []
    ).filter(
      (billingEvent) =>
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind)
        ) &&
        billingEvent?.billing_subject_type === "student"
    );

    const linkedBillingEventId = normalizeText(
      enrollment?.organization_billing_event_id
    );

    let billingEvent = null;
    let billingIntegrityStatus = "not_found";

    if (linkedBillingEventId) {
      const exactMatches = registrationBillingEvents.filter(
        (billingRecord) =>
          normalizeText(billingRecord?.id) ===
          linkedBillingEventId
      );

      if (exactMatches.length === 1) {
        const candidate = exactMatches[0];

        const identityMatches =
          normalizeText(candidate?.organization_id) ===
            organizationId &&
          normalizeText(candidate?.cohort_id) === cohortId &&
          normalizeEmail(
            candidate?.subject_verified_email
          ) === studentEmail;

        if (identityMatches) {
          billingEvent = candidate;
          billingIntegrityStatus = "valid";
        } else {
          billingIntegrityStatus = "identity_mismatch";
        }
      } else {
        billingIntegrityStatus = "linked_billing_event_not_found";
      }
    } else {
      const candidateBillingEvents = registrationBillingEvents.filter(
        (billingRecord) =>
          normalizeText(billingRecord?.cohort_id) === cohortId &&
          normalizeEmail(
            billingRecord?.subject_verified_email
          ) === studentEmail
      );

      if (candidateBillingEvents.length === 1) {
        billingEvent = candidateBillingEvents[0];
        billingIntegrityStatus = "valid_legacy_match";
      } else if (candidateBillingEvents.length > 1) {
        billingIntegrityStatus = "multiple_legacy_matches";
      }
    }

      const billingStatus = normalizeText(
      billingEvent?.event_status
    );

    const receipt = await getReceiptDetails(
      normalizeText(billingEvent?.stripe_checkout_session_id),
      billingStatus
    );

    const enrollmentStatus = normalizeText(
      enrollment?.enrollment_status
    );

    const resolvedEnrollmentStatus =
      enrollmentStatus ||
      (membership
        ? normalizeText(membership?.training_status) ===
          "completed"
          ? "training_completed"
          : "active"
        : ["paid", "waived"].includes(billingStatus)
          ? "payment_settled_registration_pending"
          : "payment_pending");

    const [
      activeCallerMembershipRows,
      platformAdminRows,
      studentCertificationRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohortId,
        user_id: caller.id,
        is_active: true,
      }),
      base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
        is_active: true,
      }),
      studentUserId
        ? base44.asServiceRole.entities.CEPractitionerCertification.filter({
            user_id: studentUserId,
          })
        : Promise.resolve([]),
    ]);

    const activeCallerMemberships = Array.isArray(
      activeCallerMembershipRows
    )
      ? activeCallerMembershipRows
      : [];

    const callerIsCohortManager = activeCallerMemberships.some(
      (row) => row?.cohort_role === "manager"
    );

    const callerIsCohortTrainer = activeCallerMemberships.some(
      (row) => row?.cohort_role === "trainer"
    );

    const callerIsPlatformOwner = (
      Array.isArray(platformAdminRows) ? platformAdminRows : []
    ).some(
      (row) =>
        row?.is_active !== false &&
        normalizeText(row?.platform_role) === "platform_owner"
    );

    const studentHasCertification =
      Array.isArray(studentCertificationRows) &&
      studentCertificationRows.length > 0;

    const membershipIsActive = Boolean(
      membership && isActive(membership)
    );

    const trainingStatus =
      normalizeText(membership?.training_status) || "in_training";

    const matchingRegistrationBillingEvents =
      registrationBillingEvents.filter(
        (billingRecord) =>
          normalizeText(billingRecord?.cohort_id) === cohortId &&
          normalizeText(billingRecord?.subject_user_id) ===
            studentUserId
      );

    const hasAnyRegistrationBillingEvent =
      matchingRegistrationBillingEvents.length > 0;

    const hasSettledRegistration = matchingRegistrationBillingEvents.some(
      (billingRecord) =>
        ["paid", "waived"].includes(
          normalizeText(billingRecord?.event_status)
        )
    );

    const actionPermissions = {
      can_record_test_registration_waiver: Boolean(
        callerIsPlatformOwner &&
          membershipIsActive &&
          studentUser?.is_active !== false &&
          normalizeText(studentUser?.role) === "ce_student" &&
          !hasAnyRegistrationBillingEvent
      ),
      can_mark_training_complete: Boolean(
        membershipIsActive &&
          hasSettledRegistration &&
          !studentHasCertification &&
          ["active", "completed"].includes(
            normalizeText(cohort?.status)
          ) &&
          !["completed", "withdrawn"].includes(trainingStatus) &&
          !["withdrawn", "revoked"].includes(
            resolvedEnrollmentStatus
          ) &&
          (caller.role === "admin" ||
            callerIsCohortManager ||
            callerIsCohortTrainer)
      ),
      can_remove_cohort_membership: Boolean(
        membershipIsActive &&
          (caller.role === "admin" || callerIsCohortManager)
      ),
    };
    return Response.json({
      ok: true,
      cohort: {
        id: cohort.id,
        name: cohort.name || "",
        code: cohort.code || "",
        course_name: cohort.course_name || "",
        course_version: cohort.course_version || "",
        status: cohort.status || "",
      },
      student: {
        display_name:
          normalizeText(studentUser?.full_name) ||
          studentEmail,
        email: studentEmail,
        user_id: studentUser?.id || null,
        user_is_active:
          studentUser?.is_active !== false && !!studentUser,
      },
      enrollment: {
        id: enrollment?.id || null,
        is_legacy: !enrollment,
        enrollment_status: resolvedEnrollmentStatus,
        is_active:
          enrollment?.is_active !== false,
        invited_at: enrollment?.invited_at || invitation?.invited_at || null,
        payment_settled_at:
          enrollment?.payment_settled_at ||
          billingEvent?.paid_at ||
          billingEvent?.waived_at ||
          null,
        registered_at:
          enrollment?.registered_at || membership?.joined_at || null,
        training_completed_at:
          enrollment?.training_completed_at ||
          membership?.training_completed_at ||
          null,
      },
      invitation: {
        id: invitation?.id || null,
        status: invitation?.status || null,
        invited_at: invitation?.invited_at || null,
        invited_by_name: invitation?.invited_by_name || null,
        payment_responsibility:
          enrollment?.payment_responsibility ||
          invitation?.payment_responsibility ||
          null,
        instructor_payment_mode:
          enrollment?.instructor_payment_mode ||
          invitation?.instructor_payment_mode ||
          null,
      },
      payment: {
        billing_event_id: billingEvent?.id || null,
        integrity_status: billingIntegrityStatus,
        status: billingStatus || null,
        amount_cents:
          typeof billingEvent?.amount_cents === "number"
            ? billingEvent.amount_cents
            : null,
        currency: billingEvent?.currency || null,
        paid_at: billingEvent?.paid_at || null,
        waived_at: billingEvent?.waived_at || null,
        receipt,
      },
      cohort_membership: {
        id: membership?.id || null,
        is_active: membership ? isActive(membership) : false,
        joined_at: membership?.joined_at || null,
        training_status: membership?.training_status || null,
        training_completed_at:
          membership?.training_completed_at || null,
      },
    });
  } catch (error) {
    const status =
      error instanceof RequestError ? error.status : 500;

    console.error(
      "[getCETrainingStudentDetail] Error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load CE Training student details.",
      },
      { status }
    );
  }
});
