import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const APPLY_CONFIRMATION = "BACKFILL_PRE_ETS_TIME_ENTRY_ORG_IDS";

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
    const mode = normalizeText(requestBody?.mode) || "dry_run";
    const confirmation = normalizeText(requestBody?.confirmation);

    if (mode !== "dry_run" && mode !== "apply") {
      return Response.json(
        { error: 'mode must be either "dry_run" or "apply".' },
        { status: 400 }
      );
    }

    if (mode === "apply" && confirmation !== APPLY_CONFIRMATION) {
      return Response.json(
        {
          error:
            "Explicit backfill confirmation is required before records can be changed.",
        },
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

    const callerRole = normalizeText(caller?.role).toLowerCase();
    const organizationId = normalizeText(caller?.org_id);

    if (callerRole !== "admin") {
      return Response.json(
        {
          error:
            "Only an active administrator may backfill Pre-ETS time-entry organization IDs.",
        },
        { status: 403 }
      );
    }

    if (!organizationId) {
      return Response.json(
        {
          error:
            "Your administrator account is not assigned to an organization.",
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

    if (mode === "dry_run") {
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
      });
    }

    const updatedEntryIds: string[] = [];
    const updateFailures: Array<{ id: string; error: string }> = [];

    for (const { entry } of candidates) {
      const entryId = normalizeText(entry?.id);

      try {
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(
          entryId,
          { org_id: organizationId }
        );

        updatedEntryIds.push(entryId);
      } catch (error: any) {
        updateFailures.push({
          id: entryId,
          error: error?.message || "Unable to update this entry.",
        });
      }
    }

    return Response.json({
      ok: true,
      mode: "apply",
      organization_id: organizationId,
      candidate_count: candidates.length,
      updated_count: updatedEntryIds.length,
      updated_entry_ids: updatedEntryIds,
      update_failures: updateFailures,
      already_tagged_for_this_organization:
        alreadyTaggedForThisOrganization,
      excluded_foreign_organization: excludedForeignOrganization,
      excluded_without_authorized_pre_ets_client:
        excludedWithoutAuthorizedPreEtsClient,
    });
  } catch (error: any) {
    console.error(
      "backfillPreEtsTimeEntryOrgIds error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to backfill Pre-ETS time-entry organization IDs.",
      },
      { status: 500 }
    );
  }
});
