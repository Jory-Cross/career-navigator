import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
];

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

const fromDomain = RESEND_FROM_EMAIL.split("@")[1] || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

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

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function formatMoney(amountCents: unknown, currency: unknown) {
  const amount = Number(amountCents);
  const safeCurrency = normalizeText(currency || "USD").toUpperCase();

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${safeCurrency} ${(amount / 100).toFixed(2)}`;
}

function buildCheckoutRedirectUrls() {
  const appUrl = getAppUrl();

  return {
    successUrl:
      `${appUrl}/CERegistrationPaymentStatus` +
      `?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/?ce_registration=cancelled`,
  };
}

async function getExistingCheckoutSession(
  billingEvent: any
) {
  if (!stripe) {
    throw createHttpError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  const sessionId = normalizeText(
    billingEvent?.stripe_checkout_session_id
  );

  if (!sessionId) {
    return null;
  }

  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

async function createOrReuseStudentCheckout({
  base44,
  billingEvent,
  organizationId,
  studentEmail,
}: {
  base44: any;
  billingEvent: any;
  organizationId: string;
  studentEmail: string;
}) {
  if (!stripe) {
    throw createHttpError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  if (
    !CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
      normalizeText(billingEvent.event_status)
    )
  ) {
    return {
      checkout_url: "",
      checkout_state: "not_needed",
    };
  }

  const existingSession = await getExistingCheckoutSession(
    billingEvent
  );

  if (existingSession?.status === "open" && existingSession.url) {
    return {
      checkout_url: existingSession.url,
      checkout_state: "reused_open_checkout",
    };
  }

  if (
    existingSession?.status === "complete" &&
    existingSession.payment_status === "paid"
  ) {
    return {
      checkout_url: "",
      checkout_state: "payment_already_confirmed_by_stripe",
    };
  }

  const amountCents = Number(billingEvent.amount_cents);
  const currency = normalizeText(
    billingEvent.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw createHttpError(
      409,
      "The locked CE registration amount is invalid."
    );
  }

  if (!currency) {
    throw createHttpError(
      409,
      "The locked CE registration currency is missing."
    );
  }

  const { successUrl, cancelUrl } = buildCheckoutRedirectUrls();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: studentEmail,
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
        subject_verified_email: studentEmail,
        payment_responsibility: "student_paid",
        instructor_payment_mode: "",
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
      idempotencyKey: `${billingEvent.id}:resend:${Date.now()}`,
    }
  );

  if (!session.url) {
    throw createHttpError(
      500,
      "Stripe created a CE registration checkout session without a payment URL."
    );
  }

  await base44.asServiceRole.entities.OrganizationBillingEvent.update(
    billingEvent.id,
    {
      event_status: "ready_for_checkout",
      stripe_checkout_session_id: session.id,
      notes:
        "CE registration checkout session created or renewed during invitation resend.",
    }
  );

  return {
    checkout_url: session.url,
    checkout_state: "created_new_checkout",
  };
}

async function sendResendEmail({
  toEmail,
  inviterName,
  paymentResponsibility,
  instructorPaymentMode,
  billingEvent,
  checkoutUrl,
}: {
  toEmail: string;
  inviterName: string;
  paymentResponsibility: string;
  instructorPaymentMode: string;
  billingEvent: any;
  checkoutUrl: string;
}) {
  if (!RESEND_API_KEY) {
    throw createHttpError(
      500,
      "Email delivery is not configured for CE invitations."
    );
  }

  const eventStatus = normalizeText(billingEvent.event_status);
  const isPaid =
    eventStatus === "paid" || eventStatus === "waived";

  const isStudentPaid =
    paymentResponsibility === "student_paid";

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());

  const paymentAmount = formatMoney(
    billingEvent.amount_cents,
    billingEvent.currency
  );

  const paidSection = `
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 8px;">
      <div style="font-size: 12px; color: #166534; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
        REGISTRATION PAYMENT CONFIRMED
      </div>
      <div style="font-size: 24px; color: #14532d; font-weight: 700; margin-bottom: 10px;">
        ${escapeHtml(paymentAmount)}
      </div>
      <p style="margin: 0; color: #166534; line-height: 1.5;">
        Your CE Training registration payment has been received. Register or sign in using the exact invited email address below.
      </p>
    </div>
  `;

  const unpaidStudentSection = `
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 8px;">
      <div style="font-size: 12px; color: #6d28d9; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
        CE TRAINING REGISTRATION FEE
      </div>
      <div style="font-size: 24px; color: #4c1d95; font-weight: 700; margin-bottom: 10px;">
        ${escapeHtml(paymentAmount)}
      </div>
      <p style="margin: 0; color: #4c1d95; line-height: 1.5;">
        Complete payment before registering or signing in. CE Training access activates only after payment is confirmed.
      </p>
    </div>

    <a
      href="${escapeHtml(checkoutUrl)}"
      style="display: inline-block; background: #7c3aed; color: white; padding: 13px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 0 18px;"
    >
      Pay Registration Fee →
    </a>
  `;

  const instructorInvoiceSection = `
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px;">
      <p style="margin: 0; color: #92400e; line-height: 1.5;">
        Your instructor will include your CE Training registration on a cohort invoice. No student payment is required at this time.
      </p>
    </div>
  `;

  const instructorPayNowSection = `
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px;">
      <p style="margin: 0; color: #1e40af; line-height: 1.5;">
        Your instructor is handling your CE Training registration payment. CE Training access activates after payment is confirmed.
      </p>
    </div>
  `;

  let paymentSection = "";
  let emailSubject = "Your CE Training invitation";
  let steps = `
    <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
      <li>Open Career Navigator below</li>
      <li>Register or sign in using <strong>${safeEmail}</strong></li>
      <li>Your CE Training access will appear after the registration payment is settled</li>
    </ol>
  `;

  if (isPaid) {
    emailSubject = "Your CE Training payment is confirmed";
    paymentSection = paidSection;
    steps = `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Open Career Navigator below</li>
        <li>Register or sign in using <strong>${safeEmail}</strong></li>
        <li>Your CE Training access will appear once your account is recognized</li>
      </ol>
    `;
  } else if (isStudentPaid && checkoutUrl) {
    emailSubject = "Complete your CE Training registration";
    paymentSection = unpaidStudentSection;
    steps = `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Use the secure payment button above</li>
        <li>Return to Career Navigator after payment</li>
        <li>Register or sign in using <strong>${safeEmail}</strong></li>
      </ol>
    `;
  } else if (
    paymentResponsibility === "instructor_paid" &&
    instructorPaymentMode === "invoice_with_cohort"
  ) {
    paymentSection = instructorInvoiceSection;
  } else if (paymentResponsibility === "instructor_paid") {
    paymentSection = instructorPayNowSection;
  } else {
    paymentSection = `
      <div style="margin: 24px 0; padding: 20px; border: 1px solid #fecaca; background: #fef2f2; border-radius: 8px;">
        <p style="margin: 0; color: #991b1b; line-height: 1.5;">
          Your registration payment is still being prepared. Please contact your instructor for assistance.
        </p>
      </div>
    `;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CE Training <${RESEND_FROM}>`,
      to: [toEmail],
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">CE Training Enrollment</h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has resent your CE Training invitation.
          </p>

          ${paymentSection}

          <p style="margin-bottom: 8px;">To continue:</p>

          ${steps}

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Register or Sign In →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use <strong>${safeEmail}</strong>. A different email address cannot be connected to this CE Training invitation.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();

    throw createHttpError(
      502,
      `Invitation email delivery failed: ${details}`
    );
  }

  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      throw createHttpError(401, "Unauthorized.");
    }

    if (user.role !== "ce_instructor") {
      throw createHttpError(
        403,
        "Only CE instructors can resend CE student invitations."
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingAssignmentId = normalizeText(
      body?.pending_assignment_id
    );

    if (!pendingAssignmentId) {
      throw createHttpError(
        400,
        "A CE student invitation is required."
      );
    }

    const organizationId = normalizeText(user.org_id);

    if (!organizationId) {
      throw createHttpError(
        400,
        "Your instructor account is missing organization access."
      );
    }

    const assignmentRows =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        id: pendingAssignmentId,
      });

    const assignment = Array.isArray(assignmentRows)
      ? assignmentRows[0]
      : null;

    if (!assignment) {
      throw createHttpError(
        404,
        "The CE student invitation could not be found."
      );
    }

    if (
      assignment.role !== "ce_student" ||
      normalizeText(assignment.org_id) !== organizationId
    ) {
      throw createHttpError(
        403,
        "You are not authorized to resend this CE student invitation."
      );
    }

    if (!OPEN_INVITE_STATUSES.has(normalizeText(assignment.status))) {
      throw createHttpError(
        409,
        "Only an active, unregistered CE student invitation can be resent."
      );
    }

    const studentEmail = normalizeEmail(assignment.email);

    if (!studentEmail) {
      throw createHttpError(
        409,
        "This CE student invitation is missing its invited email address."
      );
    }

    const billingEventKey = buildRegistrationBillingEventKey(
      organizationId,
      studentEmail
    );

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        billing_event_key: billingEventKey,
      });

    const billingEvents = Array.isArray(billingRows)
      ? billingRows
      : [];

    if (billingEvents.length !== 1) {
      throw createHttpError(
        409,
        "This invitation does not have exactly one matching registration billing event."
      );
    }

    const billingEvent = billingEvents[0];

    if (
      normalizeText(billingEvent.organization_id) !== organizationId ||
      normalizeEmail(billingEvent.subject_verified_email) !==
        studentEmail ||
      !CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent.fee_kind)
      ) ||
      billingEvent.billing_subject_type !== "student"
    ) {
      throw createHttpError(
        409,
        "The registration billing event does not safely match this invitation."
      );
    }

    const paymentResponsibility =
      normalizeText(assignment.payment_responsibility) ||
      "student_paid";

    const instructorPaymentMode =
      paymentResponsibility === "instructor_paid"
        ? normalizeText(assignment.instructor_payment_mode)
        : "";

        let checkoutUrl = "";
    let checkoutState = "not_required";

    const registrationIsSettled = ["paid", "waived"].includes(
      normalizeText(billingEvent.event_status)
    );

    if (registrationIsSettled) {
      throw createHttpError(
        409,
        "This registration payment is settled. Use Resend Registration Instructions instead."
      );
    }

    if (paymentResponsibility === "student_paid") {
      const checkout = await createOrReuseStudentCheckout({
        base44,
        billingEvent,
        organizationId,
        studentEmail,
      });

      checkoutUrl = checkout.checkout_url;
      checkoutState = checkout.checkout_state;
    }

    await sendResendEmail({
      toEmail: studentEmail,
      inviterName:
        user.full_name || user.email || "Your instructor",
      paymentResponsibility,
      instructorPaymentMode,
      billingEvent,
      checkoutUrl,
    });

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: "invite_email_sent",
      }
    );

    return Response.json({
      ok: true,
      message: isPaid
        ? "CE Training invitation resent with payment-confirmed registration instructions."
        : "CE Training invitation resent.",
      pending_assignment_id: assignment.id,
      billing_event_id: billingEvent.id,
      billing_event_status: billingEvent.event_status,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        instructorPaymentMode || null,
      checkout_state: checkoutState,
      payment_link_included: !!checkoutUrl,
      access_changed: false,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to resend the CE student invitation.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
