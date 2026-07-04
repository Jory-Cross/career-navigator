import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isCanonicalAdministrator(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "admin" &&
    normalizeText(user?.access_level).toLowerCase() === "admin"
  );
}

function isPreEtsClientInOrganization(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function projectCandidate(entry: any, client: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name: `${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim(),
    date: normalizeText(entry?.date),
    status: normalizeText(entry?.status) || "pending",
    created_date: normalizeText(entry?.created_date),
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
    const mode = normalizeText(requestBody?.mode) || "dry_run";

    if (mode !== "dry_run") {
      return Response.json(
        {
          error:
            "This backfill route is limited to a dry-run audit during security remediation. No records can be changed from this route.",
        },
        { status: 403 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to run this audit." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller) || !isCanonicalAdministrator(caller)) {
      return Response.json(
        {
          error:
            "Only an active organization administrator may review Pre-ETS time-entry repair candidates.",
        },
        { status: 403 }
      );
    }

    const organizationId = normalizeText(caller?.org_id);

    if (!organizationId) {
      return Response.json(
        { error: "Your administrator account is not assigned to an organization." },
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

    const [organizationClients, allEntries] = await Promise.all([
      base44.asServiceRole.entities.Client.filter(
        { org_id: organizationId },
        "-created_date"
      ),
      base44.asServiceRole.entities.PreEtsClientTimeEntry.list(
        "-created_date"
      ),
    ]);

    const preEtsClientById = new Map(
      asArray(organizationClients)
        .filter((client: any) =>
          isPreEtsClientInOrganization(client, organizationId)
        )
        .map((client: any) => [normalizeText(client?.id), client])
    );

    const candidates: Array<{ entry: any; client: any }> = [];
    let alreadyTaggedForThisOrganization = 0;
    let excludedForeignOrganization = 0;
    let excludedWithoutAuthorizedPreEtsClient = 0;

    for (const entry of asArray(allEntries)) {
      if (!isActive(entry)) {
        continue;
      }

      const entryOrganizationId = normalizeText(entry?.org_id);
      const clientId = normalizeText(entry?.client_id);
      const client = preEtsClientById.get(clientId);

      if (entryOrganizationId === organizationId) {
        alreadyTaggedForThisOrganization += 1;
        continue;
      }

      if (entryOrganizationId && entryOrganizationId !== organizationId) {
        excludedForeignOrganization += 1;
        continue;
      }

      if (!client) {
        excludedWithoutAuthorizedPreEtsClient += 1;
        continue;
      }

      candidates.push({ entry, client });
    }

    return Response.json({
      ok: true,
      mode: "dry_run",
      organization_id: organizationId,
      candidate_count: candidates.length,
      candidates: candidates.map(({ entry, client }) =>
        projectCandidate(entry, client)
      ),
      already_tagged_for_this_organization:
        alreadyTaggedForThisOrganization,
      excluded_foreign_organization: excludedForeignOrganization,
      excluded_without_authorized_pre_ets_client:
        excludedWithoutAuthorizedPreEtsClient,
      apply_disabled: true,
    });
  } catch (error: any) {
    console.error(
      "backfillPreEtsTimeEntryOrgIds error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to audit Pre-ETS time-entry repair candidates." },
      { status: 500 }
    );
  }
});
