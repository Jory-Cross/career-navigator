import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const TIME_CARD_STATUSES = new Set([
  "submitted",
  "returned",
  "approved",
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
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasOwn(record: any, key: string) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function getTimeCardStatus(card: any) {
  return normalizeText(card?.status).toLowerCase();
}

function assertValidCalendarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RequestError(400, "Choose a valid calendar date.");
  }
}

function getRequestedStatuses(body: any) {
  const rawStatuses = body?.statuses ?? body?.status ?? [];
  const values = Array.isArray(rawStatuses) ? rawStatuses : [rawStatuses];
  const normalizedStatuses = values
    .map((status) => normalizeText(status).toLowerCase())
    .filter(Boolean);

  if (
    normalizedStatuses.length === 0 ||
    normalizedStatuses.includes("all")
  ) {
    return null;
  }

  const invalidStatus = normalizedStatuses.find(
    (status) => !TIME_CARD_STATUSES.has(status)
  );

  if (invalidStatus) {
    throw new RequestError(
      400,
      "Time Card status filters may include only submitted, returned, approved, or all."
    );
  }

  return new Set(normalizedStatuses);
}

function getRequestedLimit(body: any) {
  const requested = hasOwn(body, "limit") ? asNumber(body.limit, 0) : 100;

  if (!Number.isInteger(requested) || requested < 1 || requested > 200) {
    throw new RequestError(
      400,
      "Choose a whole-number result limit from 1 through 200."
    );
  }

  return requested;
}

function getRequestedPeriodFilter(body: any) {
  const hasPeriodStart = hasOwn(body, "period_start");
  const hasPeriodEnd = hasOwn(body, "period_end");

  if (!hasPeriodStart && !hasPeriodEnd) return null;

  const periodStart = normalizeDate(body?.period_start);
  const periodEnd = normalizeDate(body?.period_end);

  if (!periodStart || !periodEnd) {
    throw new RequestError(
      400,
      "Choose both a valid start date and end date for the Time Card period."
    );
  }

  assertValidCalendarDate(periodStart);
  assertValidCalendarDate(periodEnd);

  if (periodStart > periodEnd) {
    throw new RequestError(
      400,
      "The Time Card period start date must be on or before the end date."
    );
  }

  return { period_start: periodStart, period_end: periodEnd };
}

function getIncludeEntries(body: any) {
  if (!hasOwn(body, "include_entries")) return false;
  if (typeof body.include_entries !== "boolean") {
    throw new RequestError(400, "include_entries must be true or false.");
  }
  return body.include_entries;
}

function cardOverlapsPeriod(card: any, requestedPeriod: any) {
  if (!requestedPeriod) return true;

  const cardStart = normalizeDate(card?.period_start);
  const cardEnd = normalizeDate(card?.period_end);

  return Boolean(
    cardStart &&
      cardEnd &&
      cardStart <= requestedPeriod.period_end &&
      requestedPeriod.period_start <= cardEnd
  );
}

function buildEntrySnapshotRecord(entry: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: entry?.client_id ?? null,
    employee_id: entry?.employee_id ?? null,
    entry_type_id: entry?.entry_type_id ?? null,
    entry_type_code: entry?.entry_type_code ?? null,
    date: entry?.date ?? null,
    start_time: entry?.start_time ?? null,
    end_time: entry?.end_time ?? null,
    duration_minutes: asNumber(entry?.duration_minutes, 0),
    reporting_period_key: entry?.reporting_period_key ?? null,
    location: entry?.location ?? null,
    description: entry?.description ?? null,
    form_data: asObject(entry?.form_data),
    is_billable: entry?.is_billable === true,
    is_payroll_eligible: entry?.is_payroll_eligible !== false,
    is_reportable: entry?.is_reportable !== false,
    status: entry?.status ?? null,
    legacy_category: entry?.legacy_category ?? null,
    employer_name: entry?.employer_name ?? null,
    service_authorization_id: entry?.service_authorization_id ?? null,
    report_ready: entry?.report_ready === true,
    locked_in_report_id: entry?.locked_in_report_id ?? null,
  };
}

function getSnapshotEntries(card: any) {
  return asArray(asObject(card?.entry_snapshot).entries)
    .map(buildEntrySnapshotRecord)
    .filter((entry) => Boolean(entry.id));
}

function getUserDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeText(user?.name) ||
    normalizeText(user?.email) ||
    "Former staff member"
  );
}

function sortTimeCards(cards: any[]) {
  return [...cards].sort((left, right) => {
    const leftKey = [
      normalizeDate(left?.period_end),
      normalizeText(left?.last_submitted_at),
      normalizeText(left?.id),
    ].join("|");
    const rightKey = [
      normalizeDate(right?.period_end),
      normalizeText(right?.last_submitted_at),
      normalizeText(right?.id),
    ].join("|");

    return rightKey.localeCompare(leftKey);
  });
}

