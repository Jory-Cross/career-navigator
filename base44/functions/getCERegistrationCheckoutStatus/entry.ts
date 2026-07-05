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

const CE_PAYMENT_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
  "accepted",
]);

async function getEnrollmentPaymentContext(
  base44: any,
  billingEvent: any
) {
  const organizationId = normalizeText(
    billingEvent?.organization_id
  );

  const studentEmail = normalizeEmail(
    billingEvent?.subject_verified_email
  );

  const cohortId = normalizeText(billingEvent?.cohort_id);

  if (!organizationId || !studentEmail) {
    return {
      paymentResponsibility: "",
      instructorPaymentMode: "",
    };
  }

  const assignmentRows =
    await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      org_id: organizationId,
      role: "ce_student",
    });

  const matchingAssignments = (
    Array.isArray(assignmentRows) ? assignmentRows : []
  )
    .filter(
      (assignment) =>
        normalizeEmail(assignment?.email) === studentEmail &&
        CE_PAYMENT_ASSIGNMENT_STATUSES.has(
          normalizeText(assignment?.status)
        ) &&
        (!cohortId ||
          normalizeText(assignment?.cohort_id) === cohortId)
    )
    .sort((a, b) => {
      const bTime = new Date(
        b?.invited_at || b?.created_date || 0
      ).getTime();

      const aTime = new Date(
        a?.invited_at || a?.created_date || 0
      ).getTime();

      return bTime - aTime;
    });

  const assignment = matchingAssignments[0];

  const paymentResponsibility = normalizeText(
    assignment?.payment_responsibility
  );

  const instructorPaymentMode = normalizeText(
    assignment?.instructor_payment_mode
  );

  return {
    paymentResponsibility:
      paymentResponsibility === "instructor_paid" ||
      paymentResponsibility === "student_paid"
        ? paymentResponsibility
        : "",
    instructorPaymentMode:
      instructorPaymentMode === "pay_now" ||
      instructorPaymentMode === "invoice_with_cohort"
        ? instructorPaymentMode
        : "",
  };
}
function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return "";
  }

  const visibleLocal =
    localPart.length <= 2
      ? localPart.charAt(0)
      : localPart.slice(0, 2);

  const visibleDomain = domain.split(".")[0].slice(0, 2);
  const topLevelDomain = domain.includes(".")
    ? `.${domain.split(".").slice(1).join(".")}`
    : "";

  return `${visibleLocal}•••@${visibleDomain}•••${topLevelDomain}`;
}

function getPaymentState(
  billingEventStatus: string,
  stripeSessionStatus: string,
  stripePaymentStatus: string
) {
  if (
    billingEventStatus === "paid" ||
    billingEventStatus === "waived"
  ) {
    return "registration_payment_settled";
  }

  if (stripePaymentStatus === "paid") {
    return "payment_confirmed_processing";
  }

  if (stripeSessionStatus === "open") {
    return "payment_not_completed";
  }

  if (billingEventStatus === "failed") {
    return "payment_failed";
  }

  return "payment_processing";
}

function isInstructorPaidReceipt(
  paymentResponsibility: string,
  instructorPaymentMode: string
) {
  return (
    paymentResponsibility === "instructor_paid" &&
    instructorPaymentMode === "pay_now"
  );
}

function getStudentSettlementEmailState(billingEvent: any) {
  if (
    normalizeText(
      billingEvent?.registration_settlement_email_sent_at
    )
  ) {
    return "sent";
  }

  if (
    normalizeText(
      billingEvent?.registration_settlement_email_last_error
    )
  ) {
    return "failed";
  }

  if (
    normalizeText(
      billingEvent?.registration_settlement_email_last_attempt_at
    )
  ) {
    return "pending";
  }

  return "not_recorded";
}

function getNextStep(
  paymentState: string,
  paymentResponsibility: string,
  instructorPaymentMode: string,
  studentSettlementEmailState: string
) {
  if (paymentState === "registration_payment_settled") {
    if (
      isInstructorPaidReceipt(
        paymentResponsibility,
        instructorPaymentMode
      )
    ) {
      if (studentSettlementEmailState === "sent") {
        return "student_has_been_emailed_registration_instructions";
      }

      if (studentSettlementEmailState === "pending") {
        return "student_registration_email_delivery_pending";
      }

      return "student_registration_email_needs_attention";
    }

    return "register_or_sign_in_with_invited_email";
  }

  if (paymentState === "payment_confirmed_processing") {
    return "wait_for_payment_confirmation";
  }

  if (paymentState === "payment_not_completed") {
    return "return_to_secure_checkout";
  }

  return "contact_your_instructor";
}

