import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const ALLOWED_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const REVOCABLE_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

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

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

async function resolveOrganizationId(base44: any, caller: any) {
  const directOrgId = normalizeText(caller?.org_id);

  if (directOrgId) {
    return directOrgId;
  }

  const organizations =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller.email,
    });

  return normalizeText(organizations?.[0]?.id);
}

async function getMatchingRegistrationBillingEvent({
  base44,
  organizationId,
  email,
}: {
  base44: any;
  organizationId: string;
  email: string;
}) {
  const billingEventKey = buildRegistrationBillingEventKey(
    organizationId,
    email
  );

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      billing_event_key: billingEventKey,
    });

  const billingEvents = Array.isArray(billingRows)
    ? billingRows
    : [];

  if (billingEvents.length === 0) {
    return null;
  }

  if (billingEvents.length > 1) {
    throw new Error(
      "Multiple CE registration billing events exist for this invitation. Resolve the billing conflict before revoking the invitation."
    );
  }

  const billingEvent = billingEvents[0];

  const identityMatches =
    normalizeText(billingEvent.organization_id) === organizationId &&
    normalizeEmail(billingEvent.subject_verified_email) ===
      normalizeEmail(email) &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent.fee_kind)
    ) &&
    billingEvent.billing_subject_type === "student";

  if (!identityMatches) {
    throw new Error(
      "The CE registration billing event does not safely match this invitation. Resolve the billing record before revoking the invitation."
    );
  }

  return billingEvent;
}

async function expireOpenCheckoutIfNeeded(billingEvent: any) {
  const checkoutSessionId = normalizeText(
    billingEvent?.stripe_checkout_session_id
  );

  if (!checkoutSessionId) {
    return {
      checkout_expired: false,
      checkout_state: "no_checkout_session",
    };
  }

  if (!stripe) {
    throw new Error(
      "Stripe is not configured, so this invitation cannot be safely revoked while a checkout session may still be active."
    );
  }

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(
      checkoutSessionId
    );
  } catch {
    return {
      checkout_expired: false,
      checkout_state: "checkout_session_not_found",
    };
  }

  if (session.status !== "open") {
    return {
      checkout_expired: false,
      checkout_state: session.status || "not_open",
    };
  }

  await stripe.checkout.sessions.expire(checkoutSessionId);

  return {
    checkout_expired: true,
    checkout_state: "expired",
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ALLOWED_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users may revoke student invitations.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingInviteId = normalizeText(
      body?.pending_invite_id
    );

    if (!pendingInviteId) {
      return Response.json(
        {
          ok: false,
          error: "pending_invite_id is required.",
        },
        { status: 400 }
      );
    }

    const organizationId = await resolveOrganizationId(
      base44,
      caller
    );

    if (!organizationId) {
      return Response.json(
        {
          ok: false,
          error: "Your account is not connected to an organization.",
        },
        { status: 400 }
      );
    }

    const inviteRows =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        id: pendingInviteId,
      });

    const invite = Array.isArray(inviteRows)
      ? inviteRows[0]
      : null;

    if (!invite) {
      return Response.json(
        {
          ok: false,
          error: "CE student invitation not found.",
        },
        { status: 404 }
      );
    }

    if (
      invite.role !== "ce_student" ||
      normalizeText(invite.org_id) !== organizationId
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student invitation does not belong to your organization.",
        },
        { status: 403 }
      );
    }

    if (!REVOCABLE_INVITE_STATUSES.has(invite.status)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only pending CE student invitations may be revoked.",
        },
        { status: 409 }
      );
    }

    const invitedEmail = normalizeEmail(invite.email);

    if (!invitedEmail) {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student invitation is missing its invited email address.",
        },
        { status: 409 }
      );
    }

    const billingEvent = await getMatchingRegistrationBillingEvent({
      base44,
      organizationId,
      email: invitedEmail,
    });

    if (
      billingEvent &&
      ["paid", "waived"].includes(
        normalizeText(billingEvent.event_status)
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This invitation cannot be revoked because its CE registration payment is settled. Use Resend Registration Instructions so the student can register with the same invited email.",
          billing_event_status: billingEvent.event_status,
        },
        { status: 409 }
      );
    }

    const checkoutResult = billingEvent
      ? await expireOpenCheckoutIfNeeded(billingEvent)
      : {
          checkout_expired: false,
          checkout_state: "no_billing_event",
        };

    if (billingEvent) {
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        {
          event_status: "failed",
          notes:
            "CE student invitation revoked before payment. Any open Stripe Checkout session was expired.",
        }
      );
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      invite.id,
      {
        status: "revoked",
      }
    );

    return Response.json({
      ok: true,
      message: "CE student invitation revoked.",
      pending_invite_id: invite.id,
      email: invite.email,
      status: "revoked",
      billing_event_status: billingEvent ? "failed" : null,
      checkout_expired: checkoutResult.checkout_expired,
      checkout_state: checkoutResult.checkout_state,
    });
  } catch (error) {
    console.error(
      "revokeCEStudentInvite error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to revoke the CE student invitation.",
      },
      { status: 500 }
    );
  }
});
