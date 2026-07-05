import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL =
  Deno.env.get("APP_URL") || "https://app.base44.com";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
];

const fromDomain = (
  RESEND_FROM_EMAIL.split("@")[1] || ""
).toLowerCase();

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

class RequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false &&
    record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getClientName(client: any) {
  const name = `${normalizeText(client?.first_name)} ${normalizeText(
    client?.last_name
  )}`.trim();

  return name || "Client";
}

function getPortalInviteConfig(client: any) {
  const clientType = normalizeText(
    client?.client_type
  ).toLowerCase();

  if (clientType === "pre_ets") {
    return {
      role: "pre_ets",
      accessLevel: "client_portal",
      portalName: "Career Navigator Pre-ETS Portal",
      subject:
        "You're invited to the Career Navigator Pre-ETS Portal",
      description:
        "Your Pre-ETS portal gives you access to your approved student tools, activities, documents, and time-entry features.",
    };
  }

  if (clientType === "dspd") {
    return {
      role: "dspd",
      accessLevel: "client_portal",
      portalName: "Career Navigator Client Portal",
      subject:
        "You're invited to the Career Navigator Client Portal",
      description:
        "Your client portal gives you access to your approved services, documents, and account tools.",
    };
  }

  return {
    role: "client",
    accessLevel: "client_portal",
    portalName: "Career Navigator Client Portal",
    subject:
      "You're invited to the Career Navigator Client Portal",
    description:
      "Your client portal gives you access to your approved services, documents, and account tools.",
  };
}

function getSafeAppUrl() {
  return APP_URL.replace(/\/+$/, "");
}

function getDeliveryFailureMessage(error: unknown) {
  const rawMessage = normalizeText(
    error instanceof Error ? error.message : String(error || "")
  );

  if (rawMessage.includes("RESEND_API_KEY")) {
    return "The portal access was prepared, but the invitation email could not be sent because the Resend API key is not configured. Add the Resend API key, then use Resend Invite.";
  }

  if (rawMessage.includes("RESEND_FROM_EMAIL")) {
    return "The portal access was prepared, but the invitation email could not be sent because the Resend sender email is not configured. Set the sender email, then use Resend Invite.";
  }

  return "The portal access was prepared, but Resend could not deliver the invitation email. Confirm the Resend sender domain is verified, then use Resend Invite.";
}

async function sendClientInviteEmail({
  toEmail,
  inviterName,
  client,
  portalConfig,
}: {
  toEmail: string;
  inviterName: string;
  client: any;
  portalConfig: any;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeClientName = escapeHtml(getClientName(client));
  const safePortalName = escapeHtml(portalConfig.portalName);
  const safeDescription = escapeHtml(portalConfig.description);
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
      subject: portalConfig.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">
            You're invited!
          </h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            Hello ${safeClientName},
          </p>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has invited you to the
            <strong>${safePortalName}</strong>.
          </p>

          <p style="margin-bottom: 20px;">
            ${safeDescription}
          </p>

          <p style="margin-bottom: 8px;">To get started:</p>

          <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
            <li>Open the portal using the button below</li>
            <li>Register or sign in using <strong>${safeEmail}</strong></li>
            <li>Your portal access will be connected to your invited account</li>
          </ol>

          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Access Portal →
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

  if (!caller || !isActive(caller)) {
    throw new RequestError(
      "Your account is unavailable or inactive."
    );
  }

  const callerRole = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!callerRole) {
    throw new RequestError(
      "You are not authorized to send client portal invitations."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      "Your account is not assigned to an organization."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId: normalizeText(caller?.id),
    callerRole,
    organizationId,
  };
}

async function resolveAuthorizedClient(
  base44: any,
  caller: any,
  callerId: string,
  callerRole: string,
  organizationId: string,
  clientId: string
) {
  const client = await base44.asServiceRole.entities.Client.get(
    clientId
  ).catch(() => null);

  if (
    !client ||
    !isActive(client) ||
    normalizeText(client?.org_id) !== organizationId
  ) {
    throw new RequestError(
      "The selected client was not found in your organization."
    );
  }

  if (callerRole === "admin") {
    return client;
  }

  const assignedStaffId = normalizeText(
    client?.assigned_employee_id
  );

  if (!assignedStaffId) {
    throw new RequestError(
      "This client must be assigned to a staff member before a portal invitation can be sent."
    );
  }

  const assignedStaff = await base44.asServiceRole.entities.User.get(
    assignedStaffId
  ).catch(() => null);

  if (
    !assignedStaff ||
    !isActive(assignedStaff) ||
    normalizeText(assignedStaff?.org_id) !== organizationId ||
    !getCanonicalStaffRole(assignedStaff)
  ) {
    throw new RequestError(
      "The client is assigned to a staff member who is no longer active in this organization."
    );
  }

  if (callerId === assignedStaffId) {
    return client;
  }

  if (callerRole !== "management") {
    throw new RequestError(
      "You may only send invitations for clients assigned to you."
    );
  }

  const managerAssignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: callerId,
      employee_user_id: assignedStaffId,
    });

  const hasActiveManagerAssignment = asArray(
    managerAssignments
  ).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.manager_user_id) === callerId &&
      normalizeText(assignment?.employee_user_id) ===
        assignedStaffId
  );

  if (!hasActiveManagerAssignment) {
    throw new RequestError(
      "You may only send invitations for clients assigned to an active direct-report staff member."
    );
  }

  return client;
}

