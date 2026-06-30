import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function resolveEntryOwnerId(
  entry: any,
  orgUserIds: Set<string>,
  orgUserIdByEmail: Map<string, string>
) {
  const idCandidates = [
    entry?.employee_id,
    entry?.staff_id,
    entry?.user_id,
  ];

  for (const candidate of idCandidates) {
    const userId = normalizeText(candidate);

    if (userId && orgUserIds.has(userId)) {
      return userId;
    }
  }

  const emailCandidates = [
    entry?.created_by,
    entry?.created_by_email,
    entry?.employee_email,
    entry?.staff_email,
  ];

  for (const candidate of emailCandidates) {
    const email = normalizeEmail(candidate);
    const userId = orgUserIdByEmail.get(email);

    if (userId) {
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
      allTimeEntries,
      allManagerAssignments,
      allCohorts,
      allCohortMemberships,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.TimeEntry.list("-created_date"),
      base44.asServiceRole.entities.ManagerEmployeeAssignment.list(),
      base44.asServiceRole.entities.CETrainingCohort.list(),
      base44.asServiceRole.entities.CETrainingCohortMember.list(),
    ]);

    const caller = (Array.isArray(allUsers) ? allUsers : []).find(
      (record: any) => record.id === authenticatedUser.id
    );

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Authenticated user record was not found or is inactive." },
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

    const organization = (
      Array.isArray(allOrganizations) ? allOrganizations : []
    ).find((record: any) => record.id === organizationId);

    if (!organization || organization.is_active === false) {
      return Response.json(
        { error: "Your organization assignment is invalid or inactive." },
        { status: 403 }
      );
    }

    const isOrganizationAdmin =
      caller.role === "admin" || caller.access_level === "admin";

    const isManagement = caller.role === "management";
    const isEmployee = caller.role === "employee";
    const isCeInstructor = caller.role === "ce_instructor";

    if (
      !isOrganizationAdmin &&
      !isManagement &&
      !isEmployee &&
      !isCeInstructor
    ) {
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
        isActive(record)
    );

    const orgUserIds = new Set(
      organizationUsers
        .map((record: any) => normalizeText(record.id))
        .filter(Boolean)
    );

    if (!orgUserIds.has(caller.id)) {
      return Response.json(
        { error: "Your account is not validly scoped to this organization." },
        { status: 403 }
      );
    }

    const orgUserIdByEmail = new Map(
      organizationUsers
        .map((record: any) => [
          normalizeEmail(record.email),
          normalizeText(record.id),
        ])
        .filter(([email, userId]) => email && userId)
    );

    const clientsById = new Map(
      (Array.isArray(allClients) ? allClients : [])
        .filter(
          (client: any) =>
            normalizeText(client.org_id) === organizationId
        )
        .map((client: any) => [client.id, client])
    );

    const allowedAuthorIds = new Set<string>([caller.id]);

    if (isOrganizationAdmin) {
      for (const userId of orgUserIds) {
        allowedAuthorIds.add(userId);
      }
    }

    if (isManagement) {
      const directReportIds = new Set<string>();

      for (const assignment of Array.isArray(allManagerAssignments)
        ? allManagerAssignments
        : []) {
        if (
          assignment?.manager_user_id === caller.id &&
          assignment?.is_active !== false &&
          orgUserIds.has(normalizeText(assignment?.employee_user_id))
        ) {
          directReportIds.add(
            normalizeText(assignment.employee_user_id)
          );
        }
      }

      for (const organizationUser of organizationUsers) {
        if (
          organizationUser?.role === "employee" &&
          organizationUser?.manager_id === caller.id
        ) {
          directReportIds.add(organizationUser.id);
        }
      }

      for (const userId of directReportIds) {
        allowedAuthorIds.add(userId);
      }
    }

    const organizationCohortIds = new Set(
      (Array.isArray(allCohorts) ? allCohorts : [])
        .filter(
          (cohort: any) =>
            normalizeText(cohort.org_id) === organizationId
        )
        .map((cohort: any) => normalizeText(cohort.id))
        .filter(Boolean)
    );

    const activeOrganizationMemberships = (
      Array.isArray(allCohortMemberships)
        ? allCohortMemberships
        : []
    ).filter(
      (membership: any) =>
        membership?.is_active !== false &&
        normalizeText(membership.org_id) === organizationId &&
        organizationCohortIds.has(
          normalizeText(membership.cohort_id)
        ) &&
        orgUserIds.has(normalizeText(membership.user_id))
    );

    const managedCohortIds = new Set(
      activeOrganizationMemberships
        .filter(
          (membership: any) =>
            membership.user_id === caller.id &&
            normalizeText(membership.cohort_role) === "manager"
        )
        .map((membership: any) =>
          normalizeText(membership.cohort_id)
        )
        .filter(Boolean)
    );

    for (const membership of activeOrganizationMemberships) {
      if (managedCohortIds.has(normalizeText(membership.cohort_id))) {
        allowedAuthorIds.add(normalizeText(membership.user_id));
      }
    }

    const visibleEntries = (
      Array.isArray(allTimeEntries) ? allTimeEntries : []
    ).filter((entry: any) => {
      const entryOrganizationId = normalizeText(entry.org_id);
      const clientId = normalizeText(entry.client_id);

      const ownerId = resolveEntryOwnerId(
        entry,
        orgUserIds,
        orgUserIdByEmail
      );

      if (clientId) {
        const linkedClient = clientsById.get(clientId);

        if (!linkedClient) {
          return false;
        }

        if (
          entryOrganizationId &&
          entryOrganizationId !== organizationId
        ) {
          return false;
        }
      } else {
        const hasValidEntryOrganization =
          entryOrganizationId === organizationId;

        const isSafeLegacyClientlessEntry =
          !entryOrganizationId &&
          Boolean(ownerId) &&
          orgUserIds.has(ownerId);

        if (
          !hasValidEntryOrganization &&
          !isSafeLegacyClientlessEntry
        ) {
          return false;
        }
      }

      if (isOrganizationAdmin) {
        return true;
      }

      return Boolean(ownerId && allowedAuthorIds.has(ownerId));
    });

    const legacyEntriesPendingBackfill = visibleEntries.filter(
      (entry: any) => !normalizeText(entry.org_id)
    );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      visible_employee_ids: Array.from(allowedAuthorIds),
      entries: visibleEntries,
      entry_count: visibleEntries.length,
      legacy_entries_pending_org_backfill:
        legacyEntriesPendingBackfill.length,
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
