import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const FREE_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const SETTLED_PAYMENT_STATUSES = new Set([
  "paid",
  "waived",
]);

const RESENDABLE_PAYMENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "payment_processing",
  "failed",
]);

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const fromDomain = RESEND_FROM_EMAIL.split("@")[1] || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.has(fromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

function formatMoney(amountCents: unknown, currency: unknown) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${String(currency || "USD").toUpperCase()} ${(
    amount / 100
  ).toFixed(2)}`;
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function buildCheckoutRedirectUrls() {
  const appUrl = getAppUrl();

  return {
    successUrl:
      `${appUrl}/CERegistrationPaymentStatus` +
      "?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: `${appUrl}/?ce_registration=cancelled`,
  };
}

function isActive(record: any) {
  return record?.is_active !== false;
}

async function getOneById(entity: any, id: string) {
  if (!id) {
    return null;
  }

  const rows = await entity.filter({ id });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function resolveOrganizationId(base44: any, caller: any) {
  let organizationId = normalizeText(caller?.org_id);

  if (organizationId) {
    return organizationId;
  }

  const organizations =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller?.email,
    });

  organizationId = normalizeText(organizations?.[0]?.id);

  if (!organizationId) {
    throw new RequestError(
      400,
      "Your account is not connected to an organization."
    );
  }

  return organizationId;
}

async function requireCohortAccess(
  base44: any,
  caller: any,
  organizationId: string,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    );

  if (!cohort) {
    throw new RequestError(404, "Training cohort not found.");
  }

  if (
    normalizeText(cohort.org_id) !== organizationId ||
    normalizeText(cohort.cohort_type) !== "training"
  ) {
    throw new RequestError(
      403,
      "This Training cohort does not belong to your organization."
    );
  }

  if (["admin", "management"].includes(caller.role)) {
    return cohort;
  }

  if (caller.role !== "ce_instructor") {
    throw new RequestError(
      403,
      "Only authorized CE organization users may resend student instructions."
    );
  }

  const managerRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: caller.id,
        cohort_role: "manager",
        is_active: true,
      }
    );

  if (!Array.isArray(managerRows) || managerRows.length === 0) {
    throw new RequestError(
      403,
      "Only active cohort managers may resend student instructions."
    );
  }

  return cohort;
}

function isValidEnrollmentForCohort(
  enrollment: any,
  organizationId: string,
  cohortId: string
) {
  return (
    normalizeText(enrollment?.org_id) === organizationId &&
    normalizeText(enrollment?.cohort_id) === cohortId
  );
}

function isValidMembershipForCohort(
  membership: any,
  cohortId: string
) {
  return (
    normalizeText(membership?.cohort_id) === cohortId &&
    normalizeText(membership?.cohort_role) === "member"
  );
}

function isValidInviteForCohort(
  invitation: any,
  organizationId: string,
  cohortId: string
) {
  return (
    normalizeText(invitation?.org_id) === organizationId &&
    normalizeText(invitation?.cohort_id) === cohortId &&
    normalizeText(invitation?.role) === "ce_student"
  );
}

async function getUsableCheckoutSession(billingEvent: any) {
  if (!stripe) {
    throw new RequestError(
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
    const session = await stripe.checkout.sessions.retrieve(
      sessionId
    );

    if (session.status === "open" && session.url) {
      return {
        reusable: true,
        session,
      };
    }

    if (
      session.status === "complete" &&
      session.payment_status === "paid"
    ) {
      return {
        completed: true,
        session,
      };
    }

    return {
      expired: true,
      session,
    };
  } catch (error) {
    console.error(
      "[resendCETrainingStudentInstructions] Checkout lookup failed:",
      error?.message || error
    );

    return {
      expired: true,
      session: null,
    };
  }
}

async function getOrCreateStudentPaidCheckout({
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
  if (!RESENDABLE_PAYMENT_STATUSES.has(billingEvent?.event_status)) {
    throw new RequestError(
      409,
      "This registration is no longer eligible for a payment-link resend."
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RequestError(
      409,
      "The CE registration billing event has an invalid locked amount."
    );
  }

  if (!currency) {
    throw new RequestError(
      409,
      "The CE registration billing event is missing its locked currency."
    );
  }

  const existingCheckout =
    await getUsableCheckoutSession(billingEvent);

  if (existingCheckout?.reusable) {
    return {
      checkoutUrl: existingCheckout.session.url,
      amountCents,
      currency: currency.toUpperCase(),
    };
  }

  if (existingCheckout?.completed) {
    throw new RequestError(
      409,
      "Stripe has already completed this payment. Refresh the student record shortly."
    );
  }

  const { successUrl, cancelUrl } = buildCheckoutRedirectUrls();

  const session = await stripe!.checkout.sessions.create(
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
    throw new RequestError(
      500,
      "Stripe created the checkout session without a checkout URL."
    );
  }

  await base44.asServiceRole.entities.OrganizationBillingEvent.update(
    billingEvent.id,
    {
      event_status: "ready_for_checkout",
      stripe_checkout_session_id: session.id,
      notes:
        "CE registration checkout session refreshed when registration instructions were resent.",
    }
  );

  return {
    checkoutUrl: session.url,
    amountCents,
    currency: currency.toUpperCase(),
  };
}

async function sendRegistrationInstructionsEmail({
  toEmail,
  inviterName,
  studentEmail,
}: {
  toEmail: string;
  inviterName: string;
  studentEmail: string;
}) {
  if (!RESEND_API_KEY) {
    throw new RequestError(
      500,
      "Email delivery is not configured for CE Training."
    );
  }

  const safeEmail = escapeHtml(studentEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CE Training <${RESEND_FROM}>`,
      to: [toEmail],
      subject: "Complete your CE Training account registration",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">
            Your CE Training registration is ready
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            Your CE Training registration payment has been confirmed.
          </p>

          <p style="margin-bottom: 16px;">
            Create an account or sign in using <strong>${safeEmail}</strong> to activate CE Training access.
          </p>

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Register or Sign In →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Your enrollment was started by <strong>${safeInviterName}</strong>. Use the invited email address above so your account connects to the paid registration.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();

    throw new RequestError(
      502,
      `Email delivery failed: ${details}`
    );
  }
}

