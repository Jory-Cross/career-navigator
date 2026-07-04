import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const OPEN_INVITATION_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getStaffProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (STAFF_ROLE_ACCESS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
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
  const profile = getStaffProfile(caller);

  if (
    !callerId ||
    !profile ||
    !["admin", "management"].includes(profile.role)
  ) {
    throw new RequestError(
      403,
      "You are not authorized to review employee invitation status."
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
    callerId,
    organizationId,
    role: profile.role,
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
    employee.is_archived === true ||
    normalizeText(employee.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected employee was not found in your organization."
    );
  }

  const employeeProfile = getStaffProfile(employee);

  if (!employeeProfile) {
    throw new RequestError(
      400,
      "The selected account does not have a valid staff access profile."
    );
  }

  if (callerRole === "admin") {
    return employee;
  }

  if (employeeProfile.role !== "employee") {
    throw new RequestError(
      403,
      "Management users may review invitation status only for their employee direct reports."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: callerId,
      employee_user_id: employeeId,
    });

  const isDirectReport = asArray(assignments).some(
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
      "You may review invitation status only for employees assigned to you."
    );
  }

  return employee;
}

async function getPendingStaffInvitations(
  base44: any,
  organizationId: string,
  employeeEmail: string
) {
  const lookupEmails = [
    ...new Set(
      [employeeEmail, normalizeText(employeeEmail)].filter(Boolean)
    ),
  ];

  const resultSets = await Promise.all(
    lookupEmails.map((email) =>
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: organizationId,
        email,
      })
    )
  );

  const invitationsById = new Map<string, any>();

  for (const resultSet of resultSets) {
    for (const invitation of asArray(resultSet)) {
      const invitationId = normalizeText(invitation?.id);

      if (invitationId) {
        invitationsById.set(invitationId, invitation);
      }
    }
  }

  return [...invitationsById.values()].filter((invitation) => {
    const role = normalizeText(invitation?.role).toLowerCase();
    const accessLevel = normalizeText(
      invitation?.access_level
    ).toLowerCase();

    return (
      invitation?.is_archived !== true &&
      normalizeText(invitation?.org_id) === organizationId &&
      normalizeEmail(invitation?.email) === employeeEmail &&
      !normalizeText(invitation?.client_id) &&
      !normalizeText(invitation?.cohort_id) &&
      STAFF_ROLE_ACCESS[role] === accessLevel &&
      OPEN_INVITATION_STATUSES.has(
        normalizeText(invitation?.status).toLowerCase()
      )
    );
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This employee invitation-status request must use POST.",
      },
      { status: 405 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = normalizeText(body?.employee_id);

    if (!employeeId) {
      throw new RequestError(
        400,
        "An employee must be selected before invitation status can be reviewed."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(
        401,
        "Please sign in before reviewing employee invitation status."
      );
    }

    const {
      callerId,
      organizationId,
      role,
    } = await resolveCanonicalCaller(base44, authenticatedUser.id);

    const employee = await resolveAuthorizedEmployee(
      base44,
      callerId,
      role,
      organizationId,
      employeeId
    );

    const employeeEmail = normalizeEmail(employee.email);

    if (!employeeEmail) {
      throw new RequestError(
        400,
        "The selected employee does not have a valid email address."
      );
    }

    const invitations = await getPendingStaffInvitations(
      base44,
      organizationId,
      employeeEmail
    );

    return Response.json({
      success: true,
      employee_id: employeeId,
      has_pending_invite: invitations.length > 0,
    });
  } catch (error) {
    const message = error instanceof RequestError
      ? error.message
      : "Employee invitation status could not be reviewed. Please try again or contact your organization administrator.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[getEmployeeAccessStatus] Unexpected error:",
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
