import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const PAYMENT_RESPONSIBILITIES = new Set([
  "student_paid",
  "instructor_paid",
]);

const INSTRUCTOR_PAYMENT_MODES = new Set([
  "pay_now",
  "invoice_with_cohort",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const SETTLED_BILLING_STATUSES = new Set([
  "paid",
  "waived",
]);

const CHANGEABLE_BILLING_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "failed",
]);

const CHANGEABLE_CE_ENROLLMENT_STATUSES = new Set([
  "invited",
  "payment_pending",
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

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role).toLowerCase();

  return (
    ["", "user", "employee"].includes(role) &&
    !normalizeText(user?.access_level) &&
    !normalizeIdentifier(user?.org_id) &&
    !normalizeIdentifier(user?.manager_id) &&
    !normalizeIdentifier(user?.linked_client_id) &&
    !normalizeIdentifier(user?.cohort_id) &&
    !normalizeText(user?.cohort_role)
  );
}

function getInvitePaymentResponsibility(invite: any) {
  return (
    normalizeText(invite?.payment_responsibility) ||
    "student_paid"
  );
}

function getInviteInstructorPaymentMode(invite: any) {
  return getInvitePaymentResponsibility(invite) ===
    "instructor_paid"
    ? normalizeText(invite?.instructor_payment_mode)
    : "";
}

