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

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const RESENDABLE_CE_ENROLLMENT_STATUSES = new Set([
  "invited",
  "payment_pending",
]);

const CHECKOUT_CREATABLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "failed",
]);

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  client: "client_portal",
  pre_ets: "client_portal",
  dspd: "client_portal",
  pre_ets_employer: "pre_ets_employer_portal",
  ce_instructor: "ce_training_portal",
  ce_student: "ce_training_portal",
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function isNeutralExistingAccount(user: any) {
  const role = normalizeText(user?.role).toLowerCase();

  return (
    ["", "user", "employee"].includes(role) &&
    !normalizeText(user?.access_level) &&
    !normalizeIdentifier(user?.org_id) &&
    !normalizeIdentifier(user?.manager_id) &&
    !normalizeIdentifier(user?.linked_client_id) &&
    !normalizeIdentifier(user?.cohort_id) &&
    !normalizeText(user?.cohort_role)
  );
}

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
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
  const safeCurrency = normalizeText(currency || "USD").toUpperCase();

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${safeCurrency} ${(amount / 100).toFixed(2)}`;
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeText(user?.email) ||
    "Your instructor"
  );
}

function getEmailDeliveryConfiguration() {
  const enabled =
    normalizeText(
      Deno.env.get("CE_INVITATION_EMAIL_DELIVERY_ENABLED")
    ).toLowerCase() === "true";

  const senderEmail = normalizeEmail(RESEND_FROM_EMAIL);
  const senderDomain = senderEmail.split("@")[1] || "";

  return {
    isReady:
      enabled &&
      !!RESEND_API_KEY &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail) &&
      !FREE_DOMAINS.has(senderDomain),
    senderEmail,
  };
}

function getEmailDeliveryConfigurationMessage() {
  return "CE invitation email delivery is unavailable until the organization-owned sender is verified in Resend. No email or new checkout link was sent.";
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

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActiveRecord(caller)) {
    throw new RequestError(
      403,
      "Your account is unavailable or inactive."
    );
  }

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeIdentifier(caller?.org_id);
  const callerProfile = getRoleProfile(caller);

  if (!callerId || !callerEmail) {
    throw new RequestError(
      403,
      "Your account is missing a verified email address."
    );
  }

  if (
    !callerProfile ||
    !["admin", "management", "ce_instructor"].includes(
      callerProfile.role
    )
  ) {
    throw new RequestError(
      403,
      "You are not authorized to resend CE student invitations."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId,
    callerProfile,
    organizationId,
  };
}

async function resolveTrainingCohort(
  base44: any,
  organizationId: string,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    ).catch(() => null);

  if (
    !cohort ||
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !==
      "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      403,
      "The Training cohort connected to this invitation is unavailable."
    );
  }

  return cohort;
}

async function assertCohortAuthority(
  base44: any,
  caller: any,
  callerProfile: { role: string; access_level: string },
  organizationId: string,
  cohortId: string
) {
  if (callerProfile.role === "admin") {
    return;
  }

  const memberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        cohort_id: cohortId,
        user_id: caller.id,
      }
    );

  const hasActiveManagerMembership = asArray(memberships).some(
    (membership: any) =>
      normalizeIdentifier(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        "manager" &&
      membership?.is_active !== false &&
      membership?.is_archived !== true
  );

  if (!hasActiveManagerMembership) {
    throw new RequestError(
      403,
      "You must be an active manager of this Training cohort to resend this invitation."
    );
  }
}

async function getUsersForEmail(
  base44: any,
  rawEmail: string,
  normalizedEmail: string
) {
  const lookupEmails = [
    ...new Set(
      [normalizeText(rawEmail), normalizedEmail].filter(Boolean)
    ),
  ];

  const resultSets = await Promise.all(
    lookupEmails.map((email) =>
      base44.asServiceRole.entities.User.filter({ email })
    )
  );

  const byId = new Map<string, any>();

  for (const resultSet of resultSets) {
    for (const user of asArray(resultSet)) {
      const userId = normalizeIdentifier(user?.id);

      if (userId) {
        byId.set(userId, user);
      }
    }
  }

  return [...byId.values()].filter(
    (user) => normalizeEmail(user?.email) === normalizedEmail
  );
}

function isMatchingOpenInvitation(assignment: any) {
  const paymentResponsibility =
    normalizeText(assignment?.payment_responsibility) ||
    "student_paid";

  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? normalizeText(assignment?.instructor_payment_mode)
      : "";

  return (
    normalizeText(assignment?.role).toLowerCase() ===
      "ce_student" &&
    normalizeText(assignment?.access_level).toLowerCase() ===
      "ce_training_portal" &&
    !!normalizeIdentifier(assignment?.org_id) &&
    !!normalizeIdentifier(assignment?.cohort_id) &&
    !normalizeIdentifier(assignment?.client_id) &&
    ["", "member"].includes(
      normalizeText(assignment?.cohort_role).toLowerCase()
    ) &&
    ["student_paid", "instructor_paid"].includes(
      paymentResponsibility
    ) &&
    (
      paymentResponsibility !== "instructor_paid" ||
      ["pay_now", "invoice_with_cohort"].includes(
        instructorPaymentMode
      )
    ) &&
    OPEN_INVITE_STATUSES.has(
      normalizeText(assignment?.status).toLowerCase()
    )
  );
}

async function resolveEnrollmentAndBilling(
  base44: any,
  assignment: any,
  organizationId: string
) {
  const assignmentId = normalizeIdentifier(assignment?.id);
  const cohortId = normalizeIdentifier(assignment?.cohort_id);
  const studentEmail = normalizeEmail(assignment?.email);
  const paymentResponsibility =
    normalizeText(assignment?.payment_responsibility) ||
    "student_paid";
  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? normalizeText(assignment?.instructor_payment_mode)
      : "";

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        pending_role_assignment_id: assignmentId,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.pending_role_assignment_id) ===
      assignmentId
  );

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      "This invitation does not have exactly one durable CE Training enrollment record."
    );
  }

  const enrollment = enrollments[0];
  const enrollmentStatus = normalizeText(
    enrollment?.enrollment_status
  ).toLowerCase();

  if (
    enrollment?.is_active === false ||
    ["withdrawn", "revoked"].includes(enrollmentStatus)
  ) {
    throw new RequestError(
      409,
      "This CE Training enrollment is no longer active."
    );
  }

  if (!RESENDABLE_CE_ENROLLMENT_STATUSES.has(enrollmentStatus)) {
    throw new RequestError(
      409,
      "This CE Training enrollment is no longer eligible for a payment invitation resend. Use registration instructions or enrollment management instead."
    );
  }

  const enrollmentMatches =
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === studentEmail &&
    normalizeText(enrollment?.payment_responsibility) ===
      paymentResponsibility &&
    normalizeText(enrollment?.instructor_payment_mode) ===
      instructorPaymentMode;

  if (!enrollmentMatches) {
    throw new RequestError(
      409,
      "The CE Training enrollment does not safely match this invitation."
    );
  }

  const billingEventId = normalizeIdentifier(
    enrollment?.organization_billing_event_id
  );

  if (!billingEventId) {
    throw new RequestError(
      409,
      "This CE Training enrollment is missing its registration billing record."
    );
  }

  const billingEvent =
    await base44.asServiceRole.entities.OrganizationBillingEvent.get(
      billingEventId
    ).catch(() => null);

  if (!billingEvent) {
    throw new RequestError(
      409,
      "The registration billing record connected to this enrollment is unavailable."
    );
  }

  const billingMatches =
    normalizeIdentifier(billingEvent?.organization_id) ===
      organizationId &&
    normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
    normalizeEmail(billingEvent?.subject_verified_email) ===
      studentEmail &&
    normalizeText(billingEvent?.billing_subject_type) ===
      "student" &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    );

  if (!billingMatches) {
    throw new RequestError(
      409,
      "The registration billing record does not safely match this invitation."
    );
  }

  return {
    cohortId,
    studentEmail,
    paymentResponsibility,
    instructorPaymentMode,
    enrollment,
    billingEvent,
  };
}

function assertExistingUserIsSafe(
  users: any[],
  organizationId: string
) {
  if (users.length > 1) {
    throw new RequestError(
      409,
      "This invitation email is connected to more than one account record and requires administrator review."
    );
  }

  const existingUser = users[0] || null;

  if (!existingUser) {
    return null;
  }

  if (!isActiveRecord(existingUser)) {
    throw new RequestError(
      409,
      "This invitation email is connected to an inactive account and requires review before the invitation can be resent."
    );
  }

  const existingProfile = getRoleProfile(existingUser);

  if (
    existingProfile?.role === "ce_student" &&
    normalizeIdentifier(existingUser?.org_id) === organizationId
  ) {
    throw new RequestError(
      409,
      "This invitation email is already connected to an active CE student account. Use CE enrollment management instead."
    );
  }

  if (!isNeutralExistingAccount(existingUser)) {
    throw new RequestError(
      409,
      "This invitation email is already connected to an account with access or organization details and cannot be repurposed."
    );
  }

  return existingUser;
}

function assertBillingIsUnsettledAndUsable(billingEvent: any) {
  const eventStatus = normalizeText(
    billingEvent?.event_status
  ).toLowerCase();

  if (["paid", "waived"].includes(eventStatus)) {
    throw new RequestError(
      409,
      "This registration payment is settled. Use Resend Registration Instructions instead."
    );
  }

  if (
    ![
      "pending",
      "ready_for_checkout",
      "payment_processing",
      "failed",
    ].includes(eventStatus)
  ) {
    throw new RequestError(
      409,
      "This registration payment state does not permit an invitation resend."
    );
  }
}

function isCheckoutScopeValid(
  session: Stripe.Checkout.Session,
  billingEvent: any,
  organizationId: string,
  studentEmail: string
) {
  const metadata = session.metadata || {};

  return (
    session.client_reference_id === String(billingEvent.id) &&
    metadata.billing_flow === "ce_student_registration" &&
    metadata.billing_event_id === String(billingEvent.id) &&
    metadata.organization_id === organizationId &&
    normalizeEmail(metadata.subject_verified_email) === studentEmail &&
    metadata.payment_responsibility === "student_paid"
  );
}

async function getExistingCheckoutSession(
  billingEvent: any
) {
  if (!stripe) {
    throw new RequestError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  const sessionId = normalizeIdentifier(
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
    throw new RequestError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  const existingSession = await getExistingCheckoutSession(
    billingEvent
  );

  if (existingSession) {
    if (
      !isCheckoutScopeValid(
        existingSession,
        billingEvent,
        organizationId,
        studentEmail
      )
    ) {
      throw new RequestError(
        409,
        "The existing CE registration checkout session does not safely match this enrollment."
      );
    }

    if (existingSession.status === "open" && existingSession.url) {
      return {
        checkoutUrl: existingSession.url,
        checkoutSessionId: existingSession.id,
        reusedExistingCheckout: true,
      };
    }

    if (
      existingSession.status === "complete" &&
      existingSession.payment_status === "paid"
    ) {
      throw new RequestError(
        409,
        "Payment is already awaiting confirmation. Do not create another checkout session."
      );
    }
  }

  const eventStatus = normalizeText(
    billingEvent?.event_status
  ).toLowerCase();

  if (eventStatus === "payment_processing") {
    throw new RequestError(
      409,
      "Payment is already processing for this registration. Wait for confirmation before trying again."
    );
  }

  if (!CHECKOUT_CREATABLE_EVENT_STATUSES.has(eventStatus)) {
    throw new RequestError(
      409,
      "This registration billing record is not available for a new checkout session."
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RequestError(
      409,
      "The locked CE registration amount is invalid."
    );
  }

  if (!currency) {
    throw new RequestError(
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
          payment_responsibility: "student_paid",
          instructor_payment_mode: "",
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
      "Stripe did not return a secure CE registration checkout link."
    );
  }

  await base44.asServiceRole.entities.OrganizationBillingEvent.update(
    billingEvent.id,
    {
      event_status: "ready_for_checkout",
      stripe_checkout_session_id: session.id,
      notes:
        "CE registration checkout session created during a tenant-scoped invitation resend.",
    }
  );

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    reusedExistingCheckout: false,
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
  const emailConfiguration = getEmailDeliveryConfiguration();

  if (!emailConfiguration.isReady) {
    throw new RequestError(
      503,
      getEmailDeliveryConfigurationMessage()
    );
  }

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());
  const paymentAmount = escapeHtml(
    formatMoney(
      billingEvent?.amount_cents,
      billingEvent?.currency
    )
  );

  const isStudentPaid =
    paymentResponsibility === "student_paid";

  if (isStudentPaid && !checkoutUrl) {
    throw new RequestError(
      409,
      "The secure registration payment link could not be prepared."
    );
  }

  const paymentSection = isStudentPaid
    ? `
      <div style="margin: 24px 0; padding: 20px; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 8px;">
        <div style="font-size: 12px; color: #6d28d9; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
          CE TRAINING REGISTRATION FEE
        </div>
        <div style="font-size: 24px; color: #4c1d95; font-weight: 700; margin-bottom: 10px;">
          ${paymentAmount}
        </div>
        <p style="margin: 0; color: #4c1d95; line-height: 1.5;">
          Complete payment before account registration. CE Training access activates only after payment is confirmed.
        </p>
      </div>

      <a
        href="${escapeHtml(checkoutUrl)}"
        style="display: inline-block; background: #7c3aed; color: white; padding: 13px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 0 18px;"
      >
        Pay Registration Fee →
      </a>
    `
    : instructorPaymentMode === "invoice_with_cohort"
      ? `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px;">
          <p style="margin: 0; color: #92400e; line-height: 1.5;">
            Your instructor will include your CE Training registration on a cohort invoice. Account-registration instructions will be sent after payment is settled.
          </p>
        </div>
      `
      : `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px;">
          <p style="margin: 0; color: #1e40af; line-height: 1.5;">
            Your instructor is handling your CE Training registration payment. Account-registration instructions will be sent after payment is settled.
          </p>
        </div>
      `;

  const nextSteps = isStudentPaid
    ? `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Use the secure payment button above</li>
        <li>Return to Career Navigator after payment succeeds</li>
        <li>Register or sign in using <strong>${safeEmail}</strong></li>
      </ol>
    `
    : `
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Wait for registration payment settlement</li>
        <li>Watch for account-registration instructions</li>
        <li>Use <strong>${safeEmail}</strong> when registering or signing in</li>
      </ol>
    `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CE Training <${emailConfiguration.senderEmail}>`,
      to: [toEmail],
      subject: isStudentPaid
        ? "Complete your CE Training registration"
        : "Your CE Training invitation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">
            CE Training Enrollment
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has resent your CE Training invitation.
          </p>

          ${paymentSection}

          <p style="margin-bottom: 8px;">Next steps:</p>

          ${nextSteps}

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Open Career Navigator →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use <strong>${safeEmail}</strong>. A different email address cannot be connected to this CE Training invitation.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new RequestError(
      502,
      "The CE Training invitation email could not be delivered. Confirm the verified sender, then resend the invitation."
    );
  }

  return response.json();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This CE invitation resend request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error:
            "Please sign in before resending a CE student invitation.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingAssignmentId = normalizeIdentifier(
      body?.pending_assignment_id
    );

    if (!pendingAssignmentId) {
      return Response.json(
        {
          ok: false,
          error: "A CE student invitation must be selected.",
        },
        { status: 400 }
      );
    }

    const {
      caller,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const assignment =
      await base44.asServiceRole.entities.PendingRoleAssignment.get(
        pendingAssignmentId
      ).catch(() => null);

    if (
      !assignment ||
      normalizeIdentifier(assignment?.org_id) !== organizationId ||
      !isMatchingOpenInvitation(assignment)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The selected CE student invitation is unavailable or cannot be resent.",
        },
        { status: 404 }
      );
    }

    const cohortId = normalizeIdentifier(assignment?.cohort_id);

    await resolveTrainingCohort(
      base44,
      organizationId,
      cohortId
    );

    await assertCohortAuthority(
      base44,
      caller,
      callerProfile,
      organizationId,
      cohortId
    );

    const studentEmail = normalizeEmail(assignment?.email);

    const matchingUsers = await getUsersForEmail(
      base44,
      normalizeText(assignment?.email),
      studentEmail
    );

    assertExistingUserIsSafe(matchingUsers, organizationId);

    const {
      paymentResponsibility,
      instructorPaymentMode,
      billingEvent,
    } = await resolveEnrollmentAndBilling(
      base44,
      assignment,
      organizationId
    );

    assertBillingIsUnsettledAndUsable(billingEvent);

    const emailConfiguration = getEmailDeliveryConfiguration();

    if (!emailConfiguration.isReady) {
      return Response.json(
        {
          ok: false,
          error: getEmailDeliveryConfigurationMessage(),
        },
        { status: 503 }
      );
    }

    let checkoutResult: {
      checkoutUrl: string;
      checkoutSessionId: string;
      reusedExistingCheckout: boolean;
    } | null = null;

    if (paymentResponsibility === "student_paid") {
      checkoutResult = await createOrReuseStudentCheckout({
        base44,
        billingEvent,
        organizationId,
        studentEmail,
      });
    }

    try {
      await sendResendEmail({
        toEmail: studentEmail,
        inviterName: getDisplayName(caller),
        paymentResponsibility,
        instructorPaymentMode,
        billingEvent,
        checkoutUrl: checkoutResult?.checkoutUrl || "",
      });
    } catch (emailError) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        assignment.id,
        {
          status: "pending_email_failed",
        }
      ).catch((statusError: unknown) => {
        console.error(
          "[resendCEStudentInvitation] Could not record email failure:",
          statusError instanceof Error
            ? statusError.message
            : statusError
        );
      });

      throw emailError;
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: "invite_email_sent",
      }
    );

    return Response.json({
      ok: true,
      message: "CE Training invitation resent.",
      pending_assignment_id: assignment.id,
      billing_event_id: billingEvent.id,
      billing_event_status:
        checkoutResult
          ? "ready_for_checkout"
          : billingEvent.event_status,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        instructorPaymentMode || null,
      checkout_reused:
        !!checkoutResult?.reusedExistingCheckout,
      payment_link_included: !!checkoutResult?.checkoutUrl,
      access_changed: false,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[resendCEStudentInvitation] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE student invitation could not be resent. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});
