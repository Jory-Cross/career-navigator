import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);
const SUPPORTED_ACTIONS = new Set([
  "create_student_entry",
  "resubmit_student_entry",
  "review_entry",
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

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function parseQuarterHour(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (minutes % 15 !== 0) {
    return null;
  }

  return hours * 60 + minutes;
}

function buildStudentEntryPayload(
  rawEntry: any,
  client: any,
  organizationId: string
) {
  const date = normalizeText(rawEntry?.date);
  const startTime = normalizeText(rawEntry?.start_time);
  const endTime = normalizeText(rawEntry?.end_time);
  const description = normalizeText(rawEntry?.description);

  if (!isValidIsoDate(date)) {
    throw new RequestError(
      400,
      "A valid service date is required."
    );
  }

  const startMinutes = parseQuarterHour(startTime);
  const endMinutes = parseQuarterHour(endTime);

  if (startMinutes === null || endMinutes === null) {
    throw new RequestError(
      400,
      "Start and end times must use 15-minute increments."
    );
  }

  if (endMinutes <= startMinutes) {
    throw new RequestError(
      400,
      "End time must be later than start time."
    );
  }

  return {
    client_id: normalizeText(client?.id),
    client_name: `${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim(),
    org_id: organizationId,
    date,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: endMinutes - startMinutes,
    description,
    source: "client_portal",
  };
}

function projectEntry(entry: any, client: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name:
      normalizeText(entry?.client_name) ||
      `${normalizeText(client?.first_name)} ${normalizeText(
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

async function resolveCallerContext(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(
      403,
      "Authenticated user record was not found or is inactive."
    );
  }

  const organizationId = normalizeText(caller?.org_id);

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
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
    caller,
    organizationId,
  };
}

async function resolveStudentClient(
  base44: any,
  caller: any,
  organizationId: string
) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const callerAccessLevel = normalizeText(
    caller?.access_level
  ).toLowerCase();
  const linkedClientId = normalizeText(caller?.linked_client_id);

  if (
    callerRole !== "pre_ets" ||
    callerAccessLevel !== "client_portal"
  ) {
    throw new RequestError(
      403,
      "You are not authorized to submit Pre-ETS student time entries."
    );
  }

  if (!linkedClientId) {
    throw new RequestError(
      403,
      "Your account is not linked to an active Pre-ETS student record."
    );
  }

  const client = await base44.asServiceRole.entities.Client.get(
    linkedClientId
  ).catch(() => null);

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(
      403,
      "Your Pre-ETS student record is unavailable or no longer active."
    );
  }

  return client;
}

async function resolveStaffClient(
  base44: any,
  caller: any,
  organizationId: string,
  clientId: string
) {
  const callerId = normalizeText(caller?.id);
  const callerRole = normalizeText(caller?.role).toLowerCase();

  if (!STAFF_ROLES.has(callerRole)) {
    throw new RequestError(
      403,
      "You are not authorized to review Pre-ETS student time entries."
    );
  }

  const client = await base44.asServiceRole.entities.Client.get(
    clientId
  ).catch(() => null);

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(404, "Pre-ETS client not found.");
  }

  if (callerRole === "admin") {
    return client;
  }

  const organizationUsers = await base44.asServiceRole.entities.User.filter({
    org_id: organizationId,
  });

  const activeOrganizationUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId
  );

  const callerIsValidlyScoped = activeOrganizationUsers.some(
    (user: any) => normalizeText(user?.id) === callerId
  );

  if (!callerIsValidlyScoped) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  if (callerRole === "management") {
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

    if (
      hasClientMembershipEvidence(
        client,
        visibleUserIds,
        visibleUserEmails
      )
    ) {
      return client;
    }
  } else {
    const ownUserIds = new Set([callerId]);
    const ownUserEmails = new Set(
      [normalizeText(caller?.email)].filter(Boolean)
    );

    if (
      hasClientMembershipEvidence(
        client,
        ownUserIds,
        ownUserEmails
      )
    ) {
      return client;
    }
  }

  throw new RequestError(404, "Pre-ETS client not found.");
}

