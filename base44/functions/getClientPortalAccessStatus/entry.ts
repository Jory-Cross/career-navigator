import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);
const CLIENT_PORTAL_ROLES = new Set(["client", "pre_ets", "dspd"]);

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
  return record?.is_active !== false && record?.is_archived !== true;
}

function responseError(error: string, status = 400) {
  return Response.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function newestFirst(left: any, right: any) {
  const leftTime = Date.parse(
    normalizeText(left?.invited_at) || normalizeText(left?.created_date)
  );
  const rightTime = Date.parse(
    normalizeText(right?.invited_at) || normalizeText(right?.created_date)
  );

  return (Number.isFinite(rightTime) ? rightTime : 0) -
    (Number.isFinite(leftTime) ? leftTime : 0);
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  const expectedAccessLevel = role === "admin" ? "admin" : "staff";

  return STAFF_ROLES.has(role) && accessLevel === expectedAccessLevel
    ? role
    : "";
}

async function resolveCanonicalCaller(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError("Your account is unavailable or inactive.");
  }

  const callerId = normalizeText(caller.id);
  const callerRole = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller.org_id);

  if (!callerId || !callerRole) {
    throw new RequestError(
      "You are not authorized to review client portal access."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      "Your account is not assigned to an organization."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    callerId,
    callerRole,
    organizationId,
  };
}

async function resolveAuthorizedClient(
  base44: any,
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
    normalizeText(client.org_id) !== organizationId
  ) {
    throw new RequestError(
      "The selected client was not found in your organization."
    );
  }

  if (callerRole === "admin") {
    return client;
  }

  const assignedStaffId = normalizeText(client.assigned_employee_id);

  if (!assignedStaffId) {
    throw new RequestError(
      "This client must be assigned to a staff member before portal access can be reviewed."
    );
  }

  const assignedStaff = await base44.asServiceRole.entities.User.get(
    assignedStaffId
  ).catch(() => null);

  if (
    !assignedStaff ||
    !isActive(assignedStaff) ||
    normalizeText(assignedStaff.id) !== assignedStaffId ||
    normalizeText(assignedStaff.org_id) !== organizationId ||
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
      "You may only review portal access for clients assigned to you."
    );
  }

  const managerAssignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: callerId,
      employee_user_id: assignedStaffId,
    });

  const managesAssignedStaff = asArray(managerAssignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment.org_id) === organizationId &&
      normalizeText(assignment.manager_user_id) === callerId &&
      normalizeText(assignment.employee_user_id) === assignedStaffId
  );

  if (!managesAssignedStaff) {
    throw new RequestError(
      "You may only review portal access for clients assigned to an active direct-report staff member."
    );
  }

  return client;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return responseError(
      "This client portal-access request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = normalizeText(body?.clientId);

    if (!clientId) {
      return responseError(
        "A client must be selected before portal access can be reviewed."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return responseError(
        "Please sign in before reviewing client portal access.",
        401
      );
    }

    const {
      callerId,
      callerRole,
      organizationId,
    } = await resolveCanonicalCaller(base44, authenticatedUser.id);

    const client = await resolveAuthorizedClient(
      base44,
      callerId,
      callerRole,
      organizationId,
      clientId
    );

    const clientEmail = normalizeEmail(client.email);

    if (!clientEmail) {
      return Response.json({
        success: true,
        client_id: clientId,
        invitation: null,
        invitations: [],
        portal_user: null,
      });
    }

    const assignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email: clientEmail,
      });

    const invitations = asArray(assignments)
      .filter(
        (assignment: any) =>
          assignment?.is_archived !== true &&
          normalizeText(assignment.org_id) === organizationId &&
          normalizeText(assignment.client_id) === clientId &&
          normalizeEmail(assignment.email) === clientEmail &&
          normalizeText(assignment.access_level) === "client_portal" &&
          CLIENT_PORTAL_ROLES.has(
            normalizeText(assignment.role).toLowerCase()
          )
      )
      .sort(newestFirst)
      .map((assignment: any) => ({
        id: assignment.id,
        email: assignment.email,
        role: assignment.role,
        access_level: assignment.access_level,
        status: assignment.status,
        invited_by_name: assignment.invited_by_name || null,
        invited_at: assignment.invited_at || null,
        created_date: assignment.created_date || null,
      }));

    const primaryInvitation =
      invitations.find((item) => item.status === "accepted") ||
      invitations.find(
        (item) =>
          item.status === "pending" ||
          item.status === "invite_email_sent" ||
          item.status === "pending_email_failed"
      ) ||
      invitations[0] ||
      null;

    const organizationUsers =
      await base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
        email: clientEmail,
      });

    const portalCandidates = asArray(organizationUsers).filter(
      (user: any) =>
        isActive(user) &&
        normalizeText(user.org_id) === organizationId &&
        normalizeEmail(user.email) === clientEmail &&
        normalizeText(user.access_level) === "client_portal" &&
        CLIENT_PORTAL_ROLES.has(normalizeText(user.role).toLowerCase())
    );

    const portalUser =
      portalCandidates.find(
        (user: any) => normalizeText(user.linked_client_id) === clientId
      ) ||
      null;

    return Response.json({
      success: true,
      client_id: clientId,
      invitation: primaryInvitation,
      invitations,
      portal_user: portalUser
        ? {
            id: portalUser.id,
            email: portalUser.email,
            role: portalUser.role,
            access_level: portalUser.access_level,
            linked_client_id: portalUser.linked_client_id || null,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "[getClientPortalAccessStatus] Error:",
      error instanceof Error ? error.message : error
    );

    return responseError(
      error instanceof RequestError
        ? error.message
        : "Client portal access could not be reviewed. Please try again or contact your organization administrator.",
      error instanceof RequestError ? 403 : 500
    );
  }
});