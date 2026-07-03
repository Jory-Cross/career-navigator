import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import Stripe from "npm:stripe@14.21.0";

/**
 * Stripe settlement may update billing and durable enrollment state, but it
 * must never assign a User role, accept a PendingRoleAssignment, or create a
 * CE cohort membership. Those actions are performed only by the authenticated,
 * tenant-scoped applyPendingRoleIfNeeded login activation workflow.
 */
async function activateExistingPaidCEStudentIfEligible(
  _base44: any,
  _billingRecord: any,
) {
  return {
    activated: false,
    reason: "activation_deferred_to_applyPendingRoleIfNeeded",
  };
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
]);

const TIER_LIMITS = {
  starter: { max_employees: 3, max_clients: 25 },
  professional: { max_employees: 10, max_clients: 100 },
  enterprise: { max_employees: 999, max_clients: 9999 },
};

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(amountCents: unknown, currency: unknown) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${normalizeText(currency || "USD").toUpperCase()} ${(
    amount / 100
  ).toFixed(2)}`;
}

function getRegistrationUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function getCeSettlementEmailConfiguration() {
  const deliveryEnabled =
    normalizeText(
      Deno.env.get("CE_INVITATION_EMAIL_DELIVERY_ENABLED")
    ).toLowerCase() === "true";

  const senderEmail = normalizeEmail(RESEND_FROM_EMAIL);
  const senderDomain = senderEmail.split("@")[1] || "";

  return {
    deliveryEnabled,
    senderEmail,
    isReady:
      deliveryEnabled &&
      !!RESEND_API_KEY &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail) &&
      !FREE_EMAIL_DOMAINS.has(senderDomain),
  };
}

async function updateSettlementEmailTracking(
  base44: any,
  billingEventId: string,
  updates: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEventId,
      updates
    );
  } catch (trackingError: any) {
    console.error(
      "[stripeWebhook] Unable to update CE settlement-email tracking:",
      trackingError?.message || trackingError
    );
  }
}

/**
 * Stripe settlement records payment and sends registration instructions.
 *
 * It must never update User.role, User.access_level, User.org_id,
 * PendingRoleAssignment.status, or CETrainingCohortMember. Those access
 * changes are performed only by applyPendingRoleIfNeeded after an
 * authenticated user signs in with the invited email address.
 */
async function syncCETrainingStudentEnrollmentSettlement(
  base44: any,
  billingRecord: any,
  paidAt: string
) {
  const billingEventId = normalizeText(billingRecord?.id);
  const organizationId = normalizeText(
    billingRecord?.organization_id
  );
  const cohortId = normalizeText(billingRecord?.cohort_id);
  const studentEmail = normalizeEmail(
    billingRecord?.subject_verified_email
  );

  const isEligibleRegistration =
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingRecord?.fee_kind)
    ) &&
    billingRecord?.billing_subject_type === "student";

  if (
    !billingEventId ||
    !organizationId ||
    !cohortId ||
    !studentEmail ||
    !isEligibleRegistration
  ) {
    return {
      updated: false,
      skipped: true,
      reason: "billing_event_is_not_a_complete_ce_training_enrollment",
    };
  }

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        organization_billing_event_id: billingEventId,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeText(enrollment?.organization_billing_event_id) ===
      billingEventId
  );

  if (enrollments.length === 0) {
    return {
      updated: false,
      skipped: true,
      reason: "no_durable_enrollment_record_found",
    };
  }

  if (enrollments.length > 1) {
    console.error(
      `[stripeWebhook] Multiple durable CE enrollments reference billing event ${billingEventId}.`
    );

    return {
      updated: false,
      skipped: true,
      reason: "multiple_durable_enrollment_records_found",
    };
  }

  const enrollment = enrollments[0];

  const identityMatches =
    normalizeText(enrollment?.org_id) === organizationId &&
    normalizeText(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === studentEmail &&
    normalizeText(enrollment?.organization_billing_event_id) ===
      billingEventId;

  if (!identityMatches) {
    console.error(
      `[stripeWebhook] Durable CE enrollment identity mismatch for billing event ${billingEventId}.`
    );

    return {
      updated: false,
      skipped: true,
      reason: "durable_enrollment_identity_mismatch",
    };
  }

  const currentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  if (
    enrollment?.is_active === false ||
    ["withdrawn", "revoked"].includes(currentStatus)
  ) {
    return {
      updated: false,
      skipped: true,
      reason: "durable_enrollment_is_not_active",
      enrollment_id: enrollment.id,
    };
  }

  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (!normalizeText(enrollment?.payment_settled_at)) {
    updates.payment_settled_at = paidAt;
  }

  if (!["active", "training_completed"].includes(currentStatus)) {
    updates.enrollment_status =
      "payment_settled_registration_pending";
    updates.status_updated_at = now;
  }

  if (Object.keys(updates).length === 0) {
    return {
      updated: false,
      skipped: true,
      reason: "durable_enrollment_already_current",
      enrollment_id: enrollment.id,
      enrollment_status: currentStatus,
    };
  }

  await base44.asServiceRole.entities.CETrainingStudentEnrollment.update(
    enrollment.id,
    updates
  );

  return {
    updated: true,
    skipped: false,
    enrollment_id: enrollment.id,
    enrollment_status:
      updates.enrollment_status || currentStatus,
  };
}

async function sendCEStudentSettlementEmail(
  base44: any,
  billingRecord: any
) {
  const billingEventId = normalizeText(billingRecord?.id);
  const studentEmail = normalizeEmail(
    billingRecord?.subject_verified_email
  );

  const isEligibleRegistration =
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingRecord?.fee_kind)
    ) &&
    billingRecord?.billing_subject_type === "student";

  if (!billingEventId || !studentEmail || !isEligibleRegistration) {
    return {
      sent: false,
      skipped: true,
      reason: "not_an_eligible_ce_student_registration",
    };
  }

  if (
    normalizeText(
      billingRecord?.registration_settlement_email_sent_at
    )
  ) {
    return {
      sent: false,
      skipped: true,
      reason: "settlement_email_already_recorded",
    };
  }

  const attemptedAt = new Date().toISOString();
  const emailConfiguration = getCeSettlementEmailConfiguration();

  if (!emailConfiguration.isReady) {
    await updateSettlementEmailTracking(base44, billingEventId, {
      registration_settlement_email_last_attempt_at: attemptedAt,
      registration_settlement_email_last_error:
        emailConfiguration.deliveryEnabled
          ? "CE settlement email delivery is not fully configured."
          : "CE settlement email delivery is paused.",
    });

    return {
      sent: false,
      skipped: false,
      reason: "email_delivery_not_configured",
    };
  }

  const registrationUrl = getRegistrationUrl();
  const paymentAmount = formatMoney(
    billingRecord?.amount_cents,
    billingRecord?.currency
  );

  const safeStudentEmail = escapeHtml(studentEmail);
  const safeRegistrationUrl = escapeHtml(registrationUrl);
  const safePaymentAmount = escapeHtml(paymentAmount);

  await updateSettlementEmailTracking(base44, billingEventId, {
    registration_settlement_email_last_attempt_at: attemptedAt,
    registration_settlement_email_last_error: "",
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ce-registration-settlement:${billingEventId}`,
      },
      body: JSON.stringify({
        from: `CE Training <${emailConfiguration.senderEmail}>`,
        to: [studentEmail],
        subject:
          "Your CE Training registration payment is confirmed",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
            <h2 style="color: #7c3aed; margin-bottom: 12px;">
              Your CE Training payment is confirmed
            </h2>

            <p style="font-size: 16px; line-height: 1.6;">
              Your CE Training registration payment of
              <strong>${safePaymentAmount}</strong> has been received.
            </p>

            <p style="font-size: 16px; line-height: 1.6;">
              Your enrollment is linked to a Training cohort. To activate CE
              Training Portal access, create your account or sign in using
              this exact invited email address:
              <strong>${safeStudentEmail}</strong>.
            </p>

            <a
              href="${safeRegistrationUrl}"
              style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 13px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 12px 0 18px;"
            >
              Register or Sign In →
            </a>

            <p style="color: #64748b; font-size: 13px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Use the invited email address above. A different email cannot be
              connected to this CE Training enrollment.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      console.error(
        `[stripeWebhook] CE settlement email failed for billing event ${billingEventId}: ${response.status}`
      );

      await updateSettlementEmailTracking(base44, billingEventId, {
        registration_settlement_email_last_attempt_at: attemptedAt,
        registration_settlement_email_last_error:
          `Resend delivery failed with status ${response.status}.`,
      });

      return {
        sent: false,
        skipped: false,
        reason: "email_delivery_failed",
      };
    }

    const providerPayload = await response.json().catch(() => ({}));

    await updateSettlementEmailTracking(base44, billingEventId, {
      registration_settlement_email_sent_at: attemptedAt,
      registration_settlement_email_provider_id:
        normalizeText(providerPayload?.id),
      registration_settlement_email_last_attempt_at: attemptedAt,
      registration_settlement_email_last_error: "",
    });

    return {
      sent: true,
      skipped: false,
      provider_id: normalizeText(providerPayload?.id) || null,
    };
  } catch (emailError: any) {
    console.error(
      `[stripeWebhook] CE settlement email error for billing event ${billingEventId}:`,
      emailError?.message || emailError
    );

    await updateSettlementEmailTracking(base44, billingEventId, {
      registration_settlement_email_last_attempt_at: attemptedAt,
      registration_settlement_email_last_error: String(
        emailError?.message || "Unable to send settlement email."
      ).slice(0, 500),
    });

    return {
      sent: false,
      skipped: false,
      reason: "email_delivery_error",
    };
  }
}