function getEnrollmentInstructorPaymentMode(enrollment: any) {
  return normalizeText(enrollment?.payment_responsibility) ===
    "instructor_paid"
    ? normalizeText(enrollment?.instructor_payment_mode)
    : "";
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

  if (!callerId || !callerEmail) {
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
      "You are not authorized to update CE student payment options."
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

async function resolveOpenCEStudentInvitation(
  base44: any,
  pendingInviteId: string,
  organizationId: string
) {
  const invite =
    await base44.asServiceRole.entities.PendingRoleAssignment.get(
      pendingInviteId
    ).catch(() => null);

  if (!invite) {
    throw new RequestError(
      404,
      "The selected CE student invitation was not found."
    );
  }

  if (
    invite?.is_archived === true ||
    normalizeIdentifier(invite?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected CE student invitation is unavailable."
    );
  }

  const role = normalizeText(invite?.role).toLowerCase();
  const accessLevel = normalizeText(
    invite?.access_level
  ).toLowerCase();
  const status = normalizeText(invite?.status).toLowerCase();
  const cohortId = normalizeIdentifier(invite?.cohort_id);
  const email = normalizeEmail(invite?.email);
  const paymentResponsibility =
    getInvitePaymentResponsibility(invite);
  const instructorPaymentMode =
    getInviteInstructorPaymentMode(invite);
  const cohortRole = normalizeText(
    invite?.cohort_role
  ).toLowerCase();

  if (
    role !== "ce_student" ||
    accessLevel !== "ce_training_portal" ||
    !cohortId ||
    !isValidEmail(email) ||
    normalizeIdentifier(invite?.client_id) ||
    !["", "member"].includes(cohortRole)
  ) {
    throw new RequestError(
      409,
      "The selected CE student invitation is incomplete or does not match the secure CE enrollment requirements."
    );
  }

  if (!OPEN_INVITE_STATUSES.has(status)) {
    throw new RequestError(
      409,
      "Only an active, unregistered CE student invitation can have its payment option changed."
    );
  }

  if (!PAYMENT_RESPONSIBILITIES.has(paymentResponsibility)) {
    throw new RequestError(
      409,
      "The selected CE student invitation has an invalid payment responsibility."
    );
  }

  if (
    paymentResponsibility === "instructor_paid" &&
    !INSTRUCTOR_PAYMENT_MODES.has(instructorPaymentMode)
  ) {
    throw new RequestError(
      409,
      "The selected CE student invitation has an invalid instructor payment method."
    );
  }

  return {
    invite,
    cohortId,
    email,
    paymentResponsibility,
    instructorPaymentMode,
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
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      403,
      "The Training cohort connected to this invitation is unavailable."
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

  const hasActiveManagerMembership = asArray(memberships).some(
    (membership: any) =>
      normalizeIdentifier(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        "manager" &&
      membership?.is_active !== false &&
      membership?.is_archived !== true
  );

  if (!hasActiveManagerMembership) {
    throw new RequestError(
      403,
      "You must be an active manager of this Training cohort to update this CE student payment option."
    );
  }
}

async function getUsersForEmail(
  base44: any,
  email: string
) {
  const lookupEmails = [
    ...new Set(
      [normalizeText(email), normalizeEmail(email)].filter(Boolean)
    ),
  ];

  const resultSets = await Promise.all(
    lookupEmails.map((lookupEmail) =>
      base44.asServiceRole.entities.User.filter({
        email: lookupEmail,
      })
    )
  );

  const byId = new Map<string, any>();

  for (const resultSet of resultSets) {
    for (const user of asArray(resultSet)) {
      const userId = normalizeIdentifier(user?.id);

      if (userId) {
        byId.set(userId, user);
      }
    }
  }

  return [...byId.values()].filter(
    (user) => normalizeEmail(user?.email) === normalizeEmail(email)
  );
}

function assertInvitedEmailAccountIsSafe(
  users: any[],
  organizationId: string
) {
  if (users.length > 1) {
    throw new RequestError(
      409,
      "This invitation email is connected to more than one account record and requires administrator review."
    );
  }

  const existingUser = users[0] || null;

  if (!existingUser) {
    return;
  }

  if (!isActiveRecord(existingUser)) {
    throw new RequestError(
      409,
      "This invitation email is connected to an inactive account and requires review before its payment option can be changed."
    );
  }

  const profile = getRoleProfile(existingUser);

  if (
    profile?.role === "ce_student" &&
    normalizeIdentifier(existingUser?.org_id) === organizationId
  ) {
    throw new RequestError(
      409,
      "This email is already connected to an active CE student account. Use CE enrollment management instead."
    );
  }

  if (!isNeutralExistingAccount(existingUser)) {
    throw new RequestError(
      409,
      "This invitation email is already connected to an account with access or organization details and cannot be repurposed."
    );
  }
}

async function resolveEnrollmentAndBilling(
  base44: any,
  invite: any,
  organizationId: string,
  cohortId: string,
  email: string,
  paymentResponsibility: string,
  instructorPaymentMode: string
) {
  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        pending_role_assignment_id: invite.id,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.pending_role_assignment_id) ===
      normalizeIdentifier(invite?.id)
  );

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      "This CE student invitation does not have exactly one durable enrollment record."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  if (
    enrollment?.is_active === false ||
    ["withdrawn", "revoked"].includes(enrollmentStatus)
  ) {
    throw new RequestError(
      409,
      "This CE Training enrollment is no longer active."
    );
  }

  if (!CHANGEABLE_CE_ENROLLMENT_STATUSES.has(enrollmentStatus)) {
    throw new RequestError(
      409,
      "This CE Training payment option can be changed only before payment settlement is recorded."
    );
  }

  const enrollmentPaymentResponsibility = normalizeText(
    enrollment?.payment_responsibility
  );

  const enrollmentInstructorPaymentMode =
    getEnrollmentInstructorPaymentMode(enrollment);

  const enrollmentMatches =
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === email &&
    enrollmentPaymentResponsibility === paymentResponsibility &&
    enrollmentInstructorPaymentMode === instructorPaymentMode;

  if (!enrollmentMatches) {
    throw new RequestError(
      409,
      "The CE Training enrollment does not safely match the invitation payment settings."
    );
  }

  const billingEventId = normalizeIdentifier(
    enrollment?.organization_billing_event_id
  );

  if (!billingEventId) {
    throw new RequestError(
      409,
      "This CE Training enrollment is missing its registration billing record."
    );
  }

  const billingEvent =
    await base44.asServiceRole.entities.OrganizationBillingEvent.get(
      billingEventId
    ).catch(() => null);

  if (!billingEvent) {
    throw new RequestError(
      409,
      "The registration billing record connected to this enrollment is unavailable."
    );
  }

  const billingMatches =
    normalizeIdentifier(billingEvent?.organization_id) ===
      organizationId &&
    normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
    normalizeEmail(billingEvent?.subject_verified_email) === email &&
    normalizeText(billingEvent?.billing_subject_type) ===
      "student" &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    );

  if (!billingMatches) {
    throw new RequestError(
      409,
      "The registration billing record does not safely match this CE student invitation."
    );
  }

  return {
    enrollment,
    billingEvent,
  };
}

function assertBillingChangeAllowed(billingEvent: any) {
  const billingStatus = normalizeText(
    billingEvent?.event_status
  ).toLowerCase();

  if (SETTLED_BILLING_STATUSES.has(billingStatus)) {
    throw new RequestError(
      409,
      "This payment option cannot be changed because the CE registration payment is already settled."
    );
  }

  if (billingStatus === "payment_processing") {
    throw new RequestError(
      409,
      "This payment option cannot be changed while CE registration payment processing is underway."
    );
  }

  if (!CHANGEABLE_BILLING_STATUSES.has(billingStatus)) {
    throw new RequestError(
      409,
      "This CE registration billing record is not in a state that permits a payment-option change."
    );
  }
}

function checkoutMatchesBillingEvent(
  checkoutSession: any,
  billingEvent: any,
  organizationId: string,
  email: string
) {
  const metadata = checkoutSession?.metadata || {};

  return (
    checkoutSession?.client_reference_id ===
      String(billingEvent?.id) &&
    metadata?.billing_flow === "ce_student_registration" &&
    metadata?.billing_event_id === String(billingEvent?.id) &&
    metadata?.organization_id === organizationId &&
    normalizeEmail(metadata?.subject_verified_email) === email
  );
}

async function expireOpenCheckoutForPaymentChange(
  billingEvent: any,
  organizationId: string,
  email: string
) {
  const checkoutSessionId = normalizeIdentifier(
    billingEvent?.stripe_checkout_session_id
  );

  if (!checkoutSessionId) {
    return {
      checkout_expired: false,
      checkout_state: "no_checkout_session",
    };
  }

  if (!stripe) {
    throw new RequestError(
      503,
      "Stripe is not configured, so the existing registration checkout cannot be safely cancelled before changing the payment option."
    );
  }

  let checkoutSession: any;

  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(
      checkoutSessionId
    );
  } catch {
    throw new RequestError(
      409,
      "The current registration checkout could not be verified. Resolve the payment session before changing the payment option."
    );
  }

  if (
    !checkoutMatchesBillingEvent(
      checkoutSession,
      billingEvent,
      organizationId,
      email
    )
  ) {
    throw new RequestError(
      409,
      "The current registration checkout does not safely match this CE student enrollment."
    );
  }

  if (
    checkoutSession.status === "complete" ||
    checkoutSession.payment_status === "paid"
  ) {
    throw new RequestError(
      409,
      "This registration payment has completed or is awaiting reconciliation. The payment option cannot be changed."
    );
  }

  if (checkoutSession.status === "open") {
    await stripe.checkout.sessions.expire(checkoutSessionId);

    return {
      checkout_expired: true,
      checkout_state: "expired",
    };
  }

  if (checkoutSession.status === "expired") {
    return {
      checkout_expired: false,
      checkout_state: "already_expired",
    };
  }

  throw new RequestError(
    409,
    "The current registration checkout is not in a state that can be safely changed."
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student payment-option request must use POST.",
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
            "Please sign in before changing a CE student payment option.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingInviteId = normalizeIdentifier(
      body?.pending_invite_id
    );

    if (!pendingInviteId) {
      return Response.json(
        {
          ok: false,
          error: "A CE student invitation must be selected.",
        },
        { status: 400 }
      );
    }

    const requestedPaymentResponsibility = normalizeText(
      body?.payment_responsibility
    );

    const requestedInstructorPaymentMode = normalizeText(
      body?.instructor_payment_mode
    );

    if (
      !PAYMENT_RESPONSIBILITIES.has(
        requestedPaymentResponsibility
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose whether the student or instructor is responsible for the registration payment.",
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.has(
        requestedInstructorPaymentMode
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose whether the instructor will pay now or include the registration fee on a cohort invoice.",
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentResponsibility === "student_paid" &&
      requestedInstructorPaymentMode
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "An instructor payment method can only be used when the instructor is responsible for the registration fee.",
        },
        { status: 400 }
      );
    }

    const {
      caller,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const {
      invite,
      cohortId,
      email,
      paymentResponsibility: currentPaymentResponsibility,
      instructorPaymentMode: currentInstructorPaymentMode,
    } = await resolveOpenCEStudentInvitation(
      base44,
      pendingInviteId,
      organizationId
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

    const matchingUsers = await getUsersForEmail(base44, email);

    assertInvitedEmailAccountIsSafe(
      matchingUsers,
      organizationId
    );

    const {
      enrollment,
      billingEvent,
    } = await resolveEnrollmentAndBilling(
      base44,
      invite,
      organizationId,
      cohortId,
      email,
      currentPaymentResponsibility,
      currentInstructorPaymentMode
    );

    const effectiveInstructorPaymentMode =
      requestedPaymentResponsibility === "instructor_paid"
        ? requestedInstructorPaymentMode
        : "";

    const paymentChoiceChanged =
      currentPaymentResponsibility !==
        requestedPaymentResponsibility ||
      currentInstructorPaymentMode !==
        effectiveInstructorPaymentMode;

    if (!paymentChoiceChanged) {
      return Response.json({
        ok: true,
        message:
          "The CE student invitation already uses this payment option.",
        pending_invite_id: invite.id,
        email,
        payment_responsibility:
          currentPaymentResponsibility,
        instructor_payment_mode:
          currentInstructorPaymentMode || null,
        cohort_id: cohortId,
        billing_event_id: billingEvent.id,
        billing_event_status: billingEvent.event_status,
        checkout_expired: false,
        checkout_state: "not_changed",
        access_changed: false,
      });
    }

    assertBillingChangeAllowed(billingEvent);

    const checkoutResult =
      await expireOpenCheckoutForPaymentChange(
        billingEvent,
        organizationId,
        email
      );

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        event_status: "pending",
        stripe_checkout_session_id: null,
        notes:
          "CE student payment option changed before settlement. Any verified open Stripe Checkout session was expired before the billing record was reset.",
      }
    );

    await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
      enrollment.id,
      {
        payment_responsibility:
          requestedPaymentResponsibility,
        instructor_payment_mode:
          effectiveInstructorPaymentMode || null,
        enrollment_status: "payment_pending",
        status_updated_at: now,
      }
    );

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      invite.id,
      {
        payment_responsibility:
          requestedPaymentResponsibility,
        instructor_payment_mode:
          effectiveInstructorPaymentMode || null,
      }
    );

    return Response.json({
      ok: true,
      message: "CE student payment option updated.",
      pending_invite_id: invite.id,
      email,
      payment_responsibility:
        requestedPaymentResponsibility,
      instructor_payment_mode:
        effectiveInstructorPaymentMode || null,
      cohort_id: cohortId,
      billing_event_id: billingEvent.id,
      billing_event_status: "pending",
      checkout_expired: checkoutResult.checkout_expired,
      checkout_state: checkoutResult.checkout_state,
      access_changed: false,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[updateCEStudentInvitePayment] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE student payment option could not be updated. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});
