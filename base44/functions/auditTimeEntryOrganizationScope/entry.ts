import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function createSummary() {
  return {
    correctly_scoped: 0,
    unscoped_with_safe_owner_scope: 0,
    mismatched_or_invalid_scope: 0,
    missing_or_ambiguous_owner_scope: 0,
  };
}

function createSamples() {
  return {
    unscoped_with_safe_owner_scope: [] as any[],
    mismatched_or_invalid_scope: [] as any[],
    missing_or_ambiguous_owner_scope: [] as any[],
  };
}

function getLinkedScope(
  entry: any,
  usersById: Map<string, any>,
  clientsById: Map<string, any>,
  authorizationsById: Map<string, any>
) {
  const employeeId = normalizeText(entry?.employee_id);
  const clientId = normalizeText(entry?.client_id);
  const authorizationId = normalizeText(entry?.service_authorization_id);

  const employee = employeeId ? usersById.get(employeeId) || null : null;
  const client = clientId ? clientsById.get(clientId) || null : null;
  const authorization = authorizationId
    ? authorizationsById.get(authorizationId) || null
    : null;

  return {
    employee_id: employeeId || null,
    client_id: clientId || null,
    service_authorization_id: authorizationId || null,
    employee_org_id: normalizeText(employee?.org_id) || null,
    client_org_id: normalizeText(client?.org_id) || null,
    authorization_org_id: normalizeText(authorization?.org_id) || null,
    missing_employee: Boolean(employeeId) && !employee,
    missing_client: Boolean(clientId) && !client,
    missing_authorization: Boolean(authorizationId) && !authorization,
  };
}

function pushSample(samples: any[], sample: any) {
  if (samples.length < SAMPLE_LIMIT) samples.push(sample);
}

function classifyEntry(
  entry: any,
  usersById: Map<string, any>,
  clientsById: Map<string, any>,
  authorizationsById: Map<string, any>,
  validOrganizationIds: Set<string>,
  summary: ReturnType<typeof createSummary>,
  samples: ReturnType<typeof createSamples>
) {
  const currentOrganizationId = normalizeText(entry?.org_id);
  const linked = getLinkedScope(
    entry,
    usersById,
    clientsById,
    authorizationsById
  );
  const referencedScopes = [
    linked.employee_org_id,
    linked.client_org_id,
    linked.authorization_org_id,
  ].filter(Boolean);
  const uniqueReferencedScopes = [...new Set(referencedScopes)];
  const unresolvedReference =
    !linked.employee_id ||
    linked.missing_employee ||
    linked.missing_client ||
    linked.missing_authorization ||
    referencedScopes.some((organizationId) => !validOrganizationIds.has(organizationId));
  const sample = {
    id: normalizeText(entry?.id) || null,
    current_org_id: currentOrganizationId || null,
    proposed_org_id:
      uniqueReferencedScopes.length === 1 ? uniqueReferencedScopes[0] : null,
    ...linked,
  };

  if (
    currentOrganizationId &&
    validOrganizationIds.has(currentOrganizationId) &&
    !unresolvedReference &&
    uniqueReferencedScopes.length === 1 &&
    uniqueReferencedScopes[0] === currentOrganizationId
  ) {
    summary.correctly_scoped += 1;
    return;
  }

  if (
    !currentOrganizationId &&
    !unresolvedReference &&
    uniqueReferencedScopes.length === 1 &&
    validOrganizationIds.has(uniqueReferencedScopes[0])
  ) {
    summary.unscoped_with_safe_owner_scope += 1;
    pushSample(samples.unscoped_with_safe_owner_scope, sample);
    return;
  }

  if (
    currentOrganizationId &&
    (!validOrganizationIds.has(currentOrganizationId) ||
      uniqueReferencedScopes.some(
        (organizationId) => organizationId !== currentOrganizationId
      ))
  ) {
    summary.mismatched_or_invalid_scope += 1;
    pushSample(samples.mismatched_or_invalid_scope, sample);
    return;
  }

  summary.missing_or_ambiguous_owner_scope += 1;
  pushSample(samples.missing_or_ambiguous_owner_scope, sample);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to review TimeEntry data scope." },
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

    const platformAdmins = await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: caller.id,
    });
    const isPlatformOwner = platformAdmins.some(
      (record: any) =>
        isActive(record) &&
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          error:
            "Platform Owner access is required to review TimeEntry data scope.",
        },
        { status: 403 }
      );
    }

    const [organizations, users, clients, authorizations, timeEntries] =
      await Promise.all([
        base44.asServiceRole.entities.Organization.list(),
        base44.asServiceRole.entities.User.list("-created_date"),
        base44.asServiceRole.entities.Client.list("-created_date"),
        base44.asServiceRole.entities.ServiceAuthorization.list("-created_date"),
        base44.asServiceRole.entities.TimeEntry.list("-created_date"),
      ]);

    const validOrganizationIds = new Set(
      organizations
        .filter((organization: any) => isActive(organization))
        .map((organization: any) => normalizeText(organization?.id))
        .filter(Boolean)
    );
    const usersById = new Map(
      users
        .filter((user: any) => normalizeText(user?.id))
        .map((user: any) => [normalizeText(user.id), user])
    );
    const clientsById = new Map(
      clients
        .filter((client: any) => normalizeText(client?.id))
        .map((client: any) => [normalizeText(client.id), client])
    );
    const authorizationsById = new Map(
      authorizations
        .filter((authorization: any) => normalizeText(authorization?.id))
        .map((authorization: any) => [
          normalizeText(authorization.id),
          authorization,
        ])
    );
    const summary = createSummary();
    const samples = createSamples();

    for (const entry of timeEntries) {
      classifyEntry(
        entry,
        usersById,
        clientsById,
        authorizationsById,
        validOrganizationIds,
        summary,
        samples
      );
    }

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      instructions:
        "This audit does not change Time Entries. Do not backfill or repair any record until a separately reviewed mutation route and dry-run plan are approved.",
      records: {
        time_entries: {
          total: timeEntries.length,
          ...summary,
          samples,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "auditTimeEntryOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to review TimeEntry organization scope." },
      { status: 500 }
    );
  }
});