function validateCeStudentCheckoutMetadata(
  session: Stripe.Checkout.Session,
  billingRecord: any
) {
  const metadata = session.metadata || {};
  const billingEventId = normalizeText(billingRecord?.id);

  if (metadata.billing_flow !== "ce_student_registration") {
    throw new Error(
      "Stripe checkout does not identify the CE student registration billing flow."
    );
  }

  if (
    normalizeText(metadata.billing_event_id) !== billingEventId ||
    normalizeText(metadata.billing_event_key) !==
      normalizeText(billingRecord?.billing_event_key) ||
    normalizeText(metadata.organization_id) !==
      normalizeText(billingRecord?.organization_id) ||
    normalizeEmail(metadata.subject_verified_email) !==
      normalizeEmail(billingRecord?.subject_verified_email)
  ) {
    throw new Error(
      "Stripe checkout metadata does not safely match the CE registration billing record."
    );
  }

  const expectedSessionId = normalizeText(
    billingRecord?.stripe_checkout_session_id
  );

  if (
    expectedSessionId &&
    expectedSessionId !== normalizeText(session.id)
  ) {
    throw new Error(
      "Stripe checkout session does not match the registration billing record."
    );
  }

  const expectedAmount = Number(billingRecord?.amount_cents);
  const checkoutAmount = Number(session.amount_total);

  if (
    Number.isFinite(expectedAmount) &&
    Number.isFinite(checkoutAmount) &&
    expectedAmount !== checkoutAmount
  ) {
    throw new Error(
      "Stripe checkout amount does not match the locked registration amount."
    );
  }

  const expectedCurrency = normalizeText(
    billingRecord?.currency
  ).toLowerCase();

  const checkoutCurrency = normalizeText(
    session.currency
  ).toLowerCase();

  if (
    expectedCurrency &&
    checkoutCurrency &&
    expectedCurrency !== checkoutCurrency
  ) {
    throw new Error(
      "Stripe checkout currency does not match the locked registration currency."
    );
  }
}

