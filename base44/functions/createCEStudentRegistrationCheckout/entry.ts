import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL =
  Deno.env.get("APP_URL") || "https://ability4hire.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const CHECKOUT_ELIGIBLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "failed",
]);

const OPEN_CE_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
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
  return typeof value === "string" ? value.trim() : "";
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

function appendAuditNote(existingNote: unknown, addition: string) {
  const existing = normalizeText(existingNote);

  return existing
    ? `${existing}\n\n${addition}`
    : addition;
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

function isAuthorizedCEStaff(profile: {
  role: string;
  access_level: string;
} | null) {
  return ["admin", "management", "ce_instructor"].includes(
    profile?.role || ""
  );
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function buildRedirectUrls() {
  const appUrl = getAppUrl();

  return {
    successUrl:
      `${appUrl}/CERegistrationPaymentStatus` +
      `?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/?ce_registration=cancelled`,
  };
}

function getStripeId(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "id" in value) {
    return normalizeText((value as { id?: unknown }).id);
  }

  return "";
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

  if (!isAuthorizedCEStaff(callerProfile)) {
    throw new RequestError(
      403,
      "You are not authorized to create CE registration checkout sessions."
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
    callerEmail,
    callerProfile,
    organizationId,
  };
}

async function resolveBillingEvent(
  base44: any,
  billingEventId: string,
  organizationId: string
) {
  const billingEvent =
    await base44.asServiceRole.entities.OrganizationBillingEvent.get(
      billingEventId
    ).catch(() => null);

  if (!billingEvent) {
    throw new RequestError(
      404,
      "The selected CE registration billing event was not found."
    );
  }

  if (
    normalizeIdentifier(billingEvent?.organization_id) !==
    organizationId
  ) {
    throw new RequestError(
      404,
      "The selected CE registration billing event is unavailable."
    );
  }

  const cohortId = normalizeIdentifier(billingEvent?.cohort_id);
  const studentEmail = normalizeEmail(
    billingEvent?.subject_verified_email
  );
  const eventStatus = normalizeText(
    billingEvent?.event_status
  ).toLowerCase();

  if (
    !CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    ) ||
    normalizeText(billingEvent?.billing_subject_type) !==
      "student" ||
    !normalizeIdentifier(billingEvent?.billing_event_key) ||
    !cohortId ||
    !isValidEmail(studentEmail)
  ) {
    throw new RequestError(
      409,
      "The selected billing event is incomplete or is not a valid CE student registration record."
    );
  }

  if (!CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(eventStatus)) {
    throw new RequestError(
      409,
      "This CE registration billing event is not currently eligible for checkout."
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RequestError(
      409,
      "The CE registration billing event has an invalid locked amount."
    );
  }

  if (!currency) {
    throw new RequestError(
      409,
      "The CE registration billing event is missing its locked currency."
    );
  }

  return {
    billingEvent,
    cohortId,
    studentEmail,
    eventStatus,
    amountCents,
    currency,
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
      "The Training cohort connected to this CE registration is unavailable."
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
      "You must be an active manager of this Training cohort to create a CE registration checkout."
    );
  }
}

async function resolveEnrollmentAndInvitation(
  base44: any,
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  studentEmail: string
) {
  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        organization_billing_event_id: billingEvent.id,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.organization_billing_event_id) ===
      normalizeIdentifier(billingEvent?.id)
  );

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      "This CE registration billing event does not have exactly one durable enrollment record."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

    if (
    enrollment?.is_active === false ||
    enrollment?.is_archived === true ||
    !["invited", "payment_pending"].includes(enrollmentStatus)
  ) {
    throw new RequestError(
      409,
      "This CE Training enrollment is not in a state that allows a new checkout session."
    );
  }

  if (
    normalizeIdentifier(enrollment?.org_id) !== organizationId ||
    normalizeIdentifier(enrollment?.cohort_id) !== cohortId ||
    normalizeEmail(enrollment?.student_email) !== studentEmail
  ) {
    throw new RequestError(
      409,
      "The CE Training enrollment does not safely match this billing event."
    );
  }

  const pendingAssignmentId = normalizeIdentifier(
    enrollment?.pending_role_assignment_id
  );

  if (!pendingAssignmentId) {
    throw new RequestError(
      409,
      "This CE Training enrollment is missing its secure invitation record."
    );
  }

  const assignment =
    await base44.asServiceRole.entities.PendingRoleAssignment.get(
      pendingAssignmentId
    ).catch(() => null);

  if (!assignment) {
    throw new RequestError(
      409,
      "The secure CE student invitation connected to this enrollment is unavailable."
    );
  }

  const assignmentStatus = normalizeText(
    assignment?.status
  ).toLowerCase();
  const assignmentRole = normalizeText(
    assignment?.role
  ).toLowerCase();
  const assignmentAccessLevel = normalizeText(
    assignment?.access_level
  ).toLowerCase();
  const assignmentCohortRole = normalizeText(
    assignment?.cohort_role
  ).toLowerCase();

  if (
    assignment?.is_archived === true ||
    assignmentRole !== "ce_student" ||
    assignmentAccessLevel !== "ce_training_portal" ||
    !OPEN_CE_ASSIGNMENT_STATUSES.has(assignmentStatus) ||
    normalizeIdentifier(assignment?.org_id) !== organizationId ||
    normalizeIdentifier(assignment?.cohort_id) !== cohortId ||
    normalizeEmail(assignment?.email) !== studentEmail ||
    normalizeIdentifier(assignment?.client_id) ||
    !["", "member"].includes(assignmentCohortRole)
  ) {
    throw new RequestError(
      409,
      "The CE student invitation does not safely match the durable enrollment."
    );
  }

  const paymentResponsibility =
    normalizeText(assignment?.payment_responsibility) ||
    "student_paid";

  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? normalizeText(assignment?.instructor_payment_mode)
      : "";

  const enrollmentPaymentResponsibility =
    normalizeText(enrollment?.payment_responsibility) ||
    "student_paid";

  const enrollmentInstructorPaymentMode =
    enrollmentPaymentResponsibility === "instructor_paid"
      ? normalizeText(enrollment?.instructor_payment_mode)
      : "";

  if (
    !["student_paid", "instructor_paid"].includes(
      paymentResponsibility
    ) ||
    paymentResponsibility !== enrollmentPaymentResponsibility ||
    instructorPaymentMode !== enrollmentInstructorPaymentMode
  ) {
    throw new RequestError(
      409,
      "The CE student invitation and enrollment have conflicting payment settings."
    );
  }

  const inviterId = normalizeIdentifier(assignment?.invited_by_id);

  if (!inviterId) {
    throw new RequestError(
      409,
      "The CE student invitation is missing its authorized inviter."
    );
  }

  const inviter =
    await base44.asServiceRole.entities.User.get(
      inviterId
    ).catch(() => null);

  if (
    !inviter ||
    !isActiveRecord(inviter) ||
    normalizeIdentifier(inviter?.org_id) !== organizationId ||
    !isAuthorizedCEStaff(getRoleProfile(inviter))
  ) {
    throw new RequestError(
      409,
      "The CE student invitation does not have a valid active organization inviter."
    );
  }

  return {
    enrollment,
    assignment,
    paymentResponsibility,
    instructorPaymentMode,
  };
}

