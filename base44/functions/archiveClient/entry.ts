import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const CLIENT_PORTAL_ROLES = new Set(["client", "pre_ets", "dspd"]);

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

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
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

function getExpectedClientPortalRole(client: any) {
  const clientType = normalizeText(client?.client_type).toLowerCase();

  if (clientType === "pre_ets") {
    return "pre_ets";
  }

  if (clientType === "dspd") {
    return "dspd";
  }

  return "client";
}

function getCallerDisplayName(caller: any) {
  return (
    normalizeText(caller?.full_name) ||
    normalizeEmail(caller?.email) ||
    "an authorized staff member"
  );
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

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const profile = getStaffProfile(caller);

  if (!callerId || !profile) {
    throw new RequestError(
      403,
      "You are not authorized to archive clients."
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

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId,
    organizationId,
    role: profile.role,
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

  if (!client || normalizeText(client?.org_id) !== organizationId) {
    throw new RequestError(
      404,
      "The selected client was not found in your organization."
    );
  }

  if (callerRole === "admin") {
    return client;
  }

  const assignedEmployeeValue = normalizeText(
    client?.assigned_employee_id
  );

  if (!assignedEmployeeValue) {
    throw new RequestError(
      403,
      "This client must be assigned to a staff member before it can be archived."
    );
  }

  const organizationUsers =
    await base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    });

  const assignedStaff = asArray(organizationUsers).find(
    (user: any) =>
      isActiveRecord(user) &&
      normalizeText(user?.org_id) === organizationId &&
      (
        normalizeText(user?.id) === assignedEmployeeValue ||
        normalizeEmail(user?.email) ===
          normalizeEmail(assignedEmployeeValue)
      )
  );

  if (!assignedStaff?.id) {
    throw new RequestError(
      403,
      "The client is assigned to a staff member who is no longer active in this organization."
    );
  }

  const assignedStaffId = normalizeText(assignedStaff.id);

  if (callerId === assignedStaffId) {
    return client;
  }

  if (callerRole !== "management") {
    throw new RequestError(
      403,
      "You may only archive clients assigned to you."
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
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.manager_user_id) === callerId &&
      normalizeText(assignment?.employee_user_id) === assignedStaffId
  );

  if (!managesAssignedStaff) {
    throw new RequestError(
      403,
      "You may only archive clients assigned to an active direct-report staff member."
    );
  }

  return client;
}

async function loadClientPortalTargets(
  base44: any,
  organizationId: string,
  client: any
) {
  const clientId = normalizeText(client?.id);
  const clientEmail = normalizeEmail(client?.email);
  const expectedRole = getExpectedClientPortalRole(client);

  const [pendingAssignments, linkedUsers] = await Promise.all([
    base44.asServiceRole.entities.PendingRoleAssignment.filter({
      client_id: clientId,
    }),
    base44.asServiceRole.entities.User.filter({
      linked_client_id: clientId,
    }),
  ]);

  const assignmentsToRevoke = asArray(pendingAssignments).filter(
    (assignment: any) =>
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.client_id) === clientId &&
      normalizeEmail(assignment?.email) === clientEmail &&
      normalizeText(assignment?.role).toLowerCase() === expectedRole &&
      normalizeText(assignment?.access_level).toLowerCase() ===
        "client_portal" &&
      normalizeText(assignment?.status).toLowerCase() !== "revoked"
  );

  const portalUsers = asArray(linkedUsers).filter(
    (user: any) =>
      normalizeText(user?.org_id) === organizationId &&
      normalizeText(user?.linked_client_id) === clientId &&
      normalizeEmail(user?.email) === clientEmail &&
      normalizeText(user?.role).toLowerCase() === expectedRole &&
      normalizeText(user?.access_level).toLowerCase() ===
        "client_portal"
  );

  if (portalUsers.length > 1) {
    throw new RequestError(
      409,
      "More than one active portal account is linked to this client. Archive processing requires administrator review before continuing."
    );
  }

  return {
    assignmentsToRevoke,
    portalUser: portalUsers[0] || null,
  };
}

async function recordArchiveActivity(
  base44: any,
  organizationId: string,
  clientId: string,
  caller: any,
  invitationCount: number,
  portalAccountRemoved: boolean
) {
  try {
    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: clientId,
      activity_type: "status_changed",
      title: "Client archived",
      description:
        `Client archived by ${getCallerDisplayName(caller)}. ` +
        `Client portal invitations revoked: ${invitationCount}. ` +
        `Client portal account removed: ${portalAccountRemoved ? "yes" : "no"}.`,
    });
  } catch (error) {
    console.error(
      "[archiveClient] Could not record archive activity:",
      error instanceof Error ? error.message : error
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure(
      "This client archive request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = normalizeText(body?.client_id);

    if (!clientId) {
      return failure(
        "A client must be selected before it can be archived."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before archiving a client.",
        401
      );
    }

    const {
      caller,
      callerId,
      organizationId,
      role,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const client = await resolveAuthorizedClient(
      base44,
      callerId,
      role,
      organizationId,
      clientId
    );

    const {
      assignmentsToRevoke,
      portalUser,
    } = await loadClientPortalTargets(
      base44,
      organizationId,
      client
    );

    const changedAssignments: Array<{
      id: string;
      previousStatus: string;
    }> = [];

    const portalUserSnapshot = portalUser
      ? {
          role: portalUser.role ?? null,
          access_level: portalUser.access_level ?? null,
          linked_client_id: portalUser.linked_client_id ?? null,
          org_id: portalUser.org_id ?? null,
        }
      : null;

    let portalUserChanged = false;

    try {
      for (const assignment of assignmentsToRevoke) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          assignment.id,
          { status: "revoked" }
        );

        changedAssignments.push({
          id: assignment.id,
          previousStatus:
            normalizeText(assignment?.status) || "pending",
        });
      }

      if (portalUser) {
        await base44.asServiceRole.entities.User.update(
          portalUser.id,
          {
            role: "user",
            access_level: null,
            linked_client_id: null,
            org_id: null,
          }
        );

        portalUserChanged = true;
      }

      await base44.asServiceRole.entities.Client.update(
        clientId,
        {
          is_archived: true,
          status: "inactive",
        }
      );
    } catch (writeError) {
      if (portalUserChanged && portalUserSnapshot) {
        await base44.asServiceRole.entities.User.update(
          portalUser.id,
          portalUserSnapshot
        ).catch((rollbackError: unknown) => {
          console.error(
            "[archiveClient] Could not restore portal account after a failed archive:",
            rollbackError instanceof Error
              ? rollbackError.message
              : rollbackError
          );
        });
      }

      for (const assignment of changedAssignments.reverse()) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          assignment.id,
          { status: assignment.previousStatus }
        ).catch((rollbackError: unknown) => {
          console.error(
            "[archiveClient] Could not restore invitation after a failed archive:",
            rollbackError instanceof Error
              ? rollbackError.message
              : rollbackError
          );
        });
      }

      throw writeError;
    }

    await recordArchiveActivity(
      base44,
      organizationId,
      clientId,
      caller,
      assignmentsToRevoke.length,
      Boolean(portalUser)
    );

    return Response.json({
      success: true,
      message: "Client archived and client portal access revoked.",
      client_id: clientId,
      already_archived: client?.is_archived === true,
      invitations_revoked: assignmentsToRevoke.length,
      portal_account_removed: Boolean(portalUser),
    });
  } catch (error) {
    const message =
      error instanceof RequestError
        ? error.message
        : "The client could not be archived. Please try again or contact your organization administrator.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[archiveClient] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return failure(
      message,
      error instanceof RequestError ? error.status : 500
    );
  }
});
