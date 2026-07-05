import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";
const SAFE_APP_URL_FALLBACK = "https://app.base44.com";

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

const SETTLED_EVENT_STATUSES = new Set([
  "paid",
  "waived",
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

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${normalizeText(currency || "USD").toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

function getAppUrl() {
  const configuredUrl = normalizeText(APP_URL);

  try {
    const parsed = new URL(configuredUrl);

    if (
      parsed.protocol === "https:" &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
    ) {
      return parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    // Use the safe fallback below when APP_URL is malformed.
  }

  return SAFE_APP_URL_FALLBACK;
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

function appendAuditNote(existingNote: unknown, addition: string) {
  const existing = normalizeText(existingNote);

  return existing
    ? `${existing}\n\n${addition}`
    : addition;
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
      isValidEmail(senderEmail) &&
      !FREE_DOMAINS.has(senderDomain),
    senderEmail,
  };
}

function getEmailDeliveryConfigurationMessage() {
  return "CE registration email delivery is unavailable until the organization-owned sender is verified in Resend.";
}

function canInviteCeStudent(
  inviterProfile: { role: string; access_level: string } | null
) {
  return [
    "admin",
    "management",
    "ce_instructor",
  ].includes(inviterProfile?.role || "");
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
      "You are not authorized to resend CE registration instructions."
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

async function resolveSettledCEStudentInvitation(
  base44: any,
  pendingAssignmentId: string,
  organizationId: string
) {
  const assignment =
    await base44.asServiceRole.entities.PendingRoleAssignment.get(
      pendingAssignmentId
    ).catch(() => null);

  if (!assignment) {
    throw new RequestError(
      404,
      "The selected CE student invitation was not found."
    );
  }

  const role = normalizeText(assignment?.role).toLowerCase();
  const accessLevel = normalizeText(
    assignment?.access_level
  ).toLowerCase();
  const status = normalizeText(assignment?.status).toLowerCase();
  const cohortId = normalizeIdentifier(assignment?.cohort_id);
  const email = normalizeEmail(assignment?.email);
  const cohortRole = normalizeText(
    assignment?.cohort_role
  ).toLowerCase();

  if (
    assignment?.is_archived === true ||
    normalizeIdentifier(assignment?.org_id) !== organizationId ||
    role !== "ce_student" ||
    accessLevel !== "ce_training_portal" ||
    !cohortId ||
    !isValidEmail(email) ||
    normalizeIdentifier(assignment?.client_id) ||
    !["", "member"].includes(cohortRole)
  ) {
    throw new RequestError(
      404,
      "The selected CE student invitation is unavailable."
    );
  }

  if (!OPEN_INVITE_STATUSES.has(status)) {
    throw new RequestError(
      409,
      "Registration instructions are available only for an active, unregistered CE student invitation."
    );
  }

  const inviterId = normalizeIdentifier(
    assignment?.invited_by_id
  );

  if (!inviterId) {
    throw new RequestError(
      409,
      "The CE student invitation is missing its authorized inviter."
    );
  }

  const inviter =
    await base44.asServiceRole.entities.User.get(
      inviterId
    ).catch(() => null);

  if (
    !inviter ||
    !isActiveRecord(inviter) ||
    normalizeIdentifier(inviter?.org_id) !== organizationId ||
    !canInviteCeStudent(getRoleProfile(inviter))
  ) {
    throw new RequestError(
      409,
      "The CE student invitation does not have a valid active organization inviter."
    );
  }

  return {
    assignment,
    cohortId,
    email,
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
      "You must be an active manager of this Training cohort to resend these registration instructions."
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

function assertInvitedEmailAccountIsSafe(
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
      "This invitation email is connected to an inactive account and requires review before instructions can be resent."
    );
  }

  const profile = getRoleProfile(existingUser);

  if (
    profile?.role === "ce_student" &&
    normalizeIdentifier(existingUser?.org_id) === organizationId
  ) {
    throw new RequestError(
      409,
      "This CE student is already registered. Registration instructions do not need to be resent."
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

async function resolveEnrollmentAndBilling(
  base44: any,
  assignment: any,
  organizationId: string,
  cohortId: string,
  email: string,
  existingUser: any
) {
  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        pending_role_assignment_id: assignment.id,
      }
    );

  const enrollments = asArray(enrollmentRows).filter(
    (enrollment: any) =>
      normalizeIdentifier(enrollment?.pending_role_assignment_id) ===
      normalizeIdentifier(assignment?.id)
  );

  if (enrollments.length !== 1) {
    throw new RequestError(
      409,
      "This CE student invitation does not have exactly one durable enrollment record."
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

  if (enrollmentStatus !== "payment_settled_registration_pending") {
    throw new RequestError(
      409,
      "Registration instructions can be resent only after payment settlement is fully recorded for this CE Training enrollment."
    );
  }

  const paymentResponsibility =
    normalizeText(assignment?.payment_responsibility) ||
    "student_paid";

  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? normalizeText(assignment?.instructor_payment_mode)
      : "";

  const enrollmentInstructorPaymentMode =
    normalizeText(enrollment?.payment_responsibility) ===
      "instructor_paid"
      ? normalizeText(enrollment?.instructor_payment_mode)
      : "";

  const enrollmentMatches =
    normalizeIdentifier(enrollment?.org_id) === organizationId &&
    normalizeIdentifier(enrollment?.cohort_id) === cohortId &&
    normalizeEmail(enrollment?.student_email) === email &&
    normalizeText(enrollment?.payment_responsibility) ===
      paymentResponsibility &&
    enrollmentInstructorPaymentMode === instructorPaymentMode;

  if (!enrollmentMatches) {
    throw new RequestError(
      409,
      "The CE Training enrollment does not safely match this invitation."
    );
  }

  const enrollmentUserId = normalizeIdentifier(enrollment?.user_id);

  if (
    enrollmentUserId &&
    (!existingUser ||
      enrollmentUserId !== normalizeIdentifier(existingUser?.id))
  ) {
    throw new RequestError(
      409,
      "This CE Training enrollment is already connected to a different account."
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
    normalizeEmail(billingEvent?.subject_verified_email) === email &&
    normalizeText(billingEvent?.billing_subject_type) ===
      "student" &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent?.fee_kind)
    );

  if (!billingMatches) {
    throw new RequestError(
      409,
      "The registration billing record does not safely match this CE student invitation."
    );
  }

  const billedUserId = normalizeIdentifier(
    billingEvent?.subject_user_id
  );

  if (
    billedUserId &&
    (!existingUser ||
      billedUserId !== normalizeIdentifier(existingUser?.id))
  ) {
    throw new RequestError(
      409,
      "The registration billing record is already connected to a different account."
    );
  }

  if (
    !SETTLED_EVENT_STATUSES.has(
      normalizeText(billingEvent?.event_status).toLowerCase()
    )
  ) {
    throw new RequestError(
      409,
      "Registration instructions can be resent only after the CE registration payment is settled."
    );
  }

  return {
    enrollment,
    billingEvent,
  };
}

async function sendRegistrationInstructionsEmail({
  toEmail,
  inviterName,
  billingEvent,
}: {
  toEmail: string;
  inviterName: string;
  billingEvent: any;
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
  const eventStatus = normalizeText(
    billingEvent?.event_status
  ).toLowerCase();

  const paymentSection =
    eventStatus === "waived"
      ? `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 8px;">
          <div style="font-size: 12px; color: #166534; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
            REGISTRATION CONFIRMED
          </div>
          <p style="margin: 0; color: #166534; line-height: 1.5;">
            Your CE Training registration requirement has been waived. You may now register or sign in using the invited email address below.
          </p>
        </div>
      `
      : `
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 8px;">
          <div style="font-size: 12px; color: #166534; font-weight: 700; letter-spacing: .04em; margin-bottom: 6px;">
            REGISTRATION PAYMENT CONFIRMED
          </div>
          <div style="font-size: 24px; color: #14532d; font-weight: 700; margin-bottom: 10px;">
            ${escapeHtml(
              formatMoney(
                billingEvent?.amount_cents,
                billingEvent?.currency
              )
            )}
          </div>
          <p style="margin: 0; color: #166534; line-height: 1.5;">
            Your CE Training registration payment has been received. You may now register or sign in using the invited email address below.
          </p>
        </div>
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
      subject: "Complete your CE Training registration",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">
            CE Training Registration
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has resent your CE Training registration instructions.
          </p>

          ${paymentSection}

          <p style="margin-bottom: 8px;">Next steps:</p>

          <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
            <li>Open Career Navigator below</li>
            <li>New to Career Navigator? Choose <strong>Sign up</strong> using <strong>${safeEmail}</strong></li>
            <li>Already have an account? Choose <strong>Sign in</strong> using <strong>${safeEmail}</strong></li>
            <li>Your CE Training Portal access will appear once your account is recognized</li>
          </ol>

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Open Career Navigator →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use <strong>${safeEmail}</strong>. A different email address cannot be connected to this CE Training registration.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new RequestError(
      502,
      "The CE Training registration instructions could not be delivered. Confirm the verified sender, then resend the instructions."
    );
  }

  const responseData = await response.json().catch(() => null);

  return {
    providerMessageId: normalizeText(responseData?.id),
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE registration-instructions request must use POST.",
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
            "Please sign in before resending CE registration instructions.",
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

    const {
      assignment,
      cohortId,
      email,
    } = await resolveSettledCEStudentInvitation(
      base44,
      pendingAssignmentId,
      organizationId
    );

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

    const matchingUsers = await getUsersForEmail(
      base44,
      normalizeText(assignment?.email),
      email
    );

    const existingUser = assertInvitedEmailAccountIsSafe(
      matchingUsers,
      organizationId
    );

    const {
      billingEvent,
    } = await resolveEnrollmentAndBilling(
      base44,
      assignment,
      organizationId,
      cohortId,
      email,
      existingUser
    );

    const attemptedAt = new Date().toISOString();

    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        registration_settlement_email_last_attempt_at:
          attemptedAt,
        registration_settlement_email_last_error: "",
      }
    );

    let emailResult: {
      providerMessageId: string;
    };

    try {
      emailResult = await sendRegistrationInstructionsEmail({
        toEmail: email,
        inviterName: getDisplayName(caller),
        billingEvent,
      });
    } catch (emailError) {
      const errorMessage =
        emailError instanceof Error
          ? emailError.message
          : "The CE registration instructions could not be delivered.";

      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        billingEvent.id,
        {
          registration_settlement_email_last_attempt_at:
            attemptedAt,
          registration_settlement_email_last_error:
            errorMessage,
          notes: appendAuditNote(
            billingEvent?.notes,
            `CE registration-instructions delivery failed on ${attemptedAt}.`
          ),
        }
      ).catch((recordingError: unknown) => {
        console.error(
          "[resendCEStudentRegistrationInstructions] Could not record delivery failure:",
          recordingError instanceof Error
            ? recordingError.message
            : recordingError
        );
      });

      throw emailError;
    }

    const sentAt = new Date().toISOString();

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: "invite_email_sent",
      }
    );

    await base44.asServiceRole.entities.OrganizationBillingEvent.update(
      billingEvent.id,
      {
        registration_settlement_email_sent_at: sentAt,
        registration_settlement_email_provider_id:
          emailResult.providerMessageId || null,
        registration_settlement_email_last_attempt_at:
          attemptedAt,
        registration_settlement_email_last_error: "",
        notes: appendAuditNote(
          billingEvent?.notes,
          `CE registration instructions sent on ${sentAt}.`
        ),
      }
    );

    return Response.json({
      ok: true,
      message: "CE registration instructions resent.",
      pending_assignment_id: assignment.id,
      billing_event_id: billingEvent.id,
      billing_event_status: billingEvent.event_status,
      payment_link_included: false,
      access_changed: false,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[resendCEStudentRegistrationInstructions] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE registration instructions could not be resent. Please try again or contact your organization administrator.",
      },
      { status }
    );
  }
});