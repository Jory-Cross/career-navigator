import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const CE_STUDENT_REGISTRATION_RATE_KEY = "ce_student_registration";

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
];

const OPEN_INVITE_STATUSES = [
  "pending",
  "invite_email_sent",
  "pending_email_failed",
];

const PAYMENT_RESPONSIBILITIES = [
  "student_paid",
  "instructor_paid",
];

const INSTRUCTOR_PAYMENT_MODES = [
  "pay_now",
  "invoice_with_cohort",
];

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
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

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${String(currency || "USD").toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

function getCanonicalUser(users) {
  const activeUsers = (users || []).filter(
    (candidate) => candidate.is_active !== false
  );

  const usableUsers = activeUsers.length > 0 ? activeUsers : users || [];

  return usableUsers.sort((a, b) => {
    const aTime = new Date(a.created_date || 0).getTime();
    const bTime = new Date(b.created_date || 0).getTime();

    return aTime - bTime;
  })[0];
}

function isNeutralExistingAccount(user) {
  const role = String(user?.role || "").trim();
  const accessLevel = String(user?.access_level || "").trim();
  const orgId = String(user?.org_id || "").trim();
  const managerId = String(user?.manager_id || "").trim();
  const linkedClientId = String(user?.linked_client_id || "").trim();

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !orgId &&
    !managerId &&
    !linkedClientId
  );
}

