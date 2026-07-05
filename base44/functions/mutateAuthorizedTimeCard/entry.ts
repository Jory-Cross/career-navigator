import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const TIME_CARD_STATUSES = new Set(["submitted", "returned", "approved"]);
const ALLOWED_ACTIONS = new Set([
  "resolve_period",
  "preview",
  "submit",
  "return_for_correction",
  "approve",
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
    throw new RequestError(400, "Choose a valid calendar date.");
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
  return Math.round(
    (parseUtcDate(endDate).getTime() - parseUtcDate(startDate).getTime()) /
      86400000
  );
}

function getMonthStart(date: string) {
  const parsed = parseUtcDate(date);
  return formatUtcDate(
    new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
  );
}

function getMonthEnd(date: string) {
  const parsed = parseUtcDate(date);
  return formatUtcDate(
    new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0))
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
  const effectiveStart = normalizeDate(schedule?.effective_start_date);
  const effectiveEnd = normalizeDate(schedule?.effective_end_date);

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
  return `${normalizeText(schedule?.name) || "Payroll Period"}: ${periodStart} through ${periodEnd}`;
}

function resolveSemiMonthlyPeriod(schedule: any, referenceDate: string) {
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

  return parsedReferenceDate.getUTCDate() <= firstPeriodEndDay
    ? { period_start: monthStart, period_end: firstPeriodEnd }
    : { period_start: addDays(firstPeriodEnd, 1), period_end: monthEnd };
}

function resolveWeeklyPeriod(schedule: any, referenceDate: string) {
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

  const offset =
    (parseUtcDate(referenceDate).getUTCDay() -
      dayIndexByName[startDayName] +
      7) %
    7;
  const periodStart = addDays(referenceDate, -offset);

  return { period_start: periodStart, period_end: addDays(periodStart, 6) };
}

function resolveBiweeklyPeriod(schedule: any, referenceDate: string) {
  const anchorPeriodStart = normalizeDate(
    schedule?.biweekly_anchor_period_start
  );

  if (!anchorPeriodStart) {
    throw new RequestError(
      409,
      "The active biweekly payroll schedule has no anchor period start date."
    );
  }

  const wholePeriodsFromAnchor = Math.floor(
    daysBetween(anchorPeriodStart, referenceDate) / 14
  );
  const periodStart = addDays(
    anchorPeriodStart,
    wholePeriodsFromAnchor * 14
  );

  return { period_start: periodStart, period_end: addDays(periodStart, 13) };
}