function checkoutMatchesBillingEvent(
  checkoutSession: any,
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  studentEmail: string,
  paymentResponsibility: string,
  instructorPaymentMode: string
) {
  const metadata = checkoutSession?.metadata || {};
  const billingEventKey = normalizeText(
    billingEvent?.billing_event_key
  );
  const lockedAmountCents = Number(billingEvent?.amount_cents);
  const lockedCurrency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  return (
    !!billingEventKey &&
    Number.isInteger(lockedAmountCents) &&
    lockedAmountCents > 0 &&
    !!lockedCurrency &&
    checkoutSession?.mode === "payment" &&
    normalizeText(checkoutSession?.client_reference_id) ===
      normalizeIdentifier(billingEvent?.id) &&
    normalizeText(metadata?.billing_flow) ===
      "ce_student_registration" &&
    normalizeText(metadata?.billing_event_id) ===
      normalizeIdentifier(billingEvent?.id) &&
    normalizeText(metadata?.billing_event_key) ===
      billingEventKey &&
    normalizeText(metadata?.organization_id) === organizationId &&
    normalizeText(metadata?.cohort_id) === cohortId &&
    normalizeEmail(metadata?.subject_verified_email) ===
      studentEmail &&
    normalizeText(metadata?.payment_responsibility) ===
      paymentResponsibility &&
    normalizeText(metadata?.instructor_payment_mode) ===
      instructorPaymentMode &&
    Number(checkoutSession?.amount_total) === lockedAmountCents &&
    normalizeText(checkoutSession?.currency).toLowerCase() ===
      lockedCurrency
  );
}