function buildRegistrationBillingEventKey(orgId, email) {
  return `ce_student_registration:${orgId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
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

function isPriceItemAvailableNow(item, nowMs) {
  if (item?.is_active === false) {
    return false;
  }

  const effectiveAtMs = Date.parse(
    String(item?.effective_at || "")
  );

  if (
    Number.isFinite(effectiveAtMs) &&
    effectiveAtMs > nowMs
  ) {
    return false;
  }

  const endsAtMs = Date.parse(String(item?.ends_at || ""));

  if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) {
    return false;
  }

  return true;
}

async function findExistingUserByEmail(base44, email) {
  const normalizedEmail = normalizeEmail(email);

  const filteredUsers = await base44.asServiceRole.entities.User.filter({
    email: normalizedEmail,
  });

  const exactMatches = (filteredUsers || []).filter(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );

  if (exactMatches.length > 0) {
    return getCanonicalUser(exactMatches);
  }

  const allUsers = await base44.asServiceRole.entities.User.list();

  const listMatches = (allUsers || []).filter(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );

  return getCanonicalUser(listMatches);
}

function getEnrollmentMessage(
  paymentResponsibility,
  instructorPaymentMode
) {
  if (paymentResponsibility === "student_paid") {
    return "Your CE Training registration fee must be paid before CE Training Portal access is activated.";
  }

  if (instructorPaymentMode === "pay_now") {
    return "Your instructor is handling your CE Training registration payment. CE Training Portal access will be activated after payment is confirmed.";
  }

  return "Your instructor will include your CE Training registration on a cohort invoice. CE Training Portal access will be activated after that invoice is settled.";
}

async function getExistingCheckoutSessionIfUsable(billingEvent) {
  if (!stripe) {
    throw createHttpError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

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
      "[inviteCEStudent] Unable to retrieve existing Stripe checkout session:",
      error?.message || error
    );

    return {
      reusable: false,
      expired: true,
      session: null,
    };
  }
}

async function createStudentPaidCheckout({
  base44,
  billingEvent,
  organizationId,
  studentEmail,
}) {
  if (!stripe) {
    throw createHttpError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  if (
    !CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
      billingEvent?.event_status
    )
  ) {
    throw createHttpError(
      409,
      `This CE registration billing event cannot create checkout while its status is "${billingEvent?.event_status}".`
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
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
    return {
      checkoutUrl: existingCheckout.session.url,
      checkoutSessionId: existingCheckout.session.id,
      reusedExistingCheckout: true,
      amountCents,
      currency: currency.toUpperCase(),
    };
  }

  if (
    existingCheckout?.completed &&
    existingCheckout.session.payment_status === "paid"
  ) {
    throw createHttpError(
      409,
      "Payment has already completed for this registration. A new checkout link cannot be created."
    );
  }

  const { successUrl, cancelUrl } = buildCheckoutRedirectUrls();

  const checkoutAttemptKey = existingCheckout?.expired
    ? `${billingEvent.id}:retry:${Date.now()}`
    : `${billingEvent.id}:initial`;

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
        "CE registration checkout session created automatically when the CE student invitation email was sent.",
    }
  );

   return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    reusedExistingCheckout: false,
    amountCents,
    currency: currency.toUpperCase(),
  };
}

async function createInstructorPaidCheckout({
  base44,
  billingEvent,
  organizationId,
  instructorEmail,
  studentEmail,
}) {
  if (!stripe) {
    throw createHttpError(
      500,
      "Stripe is not configured for instructor-paid CE registration checkout."
    );
  }

  const normalizedInstructorEmail =
    normalizeEmail(instructorEmail);

  if (!isValidEmail(normalizedInstructorEmail)) {
    throw createHttpError(
      409,
      "Your instructor account is missing the email address required for Stripe Checkout."
    );
  }

  if (
    !CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
      billingEvent?.event_status
    )
  ) {
    throw createHttpError(
      409,
      `This CE registration billing event cannot create checkout while its status is "${billingEvent?.event_status}".`
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
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
    return {
      checkoutUrl: existingCheckout.session.url,
      checkoutSessionId: existingCheckout.session.id,
      reusedExistingCheckout: true,
      amountCents,
      currency: currency.toUpperCase(),
    };
  }

  if (
    existingCheckout?.completed &&
    existingCheckout.session.payment_status === "paid"
  ) {
    throw createHttpError(
      409,
      "Payment has already completed for this registration. A new checkout link cannot be created."
    );
  }

  const { successUrl, cancelUrl } = buildCheckoutRedirectUrls();

  const checkoutAttemptKey = existingCheckout?.expired
    ? `${billingEvent.id}:instructor_retry:${Date.now()}`
    : `${billingEvent.id}:instructor_initial`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: normalizedInstructorEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: "CE Student Registration",
              description:
                `One-time CE Training Portal registration fee for ${studentEmail}.`,
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
        payment_responsibility: "instructor_paid",
        instructor_payment_mode: "pay_now",
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
          payment_responsibility: "instructor_paid",
          instructor_payment_mode: "pay_now",
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
      "Stripe created the instructor-paid CE registration checkout session without a checkout URL."
    );
  }

  await base44.asServiceRole.entities.OrganizationBillingEvent.update(
    billingEvent.id,
    {
      event_status: "ready_for_checkout",
      stripe_checkout_session_id: session.id,
      notes:
        "Instructor-paid CE registration checkout session created. CE access remains blocked until Stripe confirms payment.",
    }
  );

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    reusedExistingCheckout: false,
    amountCents,
    currency: currency.toUpperCase(),
  };
}

async function sendInviteEmail({
  toEmail,
  inviterName,
  appUrl,
  paymentResponsibility,
  instructorPaymentMode,
  checkoutUrl,
  amountCents,
  currency,
}) {
  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(appUrl);
  const safeEnrollmentMessage = escapeHtml(
    getEnrollmentMessage(
      paymentResponsibility,
      instructorPaymentMode
    )
  );

  const isStudentPaid =
    paymentResponsibility === "student_paid";

  if (isStudentPaid && !checkoutUrl) {
    throw new Error(
      "A student-paid CE invitation cannot be emailed without a secure Stripe checkout link."
    );
  }

  const paymentAmount = formatMoney(amountCents, currency);

  const paymentSection = isStudentPaid
    ? `
      <div style="margin: 24px 0; padding: 20px; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 8px;">
        <div style="font-size: 12px; color: #6d28d9; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
          CE TRAINING REGISTRATION FEE
        </div>
        <div style="font-size: 24px; color: #4c1d95; font-weight: 700; margin-bottom: 10px;">
          ${escapeHtml(paymentAmount)}
        </div>
        <p style="margin: 0; color: #4c1d95; line-height: 1.5;">
          Complete payment first. CE Training access becomes available after payment is confirmed and you register or sign in using this invited email address.
        </p>
      </div>

      <a
        href="${escapeHtml(checkoutUrl)}"
        style="display: inline-block; background: #7c3aed; color: white; padding: 13px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 0 18px;"
      >
        Pay Registration Fee →
      </a>
    `
    : "";

  const steps = isStudentPaid
    ? `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Use the secure payment button below to pay the registration fee</li>
        <li>Return to Career Navigator after Stripe confirms payment</li>
        <li>Register or sign in using <strong>${safeEmail}</strong></li>
      </ol>
    `
    : `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Open the CE Training Portal</li>
        <li>Register or sign in using <strong>${safeEmail}</strong></li>
        <li>CE Training access will appear after your registration payment is settled</li>
      </ol>
    `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CE Training <${RESEND_FROM}>`,
      to: [toEmail],
      subject: isStudentPaid
        ? "Complete your CE Training registration"
        : "You're invited to CE Training",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">You're invited to CE Training!</h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has started your CE Training enrollment.
          </p>

          <p style="margin-bottom: 16px;">
            ${safeEnrollmentMessage}
          </p>

          ${paymentSection}

          <p style="margin-bottom: 8px;">To get started:</p>

          ${steps}

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Register or Sign In →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use <strong>${safeEmail}</strong>. A different email address will not connect to this invitation or its registration payment.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API error ${response.status}: ${details}`);
  }

  return response.json();
}

async function getLockedRegistrationPricing(
  base44,
  organizationId
) {
  const subscriptionRows =
    await base44.asServiceRole.entities.OrganizationPlanSubscription.filter({
      organization_id: organizationId,
    });

  const currentSubscriptions = (
    Array.isArray(subscriptionRows) ? subscriptionRows : []
  ).filter(
    (subscription) =>
      subscription?.is_current === true &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(
        subscription?.subscription_status
      )
  );

  if (currentSubscriptions.length === 0) {
    throw createHttpError(
      409,
      "This organization has no current active pricing subscription. A CE student registration billing event cannot be created yet."
    );
  }

  if (currentSubscriptions.length > 1) {
    throw createHttpError(
      409,
      "This organization has multiple current active pricing subscriptions. Resolve the subscription records before creating CE student registration billing events."
    );
  }

  const subscription = currentSubscriptions[0];
  const pricingScheduleId = String(
    subscription?.pricing_schedule_id || ""
  ).trim();

  if (!pricingScheduleId) {
    throw createHttpError(
      409,
      "The organization's current subscription is missing its locked pricing schedule."
    );
  }

  const pricingScheduleRows =
    await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
      id: pricingScheduleId,
    });

  const pricingSchedules = Array.isArray(pricingScheduleRows)
    ? pricingScheduleRows
    : [];

  if (pricingSchedules.length !== 1) {
    throw createHttpError(
      409,
      "The pricing schedule assigned to this organization could not be resolved."
    );
  }

  const pricingSchedule = pricingSchedules[0];

  if (pricingSchedule.schedule_status === "draft") {
    throw createHttpError(
      409,
      "The organization's assigned pricing schedule is still a draft and cannot be used for billing."
    );
  }

  const [rateRows, scheduleItemRows] = await Promise.all([
    base44.asServiceRole.entities.PlatformBillingRate.filter({
      rate_key: CE_STUDENT_REGISTRATION_RATE_KEY,
    }),
    base44.asServiceRole.entities.PlatformPricingScheduleItem.filter({
      pricing_schedule_id: pricingSchedule.id,
    }),
  ]);

  const matchingRates = (Array.isArray(rateRows) ? rateRows : []).filter(
    (rate) =>
      rate?.rate_key === CE_STUDENT_REGISTRATION_RATE_KEY &&
      rate?.billing_subject_type === "student" &&
      rate?.charge_model === "one_time"
  );

  if (matchingRates.length !== 1) {
    throw createHttpError(
      409,
      "The CE student registration billing rate could not be resolved to exactly one record."
    );
  }

  const billingRate = matchingRates[0];
  const nowMs = Date.now();

  const matchingScheduleItems = (
    Array.isArray(scheduleItemRows) ? scheduleItemRows : []
  ).filter((item) => {
    const matchesRateKey =
      String(item?.billing_rate_key_snapshot || "").trim() ===
      CE_STUDENT_REGISTRATION_RATE_KEY;

    const matchesRateId =
      String(item?.platform_billing_rate_id || "").trim() ===
      String(billingRate.id || "").trim();

    return (
      item?.pricing_item_type === "billing_rate" &&
      item?.charge_model === "one_time" &&
      (matchesRateKey || matchesRateId) &&
      isPriceItemAvailableNow(item, nowMs)
    );
  });

  if (matchingScheduleItems.length === 0) {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule does not contain an active CE student registration price item."
    );
  }

  if (matchingScheduleItems.length > 1) {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule contains multiple active CE student registration price items. Resolve duplicate pricing items before creating billing events."
    );
  }

  const pricingItem = matchingScheduleItems[0];
  const unitAmountCents = Number(pricingItem.amount_cents);

  if (
    !Number.isInteger(unitAmountCents) ||
    unitAmountCents < 0
  ) {
    throw createHttpError(
      409,
      "The locked CE student registration price item has an invalid amount."
    );
  }

  const currency = String(
    pricingItem.currency ||
      pricingSchedule.currency ||
      billingRate.currency ||
      "USD"
  )
    .trim()
    .toUpperCase();

  if (!currency) {
    throw createHttpError(
      409,
      "The locked CE student registration price item is missing a currency."
    );
  }

  return {
    subscription,
    pricingSchedule,
    pricingItem,
    billingRate,
    unitAmountCents,
    currency,
  };
}

async function ensureRegistrationBillingEvent({
  base44,
  organizationId,
  email,
  subjectUserId,
  cohortId,
}) {
  const billingEventKey = buildRegistrationBillingEventKey(
    organizationId,
    email
  );

  const existingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      billing_event_key: billingEventKey,
    });

  const existingEvents = Array.isArray(existingRows)
    ? existingRows
    : [];

  if (existingEvents.length > 1) {
    throw createHttpError(
      409,
      "Multiple CE student registration billing events already exist for this organization and student email. Resolve duplicate billing events before continuing."
    );
  }

  if (existingEvents.length === 1) {
    const billingEvent = existingEvents[0];

    const belongsToOrganization =
      String(billingEvent?.organization_id || "").trim() ===
      organizationId;

    const matchesEmail =
      normalizeEmail(billingEvent?.subject_verified_email) ===
      normalizeEmail(email);

    const isStudentRegistration =
      billingEvent?.fee_kind === "training_registration" &&
      billingEvent?.billing_subject_type === "student";

    if (
      !belongsToOrganization ||
      !matchesEmail ||
      !isStudentRegistration
    ) {
      throw createHttpError(
        409,
        "The existing CE student registration billing event has an invalid identity and cannot be safely reused."
      );
    }

    return {
      billingEvent,
      created: false,
    };
  }

  const pricing = await getLockedRegistrationPricing(
    base44,
    organizationId
  );

  const now = new Date().toISOString();

  const billingEvent =
    await base44.asServiceRole.entities.OrganizationBillingEvent.create({
      organization_id: organizationId,
      billing_event_key: billingEventKey,
      fee_kind: "training_registration",
      event_status: "pending",
      billing_subject_type: "student",
      ...(subjectUserId
        ? { subject_user_id: subjectUserId }
        : {}),
      subject_verified_email: normalizeEmail(email),
      ...(cohortId ? { cohort_id: cohortId } : {}),
      organization_plan_subscription_id: pricing.subscription.id,
      pricing_schedule_id: pricing.pricingSchedule.id,
      pricing_schedule_key_snapshot:
        pricing.pricingSchedule.pricing_schedule_key,
      pricing_schedule_item_id: pricing.pricingItem.id,
      pricing_item_key_snapshot:
        pricing.pricingItem.pricing_item_key,
      feature_key:
        pricing.pricingItem.feature_key ||
        pricing.billingRate.feature_key ||
        "ce_training_portal",
      quantity: 1,
      unit_amount_cents: pricing.unitAmountCents,
      amount_cents: pricing.unitAmountCents,
      currency: pricing.currency,
      triggered_at: now,
      notes:
        "Pending CE student registration billing event. Payment responsibility is controlled by the related PendingRoleAssignment until payment collection begins.",
    });

   return {
    billingEvent,
    created: true,
  };
}

function buildCETrainingEnrollmentKey(
  organizationId,
  cohortId,
  email
) {
  return `ce_training_enrollment:${organizationId}:${cohortId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

async function ensureCETrainingStudentEnrollment({
  base44,
  organizationId,
  cohortId,
  email,
  pendingRoleAssignmentId,
  billingEventId,
  paymentResponsibility,
  instructorPaymentMode,
  createdByUserId,
  invitedAt,
}) {
  const normalizedCohortId = normalizeText(cohortId);
  const normalizedEmail = normalizeEmail(email);
  const normalizedBillingEventId = normalizeText(billingEventId);
  const normalizedPendingAssignmentId = normalizeText(
    pendingRoleAssignmentId
  );

  if (!normalizedCohortId) {
    return {
      enrollment: null,
      created: false,
      skipped: true,
      reason: "legacy_invitation_has_no_training_cohort",
    };
  }

  if (
    !organizationId ||
    !normalizedEmail ||
    !normalizedBillingEventId ||
    !normalizedPendingAssignmentId
  ) {
    throw createHttpError(
      409,
      "A CE Training enrollment requires an organization, Training cohort, student email, pending invitation, and billing event."
    );
  }

  const enrollmentKey = buildCETrainingEnrollmentKey(
    organizationId,
    normalizedCohortId,
    normalizedEmail
  );

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
      enrollment_key: enrollmentKey,
    });

  const enrollments = Array.isArray(enrollmentRows)
    ? enrollmentRows
    : [];

  if (enrollments.length > 1) {
    throw createHttpError(
      409,
      "Multiple CE Training enrollment records exist for this cohort and student email. Resolve the duplicate enrollment records before continuing."
    );
  }

  const now = new Date().toISOString();
  const existingEnrollment = enrollments[0] || null;

  if (existingEnrollment) {
    const identityMatches =
      normalizeText(existingEnrollment.org_id) === organizationId &&
      normalizeText(existingEnrollment.cohort_id) ===
        normalizedCohortId &&
      normalizeEmail(existingEnrollment.student_email) ===
        normalizedEmail;

    if (!identityMatches) {
      throw createHttpError(
        409,
        "The existing CE Training enrollment record does not safely match this organization, cohort, and student email."
      );
    }

    const existingBillingEventId = normalizeText(
      existingEnrollment.organization_billing_event_id
    );

    if (
      existingBillingEventId &&
      existingBillingEventId !== normalizedBillingEventId
    ) {
      throw createHttpError(
        409,
        "The existing CE Training enrollment is linked to a different registration billing event."
      );
    }

    const existingPaymentResponsibility = normalizeText(
      existingEnrollment.payment_responsibility
    );

    if (
      existingPaymentResponsibility &&
      existingPaymentResponsibility !== paymentResponsibility
    ) {
      throw createHttpError(
        409,
        "The existing CE Training enrollment has a different locked payment responsibility."
      );
    }

    const existingInstructorPaymentMode = normalizeText(
      existingEnrollment.instructor_payment_mode
    );

    if (
      existingInstructorPaymentMode &&
      existingInstructorPaymentMode !==
        normalizeText(instructorPaymentMode)
    ) {
      throw createHttpError(
        409,
        "The existing CE Training enrollment has a different locked instructor payment method."
      );
    }

    const updates = {};

    if (!normalizeText(existingEnrollment.pending_role_assignment_id)) {
      updates.pending_role_assignment_id =
        normalizedPendingAssignmentId;
    }

    if (!existingBillingEventId) {
      updates.organization_billing_event_id =
        normalizedBillingEventId;
    }

    if (!normalizeText(existingEnrollment.created_by_user_id)) {
      updates.created_by_user_id = createdByUserId;
    }

    if (!normalizeText(existingEnrollment.invited_at)) {
      updates.invited_at = invitedAt || now;
    }

    if (
      existingEnrollment.enrollment_status === "invited" ||
      !normalizeText(existingEnrollment.enrollment_status)
    ) {
      updates.enrollment_status = "payment_pending";
      updates.status_updated_at = now;
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
        existingEnrollment.id,
        updates
      );
    }

    return {
      enrollment: {
        ...existingEnrollment,
        ...updates,
      },
      created: false,
      skipped: false,
    };
  }

  const enrollment =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.create({
      org_id: organizationId,
      enrollment_key: enrollmentKey,
      cohort_id: normalizedCohortId,
      student_email: normalizedEmail,
      pending_role_assignment_id: normalizedPendingAssignmentId,
      organization_billing_event_id: normalizedBillingEventId,
      payment_responsibility: paymentResponsibility,
      ...(instructorPaymentMode
        ? {
            instructor_payment_mode:
              normalizeText(instructorPaymentMode),
          }
        : {}),
      enrollment_status: "payment_pending",
      is_active: true,
      invited_at: invitedAt || now,
      created_by_user_id: createdByUserId,
      status_updated_at: now,
      notes:
        "CE Training enrollment created from the student invitation and linked registration billing event.",
    });

  return {
    enrollment,
    created: true,
    skipped: false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

       const body = await req.json().catch(() => ({}));

    const email = normalizeEmail(body.email);
    const cohortId = String(body?.cohort_id || "").trim();
    const inviterRole = normalizeText(user.role);

    if (
      !["admin", "management", "ce_instructor"].includes(
        inviterRole
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Only administrators and active Training cohort managers can invite CE students.",
        },
        { status: 403 }
      );
    }

    const requestedPaymentResponsibility = String(
      body?.payment_responsibility || "student_paid"
    ).trim();

    const requestedInstructorPaymentMode = String(
      body?.instructor_payment_mode || ""
    ).trim();

    if (!isValidEmail(email)) {
      return Response.json(
        {
          ok: false,
          error: "A valid student email address is required.",
        },
        { status: 400 }
      );
    }

    if (
      !PAYMENT_RESPONSIBILITIES.includes(
        requestedPaymentResponsibility
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'payment_responsibility must be "student_paid" or "instructor_paid".',
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.includes(
        requestedInstructorPaymentMode
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'instructor_payment_mode must be "pay_now" or "invoice_with_cohort" when instructor_paid is selected.',
        },
        { status: 400 }
      );
    }

    const orgId = String(user.org_id || "").trim();

       if (!orgId) {
      return Response.json(
        {
          ok: false,
          error:
            "Your instructor account is missing organization access.",
        },
        { status: 400 }
      );
    }

      if (!cohortId) {
      return Response.json(
        {
          ok: false,
          error:
            "A Training cohort must be selected for every CE student enrollment.",
        },
        { status: 400 }
      );
    }
      const cohortRows =
      await base44.asServiceRole.entities.CETrainingCohort.filter({
        id: cohortId,
      });

    const cohort = Array.isArray(cohortRows)
      ? cohortRows[0]
      : null;

    if (!cohort) {
      return Response.json(
        {
          ok: false,
          error: "Selected CE training cohort was not found.",
        },
        { status: 404 }
      );
    }

    if (cohort.org_id !== orgId) {
      return Response.json(
        {
          ok: false,
          error:
            "Selected CE training cohort does not belong to your organization.",
        },
        { status: 403 }
      );
    }

    if (cohort.cohort_type !== "training") {
      return Response.json(
        {
          ok: false,
          error:
            "CE student invitations may only reference Training cohorts.",
        },
        { status: 400 }
      );
    }

    if (inviterRole !== "admin") {
      const membershipRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id: cohortId,
          user_id: user.id,
        });

      const isActiveManager = (
        Array.isArray(membershipRows) ? membershipRows : []
      ).some(
        (membership) =>
          membership.cohort_role === "manager" &&
          membership.is_active !== false
      );

      if (!isActiveManager) {
        return Response.json(
          {
            ok: false,
            error:
              "You must be an active manager of this Training cohort to invite CE students.",
          },
          { status: 403 }
        );
      }
    }
    const existingUser = await findExistingUserByEmail(
      base44,
      email
    );

    if (existingUser?.id) {
      if (existingUser.is_active === false) {
        return Response.json(
          {
            ok: false,
            error:
              "This email belongs to a deactivated account and cannot be invited.",
          },
          { status: 409 }
        );
      }

      if (existingUser.role === "ce_student") {
        if (
          existingUser.org_id &&
          existingUser.org_id !== orgId
        ) {
          return Response.json(
            {
              ok: false,
              error:
                "This CE Student account belongs to a different organization.",
            },
            { status: 409 }
          );
        }

        return Response.json({
          ok: true,
          message: "This CE Student is already registered.",
          email,
          user_id: existingUser.id,
          existing_user: true,
          already_registered: true,
          email_sent: false,
        });
      }

      if (!isNeutralExistingAccount(existingUser)) {
        return Response.json(
          {
            ok: false,
            error:
              "An active non-CE account already exists for this email and cannot be used for CE student enrollment.",
          },
          { status: 409 }
        );
      }
    }

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.list();

    const existingInvite = (pendingAssignments || []).find(
      (assignment) =>
        normalizeEmail(assignment.email) === email &&
        assignment.role === "ce_student" &&
        assignment.org_id === orgId &&
        OPEN_INVITE_STATUSES.includes(assignment.status)
    );

      const effectivePaymentResponsibility = existingInvite
      ? existingInvite.payment_responsibility || "student_paid"
      : requestedPaymentResponsibility;

    const effectiveInstructorPaymentMode = existingInvite
      ? existingInvite.instructor_payment_mode || null
      : requestedPaymentResponsibility === "instructor_paid"
        ? requestedInstructorPaymentMode
        : null;

    const effectiveCohortId = existingInvite
      ? String(existingInvite.cohort_id || "").trim()
      : cohortId;

       const billingResult = await ensureRegistrationBillingEvent({
      base44,
      organizationId: orgId,
      email,
      subjectUserId: existingUser?.id || "",
      cohortId: effectiveCohortId,
    });

    let instructorCheckoutResult = null;

    if (
      effectivePaymentResponsibility === "instructor_paid" &&
      effectiveInstructorPaymentMode === "pay_now"
    ) {
      instructorCheckoutResult =
        await createInstructorPaidCheckout({
          base44,
          billingEvent: billingResult.billingEvent,
          organizationId: orgId,
          instructorEmail: user.email,
          studentEmail: email,
        });
    }

    if (existingInvite) {
      return Response.json({
        ok: true,
        message:
          "A CE Student invitation already exists for this email. Revoke it before creating a new invitation.",
        email,
        pending_id: existingInvite.id,
        status: existingInvite.status,
        already_invited: true,
        email_sent:
          existingInvite.status === "invite_email_sent",
        payment_responsibility: effectivePaymentResponsibility,
        instructor_payment_mode: effectiveInstructorPaymentMode,
               billing_event_id: billingResult.billingEvent.id,
        billing_event_status: instructorCheckoutResult
          ? "ready_for_checkout"
          : billingResult.billingEvent.event_status,
        billing_event_created: billingResult.created,
        checkout_created:
          !!instructorCheckoutResult &&
          !instructorCheckoutResult.reusedExistingCheckout,
        checkout_reused:
          !!instructorCheckoutResult?.reusedExistingCheckout,
        checkout_url:
          instructorCheckoutResult?.checkoutUrl || null,
        checkout_session_id:
          instructorCheckoutResult?.checkoutSessionId || null,
      });
    }
    const pending =
      await base44.entities.PendingRoleAssignment.create({
        email,
        role: "ce_student",
        access_level: "ce_training_portal",
        org_id: orgId,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email || "",
        invited_at: new Date().toISOString(),
        cohort_id: cohortId || undefined,
        payment_responsibility: requestedPaymentResponsibility,
        instructor_payment_mode:
          requestedPaymentResponsibility === "instructor_paid"
            ? requestedInstructorPaymentMode
            : undefined,
        status: "pending",
      });

    let emailSent = false;
    let finalStatus = "pending";
    let checkoutResult = null;

    if (
      requestedPaymentResponsibility === "student_paid" &&
      RESEND_API_KEY
    ) {
      try {
        checkoutResult = await createStudentPaidCheckout({
          base44,
          billingEvent: billingResult.billingEvent,
          organizationId: orgId,
          studentEmail: email,
        });
      } catch (checkoutError) {
        finalStatus = "pending_email_failed";

        await base44.entities.PendingRoleAssignment.update(
          pending.id,
          {
            status: finalStatus,
          }
        );

        console.error(
          "[inviteCEStudent] Checkout preparation failed:",
          String(checkoutError)
        );

        return Response.json(
          {
            ok: false,
            invitation_created: true,
            pending_id: pending.id,
            email,
            status: finalStatus,
            error:
              "The CE invitation was created, but the payment-link email could not be prepared. Revoke this invitation before creating a new invitation.",
            billing_event_id: billingResult.billingEvent.id,
            billing_event_status:
              billingResult.billingEvent.event_status,
          },
          {
            status:
              Number(checkoutError?.status) || 500,
          }
        );
      }
    }

    if (RESEND_API_KEY) {
      try {
        await sendInviteEmail({
          toEmail: email,
          inviterName:
            user.full_name || user.email || "Your instructor",
          appUrl: getAppUrl(),
          paymentResponsibility:
            requestedPaymentResponsibility,
          instructorPaymentMode:
            requestedPaymentResponsibility === "instructor_paid"
              ? requestedInstructorPaymentMode
              : "",
          checkoutUrl: checkoutResult?.checkoutUrl || "",
          amountCents:
            checkoutResult?.amountCents ||
            billingResult.billingEvent.amount_cents,
          currency:
            checkoutResult?.currency ||
            billingResult.billingEvent.currency,
        });

        emailSent = true;
        finalStatus = "invite_email_sent";

        await base44.entities.PendingRoleAssignment.update(
          pending.id,
          {
            status: finalStatus,
          }
        );
      } catch (emailError) {
        finalStatus = "pending_email_failed";

        await base44.entities.PendingRoleAssignment.update(
          pending.id,
          {
            status: finalStatus,
          }
        );

        console.error(
          "[inviteCEStudent] Email delivery failed:",
          String(emailError)
        );
      }
    }

    return Response.json({
      ok: true,
      message: emailSent
        ? requestedPaymentResponsibility === "student_paid"
          ? "CE Student invitation created and the secure registration payment link was emailed."
          : "CE Student enrollment invitation created and email sent."
        : "CE Student enrollment invitation created.",
      pending_id: pending.id,
      email,
      status: finalStatus,
      email_sent: emailSent,
          payment_link_emailed:
        emailSent &&
        requestedPaymentResponsibility === "student_paid",
      checkout_created:
        (requestedPaymentResponsibility === "student_paid" &&
          !!checkoutResult) ||
        (effectivePaymentResponsibility === "instructor_paid" &&
          effectiveInstructorPaymentMode === "pay_now" &&
          !!instructorCheckoutResult &&
          !instructorCheckoutResult.reusedExistingCheckout),
      checkout_reused:
        !!checkoutResult?.reusedExistingCheckout ||
        !!instructorCheckoutResult?.reusedExistingCheckout,
      checkout_url:
        effectivePaymentResponsibility === "instructor_paid" &&
        effectiveInstructorPaymentMode === "pay_now"
          ? instructorCheckoutResult?.checkoutUrl || null
          : null,
      checkout_session_id:
        effectivePaymentResponsibility === "instructor_paid" &&
        effectiveInstructorPaymentMode === "pay_now"
          ? instructorCheckoutResult?.checkoutSessionId || null
          : null,
      existing_user: !!existingUser?.id,
      payment_responsibility: requestedPaymentResponsibility,
      instructor_payment_mode:
        requestedPaymentResponsibility === "instructor_paid"
          ? requestedInstructorPaymentMode
          : null,
      cohort_id: cohortId || null,
      billing_event_id: billingResult.billingEvent.id,
      billing_event_status:
        (
          (requestedPaymentResponsibility === "student_paid" &&
            !!checkoutResult) ||
          (effectivePaymentResponsibility === "instructor_paid" &&
            effectiveInstructorPaymentMode === "pay_now" &&
            !!instructorCheckoutResult)
        )
          ? "ready_for_checkout"
          : billingResult.billingEvent.event_status,
      billing_event_created: billingResult.created,
      billing_event_amount_cents:
        billingResult.billingEvent.amount_cents,
      billing_event_currency:
        billingResult.billingEvent.currency,
    });
  } catch (error) {
    console.error("[inviteCEStudent] Error:", error);

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create CE Student invitation.",
      },
      {
        status: Number(error?.status) || 500,
      }
    );
  }
});
