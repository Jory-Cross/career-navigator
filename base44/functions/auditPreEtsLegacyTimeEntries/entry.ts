import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const SUPPORTED_ACTIONS = new Set([
  "audit",
  "backfill",
]);

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isPreEtsClientInOrganization(
  client: any,
  organizationId: string
) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function projectCandidate(entry: any, client: any) {
  const clientName = `${normalizeText(client?.first_name)} ${normalizeText(
    client?.last_name
  )}`.trim();

  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name: clientName || "Unnamed student",
    date: normalizeText(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: Number(entry?.duration_minutes) || 0,
    status: normalizeText(entry?.status) || "pending",
    created_date: normalizeText(entry?.created_date),
  };
}

async function resolveAdminContext(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(
      403,
      "Your account could not be verified as active."
    );
  }

  if (normalizeText(caller?.role).toLowerCase() !== "admin") {
    throw new RequestError(
      403,
      "Only an organization administrator may audit or repair legacy Pre-ETS time entries."
    );
  }

  const organizationId = normalizeText(caller?.org_id);

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your administrator account is not assigned to an organization."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    organizationId,
  };
}

async function loadSafeLegacyCandidates(
  base44: any,
  organizationId: string
) {
  const [organizationClients, allEntries] = await Promise.all([
    base44.asServiceRole.entities.Client.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.PreEtsClientTimeEntry.list(
      "-created_date"
    ),
  ]);

  const preEtsClientById = new Map(
    asArray(organizationClients)
      .filter((client: any) =>
        isPreEtsClientInOrganization(client, organizationId)
      )
      .map((client: any) => [
        normalizeText(client?.id),
        client,
      ])
  );

  const candidates = asArray(allEntries)
    .filter((entry: any) => {
      if (!isActive(entry)) {
        return false;
      }

      if (normalizeText(entry?.org_id)) {
        return false;
      }

      return preEtsClientById.has(
        normalizeText(entry?.client_id)
      );
    })
    .map((entry: any) =>
      projectCandidate(
        entry,
        preEtsClientById.get(normalizeText(entry?.client_id))
      )
    );

  return {
    candidates,
    preEtsClientById,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This audit request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before auditing legacy Pre-ETS time entries.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action);

    if (!SUPPORTED_ACTIONS.has(action)) {
      throw new RequestError(
        400,
        'Choose either "audit" or "backfill".'
      );
    }

    const { organizationId } = await resolveAdminContext(
      base44,
      authenticatedUser.id
    );

    const {
      candidates,
      preEtsClientById,
    } = await loadSafeLegacyCandidates(
      base44,
      organizationId
    );

    if (action === "audit") {
      return Response.json({
        ok: true,
        action,
        organization_id: organizationId,
        candidate_count: candidates.length,
        candidates,
        message:
          candidates.length === 0
            ? "No safely scoped legacy Pre-ETS time entries need an organization backfill."
            : `${candidates.length} safely scoped legacy Pre-ETS time entr${candidates.length === 1 ? "y needs" : "ies need"} an organization backfill.`,
      });
    }

    const requestedEntryIds = new Set(
      asArray<string>(requestBody?.entry_ids)
        .map((entryId) => normalizeText(entryId))
        .filter(Boolean)
    );

    if (requestedEntryIds.size === 0) {
      throw new RequestError(
        400,
        "Select at least one audited legacy time entry before running the backfill."
      );
    }

    const candidateById = new Map(
      candidates.map((candidate: any) => [
        normalizeText(candidate?.id),
        candidate,
      ])
    );

    const invalidEntryIds = Array.from(requestedEntryIds).filter(
      (entryId) => !candidateById.has(entryId)
    );

    if (invalidEntryIds.length > 0) {
      throw new RequestError(
        400,
        "One or more selected entries are not currently safe legacy backfill candidates. Run the audit again and select only the returned entry IDs."
      );
    }

    const repairedEntries = [];

    for (const entryId of requestedEntryIds) {
      const candidate = candidateById.get(entryId);
      const client = preEtsClientById.get(
        normalizeText(candidate?.client_id)
      );

      if (!candidate || !client) {
        throw new RequestError(
          409,
          "A selected legacy entry could no longer be safely matched to an authorized Pre-ETS student."
        );
      }

      const currentEntry =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.get(
          entryId
        ).catch(() => null);

      if (
        !currentEntry ||
        !isActive(currentEntry) ||
        normalizeText(currentEntry?.org_id) ||
        normalizeText(currentEntry?.client_id) !==
          normalizeText(client?.id) ||
        !isPreEtsClientInOrganization(client, organizationId)
      ) {
        throw new RequestError(
          409,
          "A selected legacy entry changed before it could be safely repaired. Run the audit again before retrying."
        );
      }

      const repaired =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(
          entryId,
          {
            org_id: organizationId,
          }
        );

      repairedEntries.push(
        projectCandidate(repaired, client)
      );
    }

    return Response.json({
      ok: true,
      action,
      organization_id: organizationId,
      repaired_count: repairedEntries.length,
      repaired_entries: repairedEntries,
      message:
        repairedEntries.length === 1
          ? "The selected legacy Pre-ETS time entry was safely assigned to your organization."
          : `${repairedEntries.length} legacy Pre-ETS time entries were safely assigned to your organization.`,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "The legacy Pre-ETS time-entry audit could not be completed.";

    if (!(error instanceof RequestError)) {
      console.error(
        "auditPreEtsLegacyTimeEntries error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
});