async function resolveOrganizationPayPeriod(
  base44: any,
  organizationId: string,
  referenceDate: string
) {
  parseUtcDate(referenceDate);

  const schedules = await base44.asServiceRole.entities.PayPeriodSchedule.filter(
    { org_id: organizationId }
  );
  const matchingSchedules = asArray(schedules).filter((schedule: any) => {
    const effectiveStart = normalizeDate(schedule?.effective_start_date);
    const effectiveEnd = normalizeDate(schedule?.effective_end_date);

    return (
      normalizeText(schedule?.org_id) === organizationId &&
      schedule?.is_active !== false &&
      Boolean(effectiveStart) &&
      effectiveStart <= referenceDate &&
      (!effectiveEnd || effectiveEnd >= referenceDate)
    );
  });

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
  const scheduleType = normalizeText(schedule?.schedule_type).toLowerCase();
  const timeZone = validateScheduleTimeZone(schedule);
  let resolvedPeriod: {
    period_start: string;
    period_end: string;
    period_key?: string;
    label?: string;
    pay_date?: string | null;
  };

  if (scheduleType === "semi_monthly") {
    resolvedPeriod = resolveSemiMonthlyPeriod(schedule, referenceDate);
  } else if (scheduleType === "weekly") {
    resolvedPeriod = resolveWeeklyPeriod(schedule, referenceDate);
  } else if (scheduleType === "biweekly") {
    resolvedPeriod = resolveBiweeklyPeriod(schedule, referenceDate);
  } else if (scheduleType === "custom_calendar") {
    const calendarPeriods =
      await base44.asServiceRole.entities.PayPeriodCalendarPeriod.filter({
        pay_period_schedule_id: scheduleId,
      });
    const matches = asArray(calendarPeriods).filter(
      (period: any) =>
        normalizeText(period?.org_id) === organizationId &&
        normalizeText(period?.pay_period_schedule_id) === scheduleId &&
        asNumber(period?.schedule_version, 0) === scheduleVersion &&
        period?.is_active !== false &&
        normalizeDate(period?.period_start) <= referenceDate &&
        normalizeDate(period?.period_end) >= referenceDate
    );

    if (matches.length === 0) {
      throw new RequestError(
        409,
        "No active custom payroll period contains the selected date."
      );
    }
    if (matches.length > 1) {
      throw new RequestError(
        409,
        "Multiple custom payroll periods contain the selected date. An organization administrator must resolve the overlap."
      );
    }

    const period = matches[0];
    const periodStart = normalizeDate(period?.period_start);
    const periodEnd = normalizeDate(period?.period_end);
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
        normalizeText(period?.period_key) ||
        getSchedulePeriodKey(
          scheduleId,
          scheduleVersion,
          periodStart,
          periodEnd
        ),
      label:
        normalizeText(period?.label) ||
        buildDefaultPayPeriodLabel(schedule, periodStart, periodEnd),
      pay_date: normalizeDate(period?.pay_date) || null,
    };
  } else {
    throw new RequestError(
      409,
      "The active payroll schedule has an unsupported schedule type."
    );
  }

  const periodStart = normalizeDate(resolvedPeriod.period_start);
  const periodEnd = normalizeDate(resolvedPeriod.period_end);
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    throw new RequestError(
      409,
      "The payroll schedule resolved an invalid payroll period."
    );
  }

  assertResolvedPeriodFitsSchedule(schedule, periodStart, periodEnd);

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
      getSchedulePeriodKey(scheduleId, scheduleVersion, periodStart, periodEnd),
    label:
      normalizeText(resolvedPeriod.label) ||
      buildDefaultPayPeriodLabel(schedule, periodStart, periodEnd),
    pay_date: normalizeDate(resolvedPeriod.pay_date) || null,
  };
}