async function inspectExistingCheckoutSession(
  billingEvent: any,
  organizationId: string,
  cohortId: string,
  studentEmail: string,
  paymentResponsibility: string,
  instructorPaymentMode: string
) {
  const existingSessionId = normalizeIdentifier(
    billingEvent?.stripe_checkout_session_id
  );

  if (!existingSessionId) {
    return {
      kind: "none",
      session: null,
    };
  }

  if (!stripe) {
    throw new RequestError(
      503,
      "Stripe is not configured, so the existing CE registration checkout cannot be safely verified."
    );
  }

  let checkoutSession: any;

  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(
      existingSessionId
    );
  } catch {
    throw new RequestError(
      409,
      "The existing CE registration checkout could not be verified. Resolve the payment record before creating another checkout."
    );
  }

  if (
    !checkoutMatchesBillingEvent(
      checkoutSession,
      billingEvent,
      organizationId,
      cohortId,
      studentEmail,
      paymentResponsibility,
      instructorPaymentMode
    )
  ) {
    throw new RequestError(
      409,
      "The existing CE registration checkout does not safely match this enrollment."
    );
  }

   if (
    checkoutSession.status === "open" &&
    checkoutSession.payment_status === "unpaid" &&
    normalizeText(checkoutSession?.url)
  ) {
    return {
      kind: "reusable",
      session: checkoutSession,
    };
  }

  if (
    checkoutSession.status === "complete" ||
    checkoutSession.payment_status === "paid"
  ) {
    throw new RequestError(
      409,
      "Payment has already completed or is awaiting reconciliation. A new checkout cannot be created."
    );
  }

  if (checkoutSession.status === "expired") {
    return {
      kind: "expired",
      session: checkoutSession,
    };
  }

  throw new RequestError(
    409,
    "The existing CE registration checkout is not in a state that allows another checkout session."
  );
}

