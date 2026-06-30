import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
];
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

const fromDomain = RESEND_FROM_EMAIL.split("@")[1] || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
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

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function getAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function formatMoney(amountCents: unknown, currency: unknown) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return `${normalizeText(currency || "USD").toUpperCase()} ${(amount / 100).toFixed(2)}`;
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
  const configuredSender = normalizeEmail(RESEND_FROM_EMAIL);
  const senderDomain =
    configuredSender.split("@")[1] || "";

  const senderIsUsable =
    !!RESEND_API_KEY &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSender) &&
    !FREE_DOMAINS.includes(senderDomain);

  if (!senderIsUsable) {
    throw createHttpError(
      503,
      "CE registration email is not configured. Add RESEND_API_KEY and a valid RESEND_FROM_EMAIL on your verified business domain before resending registration instructions."
    );
  }
  const eventStatus = normalizeText(billingEvent.event_status);
  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeAppUrl = escapeHtml(getAppUrl());

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
                billingEvent.amount_cents,
                billingEvent.currency
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
      from: `CE Training <${RESEND_FROM}>`,
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
            <li>New to Career Navigator? Choose <strong>Sign up</strong> on the next screen using <strong>${safeEmail}</strong></li>
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
    const details = await response.text();

    throw createHttpError(
      502,
      `Registration-instructions email delivery failed: ${details}`
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      throw createHttpError(401, "Unauthorized.");
    }

    if (user.role !== "ce_instructor") {
      throw createHttpError(
        403,
        "Only CE instructors can resend CE registration instructions."
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingAssignmentId = normalizeText(
      body?.pending_assignment_id
    );

    if (!pendingAssignmentId) {
      throw createHttpError(
        400,
        "A CE student invitation is required."
      );
    }

    const organizationId = normalizeText(user.org_id);

    if (!organizationId) {
      throw createHttpError(
        400,
        "Your instructor account is missing organization access."
      );
    }

    const assignmentRows =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        id: pendingAssignmentId,
      });

    const assignment = Array.isArray(assignmentRows)
      ? assignmentRows[0]
      : null;

    if (!assignment) {
      throw createHttpError(
        404,
        "The CE student invitation could not be found."
      );
    }

    if (
      assignment.role !== "ce_student" ||
      normalizeText(assignment.org_id) !== organizationId
    ) {
      throw createHttpError(
        403,
        "You are not authorized to resend instructions for this CE student."
      );
    }

    if (!OPEN_INVITE_STATUSES.has(normalizeText(assignment.status))) {
      throw createHttpError(
        409,
        "Registration instructions are available only for an active, unregistered CE student invitation."
      );
    }

    const studentEmail = normalizeEmail(assignment.email);

    if (!studentEmail) {
      throw createHttpError(
        409,
        "This CE student invitation is missing its invited email address."
      );
    }

    const existingUserRows =
      await base44.asServiceRole.entities.User.filter({
        email: studentEmail,
      });

    const alreadyRegistered = (
      Array.isArray(existingUserRows) ? existingUserRows : []
    ).some(
      (candidate) =>
        candidate.is_active !== false &&
        candidate.role === "ce_student" &&
        normalizeText(candidate.org_id) === organizationId &&
        normalizeEmail(candidate.email) === studentEmail
    );

    if (alreadyRegistered) {
      throw createHttpError(
        409,
        "This CE student is already registered. Registration instructions do not need to be resent."
      );
    }

    const billingEventKey = buildRegistrationBillingEventKey(
      organizationId,
      studentEmail
    );

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        billing_event_key: billingEventKey,
      });

    const billingEvents = Array.isArray(billingRows)
      ? billingRows
      : [];

    if (billingEvents.length !== 1) {
      throw createHttpError(
        409,
        "This invitation does not have exactly one matching registration billing event."
      );
    }

    const billingEvent = billingEvents[0];

    const billingIdentityMatches =
      normalizeText(billingEvent.organization_id) === organizationId &&
      normalizeEmail(billingEvent.subject_verified_email) ===
        studentEmail &&
      CE_REGISTRATION_FEE_KINDS.has(
        normalizeText(billingEvent.fee_kind)
      ) &&
      billingEvent.billing_subject_type === "student";

    if (!billingIdentityMatches) {
      throw createHttpError(
        409,
        "The registration billing event does not safely match this invitation."
      );
    }

    if (
      !SETTLED_EVENT_STATUSES.has(
        normalizeText(billingEvent.event_status)
      )
    ) {
      throw createHttpError(
        409,
        "Registration instructions can be resent only after the CE registration payment is settled."
      );
    }

    await sendRegistrationInstructionsEmail({
      toEmail: studentEmail,
      inviterName:
        user.full_name || user.email || "Your instructor",
      billingEvent,
    });

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      assignment.id,
      {
        status: "invite_email_sent",
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
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to resend CE registration instructions.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