async function resolveStaffEntry(
  base44: any,
  caller: any,
  organizationId: string,
  entryId: string
) {
  if (!entryId) {
    throw new RequestError(400, "entry_id is required.");
  }

  const entry =
    await base44.asServiceRole.entities.PreEtsClientTimeEntry.get(
      entryId
    ).catch(() => null);

  if (
    !entry ||
    !isActive(entry) ||
    normalizeText(entry?.org_id) !== organizationId
  ) {
    throw new RequestError(404, "Pre-ETS time entry not found.");
  }

  const clientId = normalizeText(entry?.client_id);

  if (!clientId) {
    throw new RequestError(404, "Pre-ETS time entry not found.");
  }

  const client = await resolveStaffClient(
    base44,
    caller,
    organizationId,
    clientId
  );

  return {
    entry,
    client,
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
    const action = normalizeText(requestBody?.action);

    if (!SUPPORTED_ACTIONS.has(action)) {
      return Response.json(
        { error: "Unsupported action." },
        { status: 400 }
      );
    }

    const { caller, organizationId } = await resolveCallerContext(
      base44,
      authenticatedUser.id
    );

    if (action === "create_student_entry") {
      const client = await resolveStudentClient(
        base44,
        caller,
        organizationId
      );

      const payload = buildStudentEntryPayload(
        requestBody?.entry,
        client,
        organizationId
      );

      const created =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.create({
          ...payload,
          status: "pending",
        });

      return Response.json({
        ok: true,
        action,
        entry: projectEntry(created, client),
      });
    }

    if (action === "resubmit_student_entry") {
      const client = await resolveStudentClient(
        base44,
        caller,
        organizationId
      );
      const entryId = normalizeText(requestBody?.entry_id);

      if (!entryId) {
        throw new RequestError(400, "entry_id is required.");
      }

      const existingEntry =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.get(
          entryId
        ).catch(() => null);

      if (
        !existingEntry ||
        !isActive(existingEntry) ||
        normalizeText(existingEntry?.org_id) !== organizationId ||
        normalizeText(existingEntry?.client_id) !==
          normalizeText(client?.id)
      ) {
        throw new RequestError(404, "Pre-ETS time entry not found.");
      }

      if (
        (normalizeText(existingEntry?.status) || "pending").toLowerCase() !==
        "rejected"
      ) {
        throw new RequestError(
          409,
          "Only rejected Pre-ETS time entries may be corrected and resubmitted."
        );
      }

      const payload = buildStudentEntryPayload(
        requestBody?.entry,
        client,
        organizationId
      );

           const updated =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(
          entryId,
          {
            ...payload,
            status: "pending",
            approved_by: "",
            approved_at: null,
            rejected_by: "",
            rejected_at: "",
            rejection_reason: "",
            resubmitted_at: new Date().toISOString(),
          }
        );

      return Response.json({
        ok: true,
        action,
        entry: projectEntry(updated, client),
      });
    }

    const decision = normalizeText(requestBody?.decision).toLowerCase();
    const entryId = normalizeText(requestBody?.entry_id);

    if (decision !== "approve" && decision !== "reject") {
      throw new RequestError(
        400,
        'decision must be either "approve" or "reject".'
      );
    }

    const { entry, client } = await resolveStaffEntry(
      base44,
      caller,
      organizationId,
      entryId
    );

    const currentStatus =
      normalizeText(entry?.status).toLowerCase() || "pending";

    if (currentStatus !== "pending") {
      throw new RequestError(
        409,
        "Only pending Pre-ETS time entries may be reviewed."
      );
    }

    const now = new Date().toISOString();
    const callerId = normalizeText(caller?.id);

    if (decision === "approve") {
      const updated =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(
          entryId,
          {
            status: "approved",
            approved_by: callerId,
            approved_at: now,
            rejected_by: "",
            rejected_at: "",
            rejection_reason: "",
          }
        );

      return Response.json({
        ok: true,
        action,
        decision,
        entry: projectEntry(updated, client),
      });
    }

    const rejectionReason = normalizeText(requestBody?.rejection_reason);

    if (!rejectionReason) {
      throw new RequestError(
        400,
        "A rejection reason is required."
      );
    }

    const updated =
      await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(
        entryId,
        {
          status: "rejected",
          approved_by: "",
          approved_at: null,
          rejected_by: callerId,
          rejected_at: now,
          rejection_reason: rejectionReason.slice(0, 4000),
        }
      );

    return Response.json({
      ok: true,
      action,
      decision,
      entry: projectEntry(updated, client),
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to process the Pre-ETS time-entry request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsTimeEntry error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