async function handleCERegistrationCheckoutCompleted(
  base44: any,
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata || {};
  const billingEventId = normalizeText(metadata.billing_event_id);

  if (!billingEventId) {
    throw new Error(
      "CE registration checkout session is missing billing_event_id metadata."
    );
  }

  const billingRecord =
    await base44.asServiceRole.entities.OrganizationBillingEvent.get(
      billingEventId
    ).catch(() => null);

  if (!billingRecord) {
    throw new Error(
      "The CE registration billing event referenced by Stripe could not be found."
    );
  }

  if (
    !CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingRecord?.fee_kind)
    ) ||
    billingRecord?.billing_subject_type !== "student"
  ) {
    throw new Error(
      "The Stripe checkout session does not reference a CE student registration billing event."
    );
  }

  validateCeStudentCheckoutMetadata(session, billingRecord);

  const checkoutSessionId = normalizeText(session.id);
  const paymentIntentId = getStripeId(session.payment_intent);
  const paymentStatus = normalizeText(session.payment_status);

  if (normalizeText(billingRecord?.event_status) === "waived") {
    return {
      handled: true,
      paid: false,
      ignored: true,
      reason: "billing_event_already_waived",
      billing_event_id: billingRecord.id,
    };
  }

  if (normalizeText(billingRecord?.event_status) === "refunded") {
    return {
      handled: true,
      paid: false,
      ignored: true,
      reason: "billing_event_already_refunded",
      billing_event_id: billingRecord.id,
    };
  }

  if (paymentStatus !== "paid") {
    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingRecord.id,
      {
        event_status: "payment_processing",
        stripe_checkout_session_id: checkoutSessionId,
        ...(paymentIntentId
          ? { stripe_payment_intent_id: paymentIntentId }
          : {}),
      }
    );

    return {
      handled: true,
      paid: false,
      payment_status: paymentStatus || "unknown",
      billing_event_id: billingRecord.id,
    };
  }

  const paidAt = new Date().toISOString();

  const settledBillingRecord = {
    ...billingRecord,
    event_status: "paid",
    paid_at: paidAt,
    stripe_checkout_session_id: checkoutSessionId,
    ...(paymentIntentId
      ? { stripe_payment_intent_id: paymentIntentId }
      : {}),
  };

  await base44.asServiceRole.entities.OrganizationBillingEvent.update(
    billingRecord.id,
    {
      event_status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId,
      ...(paymentIntentId
        ? { stripe_payment_intent_id: paymentIntentId }
        : {}),
    }
  );

  const enrollmentPaymentSettlement =
    await syncCETrainingStudentEnrollmentSettlement(
      base44,
      settledBillingRecord,
      paidAt
    );

  const studentRegistrationEmail =
    await sendCEStudentSettlementEmail(
      base44,
      settledBillingRecord
    );

  return {
    handled: true,
    paid: true,
    billing_event_id: billingRecord.id,
    account_activation: {
      activated: false,
      reason: "activation_deferred_to_applyPendingRoleIfNeeded",
    },
    student_registration_email: studentRegistrationEmail,
    durable_enrollment_payment_settlement:
      enrollmentPaymentSettlement,
  };
}

