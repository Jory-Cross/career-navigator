import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isActive(record) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalRole(record) {
  const role = normalizeText(record?.role).toLowerCase();
  const accessLevel = normalizeText(record?.access_level).toLowerCase();

  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function sortNewest(records) {
  return [...records].sort((left, right) => {
    const leftTime = new Date(
      left?.updated_date || left?.created_date || 0
    ).getTime();
    const rightTime = new Date(
      right?.updated_date || right?.created_date || 0
    ).getTime();

    return rightTime - leftTime;
  });
}

function clientMatchesVisibleStaff(client, visibleUserIds) {
  return visibleUserIds.has(normalizeText(client?.assigned_employee_id));
}

/**
 * Deliberately minimal list projection for Clients and Time Tracking.
 * Sensitive portal tokens, contact details, document URLs, authorization data,
 * assessments, notes, and other client-workspace fields are never returned by
 * this organization-list route.
 */
function projectClient(client) {
  return {
    id: normalizeText(client?.id),
    first_name: normalizeText(client?.first_name),
    last_name: normalizeText(client?.last_name),
    email: normalizeText(client?.email),
    status: normalizeText(client?.status) || "active",
    client_type: normalizeText(client?.client_type) || "job_seeker",
    target_role: normalizeText(client?.target_role),
    location: normalizeText(client?.location),
    assigned_employee_id: normalizeText(client?.assigned_employee_id) || null,
    is_archived: client?.is_archived === true,
    created_date: client?.created_date ?? null,
    updated_date: client?.updated_date ?? null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    // This route does not accept browser-defined authorization scope.
    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to view clients." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const callerRole = getCanonicalRole(caller);

    if (!callerRole) {
      return Response.json(
        { error: "Your account is not authorized to view organization clients." },
        { status: 403 }
      );
    }

    const organizationId = normalizeText(caller.org_id);

    if (!organizationId) {
      return Response.json(
        { error: "Your account is not assigned to an organization." },
        { status: 403 }
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        { error: "Your organization is inactive or unavailable." },
        { status: 403 }
      );
    }

    const [organizationUsers, organizationClients] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ org_id: organizationId }),
      base44.asServiceRole.entities.Client.filter({ org_id: organizationId }),
    ]);

    const activeCanonicalUsers = asArray(organizationUsers).filter(
      (member) =>
        isActive(member) &&
        normalizeText(member?.org_id) === organizationId &&
        Boolean(getCanonicalRole(member))
    );

    const scopedClients = sortNewest(
      asArray(organizationClients).filter(
        (client) => normalizeText(client?.org_id) === organizationId
      )
    );

    if (callerRole === "admin") {
      return Response.json({ clients: scopedClients.map(projectClient) });
    }

    const visibleUserIds = new Set([caller.id]);

    if (callerRole === "management") {
      const assignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        manager_user_id: caller.id,
      });
      const activeUsersById = new Map(
        activeCanonicalUsers.map((member) => [member.id, member])
      );

      for (const assignment of asArray(assignments)) {
        const employeeId = normalizeText(assignment?.employee_user_id);
        const employee = activeUsersById.get(employeeId);

        if (
          assignment?.is_active === true &&
          assignment?.is_archived !== true &&
          normalizeText(assignment?.org_id) === organizationId &&
          employee
        ) {
          visibleUserIds.add(employeeId);
        }
      }
    }

    const clients = scopedClients
      .filter((client) => clientMatchesVisibleStaff(client, visibleUserIds))
      .map(projectClient);

    return Response.json({ clients });
  } catch (error) {
    console.error("getClientsForUser error:", error?.message || error);

    return Response.json(
      { error: "Unable to load clients for your account." },
      { status: 500 }
    );
  }
});