async function recordInvitationActivity(
  base44: any,
  organizationId: string,
  clientId: string,
  title: string,
  description: string
) {
  try {
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      org_id: organizationId,
      activity_type: "email_sent",
      title,
      description,
    });
  } catch (error) {
    console.error(
      "[inviteClient] Unable to record invitation activity:",
      error
    );
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({
        success: false,
        message: "This invitation request must use POST.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = normalizeText(body?.clientId);

    if (!clientId) {
      return Response.json({
        success: false,
        message: "A client must be selected before sending a portal invitation.",
      });
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json({
        success: false,
        message: "Please sign in before sending a portal invitation.",
      });
    }

    const {
      caller,
      callerId,
      callerRole,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const client = await resolveAuthorizedClient(
      base44,
      caller,
      callerId,
      callerRole,
      organizationId,
      clientId
    );

    const clientEmail = normalizeEmail(client?.email);
    const requestedEmail = normalizeEmail(body?.email);

    if (!clientEmail) {
      return Response.json({
        success: false,
        message:
          "The client's record does not contain an email address. Add the email to the client record before sending a portal invitation.",
      });
    }

    if (requestedEmail && requestedEmail !== clientEmail) {
      return Response.json({
        success: false,
        message:
          "The invitation email does not match the email saved on the client record. Update the client record first, then resend the invitation.",
      });
    }

    const portalConfig = getPortalInviteConfig(client);
    const now = new Date().toISOString();

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email: clientEmail,
      });

    const openAssignmentStatuses = new Set([
      "pending",
      "invite_email_sent",
      "pending_email_failed",
    ]);

    const openAssignments = asArray(
      pendingAssignments
    ).filter(
      (assignment: any) =>
        assignment?.is_archived !== true &&
        openAssignmentStatuses.has(
          normalizeText(assignment?.status).toLowerCase()
        )
    );
    const conflictingAssignment = openAssignments.find(
      (assignment: any) =>
        normalizeText(assignment?.org_id) !== organizationId ||
        normalizeText(assignment?.client_id) !== clientId
    );

    if (conflictingAssignment) {
      return Response.json({
        success: false,
        message:
          "This email already has an active portal invitation for a different client or organization. Resolve that invitation before using this email here.",
      });
    }

    const matchingAssignments = openAssignments.filter(
      (assignment: any) =>
        normalizeText(assignment?.org_id) === organizationId &&
        normalizeText(assignment?.client_id) === clientId
    );

    if (matchingAssignments.length > 1) {
      return Response.json({
        success: false,
        message:
          "This client has more than one active portal invitation. Resolve the duplicate invitations before resending.",
      });
    }

    const existingAssignment = matchingAssignments[0] || null;

    if (existingAssignment) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        existingAssignment.id,
        {
          email: clientEmail,
          role: portalConfig.role,
          access_level: portalConfig.accessLevel,
          org_id: organizationId,
          client_id: clientId,
          invited_by_id: callerId,
          invited_by_name:
            normalizeText(caller?.full_name) ||
            normalizeEmail(caller?.email),
          invited_at: now,
          status: "pending",
        }
      );
    } else {
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: clientEmail,
        role: portalConfig.role,
        access_level: portalConfig.accessLevel,
        org_id: organizationId,
        client_id: clientId,
        invited_by_id: callerId,
        invited_by_name:
          normalizeText(caller?.full_name) ||
          normalizeEmail(caller?.email),
        invited_at: now,
        status: "pending",
      });
    }

    await base44.asServiceRole.entities.Client.update(clientId, {
      onboarding_status: "in_progress",
    });

    try {
      await sendClientInviteEmail({
        toEmail: clientEmail,
        inviterName:
          normalizeText(caller?.full_name) ||
          normalizeEmail(caller?.email) ||
          "Career Navigator",
        client,
        portalConfig,
      });
    } catch (emailError) {
      console.error(
        "[inviteClient] Resend delivery failed:",
        emailError instanceof Error
          ? emailError.message
          : emailError
      );

      const failureMessage = getDeliveryFailureMessage(emailError);

      await recordInvitationActivity(
        base44,
        organizationId,
        clientId,
        "Portal access prepared — invitation email not delivered",
        `${failureMessage} Recipient: ${clientEmail}`
      );

      return Response.json({
        success: false,
        access_prepared: true,
        email_sent: false,
        message: failureMessage,
      });
    }

    await recordInvitationActivity(
      base44,
      organizationId,
      clientId,
      "Portal invitation sent",
      `${portalConfig.portalName} invitation sent to ${clientEmail} by ${
        normalizeText(caller?.full_name) ||
        normalizeEmail(caller?.email)
      }.`
    );

    return Response.json({
      success: true,
      access_prepared: true,
      email_sent: true,
      message: `The ${portalConfig.portalName} invitation was emailed to ${clientEmail}.`,
    });
  } catch (error) {
    console.error(
      "[inviteClient] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return Response.json({
      success: false,
      message:
        error instanceof RequestError
          ? error.message
          : "The portal invitation could not be completed. Please try again. If the problem continues, contact your organization administrator.",
    });
  }
});