import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

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

function isStudentPortalUser(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "pre_ets" &&
    normalizeText(user?.access_level).toLowerCase() === "client_portal"
  );
}

function projectEntry(entry: any) {
  return {
    id: normalizeText(entry?.id),
    date: normalizeText(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: Number(entry?.duration_minutes) || 0,
    description: normalizeText(entry?.description),
    status: normalizeText(entry?.status) || "pending",
    rejection_reason: normalizeText(entry?.rejection_reason),
    resubmitted_at: normalizeText(entry?.resubmitted_at),
    created_date: normalizeText(entry?.created_date),
    updated_date: normalizeText(entry?.updated_date),
  };
}

async function resolveStudentContext(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account could not be verified as active.");
  }

  if (!isStudentPortalUser(caller)) {
    throw new RequestError(
      403,
      "Only an authorized Pre-ETS student may view these time entries."
    );
  }

  const clientId = normalizeText(caller.linked_client_id);
  const organizationId = normalizeText(caller.org_id);

  if (!clientId || !organizationId) {
    throw new RequestError(
      403,
      "Your Pre-ETS student account is missing its required organization or client assignment."
    );
  }

  const [organization, client] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId).catch(
      () => null
    ),
    base44.asServiceRole.entities.Client.get(clientId).catch(() => null),
  ]);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  if (
    !client ||
    !isActive(client) ||
    normalizeText(client.org_id) !== organizationId ||
    normalizeText(client.client_type).toLowerCase() !== "pre_ets"
  ) {
    throw new RequestError(
      403,
      "Your Pre-ETS student record is unavailable or is not assigned to your organization."
    );
  }

  return { client, clientId, organizationId };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This request must use POST." },
        { status: 405 }
      );
    }

    // This route does not accept browser-defined client or organization scope.
    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before viewing Pre-ETS time entries.",
        },
        { status: 401 }
      );
    }

    const { client, clientId, organizationId } = await resolveStudentContext(
      base44,
      authenticatedUser.id
    );

    const records =
      await base44.asServiceRole.entities.PreEtsClientTimeEntry.filter(
        { client_id: clientId, org_id: organizationId },
        "-created_date"
      );

    const entries = asArray(records)
      .filter(
        (entry: any) =>
          isActive(entry) &&
          normalizeText(entry?.client_id) === clientId &&
          normalizeText(entry?.org_id) === organizationId
      )
      .map(projectEntry)
      .sort((left: any, right: any) => {
        const leftKey = `${left.date}T${left.start_time}`;
        const rightKey = `${right.date}T${right.start_time}`;
        return rightKey.localeCompare(leftKey);
      });

    const clientName = `${normalizeText(client.first_name)} ${normalizeText(
      client.last_name
    )}`.trim();

    return Response.json({
      ok: true,
      organization_id: organizationId,
      client: {
        id: clientId,
        name: clientName || "Pre-ETS student",
      },
      entries,
      entry_count: entries.length,
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "Your Pre-ETS time entries could not be loaded.";

    if (!(error instanceof RequestError)) {
      console.error(
        "getAuthorizedPreEtsStudentTimeEntries error:",
        error?.message || error
      );
    }

    return Response.json({ ok: false, error: message }, { status });
  }
});
