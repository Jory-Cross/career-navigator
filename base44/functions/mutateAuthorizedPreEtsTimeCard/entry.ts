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

const SUPPORTED_ACTIONS = new Set([
  "preview_student_time_card",
  "submit_student_time_card",
  "return_to_student",
  "submit_to_manager_payroll",
  "return_to_staff",
  "finalize",
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

function asObject(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value
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

function parseUtcDate(date: string) {
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
    throw new RequestError(
      400,
      "A valid calendar date is required."
    );
  }

  return parsed;
}

function formatUtcDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: string, days: number) {
  const parsed = parseUtcDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);

  return formatUtcDate(parsed);
}

function daysBetween(startDate: string, endDate: string) {
  const start = parseUtcDate(startDate).getTime();
  const end = parseUtcDate(endDate).getTime();

  return Math.round((end - start) / 86400000);
}

function getMonthStart(date: string) {
  const parsed = parseUtcDate(date);

  return formatUtcDate(
    new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        1
      )
    )
  );
}

function getMonthEnd(date: string) {
  const parsed = parseUtcDate(date);

  return formatUtcDate(
    new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth() + 1,
        0
      )
    )
  );
}

function getSchedulePeriodKey(
  scheduleId: string,
  scheduleVersion: number,
  periodStart: string,
  periodEnd: string
) {
  return `${scheduleId}__v${scheduleVersion}__${periodStart}__${periodEnd}`;
}

function getScheduleVersion(schedule: any) {
  const version = asNumber(schedule?.version, 0);

  if (!Number.isInteger(version) || version < 1) {
    throw new RequestError(
      409,
      "The active payroll schedule has an invalid version."
    );
  }

  return version;
}

function validateScheduleTimeZone(schedule: any) {
  const timeZone = normalizeText(schedule?.time_zone);

  if (!timeZone) {
    throw new RequestError(
      409,
      "The active payroll schedule has no time zone."
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new RequestError(
      409,
      "The active payroll schedule has an invalid time zone."
    );
  }

  return timeZone;
}

function assertResolvedPeriodFitsSchedule(
  schedule: any,
  periodStart: string,
  periodEnd: string
) {
  const effectiveStart = normalizeDate(
    schedule?.effective_start_date
  );
  const effectiveEnd = normalizeDate(
    schedule?.effective_end_date
  );

  if (
    (effectiveStart && periodStart < effectiveStart) ||
    (effectiveEnd && periodEnd > effectiveEnd)
  ) {
    throw new RequestError(
      409,
      "The payroll schedule effective dates do not align to a complete payroll period."
    );
  }
}

function buildDefaultPayPeriodLabel(
  schedule: any,
  periodStart: string,
  periodEnd: string
) {
  const scheduleName =
    normalizeText(schedule?.name) || "Payroll Period";

  return `${scheduleName}: ${periodStart} through ${periodEnd}`;
}

function resolveSemiMonthlyPeriod(
  schedule: any,
  referenceDate: string
) {
  const firstPeriodEndDay = asNumber(
    schedule?.semi_monthly_first_period_end_day,
    15
  );

  if (
    !Number.isInteger(firstPeriodEndDay) ||
    firstPeriodEndDay < 1 ||
    firstPeriodEndDay > 28
  ) {
    throw new RequestError(
      409,
      "The active semi-monthly payroll schedule has an invalid first-period end day."
    );
  }

  const parsedReferenceDate = parseUtcDate(referenceDate);
  const referenceDay = parsedReferenceDate.getUTCDate();
  const monthStart = getMonthStart(referenceDate);
  const monthEnd = getMonthEnd(referenceDate);

  const firstPeriodEnd = formatUtcDate(
    new Date(
      Date.UTC(
        parsedReferenceDate.getUTCFullYear(),
        parsedReferenceDate.getUTCMonth(),
        firstPeriodEndDay
      )
    )
  );

  if (referenceDay <= firstPeriodEndDay) {
    return {
      period_start: monthStart,
      period_end: firstPeriodEnd,
    };
  }

  return {
    period_start: addDays(firstPeriodEnd, 1),
    period_end: monthEnd,
  };
}

function resolveWeeklyPeriod(
  schedule: any,
  referenceDate: string
) {
  const dayIndexByName: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const startDayName = normalizeText(
    schedule?.weekly_period_start_day
  ).toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(dayIndexByName, startDayName)) {
    throw new RequestError(
      409,
      "The active weekly payroll schedule has an invalid period-start day."
    );
  }

  const referenceDayOfWeek =
    parseUtcDate(referenceDate).getUTCDay();

  const offset =
    (referenceDayOfWeek - dayIndexByName[startDayName] + 7) % 7;

  const periodStart = addDays(referenceDate, -offset);

  return {
    period_start: periodStart,
    period_end: addDays(periodStart, 6),
  };
}