function normalizeCardForResponse(
  card: any,
  userById: Map<string, any>,
  includeEntries: boolean
) {
  const employeeId = normalizeText(card?.employee_id);
  const returnedByUserId = normalizeText(card?.returned_by_user_id);
  const approvedByUserId = normalizeText(card?.approved_by_user_id);

  const response: Record<string, any> = {
    id: normalizeText(card?.id),
    org_id: normalizeText(card?.org_id),
    employee_id: employeeId,
    employee_name: getUserDisplayName(userById.get(employeeId)),
    period_start: normalizeDate(card?.period_start) || null,
    period_end: normalizeDate(card?.period_end) || null,
    period_key: normalizeText(card?.period_key) || null,
    pay_period_schedule_id: normalizeText(card?.pay_period_schedule_id) || null,
    pay_period_schedule_version:
      asNumber(card?.pay_period_schedule_version, 0) || null,
    pay_period_label: normalizeText(card?.pay_period_label) || null,
    pay_date: normalizeDate(card?.pay_date) || null,
    status: getTimeCardStatus(card),
    entry_ids: asArray(card?.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean),
    entry_count: asArray(card?.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean).length,
    total_minutes: asNumber(card?.total_minutes, 0),
    submission_revision: asNumber(card?.submission_revision, 1),
    first_submitted_at: card?.first_submitted_at ?? null,
    last_submitted_at: card?.last_submitted_at ?? null,
    submitted_by_user_id: normalizeText(card?.submitted_by_user_id) || null,
    returned_at: card?.returned_at ?? null,
    returned_by_user_id: returnedByUserId || null,
    returned_by_name: returnedByUserId
      ? getUserDisplayName(userById.get(returnedByUserId))
      : null,
    return_note: normalizeText(card?.return_note) || null,
    approved_at: card?.approved_at ?? null,
    approved_by_user_id: approvedByUserId || null,
    approved_by_name: approvedByUserId
      ? getUserDisplayName(userById.get(approvedByUserId))
      : null,
    approval_note: normalizeText(card?.approval_note) || null,
    archived_at: card?.archived_at ?? null,
  };

  if (includeEntries) response.entries = getSnapshotEntries(card);
  return response;
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const role = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!role || !organizationId) {
    throw new RequestError(
      403,
      "Your account is not authorized to view Time Cards."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return {
    caller,
    organizationId,
    role,
    isOrganizationAdmin: role === "admin",
    isManagement: role === "management",
  };
}

async function loadOrganizationUsers(base44: any, organizationId: string) {
  const users = await base44.asServiceRole.entities.User.filter({
    org_id: organizationId,
  });

  return asArray(users).filter(
    (user: any) =>
      normalizeText(user?.org_id) === organizationId &&
      Boolean(getCanonicalStaffRole(user))
  );
}

async function getVisibleEmployeeIds(
  base44: any,
  context: any,
  organizationUsers: any[]
) {
  if (context.isOrganizationAdmin) return null;
  if (!context.isManagement) return new Set([context.caller.id]);

  const activeUserIds = new Set(
    organizationUsers
      .filter((user: any) => isActive(user))
      .map((user: any) => normalizeText(user?.id))
      .filter(Boolean)
  );
  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: context.caller.id,
    });
  const directReportIds = asArray(assignments)
    .filter(
      (assignment: any) =>
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment?.org_id) === context.organizationId &&
        normalizeText(assignment?.manager_user_id) === context.caller.id &&
        activeUserIds.has(normalizeText(assignment?.employee_user_id))
    )
    .map((assignment: any) => normalizeText(assignment?.employee_user_id))
    .filter(Boolean);

  return new Set([context.caller.id, ...directReportIds]);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to view Time Cards." },
        { status: 401 }
      );
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);
    const requestedStatuses = getRequestedStatuses(body);
    const requestedLimit = getRequestedLimit(body);
    const requestedPeriod = getRequestedPeriodFilter(body);
    const includeEntries = getIncludeEntries(body);
    const organizationUsers = await loadOrganizationUsers(
      base44,
      context.organizationId
    );
    const userById = new Map(
      organizationUsers
        .filter((user: any) => normalizeText(user?.id))
        .map((user: any) => [normalizeText(user.id), user])
    );
    userById.set(context.caller.id, context.caller);

    const visibleEmployeeIds = await getVisibleEmployeeIds(
      base44,
      context,
      organizationUsers
    );
    const requestedEmployeeId = normalizeText(body?.employee_id);

    if (
      requestedEmployeeId &&
      visibleEmployeeIds &&
      !visibleEmployeeIds.has(requestedEmployeeId)
    ) {
      throw new RequestError(
        403,
        "You are not authorized to view Time Cards for that employee."
      );
    }

    const cards = await base44.asServiceRole.entities.TimeCard.filter({
      org_id: context.organizationId,
    });
    const scopedCards = asArray(cards).filter((card: any) => {
      const employeeId = normalizeText(card?.employee_id);
      const status = getTimeCardStatus(card);

      return (
        normalizeText(card?.org_id) === context.organizationId &&
        TIME_CARD_STATUSES.has(status) &&
        (!visibleEmployeeIds || visibleEmployeeIds.has(employeeId)) &&
        (!requestedEmployeeId || employeeId === requestedEmployeeId) &&
        (!requestedStatuses || requestedStatuses.has(status)) &&
        cardOverlapsPeriod(card, requestedPeriod)
      );
    });
    const sortedCards = sortTimeCards(scopedCards);
    const limitedCards = sortedCards.slice(0, requestedLimit);

    return Response.json({
      ok: true,
      organization_id: context.organizationId,
      caller: { id: context.caller.id, role: context.role },
      visibility: {
        is_organization_admin: context.isOrganizationAdmin,
        is_management: context.isManagement,
        employee_ids: visibleEmployeeIds ? Array.from(visibleEmployeeIds) : null,
      },
      filters: {
        employee_id: requestedEmployeeId || null,
        statuses: requestedStatuses
          ? Array.from(requestedStatuses)
          : ["submitted", "returned", "approved"],
        period_start: requestedPeriod?.period_start ?? null,
        period_end: requestedPeriod?.period_end ?? null,
        include_entries: includeEntries,
        limit: requestedLimit,
      },
      total_matching_cards: sortedCards.length,
      cards: limitedCards.map((card: any) =>
        normalizeCardForResponse(card, userById, includeEntries)
      ),
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "getAuthorizedTimeCards error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to load Time Cards. Please try again.",
      },
      { status }
    );
  }
});
