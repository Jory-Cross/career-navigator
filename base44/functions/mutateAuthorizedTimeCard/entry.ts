import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const INTERNAL_TIME_ENTRY_ROLES = new Set([
  "admin",
  "management",
  "employee",
]);

const TIME_CARD_STATUSES = new Set([
  "submitted",
  "returned",
  "approved",
]);

function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const date = normalizeText(value);

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
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

function isInternalTimeEntryRole(user: any) {
  return INTERNAL_TIME_ENTRY_ROLES.has(
    normalizeText(user?.role).toLowerCase()
  );
}

function getTimeCardStatus(card: any) {
  return normalizeText(card?.status).toLowerCase();
}

function hasOwn(record: any, key: string) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
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
    throw httpError(400, "A valid calendar date is required.");
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
    throw httpError(
      409,
      "The active payroll schedule has an invalid version."
    );
  }

  return version;
}

function validateScheduleTimeZone(schedule: any) {
  const timeZone = normalizeText(schedule?.time_zone);

  if (!timeZone) {
    throw httpError(
      409,
      "The active payroll schedule has no time zone."
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw httpError(
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
    throw httpError(
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
    throw httpError(
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
    throw httpError(
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
    throw httpError(
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
    throw httpError(
      409,
      "No active payroll schedule applies to this date for your organization."
    );
  }

  if (matchingSchedules.length > 1) {
    throw httpError(
      409,
      "Multiple active payroll schedules apply to this date. An organization administrator must resolve the schedule overlap."
    );
  }

  const schedule = matchingSchedules[0];
  const scheduleId = normalizeText(schedule?.id);

  if (!scheduleId) {
    throw httpError(
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
      throw httpError(
        409,
        "No active custom payroll period contains the selected date."
      );
    }

    if (matchingCalendarPeriods.length > 1) {
      throw httpError(
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
      throw httpError(
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
    throw httpError(
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
    throw httpError(
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

function resolveTimeCardInput(body: any) {
  const candidate = body?.time_card ?? body?.timeCard ?? {};

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw httpError(400, "time_card must be an object.");
  }

  return candidate;
}

function buildEntrySnapshotRecord(entry: any) {
  return {
    id: entry.id,
    client_id: entry.client_id ?? null,
    employee_id: entry.employee_id ?? null,
    entry_type_id: entry.entry_type_id ?? null,
    entry_type_code: entry.entry_type_code ?? null,
    date: entry.date ?? null,
    start_time: entry.start_time ?? null,
    end_time: entry.end_time ?? null,
    duration_minutes: asNumber(entry.duration_minutes, 0),
    reporting_period_key: entry.reporting_period_key ?? null,
    location: entry.location ?? null,
    description: entry.description ?? null,
    form_data: asObject(entry.form_data),
    is_billable: entry.is_billable === true,
    is_payroll_eligible: entry.is_payroll_eligible !== false,
    is_reportable: entry.is_reportable !== false,
    status: entry.status ?? null,
    legacy_category: entry.legacy_category ?? null,
    employer_name: entry.employer_name ?? null,
    service_authorization_id:
      entry.service_authorization_id ?? null,
    report_ready: entry.report_ready === true,
    locked_in_report_id: entry.locked_in_report_id ?? null,
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
  return asArray(asObject(card?.entry_snapshot).entries);
}

function normalizeCardForResponse(card: any) {
  return {
    id: card.id,
    org_id: card.org_id,
    employee_id: card.employee_id,
    period_start: card.period_start,
    period_end: card.period_end,
    period_key: card.period_key,
    pay_period_schedule_id:
      card.pay_period_schedule_id ?? null,
    pay_period_schedule_version:
      asNumber(card.pay_period_schedule_version, 0) || null,
    pay_period_label: card.pay_period_label ?? null,
    pay_date: card.pay_date ?? null,
    status: card.status,
    entry_ids: asArray(card.entry_ids),
    total_minutes: asNumber(card.total_minutes, 0),
    submission_revision: asNumber(card.submission_revision, 1),
    first_submitted_at: card.first_submitted_at ?? null,
    last_submitted_at: card.last_submitted_at ?? null,
    submitted_by_user_id: card.submitted_by_user_id ?? null,
    returned_at: card.returned_at ?? null,
    returned_by_user_id: card.returned_by_user_id ?? null,
    return_note: card.return_note ?? null,
    approved_at: card.approved_at ?? null,
    approved_by_user_id: card.approved_by_user_id ?? null,
    approval_note: card.approval_note ?? null,
    archived_at: card.archived_at ?? null,
  };
}

async function getCaller(
  base44: any,
  authenticatedUser: any
) {
  const caller =
    await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw httpError(
      403,
      "Authenticated user record was not found or is inactive."
    );
  }

  if (!isInternalTimeEntryRole(caller)) {
    throw httpError(
      403,
      "You are not authorized to use the Time Card workflow."
    );
  }

  const organizationId = normalizeText(caller.org_id);

  if (!organizationId) {
    throw httpError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw httpError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  const role = normalizeText(caller.role).toLowerCase();

  return {
    caller,
    organizationId,
    capabilities: {
      role,
      isOrganizationAdmin: role === "admin",
      isManagement: role === "management",
    },
  };
}

async function loadScopedEmployee(
  base44: any,
  organizationId: string,
  employeeId: string
) {
  const employee =
    await base44.asServiceRole.entities.User.get(
      employeeId
    ).catch(() => null);

  if (
    !employee ||
    !isActive(employee) ||
    normalizeText(employee.org_id) !== organizationId ||
    !isInternalTimeEntryRole(employee)
  ) {
    throw httpError(
      403,
      "The requested employee is not active in your organization."
    );
  }

  return employee;
}

async function assertManagerMayReviewEmployee(
  base44: any,
  caller: any,
  organizationId: string,
  capabilities: any,
  employeeId: string
) {
  await loadScopedEmployee(base44, organizationId, employeeId);

  if (employeeId === caller.id) {
    throw httpError(
      403,
      "You may not return or approve your own Time Card."
    );
  }

  if (capabilities.isOrganizationAdmin) {
    return;
  }

  if (!capabilities.isManagement) {
    throw httpError(
      403,
      "Only management or organization administrators may review Time Cards."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: caller.id,
      employee_user_id: employeeId,
    });

  const hasActiveDirectReportAssignment = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.manager_user_id) === caller.id &&
      normalizeText(assignment?.employee_user_id) === employeeId &&
      normalizeText(assignment?.org_id) === organizationId
  );

  if (!hasActiveDirectReportAssignment) {
    throw httpError(
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
  const cards =
    await base44.asServiceRole.entities.TimeCard.filter({
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
  const card =
    await base44.asServiceRole.entities.TimeCard.get(
      timeCardId
    ).catch(() => null);

  if (!card) {
    throw httpError(404, "Time Card was not found.");
  }

  if (
    normalizeText(card.org_id) !== organizationId ||
    !TIME_CARD_STATUSES.has(getTimeCardStatus(card))
  ) {
    throw httpError(
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
  const entries =
    await base44.asServiceRole.entities.TimeEntry.filter({
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
    const status =
      normalizeText(entry?.status).toLowerCase() || "submitted";

    return (
      status === "draft" ||
      status === "void" ||
      status === "locked" ||
      Boolean(normalizeText(entry?.locked_in_report_id))
    );
  });

  if (blockedEntries.length > 0) {
    throw httpError(
      409,
      `All Time Entries must be submitted and not report-locked before submitting a Time Card. Resolve these entries first: ${blockedEntries
        .map((entry: any) => entry.id)
        .join(", ")}.`
    );
  }

  const eligibleEntries = scopedEntries.filter((entry: any) => {
    const status =
      normalizeText(entry?.status).toLowerCase() || "submitted";

    return status === "submitted" || status === "approved";
  });

  if (eligibleEntries.length === 0) {
    throw httpError(
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
    throw httpError(
      409,
      "The Time Card does not contain any Time Entry IDs."
    );
  }

  const entries =
    await base44.asServiceRole.entities.TimeEntry.filter({
      employee_id: employeeId,
    });

  const matchingEntries = asArray(entries).filter(
    (entry: any) =>
      normalizeText(entry?.org_id) === organizationId &&
      normalizeText(entry?.employee_id) === employeeId &&
      requestedIds.has(normalizeText(entry?.id))
  );

  if (matchingEntries.length !== requestedIds.size) {
    throw httpError(
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
    if (card.id === exactReturnedCardId) {
      return false;
    }

    const cardStart = normalizeDate(card.period_start);
    const cardEnd = normalizeDate(card.period_end);

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
    throw httpError(
      409,
      `This payroll period overlaps an existing ${getTimeCardStatus(
        conflictingCard
      )} Time Card (${conflictingCard.id}).`
    );
  }
}

function assertCardEntriesMatchSnapshot(
  card: any,
  currentEntries: any[]
) {
  const snapshotEntries = getSnapshotEntries(card);

  if (snapshotEntries.length !== currentEntries.length) {
    throw httpError(
      409,
      "The Time Card entries changed after submission. Return the card for correction before approval."
    );
  }

  const snapshotById = new Map(
    snapshotEntries.map((entry: any) => [
      normalizeText(entry?.id),
      entry,
    ])
  );

  for (const currentEntry of currentEntries) {
    const currentSnapshot = buildEntrySnapshotRecord(currentEntry);
    const submittedSnapshot = snapshotById.get(currentSnapshot.id);

    if (
      !submittedSnapshot ||
      stableStringify(submittedSnapshot) !==
        stableStringify(currentSnapshot)
    ) {
      throw httpError(
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
  const entryIds = entries.map((entry: any) => entry.id);
  const totalMinutes = entries.reduce(
    (total: number, entry: any) =>
      total + asNumber(entry?.duration_minutes, 0),
    0
  );

  return {
    org_id: organizationId,
    employee_id: employeeId,
    period_start: payPeriod.period_start,
    period_end: payPeriod.period_end,
    period_key: payPeriod.period_key,
    pay_period_schedule_id: payPeriod.schedule_id,
    pay_period_schedule_version:
      payPeriod.schedule_version,
    pay_period_label: payPeriod.label,
    pay_date: payPeriod.pay_date,
    status: "submitted",
    entry_ids: entryIds,
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

    if (!authenticatedUser) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const action = normalizeText(body.action).toLowerCase();

    if (
      ![
        "preview",
        "submit",
        "return_for_correction",
        "approve",
      ].includes(action)
    ) {
      throw httpError(
        400,
        "action must be preview, submit, return_for_correction, or approve."
      );
    }

    const {
      caller,
      organizationId,
      capabilities,
    } = await getCaller(base44, authenticatedUser);

    const timeCardInput = resolveTimeCardInput(body);

    if (action === "preview" || action === "submit") {
      const requestedEmployeeId =
        normalizeText(timeCardInput.employee_id) || caller.id;

      if (requestedEmployeeId !== caller.id) {
        throw httpError(
          403,
          "Staff may only preview or submit their own Time Card."
        );
      }

      await loadScopedEmployee(
        base44,
        organizationId,
        requestedEmployeeId
      );

      const periodStart = normalizeDate(
        timeCardInput.period_start
      );
      const periodEnd = normalizeDate(timeCardInput.period_end);

      if (!periodStart || !periodEnd) {
        throw httpError(
          400,
          "period_start and period_end are required in YYYY-MM-DD format."
        );
      }

      if (periodStart > periodEnd) {
        throw httpError(
          400,
          "period_start cannot be after period_end."
        );
      }

      const existingCards = await loadEmployeeTimeCards(
        base44,
        organizationId,
        requestedEmployeeId
      );

      const exactPeriodCard = existingCards.find(
        (card: any) =>
          normalizeDate(card.period_start) === periodStart &&
          normalizeDate(card.period_end) === periodEnd
      );

      if (
        exactPeriodCard &&
        ["submitted", "approved"].includes(
          getTimeCardStatus(exactPeriodCard)
        )
      ) {
        throw httpError(
          409,
          `A ${getTimeCardStatus(
            exactPeriodCard
          )} Time Card already exists for this payroll period.`
        );
      }

      assertNoConflictingTimeCards(
        existingCards,
        periodStart,
        periodEnd,
        exactPeriodCard &&
          getTimeCardStatus(exactPeriodCard) === "returned"
          ? exactPeriodCard.id
          : ""
      );

      const entries = await loadEmployeeEntriesForPeriod(
        base44,
        organizationId,
        requestedEmployeeId,
        periodStart,
        periodEnd
      );

      const now = new Date().toISOString();
      const totalMinutes = entries.reduce(
        (total: number, entry: any) =>
          total + asNumber(entry?.duration_minutes, 0),
        0
      );

      if (action === "preview") {
        return Response.json({
          ok: true,
          action,
          organization_id: organizationId,
          employee_id: requestedEmployeeId,
          period_start: periodStart,
          period_end: periodEnd,
          period_key: getPeriodKey(periodStart, periodEnd),
          total_minutes: totalMinutes,
          total_hours: Number(
            (totalMinutes / 60).toFixed(2)
          ),
          entries: entries.map(buildEntrySnapshotRecord),
          returned_time_card:
            exactPeriodCard &&
            getTimeCardStatus(exactPeriodCard) === "returned"
              ? normalizeCardForResponse(exactPeriodCard)
              : null,
        });
      }

      if (
        exactPeriodCard &&
        getTimeCardStatus(exactPeriodCard) === "returned"
      ) {
        const revision =
          Math.max(
            1,
            asNumber(exactPeriodCard.submission_revision, 1)
          ) + 1;

        const updated =
          await base44.asServiceRole.entities.TimeCard.update(
            exactPeriodCard.id,
            buildTimeCardSubmissionPayload(
              organizationId,
              requestedEmployeeId,
              periodStart,
              periodEnd,
              entries,
              now,
              caller.id,
              revision,
              normalizeText(exactPeriodCard.first_submitted_at) ||
                now
            )
          );

        return Response.json({
          ok: true,
          action,
          resubmitted: true,
          time_card: normalizeCardForResponse(updated),
        });
      }

      const created =
        await base44.asServiceRole.entities.TimeCard.create(
          buildTimeCardSubmissionPayload(
            organizationId,
            requestedEmployeeId,
            periodStart,
            periodEnd,
            entries,
            now,
            caller.id,
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
      body.time_card_id || body.id || timeCardInput.id
    );

    if (!timeCardId) {
      throw httpError(
        400,
        "time_card_id is required for return_for_correction or approve."
      );
    }

    const timeCard = await loadScopedTimeCard(
      base44,
      organizationId,
      timeCardId
    );

    const employeeId = normalizeText(timeCard.employee_id);

    if (!employeeId) {
      throw httpError(
        409,
        "The Time Card has no employee owner."
      );
    }

    await assertManagerMayReviewEmployee(
      base44,
      caller,
      organizationId,
      capabilities,
      employeeId
    );

    if (action === "return_for_correction") {
      if (getTimeCardStatus(timeCard) !== "submitted") {
        throw httpError(
          409,
          "Only a submitted Time Card may be returned for correction."
        );
      }

      const returnNote = normalizeText(
        body.return_note ?? timeCardInput.return_note
      );

      if (!returnNote) {
        throw httpError(
          400,
          "return_note is required when returning a Time Card for correction."
        );
      }

      const returned =
        await base44.asServiceRole.entities.TimeCard.update(
          timeCard.id,
          {
            status: "returned",
            returned_at: new Date().toISOString(),
            returned_by_user_id: caller.id,
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
      throw httpError(
        409,
        "Only a submitted Time Card may be approved."
      );
    }

    const entryIds = asArray(timeCard.entry_ids)
      .map((entryId) => normalizeText(entryId))
      .filter(Boolean);

    const currentEntries = await loadEntriesByIds(
      base44,
      organizationId,
      employeeId,
      entryIds
    );

    assertCardEntriesMatchSnapshot(
      timeCard,
      currentEntries
    );

    const approvalNote = normalizeText(
      body.approval_note ?? timeCardInput.approval_note
    );

    const now = new Date().toISOString();

    const approved =
      await base44.asServiceRole.entities.TimeCard.update(
        timeCard.id,
        {
          status: "approved",
          approved_at: now,
          approved_by_user_id: caller.id,
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
    console.error(
      "mutateAuthorizedTimeCard error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to process the Time Card request.",
      },
      {
        status:
          typeof error?.status === "number"
            ? error.status
            : 500,
      }
    );
  }
});
