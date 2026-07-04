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

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function failure(error: string, status = 400) {
  return Response.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

async function resolveCanonicalCaller(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(authenticatedUserId)
    .catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError("Your account is unavailable or inactive.");
  }

    const callerId = normalizeText(caller.id);
  const callerRole = normalizeText(caller.role).toLowerCase();
  const callerAccessLevel = normalizeText(
    caller.access_level
  ).toLowerCase();
  const organizationId = normalizeText(caller.org_id);

  const expectedAccessLevel =
    callerRole === "admin" ? "admin" : "staff";

  if (
    !callerId ||
    !STAFF_ROLES.has(callerRole) ||
    callerAccessLevel !== expectedAccessLevel
  ) {
    throw new RequestError(
      "You are not authorized to revoke client portal access."
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
    caller,
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
  const client = await base44.asServiceRole.entities.Client.get(clientId)
    .catch(() => null);

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

  const assignmentValue = normalizeText(client.assigned_employee_id);

  if (!assignmentValue) {
    throw new RequestError(
      "This client must be assigned to a staff member before portal access can be changed."
    );
  }

  const organizationUsers = await base44.asServiceRole.entities.User.filter({
    org_id: organizationId,
  });

  const assignedStaff = asArray(organizationUsers).find(
    (user: any) =>
      isActive(user) &&
      (
        normalizeText(user.id) === assignmentValue ||
        normalizeEmail(user.email) === normalizeEmail(assignmentValue)
      )
  );

  if (!assignedStaff?.id) {
    throw new RequestError(
      "The client is assigned to a staff member who is no longer active in this organization."
    );
  }

  const assignedStaffId = normalizeText(assignedStaff.id);

  if (callerId === assignedStaffId) {
    return client;
  }

  if (callerRole !== "management") {
    throw new RequestError(
      "You may only change portal access for clients assigned to you."
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
      "You may only change portal access for clients assigned to an active direct-report staff member."
    );
  }

  return client;
}

async function recordRevocationActivity(
  base44: any,
  organizationId: string,
  clientId: string,
  email: string,
  caller: any
) {
  try {
    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: clientId,
      activity_type: "portal_access_revoked",
      title: "Client portal access revoked",
      description: `Client portal access for ${email} was revoked by ${
        normalizeText(caller?.full_name) ||
        normalizeEmail(caller?.email) ||
        "an authorized staff member"
      }.`,
    });
  } catch (error) {
    console.error("[revokePortalUser] Could not record activity:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure("This portal-access revocation request must use POST.", 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = normalizeText(body?.clientId);
    const email = normalizeEmail(body?.email);

    if (!clientId) {
      return failure(
        "A client must be selected before portal access can be revoked."
      );
    }

    if (!email) {
      return failure(
        "A valid client email is required before portal access can be revoked."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before changing client portal access.",
        401
      );
    }

    const {
      caller,
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

    if (!clientEmail || clientEmail !== email) {
      return failure(
        "The supplied email does not match the email saved on the selected client record."
      );
    }

    const allAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email,
      });

    const assignmentsToRevoke = asArray(allAssignments).filter(
      (assignment: any) =>
        assignment?.is_archived !== true &&
        normalizeText(assignment.org_id) === organizationId &&
        normalizeText(assignment.client_id) === clientId &&
        normalizeEmail(assignment.email) === email &&
        normalizeText(assignment.access_level) === "client_portal" &&
        CLIENT_PORTAL_ROLES.has(
          normalizeText(assignment.role).toLowerCase()
        ) &&
        normalizeText(assignment.status).toLowerCase() !== "revoked"
    );

    const organizationUsers =
      await base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
        email,
      });

    const portalUser = asArray(organizationUsers).find(
      (user: any) =>
        normalizeText(user.org_id) === organizationId &&
        normalizeEmail(user.email) === email &&
        normalizeText(user.linked_client_id) === clientId &&
        normalizeText(user.access_level) === "client_portal" &&
        CLIENT_PORTAL_ROLES.has(normalizeText(user.role).toLowerCase())
    );

    if (!assignmentsToRevoke.length && !portalUser) {
      return failure(
        "No active client portal invitation or portal account was found for this client."
      );
    }

    const changedAssignments: Array<{ id: string; status: string }> = [];

    try {
      for (const assignment of assignmentsToRevoke) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          assignment.id,
          { status: "revoked" }
        );

        changedAssignments.push({
          id: assignment.id,
          status: normalizeText(assignment.status) || "pending",
        });
      }

      if (portalUser) {
        await base44.asServiceRole.entities.User.update(portalUser.id, {
          linked_client_id: null,
          access_level: null,
          role: "user",
        });
      }
    } catch (error) {
      for (const assignment of changedAssignments) {
        try {
          await base44.asServiceRole.entities.PendingRoleAssignment.update(
            assignment.id,
            { status: assignment.status }
          );
        } catch (restoreError) {
          console.error(
            "[revokePortalUser] Could not restore invitation after a failed revocation:",
            restoreError
          );
        }
      }

      throw error;
    }

    await recordRevocationActivity(
      base44,
      organizationId,
      clientId,
      email,
      caller
    );

    return Response.json({
      success: true,
      message: "Client portal access was revoked.",
      invitation_revoked: assignmentsToRevoke.length > 0,
      portal_account_removed: Boolean(portalUser),
    });
  } catch (error) {
    console.error(
      "[revokePortalUser] Error:",
      error instanceof Error ? error.message : error
    );

    return failure(
      error instanceof RequestError
        ? error.message
        : "Client portal access could not be revoked. Please try again or contact your organization administrator.",
      error instanceof RequestError ? 403 : 500
    );
  }
});
