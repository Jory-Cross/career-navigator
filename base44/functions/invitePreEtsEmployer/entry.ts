import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLES = new Set([
  "admin",
  "management",
  "employee",
]);

const OPEN_PENDING_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
];

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const PLATFORM_INVITE_INTERNAL_SECRET =
  Deno.env.get("PLATFORM_INVITE_INTERNAL_SECRET") || "";
const APP_URL =
  Deno.env.get("APP_URL") || "https://app.base44.com";

const fromDomain =
  RESEND_FROM_EMAIL.split("@")[1]?.toLowerCase() || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
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

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActiveRecord(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActivePreEtsClient(
  client: any,
  organizationId: string
) {
  return (
    isActiveRecord(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() ===
      "pre_ets" &&
    normalizeText(client?.status).toLowerCase() === "active"
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: unknown) {
  return normalizeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getManagedEmployeeIds(
  managerUserId: string,
  assignments: any[]
) {
  const employeesByManagerId = new Map<string, string[]>();

  for (const assignment of assignments) {
    if (!isActiveRecord(assignment)) {
      continue;
    }

    const assignmentManagerId = normalizeText(
      assignment?.manager_user_id
    );
    const employeeUserId = normalizeText(
      assignment?.employee_user_id
    );

    if (!assignmentManagerId || !employeeUserId) {
      continue;
    }

    const existingEmployees =
      employeesByManagerId.get(assignmentManagerId) || [];

    existingEmployees.push(employeeUserId);

    employeesByManagerId.set(
      assignmentManagerId,
      existingEmployees
    );
  }

  const visibleEmployeeIds = new Set<string>([managerUserId]);
  const queue = [managerUserId];

  while (queue.length > 0) {
    const currentManagerId = queue.shift() || "";
    const directEmployeeIds =
      employeesByManagerId.get(currentManagerId) || [];

    for (const employeeUserId of directEmployeeIds) {
      if (visibleEmployeeIds.has(employeeUserId)) {
        continue;
      }

      visibleEmployeeIds.add(employeeUserId);
      queue.push(employeeUserId);
    }
  }

  return visibleEmployeeIds;
}

function callerCanManageClient(
  caller: any,
  client: any,
  activeOrganizationUsers: any[],
  activeManagerAssignments: any[]
) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const callerId = normalizeText(caller?.id);

  if (callerRole === "admin") {
    return true;
  }

  const visibleUserIds =
    callerRole === "management"
      ? getManagedEmployeeIds(
          callerId,
          activeManagerAssignments
        )
      : new Set<string>([callerId]);

  const visibleUserEmails = new Set(
    activeOrganizationUsers
      .filter((user: any) =>
        visibleUserIds.has(normalizeText(user?.id))
      )
      .map((user: any) => normalizeEmail(user?.email))
      .filter(Boolean)
  );

  const clientAssignmentEvidence = [
    normalizeText(client?.assigned_employee_id),
    normalizeText(client?.created_by),
  ];

  return clientAssignmentEvidence.some(
    (value) =>
      visibleUserIds.has(value) ||
      visibleUserEmails.has(normalizeEmail(value))
  );
}

function projectEmployerAccount(user: any) {
  return {
    id: normalizeText(user?.id),
    email: normalizeEmail(user?.email),
    full_name: normalizeText(user?.full_name),
  };
}

async function sendEmployerInviteEmail({
  toEmail,
  inviterName,
}: {
  toEmail: string;
  inviterName: string;
}) {
  if (!RESEND_API_KEY) {
    return false;
  }

  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Pre-ETS Employer Portal <${RESEND_FROM}>`,
      to: [toEmail],
      subject: "You've been invited to the Pre-ETS Employer Portal",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
          <h2 style="color:#2563eb;margin-bottom:8px;">You're invited!</h2>
          <p style="font-size:16px;margin-bottom:16px;">
            <strong>${safeInviterName}</strong> has invited you to access the Pre-ETS Employer Portal.
          </p>
          <ol style="margin-bottom:24px;padding-left:20px;line-height:1.8;">
            <li>Open the portal using the link below.</li>
            <li>Register or sign in using <strong>${safeEmail}</strong>.</li>
            <li>Your assigned Pre-ETS student will appear after access is activated.</li>
          </ol>
          <a
            href="${APP_URL}"
            style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;"
          >
            Access Employer Portal
          </a>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(
      "The employer instruction email could not be sent."
    );
  }

  return true;
}

async function resolveAuthorizedInvitationContext(
  base44: any,
  authenticatedUserId: string,
  clientId: string
) {
  const [caller, client] = await Promise.all([
    base44.asServiceRole.entities.User.get(
      authenticatedUserId
    ).catch(() => null),
    base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null),
  ]);

  if (!caller || !isActiveRecord(caller)) {
    throw new RequestError(
      403,
      "Your staff account could not be verified as active."
    );
  }

  const callerId = normalizeText(caller?.id);
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const organizationId = normalizeText(caller?.org_id);

  if (!STAFF_ROLES.has(callerRole)) {
    throw new RequestError(
      403,
      "Only authorized staff may invite a Pre-ETS employer."
    );
  }

  if (!callerId || !organizationId) {
    throw new RequestError(
      403,
      "Your staff account is missing its organization assignment."
    );
  }

  const [
    organization,
    organizationUsers,
    managerAssignments,
  ] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
    }),
  ]);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  const activeOrganizationUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActiveRecord(user) &&
      normalizeText(user?.org_id) === organizationId
  );

  const callerIsOrganizationMember = activeOrganizationUsers.some(
    (user: any) => normalizeText(user?.id) === callerId
  );

  if (!callerIsOrganizationMember) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  if (!isActivePreEtsClient(client, organizationId)) {
    throw new RequestError(
      404,
      "The selected active Pre-ETS student was not found in your organization."
    );
  }

  const activeManagerAssignments = asArray(
    managerAssignments
  ).filter(
    (assignment: any) =>
      isActiveRecord(assignment) &&
      normalizeText(assignment?.org_id) === organizationId
  );

  if (
    !callerCanManageClient(
      caller,
      client,
      activeOrganizationUsers,
      activeManagerAssignments
    )
  ) {
    throw new RequestError(
      403,
      "You are not authorized to invite an employer for this Pre-ETS student."
    );
  }

  return {
    caller,
    client,
    organizationId,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          success: false,
          error: "Method not allowed.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          success: false,
          error: "Please sign in before inviting an employer.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const email = normalizeEmail(requestBody?.email);
    const clientId = normalizeText(requestBody?.clientId);

    if (!email || !isValidEmail(email)) {
      throw new RequestError(
        400,
        "Enter a valid employer email address."
      );
    }

    if (!clientId) {
      throw new RequestError(
        400,
        "Choose a Pre-ETS student before inviting an employer."
      );
    }

    const {
      caller,
      client,
      organizationId,
    } = await resolveAuthorizedInvitationContext(
      base44,
      authenticatedUser.id,
      clientId
    );

    const assignedEmployerId = normalizeText(
      client?.assigned_employer_id
    );

    const existingUsers =
      await base44.asServiceRole.entities.User.filter({
        email,
      });

    const matchingUsers = asArray(existingUsers).filter(
      (candidate: any) =>
        normalizeEmail(candidate?.email) === email
    );

    if (matchingUsers.length > 1) {
      throw new RequestError(
        409,
        "More than one account uses this email address. Resolve the duplicate accounts before assigning employer access."
      );
    }

    const existingUser = matchingUsers[0] || null;

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter(
        { email }
      );

    const matchingOpenAssignments = asArray(
      pendingAssignments
    ).filter(
      (assignment: any) =>
        normalizeEmail(assignment?.email) === email &&
        OPEN_PENDING_STATUSES.has(
          normalizeText(assignment?.status)
        )
    );

    const exactPendingAssignment = matchingOpenAssignments.find(
      (assignment: any) =>
        normalizeText(assignment?.role) === "pre_ets_employer" &&
        normalizeText(assignment?.access_level) ===
          "pre_ets_employer_portal" &&
        normalizeText(assignment?.org_id) === organizationId &&
        normalizeText(assignment?.client_id) === clientId
    );

    const conflictingPendingAssignment =
      matchingOpenAssignments.find(
        (assignment: any) =>
          normalizeText(assignment?.id) !==
          normalizeText(exactPendingAssignment?.id)
      );

    if (conflictingPendingAssignment) {
      throw new RequestError(
        409,
        "This email already has an active invitation for a different role, organization, or student. Resolve that invitation before continuing."
      );
    }

    if (existingUser) {
      const existingUserRole = normalizeText(
        existingUser?.role
      ).toLowerCase();

      const existingAccessLevel = normalizeText(
        existingUser?.access_level
      ).toLowerCase();

      const existingOrganizationId = normalizeText(
        existingUser?.org_id
      );

      if (!isActiveRecord(existingUser)) {
        throw new RequestError(
          409,
          "The existing account for this email is inactive and cannot receive employer access."
        );
      }

      if (
        existingUserRole !== "pre_ets_employer" ||
        existingAccessLevel !== "pre_ets_employer_portal" ||
        existingOrganizationId !== organizationId
      ) {
        throw new RequestError(
          409,
          "An existing account uses this email, but it is not an active Pre-ETS employer account in this organization. This invitation will not overwrite another account's role or organization."
        );
      }

      if (
        assignedEmployerId &&
        assignedEmployerId !== normalizeText(existingUser?.id)
      ) {
        throw new RequestError(
          409,
          "This Pre-ETS student is already assigned to a different employer account."
        );
      }

      await base44.asServiceRole.entities.Client.update(
        clientId,
        {
          assigned_employer_id: existingUser.id,
        }
      );

      if (exactPendingAssignment) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          exactPendingAssignment.id,
          {
            status: "accepted",
          }
        );
      }

      await base44.asServiceRole.entities.Activity.create({
        org_id: organizationId,
        client_id: clientId,
        activity_type: "status_changed",
        title: "Pre-ETS employer assigned",
        description:
          "An authorized staff member assigned an existing Pre-ETS employer account to this student.",
        metadata: {
          employer_user_id: normalizeText(existingUser?.id),
          invited_by_user_id: normalizeText(caller?.id),
          related_entity_type: "Client",
          related_entity_id: clientId,
        },
      });

      return Response.json({
        success: true,
        existing_account_linked: true,
        employer: projectEmployerAccount(existingUser),
        message:
          "The existing Pre-ETS employer account was assigned to this student.",
      });
    }

    if (assignedEmployerId) {
      throw new RequestError(
        409,
        "This Pre-ETS student is already assigned to an employer account."
      );
    }

    if (!PLATFORM_INVITE_INTERNAL_SECRET) {
      throw new Error(
        "The platform invitation relay is not configured."
      );
    }

    const now = new Date().toISOString();
    let pendingAssignmentId = normalizeText(
      exactPendingAssignment?.id
    );

    if (pendingAssignmentId) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingAssignmentId,
        {
          invited_by_id: normalizeText(caller?.id),
          invited_by_name:
            normalizeText(caller?.full_name) ||
            normalizeEmail(caller?.email),
          invited_at: now,
          status: "pending",
        }
      );
    } else {
      const createdAssignment =
        await base44.asServiceRole.entities.PendingRoleAssignment.create(
          {
            email,
            role: "pre_ets_employer",
            access_level: "pre_ets_employer_portal",
            org_id: organizationId,
            invited_by_id: normalizeText(caller?.id),
            invited_by_name:
              normalizeText(caller?.full_name) ||
              normalizeEmail(caller?.email),
            invited_at: now,
            client_id: clientId,
            status: "pending",
          }
        );

      pendingAssignmentId = normalizeText(createdAssignment?.id);
    }

    if (!pendingAssignmentId) {
      throw new Error(
        "The employer invitation record could not be created."
      );
    }

    try {
      const inviteResponse =
        await base44.asServiceRole.functions.invoke(
          "platformInviteUser",
          {
            email,
            internal_secret:
              PLATFORM_INVITE_INTERNAL_SECRET,
          }
        );

      const inviteData =
        inviteResponse?.data ?? inviteResponse ?? {};

      if (inviteData?.success !== true) {
        throw new Error(
          normalizeText(inviteData?.error) ||
            "The platform invitation relay did not confirm delivery."
        );
      }
    } catch (inviteError: any) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(
        pendingAssignmentId,
        {
          status: "pending_email_failed",
        }
      );

      await base44.asServiceRole.entities.Activity.create({
        org_id: organizationId,
        client_id: clientId,
        activity_type: "email_sent",
        title: "Pre-ETS employer invitation preparation failed",
        description:
          "Employer access was prepared, but the platform invitation could not be sent.",
        metadata: {
          pending_role_assignment_id: pendingAssignmentId,
          invited_by_user_id: normalizeText(caller?.id),
        },
      });

      throw new RequestError(
        502,
        "Employer access was prepared, but the platform invitation could not be sent. The invitation remains pending for retry."
      );
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      pendingAssignmentId,
      {
        status: "invite_email_sent",
      }
    );

    let instructionEmailSent = false;

    try {
      instructionEmailSent = await sendEmployerInviteEmail({
        toEmail: email,
        inviterName:
          normalizeText(caller?.full_name) ||
          normalizeEmail(caller?.email),
      });
    } catch (emailError: any) {
      console.error(
        "[invitePreEtsEmployer] Instruction email failed:",
        emailError?.message || emailError
      );
    }

    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: clientId,
      activity_type: "email_sent",
      title: "Pre-ETS employer invitation sent",
      description:
        "An authorized staff member sent a Pre-ETS employer portal invitation.",
      metadata: {
        pending_role_assignment_id: pendingAssignmentId,
        invited_by_user_id: normalizeText(caller?.id),
        instruction_email_sent: instructionEmailSent,
      },
    });

    return Response.json({
      success: true,
      existing_account_linked: false,
      platform_invite_sent: true,
      instruction_email_sent: instructionEmailSent,
      pending_role_assignment_id: pendingAssignmentId,
      message: "Pre-ETS employer invitation sent successfully.",
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : "The Pre-ETS employer invitation could not be completed.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[invitePreEtsEmployer] Unexpected error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
});
