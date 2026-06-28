import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL =
  Deno.env.get("APP_URL") || "https://ability4hire.com";

const stripe = new Stripe(STRIPE_SECRET_KEY);

const STAFF_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const OPEN_CE_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const CHECKOUT_ELIGIBLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "payment_processing",
  "failed",
]);

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

function getMostRecentAssignment(assignments: any[]) {
  return [...assignments].sort((a, b) => {
    const bTime = new Date(
      b?.invited_at || b?.created_date || 0
    ).getTime();

    const aTime = new Date(
      a?.invited_at || a?.created_date || 0
    ).getTime();

    return bTime - aTime;
  })[0];
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
async function getCurrentCallerRecord(base44: any, caller: any) {
  const rows = await base44.asServiceRole.entities.User.filter({
    id: caller.id,
  });

  return Array.isArray(rows) && rows[0] ? rows[0] : caller;
}

async function resolveBillingEvent({
  base44,
  billingEventId,
  studentEmail,
  caller,
}: {
  base44: any;
  billingEventId: string;
  studentEmail: string;
  caller: any;
}) {
  if (billingEventId) {
    const rows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        id: billingEventId,
      });

    const event = Array.isArray(rows) ? rows[0] : null;

    if (!event) {
      throw createHttpError(
        404,
        "The CE registration billing event could not be found."
      );
    }

    return event;
  }

  const emailToUse =
    studentEmail || normalizeEmail(caller.email);

  if (!emailToUse) {
    throw createHttpError(
      400,
      "billing_event_id or student_email is required."
    );
  }

  const rows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      subject_verified_email: emailToUse,
    });

  const events = (Array.isArray(rows) ? rows : []).filter(
    (event) =>
      CE_REGISTRATION_FEE_KINDS.has(event?.fee_kind) &&
      event?.billing_subject_type === "student"
  );

  if (events.length === 0) {
    throw createHttpError(
      404,
      "No CE student registration billing event was found for this email address."
    );
  }

  if (events.length > 1) {
    throw createHttpError(
      409,
      "Multiple CE student registration billing events were found for this email address. Provide billing_event_id to select the correct event."
    );
  }

  return events[0];
}

async function getOpenCEStudentAssignment(
  base44: any,
  organizationId: string,
  studentEmail: string
) {
  const rows =
    await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      org_id: organizationId,
      role: "ce_student",
    });

  const matchingAssignments = (
    Array.isArray(rows) ? rows : []
  ).filter(
    (assignment) =>
      normalizeEmail(assignment?.email) === studentEmail &&
      OPEN_CE_ASSIGNMENT_STATUSES.has(assignment?.status)
  );

  if (matchingAssignments.length === 0) {
    throw createHttpError(
      409,
      "No active CE student invitation was found for this registration billing event. A revoked, accepted, or historical invite cannot create a payment checkout."
    );
  }

  return getMostRecentAssignment(matchingAssignments);
}

async function getExistingCheckoutSessionIfUsable(
  billingEvent: any
) {
  const existingSessionId = normalizeText(
    billingEvent?.stripe_checkout_session_id
  );

  if (!existingSessionId) {
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      existingSessionId
    );

    if (session.status === "open" && session.url) {
      return {
        reusable: true,
        session,
      };
    }

    if (session.status === "complete") {
      return {
        reusable: false,
        completed: true,
        session,
      };
    }

    return {
      reusable: false,
      expired: true,
      session,
    };
  } catch (error) {
    console.error(
      "Unable to retrieve existing Stripe checkout session:",
      error?.message || error
    );

    return {
      reusable: false,
      expired: true,
      session: null,
    };
  }
}