function resolveBiweeklyPeriod(
  schedule: any,
  referenceDate: string
) {
  const anchorPeriodStart = normalizeDate(
    schedule?.biweekly_anchor_period_start
  );

  if (!anchorPeriodStart) {
    throw new RequestError(
      409,
      "The active biweekly payroll schedule has no anchor period start date."
    );
  }

  const offsetDays = daysBetween(
    anchorPeriodStart,
    referenceDate
  );

  const wholePeriodsFromAnchor = Math.floor(offsetDays / 14);
  const periodStart = addDays(
    anchorPeriodStart,
    wholePeriodsFromAnchor * 14
  );

  return {
    period_start: periodStart,
    period_end: addDays(periodStart, 13),
  };
}

async function resolveOrganizationPayPeriod(
  base44: any,
  organizationId: string,
  referenceDate: string
) {
  parseUtcDate(referenceDate);

  const schedules =
    await base44.asServiceRole.entities.PayPeriodSchedule.filter({
      org_id: organizationId,
    });

  const matchingSchedules = asArray(schedules).filter(
    (schedule: any) => {
      const effectiveStart = normalizeDate(
        schedule?.effective_start_date
      );
      const effectiveEnd = normalizeDate(
        schedule?.effective_end_date
      );

      return (
        normalizeText(schedule?.org_id) === organizationId &&
        schedule?.is_active !== false &&
        Boolean(effectiveStart) &&
        effectiveStart <= referenceDate &&
        (!effectiveEnd || effectiveEnd >= referenceDate)
      );
    }
  );

  if (matchingSchedules.length === 0) {
    throw new RequestError(
      409,
      "No active payroll schedule applies to this date for your organization."
    );
  }

  if (matchingSchedules.length > 1) {
    throw new RequestError(
      409,
      "Multiple active payroll schedules apply to this date. An organization administrator must resolve the schedule overlap."
    );
  }

  const schedule = matchingSchedules[0];
  const scheduleId = normalizeText(schedule?.id);

  if (!scheduleId) {
    throw new RequestError(
      409,
      "The active payroll schedule has no valid ID."
    );
  }

  const scheduleVersion = getScheduleVersion(schedule);
  const scheduleType = normalizeText(
    schedule?.schedule_type
  ).toLowerCase();

  const timeZone = validateScheduleTimeZone(schedule);

  let resolvedPeriod: {
    period_start: string;
    period_end: string;
    period_key?: string;
    label?: string;
    pay_date?: string | null;
  };

  if (scheduleType === "semi_monthly") {
    resolvedPeriod = resolveSemiMonthlyPeriod(
      schedule,
      referenceDate
    );
  } else if (scheduleType === "weekly") {
    resolvedPeriod = resolveWeeklyPeriod(
      schedule,
      referenceDate
    );
  } else if (scheduleType === "biweekly") {
    resolvedPeriod = resolveBiweeklyPeriod(
      schedule,
      referenceDate
    );
  } else if (scheduleType === "custom_calendar") {
    const calendarPeriods =
      await base44.asServiceRole.entities.PayPeriodCalendarPeriod.filter({
        pay_period_schedule_id: scheduleId,
      });

    const matchingCalendarPeriods = asArray(
      calendarPeriods
    ).filter(
      (calendarPeriod: any) =>
        normalizeText(calendarPeriod?.org_id) ===
          organizationId &&
        normalizeText(
          calendarPeriod?.pay_period_schedule_id
        ) === scheduleId &&
        asNumber(calendarPeriod?.schedule_version, 0) ===
          scheduleVersion &&
        calendarPeriod?.is_active !== false &&
        normalizeDate(calendarPeriod?.period_start) <=
          referenceDate &&
        normalizeDate(calendarPeriod?.period_end) >=
          referenceDate
    );

    if (matchingCalendarPeriods.length === 0) {
      throw new RequestError(
        409,
        "No active custom payroll period contains the selected date."
      );
    }

    if (matchingCalendarPeriods.length > 1) {
      throw new RequestError(
        409,
        "Multiple custom payroll periods contain the selected date. An organization administrator must resolve the overlap."
      );
    }

    const calendarPeriod = matchingCalendarPeriods[0];
    const periodStart = normalizeDate(
      calendarPeriod?.period_start
    );
    const periodEnd = normalizeDate(
      calendarPeriod?.period_end
    );

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      throw new RequestError(
        409,
        "The active custom payroll period has invalid dates."
      );
    }

    resolvedPeriod = {
      period_start: periodStart,
      period_end: periodEnd,
      period_key:
        normalizeText(calendarPeriod?.period_key) ||
        getSchedulePeriodKey(
          scheduleId,
          scheduleVersion,
          periodStart,
          periodEnd
        ),
      label:
        normalizeText(calendarPeriod?.label) ||
        buildDefaultPayPeriodLabel(
          schedule,
          periodStart,
          periodEnd
        ),
      pay_date:
        normalizeDate(calendarPeriod?.pay_date) || null,
    };
  } else {
    throw new RequestError(
      409,
      "The active payroll schedule has an unsupported schedule type."
    );
  }

  const periodStart = normalizeDate(
    resolvedPeriod.period_start
  );
  const periodEnd = normalizeDate(
    resolvedPeriod.period_end
  );

  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    throw new RequestError(
      409,
      "The payroll schedule resolved an invalid payroll period."
    );
  }

  assertResolvedPeriodFitsSchedule(
    schedule,
    periodStart,
    periodEnd
  );

  return {
    schedule_id: scheduleId,
    schedule_version: scheduleVersion,
    schedule_name: normalizeText(schedule?.name),
    schedule_type: scheduleType,
    time_zone: timeZone,
    period_start: periodStart,
    period_end: periodEnd,
    period_key:
      normalizeText(resolvedPeriod.period_key) ||
      getSchedulePeriodKey(
        scheduleId,
        scheduleVersion,
        periodStart,
        periodEnd
      ),
    label:
      normalizeText(resolvedPeriod.label) ||
      buildDefaultPayPeriodLabel(
        schedule,
        periodStart,
        periodEnd
      ),
    pay_date:
      normalizeDate(resolvedPeriod.pay_date) || null,
  };
}

function periodsOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function normalizeStableValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = normalizeStableValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value: any) {
  return JSON.stringify(normalizeStableValue(value));
}

function getTimeCardInput(body: any) {
  const candidate = body?.time_card ?? body?.timeCard ?? {};

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new RequestError(
      400,
      "time_card must be an object."
    );
  }

  return candidate;
}

function getReferenceDate(body: any) {
  const timeCard = getTimeCardInput(body);
  const referenceDate = normalizeDate(
    timeCard?.reference_date
  );

  if (!referenceDate) {
    throw new RequestError(
      400,
      "time_card.reference_date is required."
    );
  }

  parseUtcDate(referenceDate);

  return referenceDate;
}

function buildEntrySnapshotRecord(entry: any) {
  return {
    id: normalizeText(entry?.id),
    client_id: normalizeText(entry?.client_id),
    client_name: normalizeText(entry?.client_name),
    org_id: normalizeText(entry?.org_id),
    date: normalizeDate(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: asNumber(entry?.duration_minutes, 0),
    description: normalizeText(entry?.description),
    source: normalizeText(entry?.source) || "client_portal",
    status: normalizeText(entry?.status) || "pending",
  };
}

function sortEntries(entries: any[]) {
  return [...entries].sort((left, right) => {
    const leftKey = [
      normalizeDate(left?.date),
      normalizeText(left?.start_time),
      normalizeText(left?.id),
    ].join("|");

    const rightKey = [
      normalizeDate(right?.date),
      normalizeText(right?.start_time),
      normalizeText(right?.id),
    ].join("|");

    return leftKey.localeCompare(rightKey);
  });
}

function buildEntrySnapshot(entries: any[], capturedAt: string) {
  return {
    schema_version: 1,
    captured_at: capturedAt,
    entries: sortEntries(entries).map(buildEntrySnapshotRecord),
  };
}

function getSnapshotEntries(card: any) {
  return asArray(asObject(card?.entry_snapshot).entries)
    .map(buildEntrySnapshotRecord)
    .filter((entry: any) => Boolean(entry.id));
}

function projectCard(card: any, includeEntries = false) {
  const response: Record<string, unknown> = {
    id: normalizeText(card?.id),
    org_id: normalizeText(card?.org_id),
    client_id: normalizeText(card?.client_id),
    assigned_staff_user_id: normalizeText(
      card?.assigned_staff_user_id
    ),
    period_start: normalizeDate(card?.period_start),
    period_end: normalizeDate(card?.period_end),
    period_key: normalizeText(card?.period_key),
    pay_period_schedule_id: normalizeText(
      card?.pay_period_schedule_id
    ),
    pay_period_schedule_version: asNumber(
      card?.pay_period_schedule_version,
      0
    ),
    pay_period_label: normalizeText(card?.pay_period_label),
    pay_date: normalizeDate(card?.pay_date) || null,
    status: getCardStatus(card),
    entry_ids: asArray(card?.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean),
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
    student_submitted_by_user_id:
      normalizeText(card?.student_submitted_by_user_id) || null,
    returned_to_student_at:
      card?.returned_to_student_at ?? null,
    returned_to_student_by_user_id:
      normalizeText(card?.returned_to_student_by_user_id) || null,
    return_to_student_note:
      normalizeText(card?.return_to_student_note) || null,
    staff_submitted_at:
      card?.staff_submitted_at ?? null,
    staff_submitted_by_user_id:
      normalizeText(card?.staff_submitted_by_user_id) || null,
    returned_to_staff_at:
      card?.returned_to_staff_at ?? null,
    returned_to_staff_by_user_id:
      normalizeText(card?.returned_to_staff_by_user_id) || null,
    return_to_staff_note:
      normalizeText(card?.return_to_staff_note) || null,
    finalized_at: card?.finalized_at ?? null,
    finalized_by_user_id:
      normalizeText(card?.finalized_by_user_id) || null,
    finalization_note:
      normalizeText(card?.finalization_note) || null,
    archived_at: card?.archived_at ?? null,
  };

  if (includeEntries) {
    response.entries = getSnapshotEntries(card);
  }

  return response;
}

async function createActivity(
  base44: any,
  organizationId: string,
  clientId: string,
  title: string,
  description: string,
  cardId: string
) {
  try {
    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: clientId,
      activity_type: "status_changed",
      title,
      description,
      metadata: {
        related_entity_id: cardId,
        related_entity_type: "PreEtsTimeCard",
      },
    });
  } catch (error) {
    console.error(
      "Pre-ETS Time Card activity log error:",
      error
    );
  }
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
    callerRole: normalizeText(caller?.role).toLowerCase(),
  };
}