function projectPayPeriod(payPeriod: any) {
  return {
    schedule_id: payPeriod.schedule_id,
    schedule_version: payPeriod.schedule_version,
    schedule_name: payPeriod.schedule_name,
    schedule_type: payPeriod.schedule_type,
    time_zone: payPeriod.time_zone,
    period_start: payPeriod.period_start,
    period_end: payPeriod.period_end,
    period_key: payPeriod.period_key,
    label: payPeriod.label,
    pay_date: payPeriod.pay_date,
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
  if (Array.isArray(value)) return value.map(normalizeStableValue);
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

function resolveTimeCardInput(body: any) {
  const candidate = body?.time_card ?? body?.timeCard ?? {};
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new RequestError(400, "Time Card details must be an object.");
  }
  return candidate;
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

function sortEntries(entries: any[]) {
  return [...entries].sort((left, right) => {
    const leftKey = [
      normalizeText(left?.date),
      normalizeText(left?.start_time),
      normalizeText(left?.id),
    ].join("|");
    const rightKey = [
      normalizeText(right?.date),
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

function normalizeCardForResponse(card: any) {
  return {
    id: normalizeText(card?.id),
    org_id: normalizeText(card?.org_id),
    employee_id: normalizeText(card?.employee_id),
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
    total_minutes: asNumber(card?.total_minutes, 0),
    submission_revision: asNumber(card?.submission_revision, 1),
    first_submitted_at: card?.first_submitted_at ?? null,
    last_submitted_at: card?.last_submitted_at ?? null,
    submitted_by_user_id: normalizeText(card?.submitted_by_user_id) || null,
    returned_at: card?.returned_at ?? null,
    returned_by_user_id: normalizeText(card?.returned_by_user_id) || null,
    return_note: normalizeText(card?.return_note) || null,
    approved_at: card?.approved_at ?? null,
    approved_by_user_id: normalizeText(card?.approved_by_user_id) || null,
    approval_note: normalizeText(card?.approval_note) || null,
    archived_at: card?.archived_at ?? null,
  };
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
      "Your account is not authorized to use the Time Card workflow."
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

async function loadScopedEmployee(
  base44: any,
  organizationId: string,
  employeeId: string
) {
  const employee = await base44.asServiceRole.entities.User.get(
    employeeId
  ).catch(() => null);

  if (
    !employee ||
    !isActive(employee) ||
    normalizeText(employee?.org_id) !== organizationId ||
    !getCanonicalStaffRole(employee)
  ) {
    throw new RequestError(
      403,
      "The requested employee is not active in your organization."
    );
  }

  return employee;
}

async function assertManagerMayReviewEmployee(
  base44: any,
  context: any,
  employeeId: string
) {
  await loadScopedEmployee(base44, context.organizationId, employeeId);

  if (employeeId === context.caller.id) {
    throw new RequestError(
      403,
      "You may not return or approve your own Time Card."
    );
  }

  if (context.isOrganizationAdmin) return;
  if (!context.isManagement) {
    throw new RequestError(
      403,
      "Only management or organization administrators may review Time Cards."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: context.caller.id,
      employee_user_id: employeeId,
    });
  const hasActiveDirectReportAssignment = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === context.organizationId &&
      normalizeText(assignment?.manager_user_id) === context.caller.id &&
      normalizeText(assignment?.employee_user_id) === employeeId
  );

  if (!hasActiveDirectReportAssignment) {
    throw new RequestError(
      403,
      "Management may only review Time Cards for active direct reports."
    );
  }
}

async function loadEmployeeTimeCards(
  base44: any,
  organizationId: string,
  employeeId: string
) {
  const cards = await base44.asServiceRole.entities.TimeCard.filter({
    employee_id: employeeId,
  });

  return asArray(cards).filter(
    (card: any) =>
      normalizeText(card?.org_id) === organizationId &&
      normalizeText(card?.employee_id) === employeeId &&
      TIME_CARD_STATUSES.has(getTimeCardStatus(card))
  );
}

async function loadScopedTimeCard(
  base44: any,
  organizationId: string,
  timeCardId: string
) {
  const card = await base44.asServiceRole.entities.TimeCard.get(
    timeCardId
  ).catch(() => null);

  if (!card) throw new RequestError(404, "Time Card was not found.");
  if (
    normalizeText(card?.org_id) !== organizationId ||
    !TIME_CARD_STATUSES.has(getTimeCardStatus(card))
  ) {
    throw new RequestError(
      403,
      "The requested Time Card is not available in your organization."
    );
  }

  return card;
}

async function loadEmployeeEntriesForPeriod(
  base44: any,
  organizationId: string,
  employeeId: string,
  periodStart: string,
  periodEnd: string
) {
  const entries = await base44.asServiceRole.entities.TimeEntry.filter({
    employee_id: employeeId,
  });

  const scopedEntries = asArray(entries).filter(
    (entry: any) =>
      normalizeText(entry?.org_id) === organizationId &&
      normalizeText(entry?.employee_id) === employeeId &&
      normalizeDate(entry?.date) >= periodStart &&
      normalizeDate(entry?.date) <= periodEnd
  );
  const blockedEntries = scopedEntries.filter((entry: any) => {
    const status = normalizeText(entry?.status).toLowerCase() || "submitted";
    return (
      status === "draft" ||
      status === "void" ||
      status === "locked" ||
      Boolean(normalizeText(entry?.locked_in_report_id))
    );
  });

  if (blockedEntries.length > 0) {
    throw new RequestError(
      409,
      "All Time Entries must be submitted and not report-locked before submitting a Time Card. Resolve the blocked entries and try again."
    );
  }

  const eligibleEntries = scopedEntries.filter((entry: any) => {
    const status = normalizeText(entry?.status).toLowerCase() || "submitted";
    return status === "submitted" || status === "approved";
  });

  if (eligibleEntries.length === 0) {
    throw new RequestError(
      400,
      "No eligible submitted Time Entries exist for this payroll period."
    );
  }

  return sortEntries(eligibleEntries);
}

async function loadEntriesByIds(
  base44: any,
  organizationId: string,
  employeeId: string,
  entryIds: string[]
) {
  const requestedIds = new Set(
    entryIds.map((entryId) => normalizeText(entryId)).filter(Boolean)
  );
  if (requestedIds.size === 0) {
    throw new RequestError(
      409,
      "The Time Card does not contain any Time Entry IDs."
    );
  }

  const entries = await base44.asServiceRole.entities.TimeEntry.filter({
    employee_id: employeeId,
  });
  const matchingEntries = asArray(entries).filter(
    (entry: any) =>
      normalizeText(entry?.org_id) === organizationId &&
      normalizeText(entry?.employee_id) === employeeId &&
      requestedIds.has(normalizeText(entry?.id))
  );

  if (matchingEntries.length !== requestedIds.size) {
    throw new RequestError(
      409,
      "One or more Time Entries in this Time Card are missing or no longer available."
    );
  }

  return sortEntries(matchingEntries);
}

function assertNoConflictingTimeCards(
  existingCards: any[],
  periodStart: string,
  periodEnd: string,
  exactReturnedCardId = ""
) {
  const conflictingCard = existingCards.find((card: any) => {
    if (normalizeText(card?.id) === exactReturnedCardId) return false;
    const cardStart = normalizeDate(card?.period_start);
    const cardEnd = normalizeDate(card?.period_end);
    return (
      !cardStart ||
      !cardEnd ||
      periodsOverlap(periodStart, periodEnd, cardStart, cardEnd)
    );
  });

  if (conflictingCard) {
    throw new RequestError(
      409,
      `This payroll period overlaps an existing ${getTimeCardStatus(
        conflictingCard
      )} Time Card.`
    );
  }
}

function assertCardEntriesMatchSnapshot(card: any, currentEntries: any[]) {
  const snapshotEntries = getSnapshotEntries(card);
  if (snapshotEntries.length !== currentEntries.length) {
    throw new RequestError(
      409,
      "The Time Card entries changed after submission. Return the card for correction before approval."
    );
  }

  const snapshotById = new Map(
    snapshotEntries.map((entry: any) => [normalizeText(entry?.id), entry])
  );

  for (const currentEntry of currentEntries) {
    const currentSnapshot = buildEntrySnapshotRecord(currentEntry);
    const submittedSnapshot = snapshotById.get(currentSnapshot.id);
    if (
      !submittedSnapshot ||
      stableStringify(submittedSnapshot) !== stableStringify(currentSnapshot)
    ) {
      throw new RequestError(
        409,
        "The Time Card entries changed after submission. Return the card for correction before approval."
      );
    }
  }
}

function buildTimeCardSubmissionPayload(
  organizationId: string,
  employeeId: string,
  payPeriod: any,
  entries: any[],
  now: string,
  submittedByUserId: string,
  submissionRevision: number,
  firstSubmittedAt: string
) {
  const totalMinutes = entries.reduce(
    (total: number, entry: any) => total + asNumber(entry?.duration_minutes, 0),
    0
  );

  return {
    org_id: organizationId,
    employee_id: employeeId,
    period_start: payPeriod.period_start,
    period_end: payPeriod.period_end,
    period_key: payPeriod.period_key,
    pay_period_schedule_id: payPeriod.schedule_id,
    pay_period_schedule_version: payPeriod.schedule_version,
    pay_period_label: payPeriod.label,
    pay_date: payPeriod.pay_date,
    status: "submitted",
    entry_ids: entries.map((entry: any) => entry.id),
    entry_snapshot: buildEntrySnapshot(entries, now),
    total_minutes: totalMinutes,
    submission_revision: submissionRevision,
    first_submitted_at: firstSubmittedAt,
    last_submitted_at: now,
    submitted_by_user_id: submittedByUserId,
    returned_at: null,
    returned_by_user_id: null,
    return_note: null,
    approved_at: null,
    approved_by_user_id: null,
    approval_note: null,
    archived_at: null,
  };
}

function resolveReferenceDate(body: any, timeCardInput: any) {
  const referenceDate = normalizeDate(
    timeCardInput.reference_date ?? body?.reference_date
  );
  if (!referenceDate) {
    throw new RequestError(
      400,
      "Choose a reference date in YYYY-MM-DD format."
    );
  }
  parseUtcDate(referenceDate);
  return referenceDate;
}

function findExactPeriodCard(existingCards: any[], payPeriod: any) {
  return existingCards.find(
    (card: any) =>
      normalizeText(card?.period_key) === payPeriod.period_key ||
      (normalizeDate(card?.period_start) === payPeriod.period_start &&
        normalizeDate(card?.period_end) === payPeriod.period_end &&
        normalizeText(card?.pay_period_schedule_id) === payPeriod.schedule_id &&
        asNumber(card?.pay_period_schedule_version, 0) ===
          payPeriod.schedule_version)
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();
    if (!ALLOWED_ACTIONS.has(action)) {
      throw new RequestError(
        400,
        "Choose a valid Time Card action."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);
    if (!authenticatedUser?.id) {
      throw new RequestError(401, "You must be signed in to use Time Cards.");
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);
    const timeCardInput = resolveTimeCardInput(body);

    if (action === "resolve_period") {
      const referenceDate = resolveReferenceDate(body, timeCardInput);
      const payPeriod = await resolveOrganizationPayPeriod(
        base44,
        context.organizationId,
        referenceDate
      );

      return Response.json({
        ok: true,
        action,
        organization_id: context.organizationId,
        reference_date: referenceDate,
        pay_period: projectPayPeriod(payPeriod),
      });
    }

    if (action === "preview" || action === "submit") {
      const requestedEmployeeId =
        normalizeText(timeCardInput?.employee_id) || context.caller.id;
      if (requestedEmployeeId !== context.caller.id) {
        throw new RequestError(
          403,
          "Staff may only preview or submit their own Time Card."
        );
      }

      await loadScopedEmployee(
        base44,
        context.organizationId,
        requestedEmployeeId
      );

      if (
        hasOwn(timeCardInput, "period_start") ||
        hasOwn(timeCardInput, "period_end")
      ) {
        throw new RequestError(
          400,
          "Use a reference date to select a payroll period. The payroll period is resolved by your organization schedule."
        );
      }

      const referenceDate = resolveReferenceDate(body, timeCardInput);
      const payPeriod = await resolveOrganizationPayPeriod(
        base44,
        context.organizationId,
        referenceDate
      );
      const existingCards = await loadEmployeeTimeCards(
        base44,
        context.organizationId,
        requestedEmployeeId
      );
      const exactPeriodCard = findExactPeriodCard(existingCards, payPeriod);

      if (
        exactPeriodCard &&
        ["submitted", "approved"].includes(getTimeCardStatus(exactPeriodCard))
      ) {
        throw new RequestError(
          409,
          `A ${getTimeCardStatus(
            exactPeriodCard
          )} Time Card already exists for this payroll period.`
        );
      }

      assertNoConflictingTimeCards(
        existingCards,
        payPeriod.period_start,
        payPeriod.period_end,
        exactPeriodCard &&
          getTimeCardStatus(exactPeriodCard) === "returned"
          ? normalizeText(exactPeriodCard.id)
          : ""
      );

      const entries = await loadEmployeeEntriesForPeriod(
        base44,
        context.organizationId,
        requestedEmployeeId,
        payPeriod.period_start,
        payPeriod.period_end
      );
      const totalMinutes = entries.reduce(
        (total: number, entry: any) =>
          total + asNumber(entry?.duration_minutes, 0),
        0
      );

      if (action === "preview") {
        return Response.json({
          ok: true,
          action,
          organization_id: context.organizationId,
          employee_id: requestedEmployeeId,
          reference_date: referenceDate,
          pay_period: projectPayPeriod(payPeriod),
          total_minutes: totalMinutes,
          total_hours: Number((totalMinutes / 60).toFixed(2)),
          entries: entries.map(buildEntrySnapshotRecord),
          returned_time_card:
            exactPeriodCard &&
            getTimeCardStatus(exactPeriodCard) === "returned"
              ? normalizeCardForResponse(exactPeriodCard)
              : null,
        });
      }

      const now = new Date().toISOString();
      if (
        exactPeriodCard &&
        getTimeCardStatus(exactPeriodCard) === "returned"
      ) {
        const revision =
          Math.max(1, asNumber(exactPeriodCard?.submission_revision, 1)) + 1;
        const updated = await base44.asServiceRole.entities.TimeCard.update(
          exactPeriodCard.id,
          buildTimeCardSubmissionPayload(
            context.organizationId,
            requestedEmployeeId,
            payPeriod,
            entries,
            now,
            context.caller.id,
            revision,
            normalizeText(exactPeriodCard?.first_submitted_at) || now
          )
        );

        return Response.json({
          ok: true,
          action,
          resubmitted: true,
          time_card: normalizeCardForResponse(updated),
        });
      }

      const created = await base44.asServiceRole.entities.TimeCard.create(
        buildTimeCardSubmissionPayload(
          context.organizationId,
          requestedEmployeeId,
          payPeriod,
          entries,
          now,
          context.caller.id,
          1,
          now
        )
      );

      return Response.json({
        ok: true,
        action,
        resubmitted: false,
        time_card: normalizeCardForResponse(created),
      });
    }

    const timeCardId = normalizeText(
      body?.time_card_id || body?.id || timeCardInput?.id
    );
    if (!timeCardId) {
      throw new RequestError(
        400,
        "Choose a Time Card to return or approve."
      );
    }

    const timeCard = await loadScopedTimeCard(
      base44,
      context.organizationId,
      timeCardId
    );
    const employeeId = normalizeText(timeCard?.employee_id);
    if (!employeeId) {
      throw new RequestError(409, "The Time Card has no employee owner.");
    }

    await assertManagerMayReviewEmployee(base44, context, employeeId);

    if (action === "return_for_correction") {
      if (getTimeCardStatus(timeCard) !== "submitted") {
        throw new RequestError(
          409,
          "Only a submitted Time Card may be returned for correction."
        );
      }

      const returnNote = normalizeText(
        body?.return_note ?? timeCardInput?.return_note
      );
      if (!returnNote) {
        throw new RequestError(
          400,
          "Add a correction note before returning this Time Card."
        );
      }

      const returned = await base44.asServiceRole.entities.TimeCard.update(
        timeCard.id,
        {
          status: "returned",
          returned_at: new Date().toISOString(),
          returned_by_user_id: context.caller.id,
          return_note: returnNote,
          approved_at: null,
          approved_by_user_id: null,
          approval_note: null,
          archived_at: null,
        }
      );

      return Response.json({
        ok: true,
        action,
        time_card: normalizeCardForResponse(returned),
      });
    }

    if (getTimeCardStatus(timeCard) !== "submitted") {
      throw new RequestError(
        409,
        "Only a submitted Time Card may be approved."
      );
    }

    const entryIds = asArray(timeCard?.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean);
    const currentEntries = await loadEntriesByIds(
      base44,
      context.organizationId,
      employeeId,
      entryIds
    );
    assertCardEntriesMatchSnapshot(timeCard, currentEntries);

    const approvalNote = normalizeText(
      body?.approval_note ?? timeCardInput?.approval_note
    );
    const now = new Date().toISOString();
    const approved = await base44.asServiceRole.entities.TimeCard.update(
      timeCard.id,
      {
        status: "approved",
        approved_at: now,
        approved_by_user_id: context.caller.id,
        approval_note: approvalNote || null,
        archived_at: now,
      }
    );

    return Response.json({
      ok: true,
      action,
      time_card: normalizeCardForResponse(approved),
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedTimeCard error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to process the Time Card request. Please try again.",
      },
      { status }
    );
  }
});