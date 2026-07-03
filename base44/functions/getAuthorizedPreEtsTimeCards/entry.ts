import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const INTERNAL_STAFF_ROLES = new Set([
  "admin",
  "management",
  "employee",
]);

const PRE_ETS_TIME_CARD_STATUSES = new Set([
  "submitted_to_staff",
  "returned_to_student",
  "submitted_to_manager_payroll",
  "returned_to_staff",
  "finalized",
]);

const PRE_ETS_ENTRY_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
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

function normalizeDate(value: unknown) {
  const date = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "";
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown): Record<string, any> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isInternalStaff(user: any) {
  return INTERNAL_STAFF_ROLES.has(
    normalizeText(user?.role).toLowerCase()
  );
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

function getCardStatus(card: any) {
  return normalizeText(card?.status).toLowerCase();
}

function getClientDisplayName(client: any) {
  const name = `${normalizeText(client?.first_name)} ${normalizeText(
    client?.last_name
  )}`.trim();

  return name || "Unnamed student";
}

function getUserDisplayName(user: any) {
  const fullName = normalizeText(user?.full_name);

  if (fullName) {
    return fullName;
  }

  const name = `${normalizeText(user?.first_name)} ${normalizeText(
    user?.last_name
  )}`.trim();

  if (name) {
    return name;
  }

  return normalizeText(user?.name) || "Unavailable staff member";
}

function projectSnapshotEntry(entry: any) {
  const status =
    normalizeText(entry?.status).toLowerCase() || "pending";

  return {
    id: normalizeText(entry?.id),
    date: normalizeDate(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: asNumber(entry?.duration_minutes, 0),
    description: normalizeText(entry?.description),
    source: normalizeText(entry?.source) || "client_portal",
    status: PRE_ETS_ENTRY_STATUSES.has(status)
      ? status
      : "pending",
  };
}

function getSnapshotEntries(card: any) {
  return asArray(asObject(card?.entry_snapshot)?.entries)
    .map(projectSnapshotEntry)
    .filter((entry: any) => Boolean(entry.id));
}

function projectCard(
  card: any,
  client: any,
  assignedStaff: any,
  includeEntries: boolean
) {
  const response: Record<string, unknown> = {
    id: normalizeText(card?.id),
    client_id: normalizeText(card?.client_id),
    client_name: getClientDisplayName(client),
    assigned_staff_name: getUserDisplayName(assignedStaff),
    period_start: normalizeDate(card?.period_start),
    period_end: normalizeDate(card?.period_end),
    period_key: normalizeText(card?.period_key),
    pay_period_label: normalizeText(card?.pay_period_label),
    pay_date: normalizeDate(card?.pay_date) || null,
    status: getCardStatus(card),
    entry_count: asArray(card?.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean).length,
    total_minutes: asNumber(card?.total_minutes, 0),
    student_submission_revision: asNumber(
      card?.student_submission_revision,
      1
    ),
    staff_submission_revision: asNumber(
      card?.staff_submission_revision,
      0
    ),
    first_student_submitted_at:
      card?.first_student_submitted_at ?? null,
    last_student_submitted_at:
      card?.last_student_submitted_at ?? null,
    returned_to_student_at:
      card?.returned_to_student_at ?? null,
    return_to_student_note:
      normalizeText(card?.return_to_student_note) || null,
    staff_submitted_at: card?.staff_submitted_at ?? null,
    returned_to_staff_at: card?.returned_to_staff_at ?? null,
    return_to_staff_note:
      normalizeText(card?.return_to_staff_note) || null,
    finalized_at: card?.finalized_at ?? null,
    finalization_note:
      normalizeText(card?.finalization_note) || null,
    archived_at: card?.archived_at ?? null,
  };

  if (includeEntries) {
    response.entries = getSnapshotEntries(card);
  }

  return response;
}

async function resolveCaller(
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

  const organization =
    await base44.asServiceRole.entities.Organization.get(
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
    callerId: normalizeText(caller?.id),
    callerRole: normalizeText(caller?.role).toLowerCase(),
    callerAccessLevel: normalizeText(
      caller?.access_level
    ).toLowerCase(),
  };
}

async function resolveStudentClient(
  base44: any,
  caller: any,
  organizationId: string
) {
  const linkedClientId = normalizeText(
    caller?.linked_client_id
  );

  if (
    normalizeText(caller?.role).toLowerCase() !== "pre_ets" ||
    normalizeText(caller?.access_level).toLowerCase() !==
      "client_portal"
  ) {
    throw new RequestError(
      403,
      "You are not authorized to view Pre-ETS Time Cards."
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

async function loadOrganizationData(
  base44: any,
  organizationId: string
) {
  const [clients, users, cards, assignments] = await Promise.all([
    base44.asServiceRole.entities.Client.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.PreEtsTimeCard.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
    }),
  ]);

  const preEtsClients = asArray(clients).filter((client: any) =>
    isPreEtsClientInOrganization(client, organizationId)
  );

  const activeInternalUsers = asArray(users).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId &&
      isInternalStaff(user)
  );

  const validCards = asArray(cards).filter(
    (card: any) =>
      isActive(card) &&
      normalizeText(card?.org_id) === organizationId &&
      PRE_ETS_TIME_CARD_STATUSES.has(getCardStatus(card))
  );

  const activeAssignments = asArray(assignments).filter(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.manager_user_id) &&
      normalizeText(assignment?.employee_user_id)
  );

  return {
    preEtsClients,
    activeInternalUsers,
    validCards,
    activeAssignments,
  };
}

function getManagedStaffUserIds(
  managerUserId: string,
  assignments: any[]
) {
  const childrenByManagerId = new Map<string, string[]>();

  for (const assignment of assignments) {
    const managerId = normalizeText(assignment?.manager_user_id);
    const employeeId = normalizeText(assignment?.employee_user_id);

    if (!managerId || !employeeId) {
      continue;
    }

    const employeeIds = childrenByManagerId.get(managerId) || [];
    employeeIds.push(employeeId);
    childrenByManagerId.set(managerId, employeeIds);
  }

  const managedStaffUserIds = new Set<string>([managerUserId]);
  const visitedManagerIds = new Set<string>([managerUserId]);
  const queue = [managerUserId];

  while (queue.length > 0) {
    const currentManagerId = queue.shift() || "";
    const directEmployeeIds =
      childrenByManagerId.get(currentManagerId) || [];

    for (const employeeId of directEmployeeIds) {
      managedStaffUserIds.add(employeeId);

      if (!visitedManagerIds.has(employeeId)) {
        visitedManagerIds.add(employeeId);
        queue.push(employeeId);
      }
    }
  }

  return managedStaffUserIds;
}

function sortCards(cards: any[]) {
  return [...cards].sort((left, right) => {
    const leftKey = [
      normalizeDate(left?.period_end),
      normalizeDate(left?.period_start),
      normalizeText(left?.id),
    ].join("|");

    const rightKey = [
      normalizeDate(right?.period_end),
      normalizeDate(right?.period_start),
      normalizeText(right?.id),
    ].join("|");

    return rightKey.localeCompare(leftKey);
  });
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
    const requestedTimeCardId = normalizeText(
      requestBody?.time_card_id
    );
    const requestedClientId = normalizeText(
      requestBody?.client_id
    );
    const requestedStatus = normalizeText(
      requestBody?.status
    ).toLowerCase();
    const includeEntries = requestBody?.include_entries === true;

    if (
      requestedStatus &&
      requestedStatus !== "all" &&
      !PRE_ETS_TIME_CARD_STATUSES.has(requestedStatus)
    ) {
      return Response.json(
        { error: "Invalid Pre-ETS Time Card status filter." },
        { status: 400 }
      );
    }

    const {
      caller,
      organizationId,
      callerId,
      callerRole,
    } = await resolveCaller(base44, authenticatedUser.id);

    const {
      preEtsClients,
      activeInternalUsers,
      validCards,
      activeAssignments,
    } = await loadOrganizationData(base44, organizationId);

    const clientById = new Map(
      preEtsClients.map((client: any) => [
        normalizeText(client?.id),
        client,
      ])
    );

    const internalUserById = new Map(
      activeInternalUsers.map((user: any) => [
        normalizeText(user?.id),
        user,
      ])
    );

    let visibleCards: any[] = [];
    let viewerScope = "";

    if (
      callerRole === "pre_ets" &&
      normalizeText(caller?.access_level).toLowerCase() ===
        "client_portal"
    ) {
      const studentClient = await resolveStudentClient(
        base44,
        caller,
        organizationId
      );
      const studentClientId = normalizeText(studentClient?.id);

      viewerScope = "student";
      visibleCards = validCards.filter(
        (card: any) =>
          normalizeText(card?.client_id) === studentClientId
      );
    } else if (callerRole === "admin") {
      viewerScope = "administrator";
      visibleCards = validCards;
    } else if (callerRole === "management") {
      const managedStaffUserIds = getManagedStaffUserIds(
        callerId,
        activeAssignments
      );

      viewerScope = "management";
      visibleCards = validCards.filter((card: any) =>
        managedStaffUserIds.has(
          normalizeText(card?.assigned_staff_user_id)
        )
      );
    } else if (callerRole === "employee") {
      viewerScope = "assigned_staff";
      visibleCards = validCards.filter(
        (card: any) =>
          normalizeText(card?.assigned_staff_user_id) === callerId
      );
    } else {
      throw new RequestError(
        403,
        "You are not authorized to view Pre-ETS Time Cards."
      );
    }

    visibleCards = visibleCards.filter((card: any) =>
      clientById.has(normalizeText(card?.client_id))
    );

    if (requestedTimeCardId) {
      visibleCards = visibleCards.filter(
        (card: any) =>
          normalizeText(card?.id) === requestedTimeCardId
      );

      if (visibleCards.length === 0) {
        throw new RequestError(
          404,
          "Pre-ETS Time Card not found."
        );
      }
    }

    if (requestedClientId) {
      visibleCards = visibleCards.filter(
        (card: any) =>
          normalizeText(card?.client_id) === requestedClientId
      );
    }

    if (requestedStatus && requestedStatus !== "all") {
      visibleCards = visibleCards.filter(
        (card: any) => getCardStatus(card) === requestedStatus
      );
    }

    const cards = sortCards(visibleCards).map((card: any) => {
      const client = clientById.get(
        normalizeText(card?.client_id)
      );
      const assignedStaff = internalUserById.get(
        normalizeText(card?.assigned_staff_user_id)
      );

      return projectCard(
        card,
        client,
        assignedStaff,
        includeEntries
      );
    });

    return Response.json({
      ok: true,
      organization_id: organizationId,
      viewer_scope: viewerScope,
      cards,
      card_count: cards.length,
      time_card:
        requestedTimeCardId && cards.length === 1
          ? cards[0]
          : null,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to load authorized Pre-ETS Time Cards.";

    if (!(error instanceof RequestError)) {
      console.error(
        "getAuthorizedPreEtsTimeCards error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