async function handleCETrainingCohortInvoiceCheckoutCompleted(
  base44: any,
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata || {};
  const cohortInvoiceId = normalizeText(
    metadata.cohort_invoice_id
  );

  if (
    metadata.billing_flow !== "ce_training_cohort_invoice" ||
    !cohortInvoiceId
  ) {
    throw new Error(
      "CE Training cohort invoice checkout metadata is incomplete."
    );
  }

  const cohortInvoice =
    await base44.asServiceRole.entities.CETrainingCohortInvoice.get(
      cohortInvoiceId
    ).catch(() => null);

  if (!cohortInvoice) {
    throw new Error(
      "The CE Training cohort invoice referenced by Stripe could not be found."
    );
  }

  if (
    normalizeText(metadata.organization_id) !==
      normalizeText(cohortInvoice?.organization_id) ||
    normalizeText(metadata.cohort_id) !==
      normalizeText(cohortInvoice?.cohort_id) ||
    normalizeText(metadata.invoice_key) !==
      normalizeText(cohortInvoice?.invoice_key)
  ) {
    throw new Error(
      "Stripe checkout metadata does not safely match the cohort invoice."
    );
  }

  const checkoutSessionId = normalizeText(session.id);
  const paymentIntentId = getStripeId(session.payment_intent);
  const paymentStatus = normalizeText(session.payment_status);

  const expectedCheckoutSessionId = normalizeText(
    cohortInvoice?.stripe_checkout_session_id
  );

  if (
    expectedCheckoutSessionId &&
    expectedCheckoutSessionId !== checkoutSessionId
  ) {
    throw new Error(
      "Stripe checkout session does not match the cohort invoice checkout session."
    );
  }

  const expectedAmount = Number(cohortInvoice?.amount_cents);
  const checkoutAmount = Number(session.amount_total);

  if (
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    !Number.isFinite(checkoutAmount) ||
    checkoutAmount !== expectedAmount
  ) {
    throw new Error(
      "Stripe checkout amount does not match the locked cohort invoice amount."
    );
  }

  const expectedCurrency = normalizeText(
    cohortInvoice?.currency
  ).toLowerCase();

  const checkoutCurrency = normalizeText(
    session.currency
  ).toLowerCase();

  if (
    !expectedCurrency ||
    !checkoutCurrency ||
    expectedCurrency !== checkoutCurrency
  ) {
    throw new Error(
      "Stripe checkout currency does not match the locked cohort invoice currency."
    );
  }

  const invoiceStatus = normalizeText(
    cohortInvoice?.invoice_status
  ).toLowerCase();

  if (invoiceStatus === "paid") {
    return {
      handled: true,
      paid: true,
      ignored: true,
      reason: "cohort_invoice_already_paid",
      cohort_invoice_id: cohortInvoice.id,
    };
  }

  if (["cancelled", "refunded"].includes(invoiceStatus)) {
    return {
      handled: true,
      paid: false,
      ignored: true,
      reason: "cohort_invoice_not_payable",
      cohort_invoice_id: cohortInvoice.id,
    };
  }

  const invoiceLineRows =
    await base44.asServiceRole.entities.CETrainingCohortInvoiceLine.filter(
      {
        cohort_invoice_id: cohortInvoice.id,
      }
    );

  const invoiceLines = asArray(invoiceLineRows);

  const expectedStudentCount = Number(
    cohortInvoice?.student_count
  );

  if (
    !Number.isInteger(expectedStudentCount) ||
    expectedStudentCount <= 0 ||
    invoiceLines.length !== expectedStudentCount
  ) {
    throw new Error(
      "The cohort invoice line count does not match its locked student count."
    );
  }

  const billingEventIds = new Set<string>();
  let invoiceLineTotalAmountCents = 0;

  for (const invoiceLine of invoiceLines) {
    if (
      normalizeText(invoiceLine?.organization_id) !==
        normalizeText(cohortInvoice?.organization_id) ||
      normalizeText(invoiceLine?.cohort_id) !==
        normalizeText(cohortInvoice?.cohort_id) ||
      normalizeText(invoiceLine?.cohort_invoice_id) !==
        normalizeText(cohortInvoice?.id)
    ) {
      throw new Error(
        "A cohort invoice line does not safely match its parent cohort invoice."
      );
    }

    if (
      normalizeText(invoiceLine?.currency).toLowerCase() !==
      expectedCurrency
    ) {
      throw new Error(
        "A cohort invoice line currency does not match its parent invoice."
      );
    }

    const lineAmountCents = Number(invoiceLine?.amount_cents);

    if (
      !Number.isInteger(lineAmountCents) ||
      lineAmountCents < 0
    ) {
      throw new Error(
        "A cohort invoice line has an invalid locked registration amount."
      );
    }

    if (
      !["included", "paid"].includes(
        normalizeText(invoiceLine?.line_status)
      )
    ) {
      throw new Error(
        "A cohort invoice contains a line that is no longer payable."
      );
    }

    const billingEventId = normalizeText(
      invoiceLine?.organization_billing_event_id
    );

        if (!billingEventId || billingEventIds.has(billingEventId)) {
      throw new Error(
        "A cohort invoice contains duplicate or missing student billing-event references."
      );
    }

    const enrollmentId = normalizeText(
      invoiceLine?.ce_training_student_enrollment_id
    );

    // Older invoice lines predate the durable enrollment link.
    // New lines must validate the exact linked enrollment before settlement.
    if (enrollmentId) {
      const enrollmentRows =
        await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
          {
            organization_billing_event_id: billingEventId,
          }
        );

      const linkedEnrollments = asArray(enrollmentRows);
      const enrollment = linkedEnrollments[0] || null;
      const enrollmentStatus = normalizeText(
        enrollment?.enrollment_status
      ).toLowerCase();

      const enrollmentMatches =
        linkedEnrollments.length === 1 &&
        normalizeText(enrollment?.id) === enrollmentId &&
        enrollment?.is_active !== false &&
        !["withdrawn", "revoked"].includes(enrollmentStatus) &&
        normalizeText(enrollment?.org_id) ===
          normalizeText(cohortInvoice?.organization_id) &&
        normalizeText(enrollment?.cohort_id) ===
          normalizeText(cohortInvoice?.cohort_id) &&
        normalizeEmail(enrollment?.student_email) ===
          normalizeEmail(invoiceLine?.subject_verified_email) &&
        normalizeText(enrollment?.pending_role_assignment_id) ===
          normalizeText(invoiceLine?.pending_role_assignment_id) &&
        normalizeText(enrollment?.organization_billing_event_id) ===
          billingEventId &&
        normalizeText(enrollment?.payment_responsibility) ===
          "instructor_paid" &&
        normalizeText(enrollment?.instructor_payment_mode) ===
          "invoice_with_cohort" &&
        [
          "invited",
          "payment_pending",
          "payment_settled_registration_pending",
          "active",
          "training_completed",
        ].includes(enrollmentStatus);

      if (!enrollmentMatches) {
        throw new Error(
          "A cohort invoice line is not safely linked to one eligible CE Training enrollment."
        );
      }
    }

    billingEventIds.add(billingEventId);
    invoiceLineTotalAmountCents += lineAmountCents;
  }

  if (invoiceLineTotalAmountCents !== expectedAmount) {
    throw new Error(
      "The total of the cohort invoice lines does not match the locked cohort invoice amount."
    );
  }

  if (paymentStatus !== "paid") {
    await base44.asServiceRole.entities.CETrainingCohortInvoice.update(
      cohortInvoice.id,
      {
        invoice_status: "payment_processing",
        stripe_checkout_session_id: checkoutSessionId,
        ...(paymentIntentId
          ? { stripe_payment_intent_id: paymentIntentId }
          : {}),
      }
    );

    return {
      handled: true,
      paid: false,
      payment_status: paymentStatus || "unknown",
      cohort_invoice_id: cohortInvoice.id,
    };
  }

  const billingEventRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        organization_id: cohortInvoice.organization_id,
      }
    );

  const billingEventsById = new Map(
    asArray(billingEventRows).map((billingEvent: any) => [
      billingEvent.id,
      billingEvent,
    ])
  );

  const paidAt = new Date().toISOString();
  const settlements = [];

  for (const invoiceLine of invoiceLines) {
    const billingEventId = normalizeText(
      invoiceLine?.organization_billing_event_id
    );

    const billingEvent = billingEventsById.get(billingEventId);

    if (!billingEvent) {
      throw new Error(
        "A cohort invoice line references a missing CE registration billing event."
      );
    }

    const billingEventMatchesLine =
      normalizeText(billingEvent?.organization_id) ===
        normalizeText(cohortInvoice?.organization_id) &&
      normalizeText(billingEvent?.cohort_id) ===
        normalizeText(cohortInvoice?.cohort_id) &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      ) &&
      billingEvent?.billing_subject_type === "student" &&
      normalizeEmail(billingEvent?.subject_verified_email) ===
        normalizeEmail(invoiceLine?.subject_verified_email) &&
      Number(billingEvent?.amount_cents) ===
        Number(invoiceLine?.amount_cents) &&
      normalizeText(billingEvent?.currency).toLowerCase() ===
        expectedCurrency;

    if (!billingEventMatchesLine) {
      throw new Error(
        "A cohort invoice line does not safely match its student registration billing event."
      );
    }

    const billingEventStatus = normalizeText(
      billingEvent?.event_status
    ).toLowerCase();

    const alreadySettledByThisInvoice =
      billingEventStatus === "paid" &&
      normalizeText(billingEvent?.stripe_checkout_session_id) ===
        checkoutSessionId;

    if (
      !alreadySettledByThisInvoice &&
      !["pending", "ready_for_checkout", "payment_processing"].includes(
        billingEventStatus
      )
    ) {
      throw new Error(
        "A cohort invoice includes a student registration billing event that cannot be settled."
      );
    }

    const settledBillingEvent = {
      ...billingEvent,
      event_status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId,
      ...(paymentIntentId
        ? { stripe_payment_intent_id: paymentIntentId }
        : {}),
    };

    if (!alreadySettledByThisInvoice) {
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        {
          event_status: "paid",
          paid_at: paidAt,
          stripe_checkout_session_id: checkoutSessionId,
          ...(paymentIntentId
            ? { stripe_payment_intent_id: paymentIntentId }
            : {}),
          notes:
            "CE registration settled through a paid CE Training cohort invoice.",
        }
      );
    }

    if (normalizeText(invoiceLine?.line_status) !== "paid") {
      await base44.asServiceRole.entities.CETrainingCohortInvoiceLine.update(
        invoiceLine.id,
        {
          line_status: "paid",
          paid_at: paidAt,
        }
      );
    }

    const enrollmentPaymentSettlement =
      await syncCETrainingStudentEnrollmentSettlement(
        base44,
        settledBillingEvent,
        paidAt
      );

    const studentRegistrationEmail =
      await sendCEStudentSettlementEmail(
        base44,
        settledBillingEvent
      );

    settlements.push({
      billing_event_id: billingEvent.id,
      email: billingEvent.subject_verified_email,
      account_activation: {
        activated: false,
        reason: "activation_deferred_to_applyPendingRoleIfNeeded",
      },
      student_registration_email: studentRegistrationEmail,
      durable_enrollment_payment_settlement:
        enrollmentPaymentSettlement,
    });
  }

  await base44.asServiceRole.entities.CETrainingCohortInvoice.update(
    cohortInvoice.id,
    {
      invoice_status: "paid",
      paid_at: paidAt,
      stripe_checkout_session_id: checkoutSessionId,
      ...(paymentIntentId
        ? { stripe_payment_intent_id: paymentIntentId }
        : {}),
    }
  );

  return {
    handled: true,
    paid: true,
    cohort_invoice_id: cohortInvoice.id,
    settled_student_count: invoiceLines.length,
    settlements,
  };
}