async function loadStudentClient(
  base44: any,
  caller: any,
  organizationId: string
) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const accessLevel = normalizeText(
    caller?.access_level
  ).toLowerCase();
  const linkedClientId = normalizeText(
    caller?.linked_client_id
  );

  if (
    callerRole !== "pre_ets" ||
    accessLevel !== "client_portal"
  ) {
    throw new RequestError(
      403,
      "You are not authorized to submit Pre-ETS student Time Cards."
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

async function loadOrganizationInternalUsers(
  base44: any,
  organizationId: string
) {
  const users = await base44.asServiceRole.entities.User.filter({
    org_id: organizationId,
  });

  return asArray(users).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId &&
      isInternalStaff(user)
  );
}

async function resolveAssignedStaffForClient(
  base44: any,
  client: any,
  organizationId: string
) {
  const assignmentValue = normalizeText(
    client?.assigned_employee_id
  );

  if (!assignmentValue) {
    throw new RequestError(
      409,
      "This Pre-ETS student does not have an assigned job coach or staff member."
    );
  }

  const internalUsers = await loadOrganizationInternalUsers(
    base44,
    organizationId
  );

  const assignedStaff = internalUsers.find(
    (user: any) =>
      normalizeText(user?.id) === assignmentValue ||
      normalizeText(user?.email) === assignmentValue
  );

  if (!assignedStaff?.id) {
    throw new RequestError(
      409,
      "This Pre-ETS student's assigned job coach or staff member is unavailable."
    );
  }

  return assignedStaff;
}

async function loadClientCards(
  base44: any,
  organizationId: string,
  clientId: string
) {
  const cards =
    await base44.asServiceRole.entities.PreEtsTimeCard.filter({
      client_id: clientId,
    });

  return asArray(cards).filter(
    (card: any) =>
      normalizeText(card?.org_id) === organizationId &&
      normalizeText(card?.client_id) === clientId &&
      PRE_ETS_TIME_CARD_STATUSES.has(getCardStatus(card))
  );
}

function getExactCardForPeriod(
  cards: any[],
  payPeriod: any
) {
  const matchingCards = cards.filter(
    (card: any) =>
      normalizeText(card?.period_key) ===
        normalizeText(payPeriod?.period_key) &&
      normalizeDate(card?.period_start) ===
        normalizeDate(payPeriod?.period_start) &&
      normalizeDate(card?.period_end) ===
        normalizeDate(payPeriod?.period_end)
  );

  if (matchingCards.length > 1) {
    throw new RequestError(
      409,
      "More than one Pre-ETS Time Card exists for this student and payroll period."
    );
  }

  return matchingCards[0] || null;
}

function assertNoConflictingCards(
  cards: any[],
  periodStart: string,
  periodEnd: string,
  excludedCardId = ""
) {
  const conflictingCard = cards.find((card: any) => {
    if (normalizeText(card?.id) === excludedCardId) {
      return false;
    }

    const cardStart = normalizeDate(card?.period_start);
    const cardEnd = normalizeDate(card?.period_end);

    if (!cardStart || !cardEnd) {
      return true;
    }

    return periodsOverlap(
      periodStart,
      periodEnd,
      cardStart,
      cardEnd
    );
  });

  if (conflictingCard) {
    throw new RequestError(
      409,
      `This payroll period overlaps an existing Pre-ETS Time Card (${normalizeText(
        conflictingCard?.id
      )}).`
    );
  }
}

async function loadEligibleStudentEntries(
  base44: any,
  organizationId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const entries =
    await base44.asServiceRole.entities.PreEtsClientTimeEntry.filter({
      client_id: clientId,
    });

  const periodEntries = asArray(entries).filter(
    (entry: any) =>
      isActive(entry) &&
      normalizeText(entry?.org_id) === organizationId &&
      normalizeText(entry?.client_id) === clientId &&
      normalizeDate(entry?.date) >= periodStart &&
      normalizeDate(entry?.date) <= periodEnd
  );

  const rejectedEntries = periodEntries.filter(
    (entry: any) =>
      (normalizeText(entry?.status).toLowerCase() || "pending") ===
      "rejected"
  );

  if (rejectedEntries.length > 0) {
    throw new RequestError(
      409,
      "Correct or remove rejected student time entries before submitting this Time Card."
    );
  }

  const unsupportedEntries = periodEntries.filter((entry: any) => {
    const status =
      normalizeText(entry?.status).toLowerCase() || "pending";

    return status !== "pending" && status !== "approved";
  });

  if (unsupportedEntries.length > 0) {
    throw new RequestError(
      409,
      "This payroll period contains unsupported student time-entry statuses."
    );
  }

  if (periodEntries.length === 0) {
    throw new RequestError(
      400,
      "No eligible Pre-ETS student time entries exist for this payroll period."
    );
  }

  return sortEntries(periodEntries);
}

async function loadCurrentCardEntries(
  base44: any,
  organizationId: string,
  clientId: string,
  entryIds: string[]
) {
  const requestedEntryIds = new Set(
    entryIds.map((entryId) => normalizeText(entryId)).filter(Boolean)
  );

  if (requestedEntryIds.size === 0) {
    throw new RequestError(
      409,
      "This Pre-ETS Time Card does not contain any student time-entry IDs."
    );
  }

  const entries =
    await base44.asServiceRole.entities.PreEtsClientTimeEntry.filter({
      client_id: clientId,
    });

  const matchingEntries = asArray(entries).filter(
    (entry: any) =>
      isActive(entry) &&
      normalizeText(entry?.org_id) === organizationId &&
      normalizeText(entry?.client_id) === clientId &&
      requestedEntryIds.has(normalizeText(entry?.id))
  );

  if (matchingEntries.length !== requestedEntryIds.size) {
    throw new RequestError(
      409,
      "One or more student time entries in this Time Card are missing or no longer available."
    );
  }

  return sortEntries(matchingEntries);
}

function assertCardEntriesMatchSnapshot(
  card: any,
  currentEntries: any[]
) {
  const snapshotEntries = getSnapshotEntries(card);

  if (snapshotEntries.length !== currentEntries.length) {
    throw new RequestError(
      409,
      "Student time entries changed after Time Card submission. Return the card to the student before forwarding it."
    );
  }

  const snapshotById = new Map(
    snapshotEntries.map((entry: any) => [
      normalizeText(entry?.id),
      entry,
    ])
  );

  for (const currentEntry of currentEntries) {
    const currentSnapshot = buildEntrySnapshotRecord(
      currentEntry
    );
    const submittedSnapshot = snapshotById.get(
      currentSnapshot.id
    );

    if (
      !submittedSnapshot ||
      stableStringify(submittedSnapshot) !==
        stableStringify(currentSnapshot)
    ) {
      throw new RequestError(
        409,
        "Student time entries changed after Time Card submission. Return the card to the student before forwarding it."
      );
    }
  }
}

async function loadScopedCard(
  base44: any,
  organizationId: string,
  timeCardId: string
) {
  if (!timeCardId) {
    throw new RequestError(
      400,
      "time_card_id is required."
    );
  }

  const card = await base44.asServiceRole.entities.PreEtsTimeCard.get(
    timeCardId
  ).catch(() => null);

  if (!card) {
    throw new RequestError(
      404,
      "Pre-ETS Time Card not found."
    );
  }

  if (
    normalizeText(card?.org_id) !== organizationId ||
    !PRE_ETS_TIME_CARD_STATUSES.has(getCardStatus(card))
  ) {
    throw new RequestError(
      403,
      "This Pre-ETS Time Card is not available in your organization."
    );
  }

  const client = await base44.asServiceRole.entities.Client.get(
    normalizeText(card?.client_id)
  ).catch(() => null);

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(
      404,
      "Pre-ETS student record not found."
    );
  }

  return {
    card,
    client,
  };
}