function getStatusMessage(
  paymentState: string,
  paymentResponsibility: string,
  instructorPaymentMode: string,
  studentSettlementEmailState: string
) {
  if (paymentState === "registration_payment_settled") {
    if (
      isInstructorPaidReceipt(
        paymentResponsibility,
        instructorPaymentMode
      )
    ) {
      if (studentSettlementEmailState === "sent") {
        return "Payment is confirmed. The student has been emailed instructions to register using their invited email address.";
      }

      if (studentSettlementEmailState === "pending") {
        return "Payment is confirmed. The student registration email is still being processed.";
      }

      return "Payment is confirmed, but the student registration email needs attention before the student can be notified.";
    }

    return "Registration payment is confirmed. Register or sign in using the invited email address to continue.";
  }

  if (paymentState === "payment_confirmed_processing") {
    return "Stripe received the payment. Career Navigator is confirming the registration.";
  }

  if (paymentState === "payment_not_completed") {
    return "The registration payment has not been completed.";
  }

  return "Registration payment status is still being finalized.";
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    if (!stripe) {
      throw createHttpError(
        500,
        "Stripe is not configured for CE registration status checks."
      );
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const sessionId = normalizeText(body?.session_id);

    if (!sessionId) {
      throw createHttpError(
        400,
        "A Stripe Checkout session ID is required."
      );
    }

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      throw createHttpError(
        404,
        "The CE registration payment session could not be found."
      );
    }

    const metadata = session.metadata || {};
    const billingEventId = normalizeText(metadata.billing_event_id);

    if (
      session.mode !== "payment" ||
      metadata.billing_flow !== "ce_student_registration" ||
      !billingEventId
    ) {
      throw createHttpError(
        404,
        "The payment session is not a CE student registration checkout."
      );
    }

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        id: billingEventId,
      });

    const billingEvent = Array.isArray(billingRows)
      ? billingRows[0]
      : null;

    if (!billingEvent) {
      throw createHttpError(
        404,
        "The CE registration billing record could not be found."
      );
    }

    if (
      !CE_REGISTRATION_FEE_KINDS.has(billingEvent.fee_kind) ||
      billingEvent.billing_subject_type !== "student"
    ) {
      throw createHttpError(
        409,
        "The billing record is not a CE student registration event."
      );
    }

    const billingOrganizationId = normalizeText(
      billingEvent.organization_id
    );

    const billingEventKey = normalizeText(
      billingEvent.billing_event_key
    );

    const billingEmail = normalizeEmail(
      billingEvent.subject_verified_email
    );

    if (
      normalizeText(metadata.organization_id) !==
      billingOrganizationId
    ) {
      throw createHttpError(
        409,
        "The payment session organization does not match the registration billing record."
      );
    }

    if (
      normalizeText(metadata.billing_event_key) !==
      billingEventKey
    ) {
      throw createHttpError(
        409,
        "The payment session billing key does not match the registration billing record."
      );
    }

    if (
      normalizeEmail(metadata.subject_verified_email) !==
      billingEmail
    ) {
      throw createHttpError(
        409,
        "The payment session email does not match the registration billing record."
      );
    }

    const lockedAmountCents = Number(billingEvent.amount_cents);
    const checkoutAmountCents = Number(session.amount_total);

    if (
      Number.isFinite(lockedAmountCents) &&
      Number.isFinite(checkoutAmountCents) &&
      lockedAmountCents !== checkoutAmountCents
    ) {
      throw createHttpError(
        409,
        "The payment amount does not match the locked registration amount."
      );
    }

    const lockedCurrency = normalizeText(
      billingEvent.currency
    ).toUpperCase();

    const checkoutCurrency = normalizeText(
      session.currency
    ).toUpperCase();

    if (
      lockedCurrency &&
      checkoutCurrency &&
      lockedCurrency !== checkoutCurrency
    ) {
      throw createHttpError(
        409,
        "The payment currency does not match the locked registration currency."
      );
    }

    const billingEventStatus = normalizeText(
      billingEvent.event_status
    );

    const stripeSessionStatus = normalizeText(session.status);
    const stripePaymentStatus = normalizeText(
      session.payment_status
    );

       const paymentState = getPaymentState(
      billingEventStatus,
      stripeSessionStatus,
      stripePaymentStatus
    );

      const enrollmentPaymentContext =
      await getEnrollmentPaymentContext(base44, billingEvent);

    const sessionPaymentResponsibility = normalizeText(
      metadata.payment_responsibility
    );

    const sessionInstructorPaymentMode = normalizeText(
      metadata.instructor_payment_mode
    );

    const paymentResponsibility =
      sessionPaymentResponsibility === "instructor_paid" ||
      sessionPaymentResponsibility === "student_paid"
        ? sessionPaymentResponsibility
        : enrollmentPaymentContext.paymentResponsibility ||
          "student_paid";

    const instructorPaymentMode =
      paymentResponsibility === "instructor_paid"
        ? sessionInstructorPaymentMode ||
          enrollmentPaymentContext.instructorPaymentMode
        : "";

    const studentSettlementEmailState =
      getStudentSettlementEmailState(billingEvent);

    const instructorPaidReceipt = isInstructorPaidReceipt(
      paymentResponsibility,
      instructorPaymentMode
    );

    return Response.json({

    return Response.json({
      ok: true,
          payment_state: paymentState,
      next_step: getNextStep(
        paymentState,
        paymentResponsibility,
        instructorPaymentMode,
        studentSettlementEmailState
      ),
      registration_payment_settled:
        billingEventStatus === "paid" ||
        billingEventStatus === "waived",
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        instructorPaymentMode || null,
      is_instructor_paid_receipt: instructorPaidReceipt,
      student_registration_email_state:
        studentSettlementEmailState,
      student_registration_email_sent_at:
        billingEvent.registration_settlement_email_sent_at ||
        null,
      billing_event_status: billingEventStatus,
      stripe_session_status: stripeSessionStatus,
      stripe_payment_status: stripePaymentStatus,
      amount_cents: lockedAmountCents,
      currency: lockedCurrency,
      invited_email_hint: maskEmail(billingEmail),
      paid_at: billingEvent.paid_at || null,
      message: getStatusMessage(
        paymentState,
        paymentResponsibility,
        instructorPaymentMode,
        studentSettlementEmailState
      ),
    });
  } catch (error) {
    const status = Number(
      (error as Error & { status?: number })?.status
    ) || 500;

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to check CE registration payment status.",
      },
      { status }
    );
  }
});