async function sendInvitationEmail({
  toEmail,
  inviterName,
  studentEmail,
  paymentResponsibility,
  instructorPaymentMode,
  checkoutUrl,
  amountCents,
  currency,
}: {
  toEmail: string;
  inviterName: string;
  studentEmail: string;
  paymentResponsibility: string;
  instructorPaymentMode: string;
  checkoutUrl: string;
  amountCents: number;
  currency: string;
}) {
  if (!RESEND_API_KEY) {
    throw new RequestError(
      500,
      "Email delivery is not configured for CE Training."
    );
  }

  const safeEmail = escapeHtml(studentEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());

  const isStudentPaid =
    paymentResponsibility === "student_paid";

  if (isStudentPaid && !checkoutUrl) {
    throw new RequestError(
      409,
      "A student-paid invitation cannot be resent without a secure payment link."
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

  const paymentMessage =
    paymentResponsibility === "student_paid"
      ? "Complete payment first, then register or sign in."
      : instructorPaymentMode === "invoice_with_cohort"
        ? "Your instructor will include your registration on a cohort invoice. CE Training access will activate after that invoice is settled."
        : "Your instructor is handling registration payment. CE Training access will activate after payment is confirmed.";

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
        : "Your CE Training invitation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">
            Your CE Training invitation
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has started your CE Training enrollment.
          </p>

          <p style="margin-bottom: 16px;">
            ${escapeHtml(paymentMessage)}
          </p>

          ${paymentSection}

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

    throw new RequestError(
      502,
      `Email delivery failed: ${details}`
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      throw new RequestError(401, "Unauthorized.");
    }

    if (
      !["admin", "management", "ce_instructor"].includes(
        caller.role
      )
    ) {
      throw new RequestError(
        403,
        "Only authorized CE organization users may resend student instructions."
      );
    }

    const body = await req.json().catch(() => ({}));

    const cohortId = normalizeText(body?.cohort_id);
    const enrollmentId = normalizeText(body?.enrollment_id);
    const cohortMemberId = normalizeText(body?.cohort_member_id);
    const pendingRoleAssignmentId = normalizeText(
      body?.pending_role_assignment_id
    );

    if (!cohortId) {
      throw new RequestError(400, "cohort_id is required.");
    }

    const identifierCount = [
      enrollmentId,
      cohortMemberId,
      pendingRoleAssignmentId,
    ].filter(Boolean).length;

    if (identifierCount !== 1) {
      throw new RequestError(
        400,
        "Provide exactly one student identifier: enrollment_id, cohort_member_id, or pending_role_assignment_id."
      );
    }

    const organizationId = await resolveOrganizationId(
      base44,
      caller
    );

    await requireCohortAccess(
      base44,
      caller,
      organizationId,
      cohortId
    );

    let enrollment = null;
    let membership = null;
    let invitation = null;

    if (enrollmentId) {
      enrollment = await getOneById(
        base44.asServiceRole.entities.CETrainingStudentEnrollment,
        enrollmentId
      );

      if (
        !enrollment ||
        !isValidEnrollmentForCohort(
          enrollment,
          organizationId,
          cohortId
        )
      ) {
        throw new RequestError(
          404,
          "CE Training enrollment not found in this cohort."
        );
      }
    }

    if (cohortMemberId) {
      membership = await getOneById(
        base44.asServiceRole.entities.CETrainingCohortMember,
        cohortMemberId
      );

      if (
        !membership ||
        !isValidMembershipForCohort(membership, cohortId)
      ) {
        throw new RequestError(
          404,
          "CE student membership not found in this cohort."
        );
      }
    }

    if (pendingRoleAssignmentId) {
      invitation = await getOneById(
        base44.asServiceRole.entities.PendingRoleAssignment,
        pendingRoleAssignmentId
      );

      if (
        !invitation ||
        !isValidInviteForCohort(
          invitation,
          organizationId,
          cohortId
        )
      ) {
        throw new RequestError(
          404,
          "CE student invitation not found in this cohort."
        );
      }
    }

    if (enrollment && !membership) {
      const enrollmentMembershipId = normalizeText(
        enrollment.cohort_member_id
      );

      if (enrollmentMembershipId) {
        const linkedMembership = await getOneById(
          base44.asServiceRole.entities.CETrainingCohortMember,
          enrollmentMembershipId
        );

        if (
          linkedMembership &&
          isValidMembershipForCohort(
            linkedMembership,
            cohortId
          )
        ) {
          membership = linkedMembership;
        }
      }
    }

    if (enrollment && !invitation) {
      const enrollmentInviteId = normalizeText(
        enrollment.pending_role_assignment_id
      );

      if (enrollmentInviteId) {
        const linkedInvitation = await getOneById(
          base44.asServiceRole.entities.PendingRoleAssignment,
          enrollmentInviteId
        );

        if (
          linkedInvitation &&
          isValidInviteForCohort(
            linkedInvitation,
            organizationId,
            cohortId
          )
        ) {
          invitation = linkedInvitation;
        }
      }
    }

    let studentUser = null;
    let studentUserId = normalizeText(
      enrollment?.user_id || membership?.user_id
    );

    if (studentUserId) {
      studentUser = await getOneById(
        base44.asServiceRole.entities.User,
        studentUserId
      );
    }

    let studentEmail = normalizeEmail(
      enrollment?.student_email ||
        invitation?.email ||
        studentUser?.email
    );

    if (!enrollment && studentEmail) {
      const enrollmentRows =
        await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
          {
            org_id: organizationId,
            cohort_id: cohortId,
          }
        );

      const matchingEnrollments = (
        Array.isArray(enrollmentRows) ? enrollmentRows : []
      ).filter(
        (candidate) =>
          normalizeEmail(candidate?.student_email) === studentEmail
      );

      if (matchingEnrollments.length > 1) {
        throw new RequestError(
          409,
          "Multiple durable CE Training enrollments match this student and cohort."
        );
      }

      if (matchingEnrollments.length === 1) {
        enrollment = matchingEnrollments[0];
      }
    }

    if (!membership && enrollment?.user_id) {
      const membershipRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            cohort_id: cohortId,
            user_id: enrollment.user_id,
            cohort_role: "member",
          }
        );

      membership = (
        Array.isArray(membershipRows) ? membershipRows : []
      ).find((candidate) =>
        isValidMembershipForCohort(candidate, cohortId)
      ) || null;
    }

    if (!invitation && enrollment?.pending_role_assignment_id) {
      const linkedInvitation = await getOneById(
        base44.asServiceRole.entities.PendingRoleAssignment,
        normalizeText(enrollment.pending_role_assignment_id)
      );

      if (
        linkedInvitation &&
        isValidInviteForCohort(
          linkedInvitation,
          organizationId,
          cohortId
        )
      ) {
        invitation = linkedInvitation;
      }
    }

    studentUserId = normalizeText(
      enrollment?.user_id || membership?.user_id
    );

    if (studentUserId && !studentUser) {
      studentUser = await getOneById(
        base44.asServiceRole.entities.User,
        studentUserId
      );
    }

    studentEmail = normalizeEmail(
      enrollment?.student_email ||
        invitation?.email ||
        studentUser?.email
    );

    if (!studentEmail) {
      throw new RequestError(
        409,
        "This CE student record is missing the email required to resend instructions."
      );
    }

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
        {
          organization_id: organizationId,
        }
      );

    const registrationBillingEvents = (
      Array.isArray(billingRows) ? billingRows : []
    ).filter(
      (billingEvent) =>
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind)
        ) &&
        normalizeText(billingEvent?.billing_subject_type) ===
          "student"
    );

    const linkedBillingEventId = normalizeText(
      enrollment?.organization_billing_event_id
    );

    let billingEvent = null;

    if (linkedBillingEventId) {
      billingEvent = registrationBillingEvents.find(
        (candidate) =>
          normalizeText(candidate?.id) === linkedBillingEventId
      ) || null;

      const validLinkedBillingEvent =
        billingEvent &&
        normalizeText(billingEvent?.cohort_id) === cohortId &&
        normalizeEmail(
          billingEvent?.subject_verified_email
        ) === studentEmail;

      if (!validLinkedBillingEvent) {
        throw new RequestError(
          409,
          "The linked CE registration billing event could not be safely verified."
        );
      }
    } else {
      const matchingBillingEvents = registrationBillingEvents.filter(
        (candidate) =>
          normalizeText(candidate?.cohort_id) === cohortId &&
          normalizeEmail(
            candidate?.subject_verified_email
          ) === studentEmail
      );

      if (matchingBillingEvents.length > 1) {
        throw new RequestError(
          409,
          "More than one CE registration billing event matches this student and cohort."
        );
      }

      billingEvent = matchingBillingEvents[0] || null;
    }

    if (!billingEvent) {
      throw new RequestError(
        409,
        "No CE registration billing event was found for this student and cohort."
      );
    }

    const paymentStatus = normalizeText(
      billingEvent.event_status
    );

    const accountIsRegistered = Boolean(
      studentUser &&
        studentUser.is_active !== false &&
        normalizeText(studentUser.role) === "ce_student"
    );

    const isPaymentSettled =
      SETTLED_PAYMENT_STATUSES.has(paymentStatus);

    const canResendRegistrationInstructions =
      isPaymentSettled && !accountIsRegistered;

    const paymentResponsibility = normalizeText(
      enrollment?.payment_responsibility ||
        invitation?.payment_responsibility
    );

    const instructorPaymentMode = normalizeText(
      enrollment?.instructor_payment_mode ||
        invitation?.instructor_payment_mode
    );

    const canResendInvitation =
      !isPaymentSettled &&
      RESENDABLE_PAYMENT_STATUSES.has(paymentStatus) &&
      Boolean(paymentResponsibility) &&
      (!invitation ||
        OPEN_INVITE_STATUSES.has(
          normalizeText(invitation.status)
        ));

    if (
      !canResendRegistrationInstructions &&
      !canResendInvitation
    ) {
      throw new RequestError(
        409,
        "This student is not currently awaiting registration instructions or an invitation resend."
      );
    }

    const inviterName =
      normalizeText(invitation?.invited_by_name) ||
      "Your CE Training instructor";

    let instructionType = "";
    let checkoutUrl = "";

    if (canResendRegistrationInstructions) {
      instructionType = "registration_instructions";

      await sendRegistrationInstructionsEmail({
        toEmail: studentEmail,
        inviterName,
        studentEmail,
      });
    } else {
      instructionType = "invitation";

      let checkoutDetails = null;

      if (paymentResponsibility === "student_paid") {
        checkoutDetails = await getOrCreateStudentPaidCheckout({
          base44,
          billingEvent,
          organizationId,
          studentEmail,
        });

        checkoutUrl = checkoutDetails.checkoutUrl;
      }

      await sendInvitationEmail({
        toEmail: studentEmail,
        inviterName,
        studentEmail,
        paymentResponsibility,
        instructorPaymentMode,
        checkoutUrl,
        amountCents:
          checkoutDetails?.amountCents ||
          Number(billingEvent.amount_cents),
        currency:
          checkoutDetails?.currency ||
          normalizeText(billingEvent.currency || "USD"),
      });
    }

    if (invitation) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        invitation.id,
        {
          status: "invite_email_sent",
        }
      );
    }

    return Response.json({
      ok: true,
      instruction_type: instructionType,
      message:
        instructionType === "registration_instructions"
          ? "Registration instructions were resent to the student."
          : "CE Training invitation instructions were resent to the student.",
    });
  } catch (error) {
    const status =
      error instanceof RequestError ? error.status : 500;

    console.error(
      "[resendCETrainingStudentInstructions] Error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to resend CE Training student instructions.",
      },
      { status }
    );
  }
});