async function handleLegacyOrganizationCheckoutCompleted(
  base44: any,
  session: Stripe.Checkout.Session
) {
  const { org_id, tier } = session.metadata || {};

  if (!org_id) {
    return {
      handled: false,
      reason: "legacy_checkout_without_organization_metadata",
    };
  }

  await base44.asServiceRole.entities.Organization.update(org_id, {
    subscription_status: "active",
    stripe_customer_id: getStripeId(session.customer),
    stripe_subscription_id: getStripeId(session.subscription),
    subscription_tier: tier,
    ...(TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || {}),
  });

  console.log(`Org ${org_id} activated on ${tier}`);

  return {
    handled: true,
    organization_id: org_id,
    tier,
  };
}

Deno.serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    console.error(
      "Webhook signature error:",
      error?.message || error
    );

    return new Response(
      `Webhook Error: ${error?.message || "Invalid signature"}`,
      { status: 400 }
    );
  }

  const base44 = createClientFromRequest(req);

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      if (
        metadata.billing_flow === "ce_training_cohort_invoice"
      ) {
        const result =
          await handleCETrainingCohortInvoiceCheckoutCompleted(
            base44,
            session
          );

        console.log(
          "CE Training cohort invoice checkout handled:",
          JSON.stringify(result)
        );
      } else if (
        metadata.billing_flow === "ce_student_registration"
      ) {
        const result =
          await handleCERegistrationCheckoutCompleted(
            base44,
            session
          );

        console.log(
          "CE registration checkout handled:",
          JSON.stringify(result)
        );
      } else {
        const result =
          await handleLegacyOrganizationCheckoutCompleted(
            base44,
            session
          );

        console.log(
          "Legacy organization checkout handled:",
          JSON.stringify(result)
        );
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;

      if (orgId) {
        await base44.asServiceRole.entities.Organization.update(
          orgId,
          {
            subscription_status: subscription.status,
          }
        );
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;

      if (orgId) {
        await base44.asServiceRole.entities.Organization.update(
          orgId,
          {
            subscription_status: "cancelled",
            is_active: false,
          }
        );

        console.log(`Org ${orgId} subscription cancelled`);
      }
    }

    return Response.json({
      received: true,
      event_type: event.type,
    });
  } catch (error: any) {
    console.error(
      "Webhook handler error:",
      error?.message || error
    );

    return Response.json(
      {
        received: false,
        error:
          error?.message || "Webhook event handling failed.",
      },
      { status: 500 }
    );
  }
});
