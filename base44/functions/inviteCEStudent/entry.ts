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

const PAYMENT_RESPONSIBILITIES = new Set([
  "student_paid",
  "instructor_paid",
]);

const INSTRUCTOR_PAYMENT_MODES = new Set([
  "pay_now",
  "invoice_with_cohort",
]);

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
  return typeof value === "string" ? value.trim() : "";
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function buildCETrainingEnrollmentKey(
  organizationId: string,
  cohortId: string,
  email: string
) {
  return `ce_training_enrollment:${organizationId}:${cohortId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
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

function isPriceItemAvailableNow(item: any, nowMs: number) {
  if (item?.is_active === false) {
    return false;
  }

  const effectiveAtMs = Date.parse(
    normalizeText(item?.effective_at)
  );

  if (
    Number.isFinite(effectiveAtMs) &&
    effectiveAtMs > nowMs
  ) {
    return false;
  }

  const endsAtMs = Date.parse(normalizeText(item?.ends_at));

  if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) {
    return false;
  }

  return true;
}

function getEmailDeliveryConfiguration() {
  const enabled =
    normalizeText(
      Deno.env.get("CE_INVITATION_EMAIL_DELIVERY_ENABLED")
    ).toLowerCase() === "true";

  const senderEmail = normalizeEmail(RESEND_FROM_EMAIL);
  const senderDomain = senderEmail.split("@")[1] || "";

  const senderIsUsable =
    isValidEmail(senderEmail) &&
    !FREE_DOMAINS.has(senderDomain);

  return {
    enabled,
    isReady: enabled && !!RESEND_API_KEY && senderIsUsable,
    senderEmail,
  };
}

function getEmailConfigurationMessage(
  emailConfiguration: ReturnType<
    typeof getEmailDeliveryConfiguration
  >
) {
  if (!emailConfiguration.enabled) {
    return "The CE enrollment was prepared, but invitation email delivery is paused until the organization-owned sender is verified in Resend.";
  }

  return "The CE enrollment was prepared, but invitation email delivery is not fully configured. Add RESEND_API_KEY and a verified business-domain RESEND_FROM_EMAIL before resending the invitation.";
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
      "You are not authorized to invite CE students."
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
    callerEmail,
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

  if (!cohort) {
    throw new RequestError(
      404,
      "The selected Training cohort was not found."
    );
  }

  if (
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !==
      "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    cohort?.is_active === false ||
    cohort?.is_archived === true
  ) {
    throw new RequestError(
      403,
      "The selected Training cohort is unavailable for CE student enrollment."
    );
  }

  return cohort;
}

async function assertCohortInvitationAuthority(
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
      "You must be an active manager of this Training cohort to invite CE students."
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
      base44.asServiceRole.entities.User.filter({
        email,
      })
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

async function getOpenInvitationsForEmail(
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
      base44.asServiceRole.entities.PendingRoleAssignment.filter(
        {
          email,
        }
      )
    )
  );

  const byId = new Map<string, any>();

  for (const resultSet of resultSets) {
    for (const assignment of asArray(resultSet)) {
      const assignmentId = normalizeIdentifier(assignment?.id);

      if (assignmentId) {
        byId.set(assignmentId, assignment);
      }
    }
  }

  return [...byId.values()].filter(
    (assignment) =>
      assignment?.is_archived !== true &&
      normalizeEmail(assignment?.email) === normalizedEmail &&
      OPEN_INVITE_STATUSES.has(
        normalizeText(assignment?.status).toLowerCase()
      )
  );
}

function isMatchingCEStudentInvitation(
  assignment: any,
  organizationId: string,
  cohortId: string,
  paymentResponsibility: string,
  instructorPaymentMode: string
) {
  const assignmentPaymentResponsibility =
    normalizeText(assignment?.payment_responsibility) ||
    "student_paid";

  const assignmentInstructorPaymentMode =
    assignmentPaymentResponsibility === "instructor_paid"
      ? normalizeText(assignment?.instructor_payment_mode)
      : "";

  const assignmentCohortRole = normalizeText(
    assignment?.cohort_role
  ).toLowerCase();

  return (
    normalizeText(assignment?.role).toLowerCase() ===
      "ce_student" &&
    normalizeText(assignment?.access_level).toLowerCase() ===
      "ce_training_portal" &&
    normalizeIdentifier(assignment?.org_id) === organizationId &&
    normalizeIdentifier(assignment?.cohort_id) === cohortId &&
    !normalizeIdentifier(assignment?.client_id) &&
    ["", "member"].includes(assignmentCohortRole) &&
    assignmentPaymentResponsibility === paymentResponsibility &&
    assignmentInstructorPaymentMode === instructorPaymentMode
  );
}

async function getLockedRegistrationPricing(
  base44: any,
  organizationId: string
) {
  const subscriptionRows =
    await base44.asServiceRole.entities.OrganizationPlanSubscription.filter(
      {
        organization_id: organizationId,
      }
    );

  const activeSubscriptions = asArray(subscriptionRows).filter(
    (subscription: any) =>
      subscription?.is_current === true &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(
        normalizeText(subscription?.subscription_status)
      )
  );

  if (activeSubscriptions.length === 0) {
    throw new RequestError(
      409,
      "This organization has no current active pricing subscription for CE student registration."
    );
  }

  if (activeSubscriptions.length > 1) {
    throw new RequestError(
      409,
      "This organization has more than one current pricing subscription and requires billing review before inviting a CE student."
    );
  }

  const subscription = activeSubscriptions[0];
  const pricingScheduleId = normalizeIdentifier(
    subscription?.pricing_schedule_id
  );

  if (!pricingScheduleId) {
    throw new RequestError(
      409,
      "The organization's current pricing subscription is missing its locked pricing schedule."
    );
  }

  const pricingSchedule =
    await base44.asServiceRole.entities.PlatformPricingSchedule.get(
      pricingScheduleId
    ).catch(() => null);

  if (!pricingSchedule) {
    throw new RequestError(
      409,
      "The pricing schedule assigned to this organization could not be resolved."
    );
  }

  if (
    normalizeText(pricingSchedule?.schedule_status).toLowerCase() ===
    "draft"
  ) {
    throw new RequestError(
      409,
      "The organization's assigned pricing schedule is still a draft and cannot be used for CE student registration."
    );
  }

  const [rateRows, scheduleItemRows] = await Promise.all([
    base44.asServiceRole.entities.PlatformBillingRate.filter({
      rate_key: CE_STUDENT_REGISTRATION_RATE_KEY,
    }),
    base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
      {
        pricing_schedule_id: pricingSchedule.id,
      }
    ),
  ]);

  const matchingRates = asArray(rateRows).filter(
    (rate: any) =>
      normalizeText(rate?.rate_key) ===
        CE_STUDENT_REGISTRATION_RATE_KEY &&
      normalizeText(rate?.billing_subject_type) === "student" &&
      normalizeText(rate?.charge_model) === "one_time"
  );

  if (matchingRates.length !== 1) {
    throw new RequestError(
      409,
      "The CE student registration billing rate could not be resolved safely."
    );
  }

  const billingRate = matchingRates[0];
  const nowMs = Date.now();

  const matchingScheduleItems = asArray(
    scheduleItemRows
  ).filter((item: any) => {
    const matchesRateKey =
      normalizeText(item?.billing_rate_key_snapshot) ===
      CE_STUDENT_REGISTRATION_RATE_KEY;

    const matchesRateId =
      normalizeIdentifier(item?.platform_billing_rate_id) ===
      normalizeIdentifier(billingRate?.id);

    return (
      normalizeText(item?.pricing_item_type) === "billing_rate" &&
      normalizeText(item?.charge_model) === "one_time" &&
      (matchesRateKey || matchesRateId) &&
      isPriceItemAvailableNow(item, nowMs)
    );
  });

  if (matchingScheduleItems.length === 0) {
    throw new RequestError(
      409,
      "The organization's locked pricing schedule does not contain an active CE student registration price."
    );
  }

  if (matchingScheduleItems.length > 1) {
    throw new RequestError(
      409,
      "The organization's locked pricing schedule contains duplicate active CE student registration prices and requires review."
    );
  }

  const pricingItem = matchingScheduleItems[0];
  const unitAmountCents = Number(pricingItem?.amount_cents);

  if (
    !Number.isInteger(unitAmountCents) ||
    unitAmountCents < 0
  ) {
    throw new RequestError(
      409,
      "The locked CE student registration price is invalid."
    );
  }

  const currency = normalizeText(
    pricingItem?.currency ||
      pricingSchedule?.currency ||
      billingRate?.currency ||
      "USD"
  ).toUpperCase();

  if (!currency) {
    throw new RequestError(
      409,
      "The locked CE student registration price is missing its currency."
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
  cohortId,
  email,
  subjectUserId,
}: {
  base44: any;
  organizationId: string;
  cohortId: string;
  email: string;
  subjectUserId: string;
}) {
  const billingEventKey = buildRegistrationBillingEventKey(
    organizationId,
    email
  );

  const billingRows =
    await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
      {
        billing_event_key: billingEventKey,
      }
    );

  const matchingEvents = asArray(billingRows).filter(
    (billingEvent: any) =>
      normalizeText(billingEvent?.billing_event_key) ===
      billingEventKey
  );

  if (matchingEvents.length > 1) {
    throw new RequestError(
      409,
      "Multiple CE registration billing records exist for this student email and require review before enrollment can continue."
    );
  }

  if (matchingEvents.length === 1) {
    const billingEvent = matchingEvents[0];

    const isValidExistingEvent =
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeEmail(billingEvent?.subject_verified_email) ===
        email &&
      normalizeText(billingEvent?.fee_kind) ===
        "training_registration" &&
      normalizeText(billingEvent?.billing_subject_type) ===
        "student";

    if (!isValidExistingEvent) {
      throw new RequestError(
        409,
        "The existing CE registration billing record does not safely match this organization, Training cohort, and student email."
      );
    }

    const billedUserId = normalizeIdentifier(
      billingEvent?.subject_user_id
    );

    if (billedUserId && billedUserId !== subjectUserId) {
      throw new RequestError(
        409,
        "The existing CE registration billing record is connected to a different account."
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
    await base44.asServiceRole.entities.OrganizationBillingEvent.create(
      {
        organization_id: organizationId,
        billing_event_key: billingEventKey,
        fee_kind: "training_registration",
        event_status: "pending",
        billing_subject_type: "student",
        ...(subjectUserId
          ? { subject_user_id: subjectUserId }
          : {}),
        subject_verified_email: email,
        cohort_id: cohortId,
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
          "CE student registration billing record created from a tenant-scoped Training cohort invitation.",
      }
    );

  return {
    billingEvent,
    created: true,
  };
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
}: {
  base44: any;
  organizationId: string;
  cohortId: string;
  email: string;
  pendingRoleAssignmentId: string;
  billingEventId: string;
  paymentResponsibility: string;
  instructorPaymentMode: string;
  createdByUserId: string;
  invitedAt: string;
}) {
  const enrollmentKey = buildCETrainingEnrollmentKey(
    organizationId,
    cohortId,
    email
  );

  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        enrollment_key: enrollmentKey,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeText(enrollment?.enrollment_key) === enrollmentKey
  );

  if (enrollments.length > 1) {
    throw new RequestError(
      409,
      "Multiple CE Training enrollment records exist for this student and cohort and require review."
    );
  }

  const now = new Date().toISOString();
  const existingEnrollment = enrollments[0] || null;

  if (existingEnrollment) {
    const enrollmentStatus = normalizeText(
      existingEnrollment?.enrollment_status
    ).toLowerCase();

    if (
      existingEnrollment?.is_active === false ||
      ["withdrawn", "revoked"].includes(enrollmentStatus)
    ) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment is no longer active and cannot be reused for a new invitation."
      );
    }

    const identityMatches =
      normalizeIdentifier(existingEnrollment?.org_id) ===
        organizationId &&
      normalizeIdentifier(existingEnrollment?.cohort_id) ===
        cohortId &&
      normalizeEmail(existingEnrollment?.student_email) === email;

    if (!identityMatches) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment does not safely match this organization, cohort, and student email."
      );
    }

    const existingPendingId = normalizeIdentifier(
      existingEnrollment?.pending_role_assignment_id
    );

    if (
      existingPendingId &&
      existingPendingId !== pendingRoleAssignmentId
    ) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment is linked to a different invitation."
      );
    }

    const existingBillingEventId = normalizeIdentifier(
      existingEnrollment?.organization_billing_event_id
    );

    if (
      existingBillingEventId &&
      existingBillingEventId !== billingEventId
    ) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment is linked to a different billing record."
      );
    }

    const existingPaymentResponsibility = normalizeText(
      existingEnrollment?.payment_responsibility
    );

    if (
      existingPaymentResponsibility &&
      existingPaymentResponsibility !== paymentResponsibility
    ) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment has a different locked payment responsibility."
      );
    }

    const existingInstructorPaymentMode = normalizeText(
      existingEnrollment?.instructor_payment_mode
    );

    if (
      existingInstructorPaymentMode &&
      existingInstructorPaymentMode !== instructorPaymentMode
    ) {
      throw new RequestError(
        409,
        "The existing CE Training enrollment has a different locked instructor payment method."
      );
    }

    const updates: Record<string, unknown> = {};

    if (!existingPendingId) {
      updates.pending_role_assignment_id =
        pendingRoleAssignmentId;
    }

    if (!existingBillingEventId) {
      updates.organization_billing_event_id = billingEventId;
    }

    if (!normalizeIdentifier(existingEnrollment?.created_by_user_id)) {
      updates.created_by_user_id = createdByUserId;
    }

    if (!normalizeText(existingEnrollment?.invited_at)) {
      updates.invited_at = invitedAt || now;
    }

    if (
      !enrollmentStatus ||
      enrollmentStatus === "invited"
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
    };
  }

  const enrollment =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.create(
      {
        org_id: organizationId,
        enrollment_key: enrollmentKey,
        cohort_id: cohortId,
        student_email: email,
        pending_role_assignment_id: pendingRoleAssignmentId,
        organization_billing_event_id: billingEventId,
        payment_responsibility: paymentResponsibility,
        ...(instructorPaymentMode
          ? {
              instructor_payment_mode: instructorPaymentMode,
            }
          : {}),
        enrollment_status: "payment_pending",
        is_active: true,
        invited_at: invitedAt || now,
        created_by_user_id: createdByUserId,
        status_updated_at: now,
        notes:
          "CE Training enrollment created from a tenant-scoped CE student invitation.",
      }
    );

  return {
    enrollment,
    created: true,
  };
}

async function getExistingCheckoutSessionIfUsable(
  billingEvent: any
) {
  if (!stripe) {
    throw new RequestError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  const existingSessionId = normalizeIdentifier(
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
      "[inviteCEStudent] Existing Stripe checkout lookup failed:",
      error instanceof Error ? error.message : error
    );

    return {
      reusable: false,
      expired: true,
      session: null,
    };
  }
}

async function createOrReuseCheckout({
  base44,
  billingEvent,
  organizationId,
  studentEmail,
  checkoutEmail,
  paymentResponsibility,
  instructorPaymentMode,
}: {
  base44: any;
  billingEvent: any;
  organizationId: string;
  studentEmail: string;
  checkoutEmail: string;
  paymentResponsibility: "student_paid" | "instructor_paid";
  instructorPaymentMode: string;
}) {
  if (!stripe) {
    throw new RequestError(
      500,
      "Stripe is not configured for CE registration checkout."
    );
  }

  if (
    !CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
      normalizeText(billingEvent?.event_status)
    )
  ) {
    throw new RequestError(
      409,
      "This CE registration billing record is not available for a new checkout session."
    );
  }

  const amountCents = Number(billingEvent?.amount_cents);
  const currency = normalizeText(
    billingEvent?.currency || "USD"
  ).toLowerCase();

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RequestError(
      409,
      "The locked CE registration amount is invalid for checkout."
    );
  }

  if (!currency) {
    throw new RequestError(
      409,
      "The locked CE registration currency is missing."
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
    throw new RequestError(
      409,
      "Payment is already awaiting confirmation. Do not create another checkout session."
    );
  }

  const { successUrl, cancelUrl } = buildCheckoutRedirectUrls();

  const checkoutAttemptKey = existingCheckout?.expired
    ? `${billingEvent.id}:${paymentResponsibility}:retry:${Date.now()}`
    : `${billingEvent.id}:${paymentResponsibility}:initial`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: checkoutEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: "CE Student Registration",
              description:
                paymentResponsibility === "student_paid"
                  ? "One-time CE Training Portal registration fee."
                  : `One-time CE Training Portal registration fee for ${studentEmail}.`,
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
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode:
          paymentResponsibility === "instructor_paid"
            ? instructorPaymentMode
            : "",
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
          payment_responsibility: paymentResponsibility,
          instructor_payment_mode:
            paymentResponsibility === "instructor_paid"
              ? instructorPaymentMode
              : "",
        },
      },
    },
    {
      idempotencyKey: checkoutAttemptKey,
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
        paymentResponsibility === "student_paid"
          ? "CE registration checkout session created for the invited student."
          : "Instructor-paid CE registration checkout session created.",
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
  paymentResponsibility,
  instructorPaymentMode,
  checkoutUrl,
  amountCents,
  currency,
}: {
  toEmail: string;
  inviterName: string;
  paymentResponsibility: string;
  instructorPaymentMode: string;
  checkoutUrl: string;
  amountCents: unknown;
  currency: unknown;
}) {
  const emailConfiguration = getEmailDeliveryConfiguration();

  if (!emailConfiguration.isReady) {
    throw new RequestError(
      503,
      getEmailConfigurationMessage(emailConfiguration)
    );
  }

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());

  const isStudentPaid =
    paymentResponsibility === "student_paid";

  if (isStudentPaid && !checkoutUrl) {
    throw new RequestError(
      409,
      "The CE registration payment link could not be prepared."
    );
  }

  const paymentAmount = escapeHtml(
    formatMoney(amountCents, currency)
  );

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
    : instructorPaymentMode === "invoice_with_cohort"
      ? `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px;">
          <p style="margin: 0; color: #92400e; line-height: 1.5;">
            Your instructor will include your CE Training registration on a cohort invoice. CE Training access will activate after that invoice is settled.
          </p>
        </div>
      `
      : `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px;">
          <p style="margin: 0; color: #1e40af; line-height: 1.5;">
            Your instructor is handling your CE Training registration payment. CE Training access will activate after payment is confirmed.
          </p>
        </div>
      `;

  const steps = isStudentPaid
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
        <li>Register or sign in using <strong>${safeEmail}</strong> when instructed</li>
        <li>Your CE Training access will appear after settlement and account verification</li>
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
        : "You're invited to CE Training",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">
            You're invited to CE Training!
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has started your CE Training enrollment.
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
            Use <strong>${safeEmail}</strong>. A different email address will not connect to this CE Training invitation or its registration payment.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new RequestError(
      502,
      "The CE Training invitation email could not be delivered. Confirm the verified Resend sender, then resend the invitation."
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
          error: "This CE student invitation request must use POST.",
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
            "Please sign in before creating a CE student invitation.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = normalizeText(body?.email);
    const email = normalizeEmail(rawEmail);
    const cohortId = normalizeIdentifier(body?.cohort_id);
    const requestedPaymentResponsibility = normalizeText(
      body?.payment_responsibility || "student_paid"
    );
    const requestedInstructorPaymentMode = normalizeText(
      body?.instructor_payment_mode
    );

    if (!isValidEmail(email)) {
      return Response.json(
        {
          ok: false,
          error: "A valid student email address is required.",
        },
        { status: 400 }
      );
    }

    if (!cohortId) {
      return Response.json(
        {
          ok: false,
          error:
            "A Training cohort must be selected before inviting a CE student.",
        },
        { status: 400 }
      );
    }

    if (
      !PAYMENT_RESPONSIBILITIES.has(
        requestedPaymentResponsibility
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose whether the student or instructor is responsible for the registration payment.",
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.has(
        requestedInstructorPaymentMode
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose whether the instructor will pay now or include the registration fee on a cohort invoice.",
        },
        { status: 400 }
      );
    }

    if (
      requestedPaymentResponsibility === "student_paid" &&
      requestedInstructorPaymentMode
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "An instructor payment method can only be used when the instructor is responsible for the registration fee.",
        },
        { status: 400 }
      );
    }

    const {
      caller,
      callerId,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    await resolveTrainingCohort(
      base44,
      organizationId,
      cohortId
    );

    await assertCohortInvitationAuthority(
      base44,
      caller,
      callerProfile,
      organizationId,
      cohortId
    );

    const matchingUsers = await getUsersForEmail(
      base44,
      rawEmail,
      email
    );

    if (matchingUsers.length > 1) {
      return Response.json(
        {
          ok: false,
          error:
            "This email is connected to more than one account record and requires administrator review before CE enrollment can continue.",
        },
        { status: 409 }
      );
    }

    const existingUser = matchingUsers[0] || null;

    if (existingUser && !isActiveRecord(existingUser)) {
      return Response.json(
        {
          ok: false,
          error:
            "This email belongs to an inactive account. Review that account before creating a CE student invitation.",
        },
        { status: 409 }
      );
    }

    if (existingUser) {
      const existingProfile = getRoleProfile(existingUser);

      if (
        existingProfile?.role === "ce_student" &&
        normalizeIdentifier(existingUser?.org_id) ===
          organizationId
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "This email is already connected to an active CE student account. Use CE enrollment management instead of creating a new invitation.",
          },
          { status: 409 }
        );
      }

      if (!isNeutralExistingAccount(existingUser)) {
        return Response.json(
          {
            ok: false,
            error:
              "This email is already connected to an account with access or organization details and cannot be repurposed for CE student enrollment.",
          },
          { status: 409 }
        );
      }
    }

    const effectiveInstructorPaymentMode =
      requestedPaymentResponsibility === "instructor_paid"
        ? requestedInstructorPaymentMode
        : "";

    const openInvitations = await getOpenInvitationsForEmail(
      base44,
      rawEmail,
      email
    );

    const matchingInvitations = openInvitations.filter(
      (assignment) =>
        isMatchingCEStudentInvitation(
          assignment,
          organizationId,
          cohortId,
          requestedPaymentResponsibility,
          effectiveInstructorPaymentMode
        )
    );

    if (
      openInvitations.length > 0 &&
      (openInvitations.length !== 1 ||
        matchingInvitations.length !== 1)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This email already has an active invitation that does not match this CE student enrollment. Resolve or revoke that invitation before creating another one.",
        },
        { status: 409 }
      );
    }

    const existingInvite = matchingInvitations[0] || null;

    const billingResult = await ensureRegistrationBillingEvent({
      base44,
      organizationId,
      cohortId,
      email,
      subjectUserId: normalizeIdentifier(existingUser?.id),
    });

    if (existingInvite) {
      const enrollmentResult =
        await ensureCETrainingStudentEnrollment({
          base44,
          organizationId,
          cohortId,
          email,
          pendingRoleAssignmentId: existingInvite.id,
          billingEventId: billingResult.billingEvent.id,
          paymentResponsibility:
            requestedPaymentResponsibility,
          instructorPaymentMode:
            effectiveInstructorPaymentMode,
          createdByUserId:
            normalizeIdentifier(existingInvite?.invited_by_id) ||
            callerId,
          invitedAt:
            normalizeText(existingInvite?.invited_at) ||
            new Date().toISOString(),
        });

      return Response.json({
        ok: true,
        message:
          "A matching CE student invitation already exists. Use the resend or payment workflow rather than creating another invitation.",
        already_invited: true,
        pending_id: existingInvite.id,
        status: existingInvite.status,
        email_sent:
          normalizeText(existingInvite?.status) ===
          "invite_email_sent",
        payment_responsibility:
          requestedPaymentResponsibility,
        instructor_payment_mode:
          effectiveInstructorPaymentMode || null,
        billing_event_id: billingResult.billingEvent.id,
        billing_event_status: billingResult.billingEvent.event_status,
        ce_training_student_enrollment_id:
          enrollmentResult.enrollment?.id || null,
      });
    }

    const invitedAt = new Date().toISOString();

    const pending =
      await base44.asServiceRole.entities.PendingRoleAssignment.create(
        {
          email,
          role: "ce_student",
          access_level: "ce_training_portal",
          org_id: organizationId,
          invited_by_id: callerId,
          invited_by_name: getDisplayName(caller),
          invited_at: invitedAt,
          cohort_id: cohortId,
          cohort_role: "member",
          payment_responsibility:
            requestedPaymentResponsibility,
          ...(effectiveInstructorPaymentMode
            ? {
                instructor_payment_mode:
                  effectiveInstructorPaymentMode,
              }
            : {}),
          status: "pending",
        }
      );

    const pendingId = normalizeIdentifier(pending?.id);

    if (!pendingId) {
      throw new Error(
        "The CE student invitation record was not created correctly."
      );
    }

    const enrollmentResult =
      await ensureCETrainingStudentEnrollment({
        base44,
        organizationId,
        cohortId,
        email,
        pendingRoleAssignmentId: pendingId,
        billingEventId: billingResult.billingEvent.id,
        paymentResponsibility:
          requestedPaymentResponsibility,
        instructorPaymentMode:
          effectiveInstructorPaymentMode,
        createdByUserId: callerId,
        invitedAt,
      });

    let checkoutResult: any = null;
    let emailSent = false;
    let finalStatus = "pending";

    if (
      requestedPaymentResponsibility === "instructor_paid" &&
      effectiveInstructorPaymentMode === "pay_now"
    ) {
      checkoutResult = await createOrReuseCheckout({
        base44,
        billingEvent: billingResult.billingEvent,
        organizationId,
        studentEmail: email,
        checkoutEmail: normalizeEmail(caller?.email),
        paymentResponsibility: "instructor_paid",
        instructorPaymentMode: "pay_now",
      });
    }

    const emailConfiguration = getEmailDeliveryConfiguration();

    if (!emailConfiguration.isReady) {
      return Response.json({
        ok: true,
        message: getEmailConfigurationMessage(
          emailConfiguration
        ),
        pending_id: pendingId,
        email,
        status: finalStatus,
        email_sent: false,
        access_prepared: true,
        payment_responsibility:
          requestedPaymentResponsibility,
        instructor_payment_mode:
          effectiveInstructorPaymentMode || null,
        checkout_created:
          !!checkoutResult &&
          !checkoutResult.reusedExistingCheckout,
        checkout_reused:
          !!checkoutResult?.reusedExistingCheckout,
        checkout_url:
          requestedPaymentResponsibility === "instructor_paid" &&
          effectiveInstructorPaymentMode === "pay_now"
            ? checkoutResult?.checkoutUrl || null
            : null,
        checkout_session_id:
          requestedPaymentResponsibility === "instructor_paid" &&
          effectiveInstructorPaymentMode === "pay_now"
            ? checkoutResult?.checkoutSessionId || null
            : null,
        billing_event_id: billingResult.billingEvent.id,
        billing_event_status:
          checkoutResult
            ? "ready_for_checkout"
            : billingResult.billingEvent.event_status,
        billing_event_created: billingResult.created,
        ce_training_student_enrollment_id:
          enrollmentResult.enrollment?.id || null,
      });
    }

    if (requestedPaymentResponsibility === "student_paid") {
      try {
        checkoutResult = await createOrReuseCheckout({
          base44,
          billingEvent: billingResult.billingEvent,
          organizationId,
          studentEmail: email,
          checkoutEmail: email,
          paymentResponsibility: "student_paid",
          instructorPaymentMode: "",
        });
      } catch (checkoutError) {
        finalStatus = "pending_email_failed";

        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          pendingId,
          {
            status: finalStatus,
          }
        ).catch((statusError: unknown) => {
          console.error(
            "[inviteCEStudent] Could not record checkout preparation failure:",
            statusError instanceof Error
              ? statusError.message
              : statusError
          );
        });

        const status =
          checkoutError instanceof RequestError
            ? checkoutError.status
            : 500;

        return Response.json(
          {
            ok: false,
            invitation_created: true,
            pending_id: pendingId,
            email,
            status: finalStatus,
            error:
              "The CE invitation was created, but the secure payment link could not be prepared. Review the registration billing record before resending the invitation.",
            billing_event_id: billingResult.billingEvent.id,
          },
          { status }
        );
      }
    }

    try {
      await sendInviteEmail({
        toEmail: email,
        inviterName: getDisplayName(caller),
        paymentResponsibility:
          requestedPaymentResponsibility,
        instructorPaymentMode:
          effectiveInstructorPaymentMode,
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

      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingId,
        {
          status: finalStatus,
        }
      );
    } catch (emailError) {
      finalStatus = "pending_email_failed";

      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingId,
        {
          status: finalStatus,
        }
      ).catch((statusError: unknown) => {
        console.error(
          "[inviteCEStudent] Could not record invitation delivery failure:",
          statusError instanceof Error
            ? statusError.message
            : statusError
        );
      });

      console.error(
        "[inviteCEStudent] Invitation email delivery failed:",
        emailError instanceof Error
          ? emailError.message
          : emailError
      );
    }

    return Response.json({
      ok: true,
      message: emailSent
        ? requestedPaymentResponsibility === "student_paid"
          ? "The CE student invitation and secure registration payment link were emailed."
          : "The CE student invitation was emailed."
        : "The CE enrollment was prepared, but the invitation email could not be delivered. Use the resend workflow after confirming email delivery settings.",
      pending_id: pendingId,
      email,
      status: finalStatus,
      email_sent: emailSent,
      access_prepared: true,
      payment_link_emailed:
        emailSent &&
        requestedPaymentResponsibility === "student_paid",
      payment_responsibility:
        requestedPaymentResponsibility,
      instructor_payment_mode:
        effectiveInstructorPaymentMode || null,
      checkout_created:
        !!checkoutResult &&
        !checkoutResult.reusedExistingCheckout,
      checkout_reused:
        !!checkoutResult?.reusedExistingCheckout,
      checkout_url:
        requestedPaymentResponsibility === "instructor_paid" &&
        effectiveInstructorPaymentMode === "pay_now"
          ? checkoutResult?.checkoutUrl || null
          : null,
      checkout_session_id:
        requestedPaymentResponsibility === "instructor_paid" &&
        effectiveInstructorPaymentMode === "pay_now"
          ? checkoutResult?.checkoutSessionId || null
          : null,
      billing_event_id: billingResult.billingEvent.id,
      billing_event_status:
        checkoutResult
          ? "ready_for_checkout"
          : billingResult.billingEvent.event_status,
      billing_event_created: billingResult.created,
      ce_training_student_enrollment_id:
        enrollmentResult.enrollment?.id || null,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[inviteCEStudent] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE student invitation could not be completed. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});
