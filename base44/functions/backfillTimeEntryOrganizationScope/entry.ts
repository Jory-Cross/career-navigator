import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function buildUserIndexes(allUsers: any[], validOrganizationIds: Set<string>) {
  const usersById = new Map<string, any>();
  const organizationIdsByEmail = new Map<string, Set<string>>();

  for (const user of allUsers) {
    const userId = normalizeText(user?.id);
    const organizationId = normalizeText(user?.org_id);
    const email = normalizeEmail(user?.email);

    if (!userId) continue;

    usersById.set(userId, user);

    if (!email || !validOrganizationIds.has(organizationId)) {
      continue;
    }

    if (!organizationIdsByEmail.has(email)) {
      organizationIdsByEmail.set(email, new Set<string>());
    }

    organizationIdsByEmail.get(email)?.add(organizationId);
  }

  return {
    usersById,
    organizationIdsByEmail,
  };
}

function resolveOwnerOrganization(
  entry: any,
  usersById: Map<string, any>,
  organizationIdsByEmail: Map<string, Set<string>>,
  validOrganizationIds: Set<string>
) {
  const userIdCandidates = [
    entry?.employee_id,
    entry?.staff_id,
    entry?.user_id,
    entry?.created_by_id,
  ]
    .map(normalizeText)
    .filter(Boolean);

  const ownerOrganizationIds = new Set<string>();

  for (const userId of userIdCandidates) {
    const user = usersById.get(userId);

    if (!user) {
      continue;
    }

    const organizationId = normalizeText(user.org_id);

    if (validOrganizationIds.has(organizationId)) {
      ownerOrganizationIds.add(organizationId);
    }
  }

  if (ownerOrganizationIds.size === 1) {
    return {
      organization_id: Array.from(ownerOrganizationIds)[0],
      source: "owner_user_id",
      issue: null,
    };
  }

  if (ownerOrganizationIds.size > 1) {
    return {
      organization_id: null,
      source: null,
      issue: "Entry owner references users from multiple organizations.",
    };
  }

  const emailCandidates = [
    entry?.created_by,
    entry?.created_by_email,
    entry?.employee_email,
    entry?.staff_email,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

  const emailOrganizationIds = new Set<string>();

  for (const email of emailCandidates) {
    const matches = organizationIdsByEmail.get(email);

    if (!matches) {
      continue;
    }

    for (const organizationId of matches) {
      emailOrganizationIds.add(organizationId);
    }
  }

  if (emailOrganizationIds.size === 1) {
    return {
      organization_id: Array.from(emailOrganizationIds)[0],
      source: "owner_email",
      issue: null,
    };
  }

  if (emailOrganizationIds.size > 1) {
    return {
      organization_id: null,
      source: null,
      issue:
        "Entry owner email resolves to multiple organizations.",
    };
  }

  return {
    organization_id: null,
    source: null,
    issue:
      "No valid organization could be resolved from the entry owner.",
  };
}

async function applyUpdates(entity: any, candidates: any[]) {
  const updated: string[] = [];
  const failed: Array<{
    id: string;
    error: string;
  }> = [];

  for (const candidate of candidates) {
    try {
      await entity.update(candidate.id, {
        org_id: candidate.resolved_org_id,
      });

      updated.push(candidate.id);
    } catch (error: any) {
      failed.push({
        id: candidate.id,
        error: error?.message || "Unknown update error",
      });
    }
  }

  return {
    updated,
    failed,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const apply = body.apply === true;

    const [
      platformAdminRecords,
      allOrganizations,
      allUsers,
      allClients,
      allTimeEntries,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformAdmin.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.TimeEntry.list("-created_date"),
    ]);

    const activePlatformOwner = (
      Array.isArray(platformAdminRecords)
        ? platformAdminRecords
        : []
    ).find(
      (record: any) =>
        record.user_id === authenticatedUser.id &&
        record.platform_role === PLATFORM_OWNER_ROLE &&
        record.is_active !== false
    );

    if (!activePlatformOwner) {
      return Response.json(
        {
          error:
            "Only an active Platform Owner can run TimeEntry organization repairs.",
        },
        { status: 403 }
      );
    }

    const validOrganizationIds = new Set(
      (Array.isArray(allOrganizations)
        ? allOrganizations
        : []
      )
        .filter(
          (organization: any) =>
            organization?.is_active !== false &&
            normalizeText(organization?.id)
        )
        .map((organization: any) =>
          normalizeText(organization.id)
        )
    );

    const clientsById = new Map(
      (Array.isArray(allClients) ? allClients : [])
        .filter((client: any) => normalizeText(client?.id))
        .map((client: any) => [client.id, client])
    );

    const {
      usersById,
      organizationIdsByEmail,
    } = buildUserIndexes(
      Array.isArray(allUsers) ? allUsers : [],
      validOrganizationIds
    );

    const candidates: any[] = [];
    const alreadyScoped: any[] = [];
    const conflicts: any[] = [];
    const unresolved: any[] = [];

    for (const entry of Array.isArray(allTimeEntries)
      ? allTimeEntries
      : []) {
      const entryId = normalizeText(entry?.id);

      if (!entryId) {
        continue;
      }

      const existingOrganizationId = normalizeText(entry.org_id);
      const clientId = normalizeText(entry.client_id);

      const ownerResolution = resolveOwnerOrganization(
        entry,
        usersById,
        organizationIdsByEmail,
        validOrganizationIds
      );

      let resolvedOrganizationId = "";
      let resolutionSource = "";
      let warning: string | null = null;

      if (clientId) {
        const linkedClient = clientsById.get(clientId);

        if (!linkedClient) {
          unresolved.push({
            id: entryId,
            reason: "Linked Client record was not found.",
            client_id: clientId,
          });
          continue;
        }

        const clientOrganizationId = normalizeText(
          linkedClient.org_id
        );

        if (!validOrganizationIds.has(clientOrganizationId)) {
          unresolved.push({
            id: entryId,
            reason:
              "Linked Client does not have a valid canonical organization.",
            client_id: clientId,
            client_org_id: clientOrganizationId || null,
          });
          continue;
        }

        if (
          ownerResolution.organization_id &&
          ownerResolution.organization_id !== clientOrganizationId
        ) {
          conflicts.push({
            id: entryId,
            reason:
              "Linked Client organization conflicts with entry owner organization.",
            client_id: clientId,
            client_org_id: clientOrganizationId,
            owner_org_id: ownerResolution.organization_id,
          });
          continue;
        }

        resolvedOrganizationId = clientOrganizationId;
        resolutionSource = "linked_client";

        if (ownerResolution.issue) {
          warning = ownerResolution.issue;
        }
      } else {
        if (!ownerResolution.organization_id) {
          unresolved.push({
            id: entryId,
            reason: ownerResolution.issue,
            client_id: null,
          });
          continue;
        }

        resolvedOrganizationId = ownerResolution.organization_id;
        resolutionSource = ownerResolution.source || "entry_owner";
      }

      if (existingOrganizationId) {
        if (!validOrganizationIds.has(existingOrganizationId)) {
          conflicts.push({
            id: entryId,
            reason:
              "Existing TimeEntry org_id is not a valid canonical Organization ID.",
            existing_org_id: existingOrganizationId,
            resolved_org_id: resolvedOrganizationId,
          });
          continue;
        }

        if (existingOrganizationId !== resolvedOrganizationId) {
          conflicts.push({
            id: entryId,
            reason:
              "Existing TimeEntry org_id conflicts with the deterministic organization resolution.",
            existing_org_id: existingOrganizationId,
            resolved_org_id: resolvedOrganizationId,
            resolution_source: resolutionSource,
          });
          continue;
        }

        alreadyScoped.push({
          id: entryId,
          org_id: existingOrganizationId,
          resolution_source: resolutionSource,
        });
        continue;
      }

      candidates.push({
        id: entryId,
        client_id: clientId || null,
        employee_id: normalizeText(entry.employee_id) || null,
        entry_type_code:
          normalizeText(entry.entry_type_code) || null,
        date: normalizeText(entry.date) || null,
        resolved_org_id: resolvedOrganizationId,
        resolution_source: resolutionSource,
        warning,
      });
    }

    const candidateCountsByOrganization: Record<string, number> = {};

    for (const candidate of candidates) {
      candidateCountsByOrganization[
        candidate.resolved_org_id
      ] =
        (candidateCountsByOrganization[
          candidate.resolved_org_id
        ] || 0) + 1;
    }

    const preview = {
      preview_only: !apply,
      summary: {
        total_time_entries: Array.isArray(allTimeEntries)
          ? allTimeEntries.length
          : 0,
        candidates_to_scope: candidates.length,
        already_scoped: alreadyScoped.length,
        conflicts: conflicts.length,
        unresolved: unresolved.length,
        candidates_by_organization: candidateCountsByOrganization,
      },
      candidates,
      already_scoped,
      conflicts,
      unresolved,
    };

    if (!apply) {
      return Response.json(preview);
    }

    if (conflicts.length > 0 || unresolved.length > 0) {
      return Response.json(
        {
          error:
            "Repair was not applied because unresolved or conflicting TimeEntry records require review.",
          ...preview,
        },
        { status: 409 }
      );
    }

    const repair = await applyUpdates(
      base44.asServiceRole.entities.TimeEntry,
      candidates
    );

    return Response.json({
      ...preview,
      preview_only: false,
      repair_complete: repair.failed.length === 0,
      repaired: {
        time_entries: repair.updated.length,
      },
      failed: {
        time_entries: repair.failed,
      },
    });
  } catch (error: any) {
    console.error(
      "backfillTimeEntryOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to backfill TimeEntry organization scope.",
      },
      { status: 500 }
    );
  }
});