function assertCallerMayActAsAssignedStaff(
  caller: any,
  card: any
) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const callerId = normalizeText(caller?.id);
  const assignedStaffUserId = normalizeText(
    card?.assigned_staff_user_id
  );

  if (callerRole === "admin") {
    return;
  }

  if (!isInternalStaff(caller)) {
    throw new RequestError(
      403,
      "You are not authorized to review Pre-ETS student Time Cards."
    );
  }

  if (!callerId || callerId !== assignedStaffUserId) {
    throw new RequestError(
      403,
      "Only the assigned job coach or staff member may take this Time Card action."
    );
  }
}

async function assertCallerMayFinalizeOrReturnToStaff(
  base44: any,
  caller: any,
  organizationId: string,
  card: any
) {
  const callerRole = normalizeText(caller?.role).toLowerCase();
  const callerId = normalizeText(caller?.id);
  const assignedStaffUserId = normalizeText(
    card?.assigned_staff_user_id
  );
  const staffSubmittedByUserId = normalizeText(
    card?.staff_submitted_by_user_id
  );

  if (!isInternalStaff(caller)) {
    throw new RequestError(
      403,
      "You are not authorized to finalize Pre-ETS student Time Cards."
    );
  }

  if (
    callerId &&
    (callerId === assignedStaffUserId ||
      callerId === staffSubmittedByUserId)
  ) {
    throw new RequestError(
      403,
      "You may not finalize or return a Pre-ETS Time Card that you submitted as assigned staff."
    );
  }

  if (callerRole === "admin") {
    return;
  }

  if (callerRole !== "management") {
    throw new RequestError(
      403,
      "Only management or organization administrators may finalize Pre-ETS student Time Cards."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: callerId,
      employee_user_id: assignedStaffUserId,
    });

  const hasActiveAssignment = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.manager_user_id) === callerId &&
      normalizeText(assignment?.employee_user_id) ===
        assignedStaffUserId
  );

  if (!hasActiveAssignment) {
    throw new RequestError(
      403,
      "Management may only finalize or return Pre-ETS Time Cards submitted by active direct reports."
    );
  }
}

