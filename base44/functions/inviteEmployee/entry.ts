import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL =
  Deno.env.get("APP_URL") || "https://app.base44.com";

const FREE_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
]);

const OPEN_PENDING_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
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

const STAFF_INVITE_ROLES = new Set([
  "admin",
  "management",
  "employee",
]);

const fromDomain = (
  RESEND_FROM_EMAIL.split("@")[1] || ""
).toLowerCase();

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
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function getSafeAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeText(user?.email) ||
    "Your organization"
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
  const accessLevel = normalizeText(user?.access_level);
  const organizationId = normalizeIdentifier(user?.org_id);
  const managerId = normalizeIdentifier(user?.manager_id);
  const linkedClientId = normalizeIdentifier(
    user?.linked_client_id
  );
  const cohortId = normalizeIdentifier(user?.cohort_id);
  const cohortRole = normalizeText(user?.cohort_role);

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !organizationId &&
    !managerId &&
    !linkedClientId &&
    !cohortId &&
    !cohortRole
  );
}

function canInviteStaffRole(
  inviterProfile: { role: string; access_level: string } | null,
  targetRole: string
) {
  if (!inviterProfile) {
    return false;
  }

  if (inviterProfile.role === "admin") {
    return STAFF_INVITE_ROLES.has(targetRole);
  }

  if (inviterProfile.role === "management") {
    return targetRole === "employee";
  }

  return false;
}

function isReusableStaffInvitation(
  assignment: any,
  organizationId: string,
  inviterId: string,
  role: string,
  accessLevel: string
) {
  return (
    normalizeText(assignment?.role).toLowerCase() === role &&
    normalizeText(assignment?.access_level).toLowerCase() ===
      accessLevel &&
    normalizeIdentifier(assignment?.org_id) === organizationId &&
    normalizeIdentifier(assignment?.invited_by_id) === inviterId &&
    !normalizeIdentifier(assignment?.client_id) &&
    !normalizeIdentifier(assignment?.cohort_id)
  );
}

function getDeliveryFailureMessage(error: unknown) {
  const rawMessage = normalizeText(
    error instanceof Error ? error.message : String(error || "")
  );

  if (rawMessage.includes("RESEND_API_KEY")) {
    return "The staff invitation was prepared, but the email could not be sent because the Resend API key is not configured. Add the key, then resend the invitation.";
  }

  if (rawMessage.includes("RESEND_FROM_EMAIL")) {
    return "The staff invitation was prepared, but the email could not be sent because the Resend sender email is not configured. Set the sender email, then resend the invitation.";
  }

  return "The staff invitation was prepared, but the email could not be delivered. Confirm the Resend sender domain is verified, then resend the invitation.";
}

