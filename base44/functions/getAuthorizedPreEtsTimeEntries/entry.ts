import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const READABLE_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
]);

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

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function isPreEtsClientInOrganization(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function clientMatchesVisibleStaff(
  client: any,
  visibleUserIds: Set<string>,
  visibleEmails: Set<string>
) {
  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  const createdBy = normalizeEmail(client?.created_by);

  return (
    visibleUserIds.has(assignedEmployeeId) ||
    (createdBy && visibleEmails.has(createdBy))
  );
}

function projectEntry(entry: any, client: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name:
      `${normalizeText(client?.first_name)} ${normalizeText(
        client?.last_name
      )}`.trim() || "Unnamed student",
    date: normalizeText(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: Number(entry?.duration_minutes) || 0,
    description: normalizeText(entry?.description),
    source: normalizeText(entry?.source) || "client_portal",
    status: normalizeText(entry?.status) || "pending",
    approved_by: normalizeText(entry?.approved_by),
    approved_at: normalizeText(entry?.approved_at),
    rejected_by: normalizeText(entry?.rejected_by),
    rejected_at: normalizeText(entry?.rejected_at),
    rejection_reason: normalizeText(entry?.rejection_reason),
    resubmitted_at: normalizeText(entry?.resubmitted_at),
    created_date: normalizeText(entry?.created_date),
    updated_date: normalizeText(entry?.updated_date),
  };
}

function projectClientOption(client: any) {
  const name = `${normalizeText(client?.first_name)} ${normalizeText(
    client?.last_name
  )}`.trim();

  return {
    id: normalizeText(client?.id),
    name: name || "Unnamed student",
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

    const requestBody: any = await req.json().catch(() => ({}));
    const requestedClientId = normalizeText(requestBody?.client_id);
    const requestedStatus = normalizeText(requestBody?.status).toLowerCase();

    if (
      requestedStatus &&
      requestedStatus !== "all" &&
      !READABLE_STATUSES.has(requestedStatus)
    ) {
      return Response.json(
        { error: "Choose a valid Pre-ETS time-entry status filter." },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to review Pre-ETS student time entries." },
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

    const callerRole = getCanonicalStaffRole(caller);
    const callerId = normalizeText(caller.id);
    const organizationId = normalizeText(caller.org_id);

    if (!callerRole) {
      return Response.json(
        {
          error:
            "Your account is not authorized to review Pre-ETS student time entries.",
        },
        { status: 403 }
      );
    }

    if (!callerId || !organizationId) {
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

    const [organizationUsers, organizationClients, organizationTimeEntries] =
      await Promise.all([
        base44.asServiceRole.entities.User.filter({ org_id: organizationId }),
        base44.asServiceRole.entities.Client.filter(
          { org_id: organizationId },
          "-created_date"
        ),
        base44.asServiceRole.entities.PreEtsClientTimeEntry.filter(
          { org_id: organizationId },
          "-created_date"
        ),
      ]);

    const activeCanonicalUsers = asArray(organizationUsers).filter(
      (user: any) =>
        isActive(user) &&
        normalizeText(user?.org_id) === organizationId &&
        Boolean(getCanonicalStaffRole(user))
    );

    const callerIsInOrganization = activeCanonicalUsers.some(
      (user: any) => normalizeText(user?.id) === callerId
    );

    if (!callerIsInOrganization) {
      return Response.json(
        { error: "Your account is not validly scoped to this organization." },
        { status: 403 }
      );
    }

    const preEtsClients = asArray(organizationClients).filter((client: any) =>
      isPreEtsClientInOrganization(client, organizationId)
    );

    let visibleClients: any[];

    if (callerRole === "admin") {
      visibleClients = preEtsClients;
    } else {
      const visibleUserIds = new Set<string>([callerId]);
      const visibleEmails = new Set<string>(
        [normalizeEmail(caller.email)].filter(Boolean)
      );

      if (callerRole === "management") {
        const assignments =
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
            manager_user_id: callerId,
          });
        const activeUsersById = new Map(
          activeCanonicalUsers.map((user: any) => [
            normalizeText(user?.id),
            user,
          ])
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
            const employeeEmail = normalizeEmail(employee.email);
            if (employeeEmail) {
              visibleEmails.add(employeeEmail);
            }
          }
        }
      }

      visibleClients = preEtsClients.filter((client: any) =>
        clientMatchesVisibleStaff(client, visibleUserIds, visibleEmails)
      );
    }

    const visibleClientById = new Map(
      visibleClients.map((client: any) => [normalizeText(client?.id), client])
    );

    if (requestedClientId && !visibleClientById.has(requestedClientId)) {
      return Response.json(
        { error: "The requested Pre-ETS client is unavailable to your account." },
        { status: 404 }
      );
    }

    const selectedClientIds = requestedClientId
      ? new Set([requestedClientId])
      : new Set(visibleClientById.keys());

    const entries = asArray(organizationTimeEntries)
      .filter((entry: any) => {
        if (
          !isActive(entry) ||
          normalizeText(entry?.org_id) !== organizationId
        ) {
          return false;
        }

        const clientId = normalizeText(entry?.client_id);
        const entryStatus =
          normalizeText(entry?.status).toLowerCase() || "pending";

        if (!selectedClientIds.has(clientId)) {
          return false;
        }

        if (
          requestedStatus &&
          requestedStatus !== "all" &&
          entryStatus !== requestedStatus
        ) {
          return false;
        }

        return true;
      })
      .map((entry: any) =>
        projectEntry(
          entry,
          visibleClientById.get(normalizeText(entry?.client_id))
        )
      );

    const clients = Array.from(selectedClientIds)
      .map((clientId) => visibleClientById.get(clientId))
      .filter(Boolean)
      .map(projectClientOption)
      .sort((left: any, right: any) =>
        normalizeText(left?.name).localeCompare(normalizeText(right?.name))
      );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      visible_client_ids: Array.from(selectedClientIds),
      clients,
      client_count: clients.length,
      entries,
      entry_count: entries.length,
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedPreEtsTimeEntries error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to load authorized Pre-ETS time entries." },
      { status: 500 }
    );
  }
});
