import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

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

  if (!caller || !isActive(caller) || !isCanonicalAdministrator(caller)) {
    throw new RequestError(
      403,
      "Only an active organization administrator may review legacy Pre-ETS time-entry repair candidates."
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
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return { organizationId };
}

async function loadSafeLegacyCandidates(
  base44: any,
  organizationId: string
) {
  const [organizationClients, allEntries] = await Promise.all([
    base44.asServiceRole.entities.Client.filter({ org_id: organizationId }),
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

  const candidates = asArray(allEntries)
    .filter((entry: any) => {
      if (!isActive(entry) || normalizeText(entry?.org_id)) {
        return false;
      }

      return preEtsClientById.has(normalizeText(entry?.client_id));
    })
    .map((entry: any) =>
      projectCandidate(
        entry,
        preEtsClientById.get(normalizeText(entry?.client_id))
      )
    );

  return candidates;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This audit request must use POST." },
        { status: 405 }
      );
    }

    const requestBody: any = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action) || "audit";

    if (action !== "audit") {
      return Response.json(
        {
          ok: false,
          error:
            "This route is limited to a dry-run audit during security remediation. No records can be changed from this route.",
        },
        { status: 403 }
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

    const { organizationId } = await resolveAdminContext(
      base44,
      authenticatedUser.id
    );
    const candidates = await loadSafeLegacyCandidates(base44, organizationId);

    return Response.json({
      ok: true,
      action: "audit",
      organization_id: organizationId,
      candidate_count: candidates.length,
      candidates,
      apply_disabled: true,
      message:
        candidates.length === 0
          ? "No safely scoped legacy Pre-ETS time entries need organization repair."
          : `${candidates.length} safely scoped legacy Pre-ETS time entr${
              candidates.length === 1 ? "y requires" : "ies require"
            } review before any future repair.`,
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "The legacy Pre-ETS time-entry audit could not be completed.";

    if (!(error instanceof RequestError)) {
      console.error(
        "auditPreEtsLegacyTimeEntries error:",
        error?.message || error
      );
    }

    return Response.json({ ok: false, error: message }, { status });
  }
});