async function sendInviteEmail({
  toEmail,
  inviterName,
  role,
}: {
  toEmail: string;
  inviterName: string;
  role: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);
  const safeAppUrl = escapeHtml(getSafeAppUrl());

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Career Navigator <${RESEND_FROM}>`,
      to: [toEmail],
      subject: "You're invited to join Career Navigator",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">
            You're invited!
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has invited you to create a
            <strong>${safeRole}</strong> account.
          </p>

          <p style="margin-bottom: 8px;">To get started:</p>

          <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
            <li>Open Career Navigator using the button below</li>
            <li>Register or sign in using <strong>${safeEmail}</strong></li>
            <li>Your access will be connected to the invitation after sign-in</li>
          </ol>

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Access Career Navigator →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Important: Register or sign in using <strong>${safeEmail}</strong>.
            Using a different email address will not connect to this invitation.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Resend delivery failed: ${details || response.status}`
    );
  }

  return response.json();
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
    !["admin", "management"].includes(callerProfile.role)
  ) {
    throw new RequestError(
      403,
      "You are not authorized to send staff invitations."
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

async function getOpenAssignmentsForEmail(
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
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email,
      })
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
      OPEN_PENDING_ASSIGNMENT_STATUSES.has(
        normalizeText(assignment?.status).toLowerCase()
      )
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          success: false,
          message: "This staff invitation request must use POST.",
        },
        { status: 405 }
      );
    }

        const body = await req.json().catch(() => ({}));
    const rawEmail = normalizeText(body?.email);
    const email = normalizeEmail(rawEmail);
    const inviteRole =
      normalizeText(body?.role).toLowerCase() || "employee";

    if (!email || !isValidEmail(email)) {
      return Response.json(
        {
          success: false,
          message: "Enter a valid staff email address.",
        },
        { status: 400 }
      );
    }

    if (normalizeIdentifier(body?.manager_id)) {
      return Response.json(
        {
          success: false,
          message:
            "This secure staff invitation process assigns a new staff member to the person who sends the invitation. To assign a different manager, have that manager send the invitation.",
        },
        { status: 400 }
      );
    }

    if (!STAFF_INVITE_ROLES.has(inviteRole)) {
      return Response.json(
        {
          success: false,
          message:
            "Choose employee, management, or admin for a staff invitation.",
        },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          success: false,
          message: "Please sign in before sending a staff invitation.",
        },
        { status: 401 }
      );
    }
    const {
      caller,
      callerId,
      callerEmail,
      callerProfile,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    if (!canInviteStaffRole(callerProfile, inviteRole)) {
      return Response.json(
        {
          success: false,
          message:
            "Your account is not authorized to invite that staff role.",
        },
        { status: 403 }
      );
    }

    if (email === callerEmail) {
      return Response.json(
        {
          success: false,
          message:
            "You cannot send a staff invitation to your own account.",
        },
        { status: 400 }
      );
    }

    const matchingUsers = await getUsersForEmail(
      base44,
      rawEmail,
      email
    );

    if (matchingUsers.length > 1) {
      return Response.json(
        {
          success: false,
          message:
            "This email is connected to more than one account record and requires administrator review before an invitation can be sent.",
        },
        { status: 409 }
      );
    }

    const matchingUser = matchingUsers[0] || null;

    if (matchingUser && !isActiveRecord(matchingUser)) {
      return Response.json(
        {
          success: false,
          message:
            "This email is connected to an inactive account. Restore or review that account before sending a new staff invitation.",
        },
        { status: 409 }
      );
    }

    if (matchingUser && !isNeutralExistingAccount(matchingUser)) {
      return Response.json(
        {
          success: false,
          message:
            "This email is already connected to an account with access or organization details. Existing accounts cannot be repurposed through a staff invitation.",
        },
        { status: 409 }
      );
    }

    const accessLevel = ROLE_ACCESS_LEVELS[inviteRole];
    const openAssignments = await getOpenAssignmentsForEmail(
      base44,
      rawEmail,
      email
    );

    const reusableAssignments = openAssignments.filter(
      (assignment) =>
        isReusableStaffInvitation(
          assignment,
          organizationId,
          callerId,
          inviteRole,
          accessLevel
        )
    );

    if (
      openAssignments.length > 0 &&
      (openAssignments.length !== 1 ||
        reusableAssignments.length !== 1)
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This email already has an active invitation that does not match this staff invitation. Resolve the existing invitation before sending another one.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const invitationData = {
      email,
      role: inviteRole,
      access_level: accessLevel,
      org_id: organizationId,
      invited_by_id: callerId,
      invited_by_name: getDisplayName(caller),
      invited_at: now,
      status: "pending",
    };

    let pendingId = "";

    if (reusableAssignments.length === 1) {
      pendingId = normalizeIdentifier(reusableAssignments[0]?.id);

      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingId,
        invitationData
      );
    } else {
      const created =
        await base44.asServiceRole.entities.PendingRoleAssignment.create(
          invitationData
        );

      pendingId = normalizeIdentifier(created?.id);
    }

    if (!pendingId) {
      throw new Error(
        "The staff invitation record was not created correctly."
      );
    }

    try {
      await sendInviteEmail({
        toEmail: email,
        inviterName: getDisplayName(caller),
        role: inviteRole,
      });
    } catch (emailError) {
      console.error(
        "[inviteEmployee] Invitation email delivery failed:",
        emailError instanceof Error
          ? emailError.message
          : emailError
      );

      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingId,
        {
          status: "pending_email_failed",
        }
      ).catch((statusError: unknown) => {
        console.error(
          "[inviteEmployee] Could not record invitation email failure:",
          statusError instanceof Error
            ? statusError.message
            : statusError
        );
      });

      return Response.json({
        success: false,
        access_prepared: true,
        email_sent: false,
        pending_id: pendingId,
        platform_invite_sent: false,
        instruction_email_sent: false,
        message: getDeliveryFailureMessage(emailError),
      });
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      pendingId,
      {
        status: "invite_email_sent",
      }
    ).catch((statusError: unknown) => {
      console.error(
        "[inviteEmployee] Could not record invitation email delivery:",
        statusError instanceof Error
          ? statusError.message
          : statusError
      );
    });

    return Response.json({
      success: true,
      access_prepared: true,
      email_sent: true,
      pending_id: pendingId,
      platform_invite_sent: false,
      instruction_email_sent: true,
      message: `The staff invitation was emailed to ${email}.`,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : "The staff invitation could not be completed. Please try again. If the problem continues, contact your organization administrator.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[inviteEmployee] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        success: false,
        message,
      },
      { status }
    );
  }
});
