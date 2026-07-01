import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActiveUser(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActiveManagerAssignment(record: any) {
  return record?.is_active === true && record?.is_archived !== true;
}

function resolveEntryOwnerId(entry: any, organizationUserIds: Set<string>) {
  const idCandidates = [
    entry?.employee_id,
    entry?.staff_id,
    entry?.user_id,
  ];

  for (const candidate of idCandidates) {
    const userId = normalizeText(candidate);

    if (userId && organizationUserIds.has(userId)) {
      return userId;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      allUsers,
      allOrganizations,
      allClients,
      allManagerAssignments,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.ManagerEmployeeAssignment.list(),
    ]);

    const caller = (Array.isArray(allUsers) ? allUsers : []).find(
      (record: any) => record.id === authenticatedUser.id
    );

    if (!caller || !isActiveUser(caller)) {
      return Response.json(
        { error: "Authenticated user record was not found or is inactive." },
        { status: 403 }
      );
    }

    const callerId = normalizeText(caller.id);
    const organizationId = normalizeText(caller.org_id);

    if (!callerId || !organizationId) {
      return Response.json(
        { error: "Your account is not assigned to an organization." },
        { status: 403 }
      );
    }

    const organization = (
      Array.isArray(allOrganizations) ? allOrganizations : []
    ).find((record: any) => record.id === organizationId);

    if (
      !organization ||
      organization.is_active === false ||
      organization.is_archived === true
    ) {
      return Response.json(
        { error: "Your organization assignment is invalid or inactive." },
        { status: 403 }
      );
    }

    const callerRole = normalizeText(caller.role).toLowerCase();
    const callerAccessLevel = normalizeText(caller.access_level).toLowerCase();

    const isOrganizationAdmin =
      callerRole === "admin" || callerAccessLevel === "admin";

    const isManagement =
      callerRole === "management" || callerAccessLevel === "management";

    const isEmployee = callerRole === "employee";

    if (!isOrganizationAdmin && !isManagement && !isEmployee) {
      return Response.json(
        { error: "You are not authorized to view staff Time Entries." },
        { status: 403 }
      );
    }

    const organizationUsers = (
      Array.isArray(allUsers) ? allUsers : []
    ).filter(
      (record: any) =>
        normalizeText(record.org_id) === organizationId &&
        isActiveUser(record)
    );

    const organizationUserIds = new Set(
      organizationUsers
        .map((record: any) => normalizeText(record.id))
        .filter(Boolean)
    );

    if (!organizationUserIds.has(callerId)) {
      return Response.json(
        { error: "Your account is not validly scoped to this organization." },
        { status: 403 }
      );
    }

    const organizationClientIds = new Set(
      (Array.isArray(allClients) ? allClients : [])
        .filter(
          (client: any) =>
            normalizeText(client?.org_id) === organizationId
        )
        .map((client: any) => normalizeText(client?.id))
        .filter(Boolean)
    );

    const allowedEmployeeIds = new Set<string>([callerId]);

    if (isOrganizationAdmin) {
      for (const userId of organizationUserIds) {
        allowedEmployeeIds.add(userId);
      }
    }

    if (isManagement) {
      for (const assignment of Array.isArray(allManagerAssignments)
        ? allManagerAssignments
        : []) {
        const assignmentOrganizationId = normalizeText(assignment?.org_id);
        const managerUserId = normalizeText(assignment?.manager_user_id);
        const employeeUserId = normalizeText(assignment?.employee_user_id);

        if (
          !isActiveManagerAssignment(assignment) ||
          assignmentOrganizationId !== organizationId ||
          managerUserId !== callerId ||
          !organizationUserIds.has(employeeUserId)
        ) {
          continue;
        }

        allowedEmployeeIds.add(employeeUserId);
      }
    }

    const allTimeEntries = await base44.asServiceRole.entities.TimeEntry.list(
      "-created_date"
    );

    const visibleEntries = (
      Array.isArray(allTimeEntries) ? allTimeEntries : []
    ).filter((entry: any) => {
      const entryOrganizationId = normalizeText(entry?.org_id);
      const clientId = normalizeText(entry?.client_id);

      if (entryOrganizationId !== organizationId) {
        return false;
      }

      if (clientId && !organizationClientIds.has(clientId)) {
        return false;
      }

      if (isOrganizationAdmin) {
        return true;
      }

      const ownerId = resolveEntryOwnerId(entry, organizationUserIds);

      return Boolean(ownerId && allowedEmployeeIds.has(ownerId));
    });

    return Response.json({
      ok: true,
      organization_id: organizationId,
      visible_employee_ids: Array.from(allowedEmployeeIds),
      entries: visibleEntries,
      entry_count: visibleEntries.length,
      legacy_entries_pending_org_backfill: 0,
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedTimeEntries error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to load authorized Time Entries.",
      },
      { status: 500 }
    );
  }
});
