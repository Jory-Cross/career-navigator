import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const FREE_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "resend.dev",
]);

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
}

function escapeHtml(value: unknown) {
  return normalizeText(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character
  );
}

function getSenderAddress() {
  const domain = (
    RESEND_FROM_EMAIL.split("@")[1] || ""
  ).toLowerCase();

  if (RESEND_FROM_EMAIL && !FREE_DOMAINS.has(domain)) {
    return RESEND_FROM_EMAIL;
  }

  return "onboarding@resend.dev";
}

function getSafeAppUrl() {
  const candidate = APP_URL.replace(/\/+$/, "");

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:"
      ? parsed.toString().replace(/\/+$/, "")
      : "https://app.base44.com";
  } catch {
    return "https://app.base44.com";
  }
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeEmail(user?.email) ||
    "Your organization"
  );
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
      403,
      "Your account is unavailable or inactive."
    );
  }

  const callerId = normalizeText(caller.id);
  const organizationId = normalizeText(caller.org_id);
  const profile = getRoleProfile(caller);

  if (
    !callerId ||
    !profile ||
    !["admin", "management"].includes(profile.role)
  ) {
    throw new RequestError(
      403,
      "You are not authorized to send staff access emails."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId,
    organizationId,
    profile,
  };
}

async function resolveAuthorizedEmployee(
  base44: any,
  callerId: string,
  callerRole: string,
  organizationId: string,
  employeeId: string
) {
  const employee = await base44.asServiceRole.entities.User.get(
    employeeId
  ).catch(() => null);

  if (
    !employee ||
    !isActive(employee) ||
    normalizeText(employee.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected employee was not found in your organization."
    );
  }

  const employeeProfile = getRoleProfile(employee);

  if (!employeeProfile) {
    throw new RequestError(
      400,
      "The selected employee does not have a valid staff access profile."
    );
  }

  if (callerRole === "admin") {
    return employee;
  }

  if (employeeProfile.role !== "employee") {
    throw new RequestError(
      403,
      "Management users may send access emails only to their employee direct reports."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: callerId,
      employee_user_id: employeeId,
    });

  const isDirectReport = Array.isArray(assignments) &&
    assignments.some(
      (assignment: any) =>
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment.org_id) === organizationId &&
        normalizeText(assignment.manager_user_id) === callerId &&
        normalizeText(assignment.employee_user_id) === employeeId
    );

  if (!isDirectReport) {
    throw new RequestError(
      403,
      "You may send access emails only to employees assigned to you."
    );
  }

  return employee;
}

async function sendAccessEmail({
  action,
  employee,
  caller,
}: {
  action: string;
  employee: any;
  caller: any;
}) {
  if (!RESEND_API_KEY) {
    throw new RequestError(
      400,
      "The access email could not be sent because email delivery is not configured."
    );
  }

  if (!RESEND_FROM_EMAIL) {
    throw new RequestError(
      400,
      "The access email could not be sent because the sender email is not configured."
    );
  }

  const email = normalizeEmail(employee.email);

  if (!email) {
    throw new RequestError(
      400,
      "The selected employee does not have a valid email address."
    );
  }

  const isInvite = action === "resend_invite";
  const subject = isInvite
    ? "You are invited to join Career Navigator"
    : "Access your Career Navigator account";
  const callerDisplayName = escapeHtml(getDisplayName(caller));
  const employeeEmail = escapeHtml(email);
  const appUrl = getSafeAppUrl();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Career Navigator <${getSenderAddress()}>`,
      to: [email],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb;">
            ${isInvite ? "You are invited!" : "Access Your Account"}
          </h2>
          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${callerDisplayName}</strong> has ${
              isInvite
                ? "sent you an invitation to join Career Navigator."
                : "sent you an account-access email."
            }
          </p>
          <p style="margin-bottom: 8px;">
            Open Career Navigator and sign in or register with
            <strong>${employeeEmail}</strong>.
          </p>
          <a
            href="${appUrl}"
            style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0;"
          >
            Open Career Navigator
          </a>
          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use the same email address shown above when signing in.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error(
      "[resendInviteOrReset] Resend delivery failed:",
      await response.text()
    );

    throw new RequestError(
      400,
      "The access email could not be delivered. Confirm the sender domain is configured, then try again."
    );
  }

  return email;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This staff access-email request must use POST.",
      },
      { status: 405 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = normalizeText(body?.employee_id);
    const action = normalizeText(body?.action);

    if (!employeeId) {
      throw new RequestError(
        400,
        "An employee must be selected before an access email can be sent."
      );
    }

    if (!["resend_invite", "send_reset"].includes(action)) {
      throw new RequestError(
        400,
        "Choose either resend invitation or send password reset."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(
        401,
        "Please sign in before sending a staff access email."
      );
    }

    const {
      caller,
      callerId,
      organizationId,
      profile,
    } = await resolveCanonicalCaller(base44, authenticatedUser.id);

    const employee = await resolveAuthorizedEmployee(
      base44,
      callerId,
      profile.role,
      organizationId,
      employeeId
    );

    const email = await sendAccessEmail({
      action,
      employee,
      caller,
    });

    return Response.json({
      success: true,
      email_sent: true,
      message:
        action === "resend_invite"
          ? `A staff invitation was sent to ${email}.`
          : `An account-access email was sent to ${email}.`,
    });
  } catch (error) {
    const message = error instanceof RequestError
      ? error.message
      : "The staff access email could not be sent. Please try again or contact your organization administrator.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[resendInviteOrReset] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        success: false,
        error: message,
      },
      {
        status: error instanceof RequestError ? error.status : 500,
      }
    );
  }
});
