import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);
const READABLE_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isPreEtsClientInOrganization(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function hasClientMembershipEvidence(
  client: any,
  userIds: Set<string>,
  userEmails: Set<string>
) {
  const candidates = [
    normalizeText(client?.assigned_employee_id),
    normalizeText(client?.created_by),
  ];

  return candidates.some(
    (value) => userIds.has(value) || userEmails.has(value)
  );
}

function getDescendantUserIds(rootUserId: string, organizationUsers: any[]) {
  const childrenByManagerId = new Map<string, string[]>();

  for (const user of organizationUsers) {
    const managerId = normalizeText(user?.manager_id);
    const userId = normalizeText(user?.id);

    if (!managerId || !userId) {
      continue;
    }

    const childIds = childrenByManagerId.get(managerId) || [];
    childIds.push(userId);
    childrenByManagerId.set(managerId, childIds);
  }

  const descendantIds = new Set<string>();
  const queue = [rootUserId];

  while (queue.length > 0) {
    const currentUserId = queue.shift() || "";
    const directReportIds = childrenByManagerId.get(currentUserId) || [];

    for (const directReportId of directReportIds) {
      if (descendantIds.has(directReportId)) {
        continue;
      }

      descendantIds.add(directReportId);
      queue.push(directReportId);
    }
  }

  return descendantIds;
}

function projectEntry(entry: any, client: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name: `${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim(),
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

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const requestedClientId = normalizeText(requestBody?.client_id);
    const requestedStatus = normalizeText(requestBody?.status).toLowerCase();

    if (
      requestedStatus &&
      requestedStatus !== "all" &&
      !READABLE_STATUSES.has(requestedStatus)
    ) {
      return Response.json(
        { error: "Invalid status filter." },
        { status: 400 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        {
          error:
            "Authenticated user record was not found or is inactive.",
        },
        { status: 403 }
      );
    }

    const callerId = normalizeText(caller.id);
    const callerRole = normalizeText(caller.role).toLowerCase();
    const organizationId = normalizeText(caller.org_id);

    if (!STAFF_ROLES.has(callerRole)) {
      return Response.json(
        {
          error:
            "You are not authorized to review Pre-ETS student time entries.",
        },
        { status: 403 }
      );
    }

    if (!callerId || !organizationId) {
      return Response.json(
        {
          error:
            "Your account is not assigned to an organization.",
        },
        { status: 403 }
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        {
          error:
            "Your organization assignment is invalid or inactive.",
        },
        { status: 403 }
      );
    }

    const [
      organizationUsers,
      organizationClients,
      allTimeEntries,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.Client.filter(
        { org_id: organizationId },
        "-created_date"
      ),
      base44.asServiceRole.entities.PreEtsClientTimeEntry.list(
        "-created_date"
      ),
    ]);

    const activeOrganizationUsers = asArray(organizationUsers).filter(
      (user: any) =>
        isActive(user) &&
        normalizeText(user?.org_id) === organizationId
    );

    const activeOrganizationUserIds = new Set(
      activeOrganizationUsers
        .map((user: any) => normalizeText(user?.id))
        .filter(Boolean)
    );

    if (!activeOrganizationUserIds.has(callerId)) {
      return Response.json(
        {
          error:
            "Your account is not validly scoped to this organization.",
        },
        { status: 403 }
      );
    }

    const preEtsClients = asArray(organizationClients).filter((client: any) =>
      isPreEtsClientInOrganization(client, organizationId)
    );

    let visibleClients: any[] = [];

    if (callerRole === "admin") {
      visibleClients = preEtsClients;
    } else if (callerRole === "management") {
      const visibleUserIds = new Set<string>([
        callerId,
        ...getDescendantUserIds(callerId, activeOrganizationUsers),
      ]);

      const visibleUserEmails = new Set(
        activeOrganizationUsers
          .filter((user: any) =>
            visibleUserIds.has(normalizeText(user?.id))
          )
          .map((user: any) => normalizeText(user?.email))
          .filter(Boolean)
      );

      visibleClients = preEtsClients.filter((client: any) =>
        hasClientMembershipEvidence(
          client,
          visibleUserIds,
          visibleUserEmails
        )
      );
    } else {
      const ownUserIds = new Set([callerId]);
      const ownUserEmails = new Set(
        [normalizeText(caller.email)].filter(Boolean)
      );

      visibleClients = preEtsClients.filter((client: any) =>
        hasClientMembershipEvidence(
          client,
          ownUserIds,
          ownUserEmails
        )
      );
    }

    const visibleClientById = new Map(
      visibleClients.map((client: any) => [
        normalizeText(client?.id),
        client,
      ])
    );

    if (
      requestedClientId &&
      !visibleClientById.has(requestedClientId)
    ) {
      return Response.json(
        { error: "Pre-ETS client not found." },
        { status: 404 }
      );
    }

    const selectedClientIds = requestedClientId
      ? new Set([requestedClientId])
      : new Set(visibleClientById.keys());

    let legacyEntriesPendingOrgBackfill = 0;

    const entries = asArray(allTimeEntries)
      .filter((entry: any) => {
        if (!isActive(entry)) {
          return false;
        }

        const clientId = normalizeText(entry?.client_id);
        const entryOrganizationId = normalizeText(entry?.org_id);
        const entryStatus =
          normalizeText(entry?.status).toLowerCase() || "pending";

        if (!selectedClientIds.has(clientId)) {
          return false;
        }

        if (
          entryOrganizationId &&
          entryOrganizationId !== organizationId
        ) {
          return false;
        }

        if (
          requestedStatus &&
          requestedStatus !== "all" &&
          entryStatus !== requestedStatus
        ) {
          return false;
        }

        if (!entryOrganizationId) {
          legacyEntriesPendingOrgBackfill += 1;
        }

        return true;
      })
      .map((entry: any) =>
        projectEntry(
          entry,
          visibleClientById.get(normalizeText(entry?.client_id))
        )
      );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      visible_client_ids: Array.from(selectedClientIds),
      entries,
      entry_count: entries.length,
      legacy_entries_pending_org_backfill:
        legacyEntriesPendingOrgBackfill,
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedPreEtsTimeEntries error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to load authorized Pre-ETS time entries.",
      },
      { status: 500 }
    );
  }
});
