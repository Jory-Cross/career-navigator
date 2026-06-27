import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

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

  const activation =
    await activateExistingPaidCEStudentIfEligible(
      base44,
      billingRecord
    );

  return {
    handled: true,
    paid: true,
    billing_event_id: billingRecord.id,
    existing_user_activation: activation,
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