async function createCheckoutSession({
  billingEvent,
  organizationId,
  cohortId,
  studentEmail,
  payerEmail,
  paymentResponsibility,
  instructorPaymentMode,
  amountCents,
  currency,
  existingCheckout,
}: {
  billingEvent: any;
  organizationId: string;
  cohortId: string;
  studentEmail: string;
  payerEmail: string;
  paymentResponsibility: string;
  instructorPaymentMode: string;
  amountCents: number;
  currency: string;
  existingCheckout: { kind: string; session: any };
}) {
  if (!stripe) {
    throw new RequestError(
      503,
      "Stripe is not configured for CE registration checkout."
    );
  }

  const { successUrl, cancelUrl } = buildRedirectUrls();

  const idempotencyKey =
    existingCheckout.kind === "expired"
      ? `ce_student_registration:${billingEvent.id}:retry:${existingCheckout.session.id}`
      : `ce_student_registration:${billingEvent.id}:initial`;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: payerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: "CE Student Registration",
              description:
                "One-time CE Training Portal registration fee.",
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(billingEvent.id),
      metadata: {
        billing_flow: "ce_student_registration",
        billing_event_id: String(billingEvent.id),
        billing_event_key: String(
          billingEvent.billing_event_key
        ),
        organization_id: organizationId,
        cohort_id: cohortId,
        subject_verified_email: studentEmail,
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode: instructorPaymentMode,
      },
      payment_intent_data: {
        metadata: {
          billing_flow: "ce_student_registration",
          billing_event_id: String(billingEvent.id),
          billing_event_key: String(
            billingEvent.billing_event_key
          ),
          organization_id: organizationId,
          cohort_id: cohortId,
          subject_verified_email: studentEmail,
        },
      },
    },
    {
      idempotencyKey,
    }
  );

  if (!checkoutSession.url) {
    throw new RequestError(
      502,
      "Stripe did not return a usable CE registration checkout link."
    );
  }

  return checkoutSession;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE registration checkout request must use POST.",
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
            "Please sign in before creating a CE registration checkout.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const billingEventId = normalizeIdentifier(
      body?.billing_event_id
    );

    if (!billingEventId) {
      return Response.json(
        {
          ok: false,
          error:
            "A CE registration billing event must be selected.",
        },
        { status: 400 }
      );
    }

    const {
      caller,
      callerEmail,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const {
      billingEvent,
      cohortId,
      studentEmail,
      amountCents,
      currency,
    } = await resolveBillingEvent(
      base44,
      billingEventId,
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

    const {
      paymentResponsibility,
      instructorPaymentMode,
    } = await resolveEnrollmentAndInvitation(
      base44,
      billingEvent,
      organizationId,
      cohortId,
      studentEmail
    );

    if (paymentResponsibility === "student_paid") {
      throw new RequestError(
        409,
        "Student-paid CE registration checkout is delivered only through the student invitation. Resend the invitation when the student needs the payment link again."
      );
    }

    if (paymentResponsibility !== "instructor_paid") {
      throw new RequestError(
        409,
        "This CE registration has an invalid payment responsibility."
      );
    }

    if (instructorPaymentMode === "invoice_with_cohort") {
      throw new RequestError(
        409,
        "This registration is assigned to a cohort invoice. A direct checkout is not available unless the payment method is changed to pay now."
      );
    }

    if (instructorPaymentMode !== "pay_now") {
      throw new RequestError(
        409,
        "This CE registration does not have a valid direct-payment method."
      );
    }

    const existingCheckout = await inspectExistingCheckoutSession(
      billingEvent,
      organizationId,
      cohortId,
      studentEmail,
      paymentResponsibility,
      instructorPaymentMode
    );

    if (existingCheckout.kind === "reusable") {
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        {
          event_status: "ready_for_checkout",
          stripe_checkout_session_id:
            existingCheckout.session.id,
        }
      );

      return Response.json({
        ok: true,
        reused_existing_checkout: true,
        billing_event_id: billingEvent.id,
        billing_event_status: "ready_for_checkout",
        checkout_session_id: existingCheckout.session.id,
        checkout_url: existingCheckout.session.url,
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode: instructorPaymentMode,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        access_changed: false,
      });
    }

    const checkoutSession = await createCheckoutSession({
      billingEvent,
      organizationId,
      cohortId,
      studentEmail,
      payerEmail: callerEmail,
      paymentResponsibility,
      instructorPaymentMode,
      amountCents,
      currency,
      existingCheckout,
    });

    const createdAt = new Date().toISOString();

    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        event_status: "ready_for_checkout",
        stripe_checkout_session_id: checkoutSession.id,
        notes: appendAuditNote(
          billingEvent?.notes,
          `Verified instructor-paid CE registration checkout created on ${createdAt}.`
        ),
      }
    );

    return Response.json({
      ok: true,
      reused_existing_checkout: false,
      billing_event_id: billingEvent.id,
      billing_event_status: "ready_for_checkout",
      checkout_session_id: checkoutSession.id,
      checkout_url: checkoutSession.url,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode: instructorPaymentMode,
      amount_cents: amountCents,
      currency: currency.toUpperCase(),
      access_changed: false,
      message:
        "CE registration checkout is ready. No payment or portal access is recorded until Stripe confirms settlement and the student completes secure sign-in activation.",
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[createCEStudentRegistrationCheckout] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE registration checkout could not be created. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});
