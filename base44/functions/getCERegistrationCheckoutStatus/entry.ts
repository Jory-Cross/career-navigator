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

function getNextStep(paymentState: string) {
  if (paymentState === "registration_payment_settled") {
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

Deno.serve(async (req) => {
  try {
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

    return Response.json({
      ok: true,
      payment_state: paymentState,
      next_step: getNextStep(paymentState),
      registration_payment_settled:
        billingEventStatus === "paid" ||
        billingEventStatus === "waived",
      billing_event_status: billingEventStatus,
      stripe_session_status: stripeSessionStatus,
      stripe_payment_status: stripePaymentStatus,
      amount_cents: lockedAmountCents,
      currency: lockedCurrency,
      invited_email_hint: maskEmail(billingEmail),
      paid_at: billingEvent.paid_at || null,
      message:
        paymentState === "registration_payment_settled"
          ? "Registration payment is confirmed. Register or sign in using the invited email address to continue."
          : paymentState === "payment_confirmed_processing"
            ? "Stripe received the payment. Career Navigator is confirming the registration."
            : paymentState === "payment_not_completed"
              ? "The registration payment has not been completed."
              : "Registration payment status is still being finalized.",
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
