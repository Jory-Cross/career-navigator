import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

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

const resendFromDomain =
  RESEND_FROM_EMAIL.split("@")[1]?.toLowerCase() || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL &&
  !FREE_EMAIL_DOMAINS.has(resendFromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

const TIER_LIMITS = {
  starter: { max_employees: 3, max_clients: 25 },
  professional: { max_employees: 10, max_clients: 100 },
  enterprise: { max_employees: 999, max_clients: 9999 },
};

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const OPEN_CE_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
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

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role);
  const accessLevel = normalizeText(user?.access_level);
  const orgId = normalizeText(user?.org_id);
  const managerId = normalizeText(user?.manager_id);
  const linkedClientId = normalizeText(user?.linked_client_id);

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !orgId &&
    !managerId &&
    !linkedClientId
  );
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

async function ensurePaidCeStudentCohortMembership(
  base44: any,
  assignment: any,
  registeredUser: any,
  organizationId: string
) {
  const cohortId = normalizeText(assignment?.cohort_id);

  if (!cohortId) {
    return {
      membership_created: false,
      membership_reactivated: false,
      membership_status: "no_cohort_selected",
      membership_id: null,
    };
  }

  const cohortRows =
    await base44.asServiceRole.entities.CETrainingCohort.filter({
      id: cohortId,
    });

  const cohort = Array.isArray(cohortRows)
    ? cohortRows[0]
    : null;

  if (!cohort) {
    throw new Error(
      "The Training cohort connected to this CE enrollment could not be found."
    );
  }

  if (
    normalizeText(cohort.org_id) !== organizationId ||
    cohort.cohort_type !== "training"
  ) {
    throw new Error(
      "The Training cohort connected to this CE enrollment is not valid for this organization."
    );
  }

  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      cohort_id: cohortId,
      user_id: registeredUser.id,
      cohort_role: "member",
    });

  const memberships = Array.isArray(membershipRows)
    ? membershipRows
    : [];

  const activeMembership = memberships.find(
    (membership) => membership.is_active !== false
  );

  if (activeMembership) {
    return {
      membership_created: false,
      membership_reactivated: false,
      membership_status: "already_active",
      membership_id: activeMembership.id,
    };
  }

  const existingMembership = memberships[0];
  const now = new Date().toISOString();

  if (existingMembership) {
    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      existingMembership.id,
      {
        is_active: true,
        joined_at: existingMembership.joined_at || now,
        added_by: assignment.invited_by_id || undefined,
      }
    );

    return {
      membership_created: false,
      membership_reactivated: true,
      membership_status: "reactivated",
      membership_id: existingMembership.id,
    };
  }

  const createdMembership =
    await base44.asServiceRole.entities.CETrainingCohortMember.create({
      org_id: organizationId,
      cohort_id: cohortId,
      user_id: registeredUser.id,
      cohort_role: "member",
      is_active: true,
      joined_at: now,
      added_by: assignment.invited_by_id || undefined,
    });

  return {
    membership_created: true,
    membership_reactivated: false,
    membership_status: "created",
    membership_id: createdMembership.id,
  };
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
  } catch (trackingError) {
    console.error(
      "[stripeWebhook] Unable to update CE settlement-email tracking:",
      trackingError?.message || trackingError
    );
  }
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

  if (!RESEND_API_KEY) {
    await updateSettlementEmailTracking(base44, billingEventId, {
      registration_settlement_email_last_attempt_at: attemptedAt,
      registration_settlement_email_last_error:
        "RESEND_API_KEY is not configured.",
    });

    return {
      sent: false,
      skipped: false,
      reason: "email_not_configured",
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
        from: `CE Training <${RESEND_FROM}>`,
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
              Your enrollment is already linked to a Training cohort. To
              activate CE Training Portal access, create your account or sign
              in using this exact invited email address:
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
  } catch (emailError) {
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

async function activateExistingPaidCEStudentIfEligible(
  base44: any,
  billingRecord: any
) {
  const subjectUserId = normalizeText(billingRecord?.subject_user_id);
  const organizationId = normalizeText(billingRecord?.organization_id);
  const studentEmail = normalizeEmail(
    billingRecord?.subject_verified_email
  );

  if (!subjectUserId || !organizationId || !studentEmail) {
    return {
      activated: false,
      reason: "no_existing_registered_user_to_activate",
    };
  }

  const userRows = await base44.asServiceRole.entities.User.filter({
    id: subjectUserId,
  });

  const registeredUser = Array.isArray(userRows) ? userRows[0] : null;

  if (!registeredUser) {
    return {
      activated: false,
      reason: "subject_user_not_found",
    };
  }

  if (
    normalizeEmail(registeredUser.email) !== studentEmail ||
    registeredUser.is_active === false
  ) {
    return {
      activated: false,
      reason: "subject_user_is_not_an_eligible_email_match",
    };
  }

  const inviteRows =
    await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      org_id: organizationId,
      role: "ce_student",
    });

  const matchingOpenAssignments = (
    Array.isArray(inviteRows) ? inviteRows : []
  ).filter(
    (assignment) =>
      normalizeEmail(assignment?.email) === studentEmail &&
      OPEN_CE_ASSIGNMENT_STATUSES.has(assignment?.status)
  );

  if (matchingOpenAssignments.length !== 1) {
    return {
      activated: false,
      reason:
        matchingOpenAssignments.length === 0
          ? "no_open_ce_student_assignment_found"
          : "multiple_open_ce_student_assignments_found",
    };
  }

  const assignment = getMostRecentAssignment(
    matchingOpenAssignments
  );

  if (
    registeredUser.role === "ce_student" &&
    normalizeText(registeredUser.org_id) &&
    normalizeText(registeredUser.org_id) !== organizationId
  ) {
    return {
      activated: false,
      reason: "existing_ce_student_belongs_to_different_organization",
    };
  }

  if (
    registeredUser.role !== "ce_student" &&
    !isNeutralExistingAccount(registeredUser)
  ) {
    return {
      activated: false,
      reason: "existing_user_is_not_safe_to_repurpose",
    };
  }

  if (registeredUser.role !== "ce_student") {
    await base44.asServiceRole.entities.User.update(
      registeredUser.id,
      {
        role: "ce_student",
        access_level: "ce_training_portal",
        org_id: organizationId,
        manager_id: assignment.invited_by_id || undefined,
      }
    );
  }

  const cohortMembership =
    await ensurePaidCeStudentCohortMembership(
      base44,
      assignment,
      registeredUser,
      organizationId
    );

  await base44.asServiceRole.entities.PendingRoleAssignment.update(
    assignment.id,
    {
      status: "accepted",
    }
  );

  return {
    activated: true,
    user_id: registeredUser.id,
    pending_assignment_id: assignment.id,
    cohort_membership: cohortMembership,
  };
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

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      id: billingEventId,
    });

  const billingRecord = Array.isArray(billingRows)
    ? billingRows[0]
    : null;

  if (!billingRecord) {
    throw new Error(
      "The CE registration billing event referenced by Stripe could not be found."
    );
  }

  if (
    !CE_REGISTRATION_FEE_KINDS.has(billingRecord.fee_kind) ||
    billingRecord.billing_subject_type !== "student"
  ) {
    throw new Error(
      "The Stripe checkout session does not reference a CE student registration billing event."
    );
  }

  const metadataOrganizationId = normalizeText(
    metadata.organization_id
  );

  if (
    metadataOrganizationId &&
    metadataOrganizationId !==
      normalizeText(billingRecord.organization_id)
  ) {
    throw new Error(
      "Stripe checkout organization metadata does not match the billing event."
    );
  }

  const metadataBillingEventKey = normalizeText(
    metadata.billing_event_key
  );

  if (
    metadataBillingEventKey &&
    metadataBillingEventKey !==
      normalizeText(billingRecord.billing_event_key)
  ) {
    throw new Error(
      "Stripe checkout billing-event metadata does not match the billing event."
    );
  }

  const metadataStudentEmail = normalizeEmail(
    metadata.subject_verified_email
  );

  if (
    metadataStudentEmail &&
    metadataStudentEmail !==
      normalizeEmail(billingRecord.subject_verified_email)
  ) {
    throw new Error(
      "Stripe checkout student-email metadata does not match the billing event."
    );
  }

  const expectedAmount = Number(billingRecord.amount_cents);
  const checkoutAmount = Number(session.amount_total);

  if (
    Number.isFinite(checkoutAmount) &&
    Number.isFinite(expectedAmount) &&
    checkoutAmount !== expectedAmount
  ) {
    throw new Error(
      "Stripe checkout amount does not match the locked billing-event amount."
    );
  }

  const expectedCurrency = normalizeText(
    billingRecord.currency
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
      "Stripe checkout currency does not match the locked billing-event currency."
    );
  }

  const checkoutSessionId = normalizeText(session.id);
  const paymentIntentId = getStripeId(session.payment_intent);
  const paymentStatus = normalizeText(session.payment_status);

  if (billingRecord.event_status === "waived") {
    return {
      handled: true,
      paid: false,
      ignored: true,
      reason: "billing_event_already_waived",
      billing_event_id: billingRecord.id,
    };
  }

  if (billingRecord.event_status === "refunded") {
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

  const studentRegistrationEmail =
    await sendCEStudentSettlementEmail(
      base44,
      settledBillingRecord
    );

  const activation =
    await activateExistingPaidCEStudentIfEligible(
      base44,
      settledBillingRecord
    );

  return {
    handled: true,
    paid: true,
    billing_event_id: billingRecord.id,
    existing_user_activation: activation,
    student_registration_email: studentRegistrationEmail,
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

  if (!cohortInvoiceId) {
    throw new Error(
      "CE Training cohort invoice checkout is missing cohort_invoice_id metadata."
    );
  }

  const invoiceRows =
    await base44.asServiceRole.entities.CETrainingCohortInvoice.filter({
      id: cohortInvoiceId,
    });

  const cohortInvoice = Array.isArray(invoiceRows)
    ? invoiceRows[0]
    : null;

  if (!cohortInvoice) {
    throw new Error(
      "The CE Training cohort invoice referenced by Stripe could not be found."
    );
  }

  const metadataOrganizationId = normalizeText(
    metadata.organization_id
  );

  if (
    metadataOrganizationId &&
    metadataOrganizationId !==
      normalizeText(cohortInvoice.organization_id)
  ) {
    throw new Error(
      "Stripe checkout organization metadata does not match the cohort invoice."
    );
  }

  const metadataCohortId = normalizeText(metadata.cohort_id);

  if (
    metadataCohortId &&
    metadataCohortId !== normalizeText(cohortInvoice.cohort_id)
  ) {
    throw new Error(
      "Stripe checkout cohort metadata does not match the cohort invoice."
    );
  }

  const metadataInvoiceKey = normalizeText(metadata.invoice_key);

  if (
    metadataInvoiceKey &&
    metadataInvoiceKey !== normalizeText(cohortInvoice.invoice_key)
  ) {
    throw new Error(
      "Stripe checkout invoice metadata does not match the cohort invoice."
    );
  }

  const checkoutSessionId = normalizeText(session.id);
  const paymentIntentId = getStripeId(session.payment_intent);
  const paymentStatus = normalizeText(session.payment_status);

  const expectedCheckoutSessionId = normalizeText(
    cohortInvoice.stripe_checkout_session_id
  );

  if (
    expectedCheckoutSessionId &&
    expectedCheckoutSessionId !== checkoutSessionId
  ) {
    throw new Error(
      "Stripe checkout session does not match the cohort invoice checkout session."
    );
  }

  const expectedAmount = Number(cohortInvoice.amount_cents);
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
    cohortInvoice.currency
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

  if (cohortInvoice.invoice_status === "paid") {
    return {
      handled: true,
      paid: true,
      ignored: true,
      reason: "cohort_invoice_already_paid",
      cohort_invoice_id: cohortInvoice.id,
    };
  }

  if (
    ["cancelled", "refunded"].includes(
      normalizeText(cohortInvoice.invoice_status)
    )
  ) {
    return {
      handled: true,
      paid: false,
      ignored: true,
      reason: "cohort_invoice_not_payable",
      cohort_invoice_id: cohortInvoice.id,
    };
  }

  const invoiceLineRows =
    await base44.asServiceRole.entities.CETrainingCohortInvoiceLine.filter({
      cohort_invoice_id: cohortInvoice.id,
    });

  const invoiceLines = Array.isArray(invoiceLineRows)
    ? invoiceLineRows
    : [];

  const expectedStudentCount = Number(cohortInvoice.student_count);

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
      normalizeText(invoiceLine.organization_id) !==
        normalizeText(cohortInvoice.organization_id) ||
      normalizeText(invoiceLine.cohort_id) !==
        normalizeText(cohortInvoice.cohort_id) ||
      normalizeText(invoiceLine.cohort_invoice_id) !==
        normalizeText(cohortInvoice.id)
    ) {
      throw new Error(
        "A cohort invoice line does not safely match its parent cohort invoice."
      );
    }

    if (
      normalizeText(invoiceLine.currency).toLowerCase() !==
      expectedCurrency
    ) {
      throw new Error(
        "A cohort invoice line currency does not match its parent invoice."
      );
    }

    const lineAmountCents = Number(invoiceLine.amount_cents);

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
        normalizeText(invoiceLine.line_status)
      )
    ) {
      throw new Error(
        "A cohort invoice contains a line that is no longer payable."
      );
    }

    const billingEventId = normalizeText(
      invoiceLine.organization_billing_event_id
    );

    if (!billingEventId || billingEventIds.has(billingEventId)) {
      throw new Error(
        "A cohort invoice contains duplicate or missing student billing-event references."
      );
    }

    billingEventIds.add(billingEventId);
    invoiceLineTotalAmountCents += lineAmountCents;
  }

  if (invoiceLineTotalAmountCents !== expectedAmount) {
    throw new Error(
      "The total of the cohort invoice lines does not match the locked cohort invoice amount."
    );
  }

  const billingEventRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      organization_id: cohortInvoice.organization_id,
    });

  const billingEventsById = new Map(
    (Array.isArray(billingEventRows) ? billingEventRows : []).map(
      (billingEvent) => [billingEvent.id, billingEvent]
    )
  );

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

  const paidAt = new Date().toISOString();
  const activations = [];

  for (const invoiceLine of invoiceLines) {
    const billingEventId = normalizeText(
      invoiceLine.organization_billing_event_id
    );

    const billingEvent = billingEventsById.get(billingEventId);

    if (!billingEvent) {
      throw new Error(
        "A cohort invoice line references a missing CE registration billing event."
      );
    }

    const billingEventMatchesLine =
      normalizeText(billingEvent.organization_id) ===
        normalizeText(cohortInvoice.organization_id) &&
      normalizeText(billingEvent.cohort_id) ===
        normalizeText(cohortInvoice.cohort_id) &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent.fee_kind)
      ) &&
      billingEvent.billing_subject_type === "student" &&
      normalizeEmail(billingEvent.subject_verified_email) ===
        normalizeEmail(invoiceLine.subject_verified_email) &&
      Number(billingEvent.amount_cents) ===
        Number(invoiceLine.amount_cents) &&
      normalizeText(billingEvent.currency).toLowerCase() ===
        expectedCurrency;

    if (!billingEventMatchesLine) {
      throw new Error(
        "A cohort invoice line does not safely match its student registration billing event."
      );
    }

    const billingEventStatus = normalizeText(
      billingEvent.event_status
    );

    const alreadySettledByThisInvoice =
      billingEventStatus === "paid" &&
      normalizeText(billingEvent.stripe_checkout_session_id) ===
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

    if (normalizeText(invoiceLine.line_status) !== "paid") {
      await base44.asServiceRole.entities.CETrainingCohortInvoiceLine.update(
        invoiceLine.id,
        {
          line_status: "paid",
          paid_at: paidAt,
        }
      );
    }

    const studentRegistrationEmail =
      await sendCEStudentSettlementEmail(
        base44,
        settledBillingEvent
      );

    const activation =
      await activateExistingPaidCEStudentIfEligible(
        base44,
        settledBillingEvent
      );

    activations.push({
      billing_event_id: billingEvent.id,
      email: billingEvent.subject_verified_email,
      activation,
      student_registration_email: studentRegistrationEmail,
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
    existing_user_activations: activations,
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
  } catch (error) {
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
        metadata.billing_flow === "ce_training_cohort_invoice" ||
        metadata.cohort_invoice_id
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
        metadata.billing_flow === "ce_student_registration" ||
        metadata.billing_event_id
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
  } catch (error) {
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
