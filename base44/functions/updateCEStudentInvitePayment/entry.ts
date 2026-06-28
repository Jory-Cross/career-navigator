import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const ALLOWED_CALLER_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const PAYMENT_RESPONSIBILITIES = new Set([
  "student_paid",
  "instructor_paid",
]);

const INSTRUCTOR_PAYMENT_MODES = new Set([
  "pay_now",
  "invoice_with_cohort",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const SETTLED_BILLING_STATUSES = new Set([
  "paid",
  "waived",
]);

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & {
    status?: number;
  };

  error.status = status;

  return error;
}

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

async function getMatchingRegistrationBillingEvent(
  base44: any,
  organizationId: string,
  email: string
) {
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
    throw createHttpError(
      409,
      "Multiple CE registration billing events exist for this invitation. Resolve the billing conflict before changing the payment option."
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
    throw createHttpError(
      409,
      "The CE registration billing event does not safely match this invitation."
    );
  }

  return billingEvent;
}

async function validateInvoiceTrainingCohort(
  base44: any,
  organizationId: string,
  cohortId: string
) {
  if (!cohortId) {
    throw createHttpError(
      409,
      "A Training cohort must be selected before this CE student can be included on a future cohort invoice."
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
    throw createHttpError(
      409,
      "The Training cohort connected to this invitation could not be found."
    );
  }

  if (normalizeText(cohort.org_id) !== organizationId) {
    throw createHttpError(
      403,
      "The Training cohort connected to this invitation belongs to a different organization."
    );
  }

  if (cohort.cohort_type !== "training") {
    throw createHttpError(
      409,
      "Only Training cohorts may be used for CE registration invoice billing."
    );
  }

  if (cohort.is_active === false) {
    throw createHttpError(
      409,
      "The selected Training cohort is inactive and cannot receive new invoice-billed CE registrations."
    );
  }

  return cohort;
}

async function expireOpenCheckoutForPaymentChange(
  billingEvent: any
) {
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
    throw createHttpError(
      503,
      "Stripe is not configured, so the current registration checkout cannot be safely cancelled before changing the payment option."
    );
  }

  let checkoutSession: any;

  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(
      checkoutSessionId
    );
  } catch {
    throw createHttpError(
      409,
      "The current Stripe Checkout session could not be verified. Resolve the payment session before changing this payment option."
    );
  }

  if (
    checkoutSession.status === "complete" ||
    checkoutSession.payment_status === "paid"
  ) {
    throw createHttpError(
      409,
      "This registration payment has completed or is awaiting reconciliation. The payment option cannot be changed."
    );
  }

  if (checkoutSession.status === "open") {
    await stripe.checkout.sessions.expire(checkoutSessionId);

    return {
      checkout_expired: true,
      checkout_state: "expired",
    };
  }

  if (checkoutSession.status === "expired") {
    return {
      checkout_expired: false,
      checkout_state: "already_expired",
    };
  }

  throw createHttpError(
    409,
    "The current Stripe Checkout session is not in a state that can be safely changed."
  );
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

    if (!ALLOWED_CALLER_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users may update student invite payment options.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const pendingInviteId = normalizeText(
      body?.pending_invite_id
    );

    const paymentResponsibility = normalizeText(
      body?.payment_responsibility
    );

    const instructorPaymentMode = normalizeText(
      body?.instructor_payment_mode
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

    if (!PAYMENT_RESPONSIBILITIES.has(paymentResponsibility)) {
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
      paymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.has(instructorPaymentMode)
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

    if (!OPEN_INVITE_STATUSES.has(invite.status)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only pending CE student invitations may have their payment option changed.",
        },
        { status: 409 }
      );
    }

    const inviteEmail = normalizeEmail(invite.email);

    const billingEvent = await getMatchingRegistrationBillingEvent(
      base44,
      organizationId,
      inviteEmail
    );

    const currentPaymentResponsibility =
      normalizeText(invite.payment_responsibility) ||
      "student_paid";

    const currentInstructorPaymentMode =
      currentPaymentResponsibility === "instructor_paid"
        ? normalizeText(invite.instructor_payment_mode) ||
          "pay_now"
        : "";

    const paymentChoiceChanged =
      currentPaymentResponsibility !== paymentResponsibility ||
      currentInstructorPaymentMode !==
        (paymentResponsibility === "instructor_paid"
          ? instructorPaymentMode
          : "");

    if (
      paymentResponsibility === "instructor_paid" &&
      instructorPaymentMode === "invoice_with_cohort"
    ) {
      await validateInvoiceTrainingCohort(
        base44,
        organizationId,
        normalizeText(invite.cohort_id)
      );
    }

    if (
      billingEvent &&
      SETTLED_BILLING_STATUSES.has(
        normalizeText(billingEvent.event_status)
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This payment option cannot be changed because the CE registration payment is already settled.",
          billing_event_status: billingEvent.event_status,
        },
        { status: 409 }
      );
    }

    if (
      billingEvent &&
      normalizeText(billingEvent.event_status) ===
        "payment_processing"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This payment option cannot be changed while CE registration payment processing is underway.",
          billing_event_status: billingEvent.event_status,
        },
        { status: 409 }
      );
    }

    let checkoutResult = {
      checkout_expired: false,
      checkout_state: "not_changed",
    };

    if (billingEvent && paymentChoiceChanged) {
      checkoutResult =
        await expireOpenCheckoutForPaymentChange(billingEvent);
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      invite.id,
      {
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode:
          paymentResponsibility === "instructor_paid"
            ? instructorPaymentMode
            : null,
      }
    );

    if (billingEvent && paymentChoiceChanged) {
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        {
          event_status: "pending",
          notes:
            "CE registration payment option changed before settlement. Any open Stripe Checkout session was expired before the new payment option was saved.",
        }
      );
    }

    return Response.json({
      ok: true,
      message: paymentChoiceChanged
        ? "CE student invite payment option updated."
        : "The CE student invite already uses this payment option.",
      pending_invite_id: invite.id,
      email: invite.email,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        paymentResponsibility === "instructor_paid"
          ? instructorPaymentMode
          : null,
      cohort_id: normalizeText(invite.cohort_id) || null,
      billing_event_id: billingEvent?.id || null,
      billing_event_status: billingEvent
        ? "pending"
        : null,
      checkout_expired: checkoutResult.checkout_expired,
      checkout_state: checkoutResult.checkout_state,
      access_changed: false,
    });
  } catch (error) {
    console.error(
      "updateCEStudentInvitePayment error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to update the CE student invite payment option.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