Deno.serve(async (req) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      throw createHttpError(
        500,
        "Stripe is not configured for CE registration checkout."
      );
    }

    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const billingEventId = normalizeText(body?.billing_event_id);
    const requestedStudentEmail = normalizeEmail(
      body?.student_email
    );

    const callerRecord = await getCurrentCallerRecord(
      base44,
      caller
    );

    const billingEvent = await resolveBillingEvent({
      base44,
      billingEventId,
      studentEmail: requestedStudentEmail,
      caller,
    });

    const organizationId = normalizeText(
      billingEvent.organization_id
    );

    const studentEmail = normalizeEmail(
      billingEvent.subject_verified_email
    );

    if (
      !CE_REGISTRATION_FEE_KINDS.has(billingEvent.fee_kind) ||
      billingEvent.billing_subject_type !== "student"
    ) {
      throw createHttpError(
        409,
        "This billing event is not a CE student registration event."
      );
    }

    if (
      !CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
        billingEvent.event_status
      )
    ) {
      throw createHttpError(
        409,
        `This CE registration billing event cannot create checkout while its status is "${billingEvent.event_status}".`
      );
    }

    const openAssignment = await getOpenCEStudentAssignment(
      base44,
      organizationId,
      studentEmail
    );

    const paymentResponsibility =
      openAssignment.payment_responsibility || "student_paid";

    const instructorPaymentMode =
      paymentResponsibility === "instructor_paid"
        ? openAssignment.instructor_payment_mode || "pay_now"
        : null;

    const callerEmail = normalizeEmail(caller.email);
    const isStudent = callerEmail === studentEmail;

    const callerOrganizationId = normalizeText(
      callerRecord.org_id
    );

    const isOrganizationStaff =
      STAFF_ROLES.has(callerRecord.role) &&
      callerOrganizationId === organizationId;

    if (!isStudent && !isOrganizationStaff) {
      throw createHttpError(
        403,
        "You are not authorized to create checkout for this CE student registration."
      );
    }

       if (paymentResponsibility === "student_paid") {
      throw createHttpError(
        409,
        "Student-paid CE registration checkout is delivered through the invitation email. Use Resend Invitation when the student needs the payment link again."
      );
    }

    if (
      paymentResponsibility === "instructor_paid" &&
      instructorPaymentMode === "invoice_with_cohort"
    ) {
      throw createHttpError(
        409,
        "This registration is set to be included on a future cohort invoice. A direct checkout session cannot be created until the payment option is changed to pay now."
      );
    }

    if (
      paymentResponsibility === "instructor_paid" &&
      !isOrganizationStaff
    ) {
      throw createHttpError(
        403,
        "Only the instructor or organization may open checkout for an instructor-paid registration."
      );
    }
    const amountCents = Number(billingEvent.amount_cents);
    const currency = normalizeText(
      billingEvent.currency || "USD"
    ).toLowerCase();

    if (
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      throw createHttpError(
        409,
        "The CE registration billing event has an invalid locked amount."
      );
    }

    if (!currency) {
      throw createHttpError(
        409,
        "The CE registration billing event is missing its locked currency."
      );
    }

    const existingCheckout =
      await getExistingCheckoutSessionIfUsable(billingEvent);

    if (existingCheckout?.reusable) {
      return Response.json({
        ok: true,
        reused_existing_checkout: true,
        billing_event_id: billingEvent.id,
        billing_event_status: billingEvent.event_status,
        checkout_session_id: existingCheckout.session.id,
        checkout_url: existingCheckout.session.url,
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode: instructorPaymentMode,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
      });
    }

    if (
      existingCheckout?.completed &&
      existingCheckout.session.payment_status === "paid"
    ) {
      throw createHttpError(
        409,
        "Payment has already completed for this checkout session. Wait briefly for the payment webhook to update the CE registration status."
      );
    }

    const { successUrl, cancelUrl } = buildRedirectUrls();

    const payerEmail =
      paymentResponsibility === "instructor_paid"
        ? callerEmail
        : studentEmail;

    const checkoutAttemptKey = existingCheckout?.expired
      ? `${billingEvent.id}:retry:${Date.now()}`
      : `${billingEvent.id}:initial`;

    const session = await stripe.checkout.sessions.create(
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
        client_reference_id: billingEvent.id,
        metadata: {
          billing_flow: "ce_student_registration",
          billing_event_id: String(billingEvent.id),
          billing_event_key: String(
            billingEvent.billing_event_key
          ),
          organization_id: organizationId,
          subject_verified_email: studentEmail,
          payment_responsibility: paymentResponsibility,
          instructor_payment_mode:
            instructorPaymentMode || "",
        },
        payment_intent_data: {
          metadata: {
            billing_flow: "ce_student_registration",
            billing_event_id: String(billingEvent.id),
            billing_event_key: String(
              billingEvent.billing_event_key
            ),
            organization_id: organizationId,
            subject_verified_email: studentEmail,
          },
        },
      },
      {
        idempotencyKey: checkoutAttemptKey,
      }
    );

    if (!session.url) {
      throw createHttpError(
        500,
        "Stripe created the CE registration checkout session without a checkout URL."
      );
    }

    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        event_status: "ready_for_checkout",
        stripe_checkout_session_id: session.id,
        notes:
          "CE registration checkout session created from the locked billing event.",
      }
    );

    return Response.json({
      ok: true,
      reused_existing_checkout: false,
      billing_event_id: billingEvent.id,
      billing_event_status: "ready_for_checkout",
      checkout_session_id: session.id,
      checkout_url: session.url,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode: instructorPaymentMode,
      amount_cents: amountCents,
      currency: currency.toUpperCase(),
      message:
        "CE student registration checkout is ready. No payment is recorded until Stripe confirms successful payment.",
    });
  } catch (error) {
    console.error(
      "createCEStudentRegistrationCheckout error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create CE student registration checkout.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