function buildStudentSubmissionPayload(
  organizationId: string,
  clientId: string,
  assignedStaffUserId: string,
  payPeriod: any,
  entries: any[],
  studentUserId: string,
  now: string,
  studentSubmissionRevision: number,
  staffSubmissionRevision: number,
  firstStudentSubmittedAt: string
) {
  const entryIds = entries.map((entry: any) =>
    normalizeText(entry?.id)
  );
  const totalMinutes = entries.reduce(
    (total: number, entry: any) =>
      total + asNumber(entry?.duration_minutes, 0),
    0
  );

  return {
    org_id: organizationId,
    client_id: clientId,
    assigned_staff_user_id: assignedStaffUserId,
    period_start: payPeriod.period_start,
    period_end: payPeriod.period_end,
    period_key: payPeriod.period_key,
    pay_period_schedule_id: payPeriod.schedule_id,
    pay_period_schedule_version:
      payPeriod.schedule_version,
    pay_period_label: payPeriod.label,
    pay_date: payPeriod.pay_date,
    status: "submitted_to_staff",
    entry_ids: entryIds,
    entry_snapshot: buildEntrySnapshot(entries, now),
    total_minutes: totalMinutes,
    student_submission_revision: studentSubmissionRevision,
    staff_submission_revision: staffSubmissionRevision,
    first_student_submitted_at: firstStudentSubmittedAt,
    last_student_submitted_at: now,
    student_submitted_by_user_id: studentUserId,
    returned_to_student_at: null,
    returned_to_student_by_user_id: null,
    return_to_student_note: null,
    staff_submitted_at: null,
    staff_submitted_by_user_id: null,
    returned_to_staff_at: null,
    returned_to_staff_by_user_id: null,
    return_to_staff_note: null,
    finalized_at: null,
    finalized_by_user_id: null,
    finalization_note: null,
    archived_at: null,
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

    const { caller, organizationId } = await resolveCaller(
      base44,
      authenticatedUser.id
    );

    if (
      action === "preview_student_time_card" ||
      action === "submit_student_time_card"
    ) {
      const referenceDate = getReferenceDate(requestBody);
      const client = await loadStudentClient(
        base44,
        caller,
        organizationId
      );
      const assignedStaff = await resolveAssignedStaffForClient(
        base44,
        client,
        organizationId
      );
      const payPeriod = await resolveOrganizationPayPeriod(
        base44,
        organizationId,
        referenceDate
      );
      const existingCards = await loadClientCards(
        base44,
        organizationId,
        normalizeText(client?.id)
      );
      const exactCard = getExactCardForPeriod(
        existingCards,
        payPeriod
      );

      if (action === "preview_student_time_card") {
        if (
          exactCard &&
          getCardStatus(exactCard) !== "returned_to_student"
        ) {
          return Response.json({
            ok: true,
            action,
            pay_period: payPeriod,
            existing_time_card: projectCard(exactCard, true),
            entries: getSnapshotEntries(exactCard),
            locked: true,
          });
        }

        assertNoConflictingCards(
          existingCards,
          payPeriod.period_start,
          payPeriod.period_end,
          normalizeText(exactCard?.id)
        );

        const entries = await loadEligibleStudentEntries(
          base44,
          organizationId,
          normalizeText(client?.id),
          payPeriod.period_start,
          payPeriod.period_end
        );

        return Response.json({
          ok: true,
          action,
          pay_period: payPeriod,
          existing_time_card: exactCard
            ? projectCard(exactCard, true)
            : null,
          entries: entries.map(buildEntrySnapshotRecord),
          locked: false,
        });
      }

      if (
        exactCard &&
        getCardStatus(exactCard) !== "returned_to_student"
      ) {
        throw new RequestError(
          409,
          "A Pre-ETS Time Card already exists for this payroll period and is not open for student correction."
        );
      }

      assertNoConflictingCards(
        existingCards,
        payPeriod.period_start,
        payPeriod.period_end,
        normalizeText(exactCard?.id)
      );

      const entries = await loadEligibleStudentEntries(
        base44,
        organizationId,
        normalizeText(client?.id),
        payPeriod.period_start,
        payPeriod.period_end
      );

      const now = new Date().toISOString();
      const studentSubmissionRevision = exactCard
        ? asNumber(exactCard?.student_submission_revision, 1) + 1
        : 1;
      const staffSubmissionRevision = exactCard
        ? asNumber(exactCard?.staff_submission_revision, 0)
        : 0;
      const firstStudentSubmittedAt =
        normalizeText(exactCard?.first_student_submitted_at) ||
        now;

      const payload = buildStudentSubmissionPayload(
        organizationId,
        normalizeText(client?.id),
        normalizeText(assignedStaff?.id),
        payPeriod,
        entries,
        normalizeText(caller?.id),
        now,
        studentSubmissionRevision,
        staffSubmissionRevision,
        firstStudentSubmittedAt
      );

      const timeCard = exactCard
        ? await base44.asServiceRole.entities.PreEtsTimeCard.update(
            exactCard.id,
            payload
          )
        : await base44.asServiceRole.entities.PreEtsTimeCard.create(
            payload
          );

      await createActivity(
        base44,
        organizationId,
        normalizeText(client?.id),
        exactCard
          ? "Pre-ETS Time Card resubmitted to staff"
          : "Pre-ETS Time Card submitted to staff",
        exactCard
          ? "The student corrected and resubmitted their payroll-period Time Card to assigned staff."
          : "The student submitted their payroll-period Time Card to assigned staff.",
        normalizeText(timeCard?.id)
      );

      return Response.json({
        ok: true,
        action,
        resubmitted: Boolean(exactCard),
        pay_period: payPeriod,
        time_card: projectCard(timeCard, true),
      });
    }

    const timeCardId = normalizeText(requestBody?.time_card_id);
    const { card, client } = await loadScopedCard(
      base44,
      organizationId,
      timeCardId
    );
    const cardStatus = getCardStatus(card);
    const callerId = normalizeText(caller?.id);

    if (action === "return_to_student") {
      if (
        cardStatus !== "submitted_to_staff" &&
        cardStatus !== "returned_to_staff"
      ) {
        throw new RequestError(
          409,
          "Only Time Cards awaiting staff review may be returned to the student."
        );
      }

      assertCallerMayActAsAssignedStaff(caller, card);

      const returnNote = normalizeText(
        requestBody?.return_to_student_note
      );

      if (!returnNote) {
        throw new RequestError(
          400,
          "A correction note is required when returning a Pre-ETS Time Card to the student."
        );
      }

      const updated =
        await base44.asServiceRole.entities.PreEtsTimeCard.update(
          card.id,
          {
            status: "returned_to_student",
            returned_to_student_at: new Date().toISOString(),
            returned_to_student_by_user_id: callerId,
            return_to_student_note: returnNote.slice(0, 4000),
          }
        );

      await createActivity(
        base44,
        organizationId,
        normalizeText(client?.id),
        "Pre-ETS Time Card returned to student",
        "Assigned staff returned the student's Time Card for correction.",
        normalizeText(updated?.id)
      );

      return Response.json({
        ok: true,
        action,
        time_card: projectCard(updated, true),
      });
    }

    if (action === "submit_to_manager_payroll") {
      if (
        cardStatus !== "submitted_to_staff" &&
        cardStatus !== "returned_to_staff"
      ) {
        throw new RequestError(
          409,
          "Only Time Cards awaiting staff action may be submitted to manager or payroll."
        );
      }

      assertCallerMayActAsAssignedStaff(caller, card);

      const currentEntries = await loadCurrentCardEntries(
        base44,
        organizationId,
        normalizeText(client?.id),
        asArray(card?.entry_ids)
      );

      assertCardEntriesMatchSnapshot(card, currentEntries);

      const now = new Date().toISOString();

      const updated =
        await base44.asServiceRole.entities.PreEtsTimeCard.update(
          card.id,
          {
            status: "submitted_to_manager_payroll",
            staff_submission_revision:
              asNumber(card?.staff_submission_revision, 0) + 1,
            staff_submitted_at: now,
            staff_submitted_by_user_id: callerId,
            returned_to_staff_at: null,
            returned_to_staff_by_user_id: null,
            return_to_staff_note: null,
          }
        );

      await createActivity(
        base44,
        organizationId,
        normalizeText(client?.id),
        "Pre-ETS Time Card submitted to manager / payroll",
        "Assigned staff submitted the student's Time Card to manager or payroll for final review.",
        normalizeText(updated?.id)
      );

      return Response.json({
        ok: true,
        action,
        time_card: projectCard(updated, true),
      });
    }

    if (action === "return_to_staff") {
      if (cardStatus !== "submitted_to_manager_payroll") {
        throw new RequestError(
          409,
          "Only Time Cards submitted to manager or payroll may be returned to staff."
        );
      }

      await assertCallerMayFinalizeOrReturnToStaff(
        base44,
        caller,
        organizationId,
        card
      );

      const returnNote = normalizeText(
        requestBody?.return_to_staff_note
      );

      if (!returnNote) {
        throw new RequestError(
          400,
          "A return note is required when sending a Pre-ETS Time Card back to staff."
        );
      }

      const updated =
        await base44.asServiceRole.entities.PreEtsTimeCard.update(
          card.id,
          {
            status: "returned_to_staff",
            returned_to_staff_at: new Date().toISOString(),
            returned_to_staff_by_user_id: callerId,
            return_to_staff_note: returnNote.slice(0, 4000),
          }
        );

      await createActivity(
        base44,
        organizationId,
        normalizeText(client?.id),
        "Pre-ETS Time Card returned to staff",
        "Manager or payroll returned the student's Time Card to assigned staff for resolution.",
        normalizeText(updated?.id)
      );

      return Response.json({
        ok: true,
        action,
        time_card: projectCard(updated, true),
      });
    }

    if (cardStatus !== "submitted_to_manager_payroll") {
      throw new RequestError(
        409,
        "Only Time Cards submitted to manager or payroll may be finalized."
      );
    }

    await assertCallerMayFinalizeOrReturnToStaff(
      base44,
      caller,
      organizationId,
      card
    );

    const currentEntries = await loadCurrentCardEntries(
      base44,
      organizationId,
      normalizeText(client?.id),
      asArray(card?.entry_ids)
    );

    assertCardEntriesMatchSnapshot(card, currentEntries);

    const finalizationNote = normalizeText(
      requestBody?.finalization_note
    );

    const now = new Date().toISOString();

    const updated =
      await base44.asServiceRole.entities.PreEtsTimeCard.update(
        card.id,
        {
          status: "finalized",
          finalized_at: now,
          finalized_by_user_id: callerId,
          finalization_note: finalizationNote
            ? finalizationNote.slice(0, 4000)
            : "",
          archived_at: now,
        }
      );

    await createActivity(
      base44,
      organizationId,
      normalizeText(client?.id),
      "Pre-ETS Time Card finalized",
      "Manager or payroll finalized the student's Time Card and moved it to the archive.",
      normalizeText(updated?.id)
    );

    return Response.json({
      ok: true,
      action,
      time_card: projectCard(updated, true),
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to process the Pre-ETS Time Card request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsTimeCard error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
