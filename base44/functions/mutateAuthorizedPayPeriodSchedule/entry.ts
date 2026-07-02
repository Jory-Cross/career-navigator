import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const SUPPORTED_SCHEDULE_TYPES = new Set([
  "semi_monthly",
  "weekly",
  "biweekly",
  "custom_calendar",
]);

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
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

function getScheduleVersion(schedule: any) {
  const version = asNumber(schedule?.version, 0);

  return Number.isInteger(version) && version > 0
    ? version
    : 1;
}

function resolveScheduleInput(body: any) {
  const candidate =
    body?.schedule ??
    body?.pay_period_schedule ??
    {};

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw httpError(400, "schedule must be an object.");
  }

  return candidate;
}

function assertValidTimeZone(timeZone: string) {
  if (!timeZone) {
    throw httpError(400, "time_zone is required.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw httpError(
      400,
      "time_zone must be a valid IANA time zone."
    );
  }

  return timeZone;
}

function normalizeScheduleConfig(input: any) {
  const name = normalizeText(input?.name);
  const scheduleType = normalizeText(
    input?.schedule_type
  ).toLowerCase();
  const timeZone = assertValidTimeZone(
    normalizeText(input?.time_zone)
  );
  const effectiveStartDate = normalizeDate(
    input?.effective_start_date
  );

  if (!name) {
    throw httpError(400, "schedule.name is required.");
  }

  if (!SUPPORTED_SCHEDULE_TYPES.has(scheduleType)) {
    throw httpError(
      400,
      "schedule.schedule_type must be semi_monthly, weekly, biweekly, or custom_calendar."
    );
  }

  if (!effectiveStartDate) {
    throw httpError(
      400,
      "schedule.effective_start_date is required in YYYY-MM-DD format."
    );
  }

  parseUtcDate(effectiveStartDate);

  const semiMonthlyFirstPeriodEndDay =
    asNumber(
      input?.semi_monthly_first_period_end_day,
      15
    );

  const biweeklyAnchorPeriodStart = normalizeDate(
    input?.biweekly_anchor_period_start
  );

  const weeklyPeriodStartDay = normalizeText(
    input?.weekly_period_start_day
  ).toLowerCase();

  const customCalendarNote =
    normalizeText(input?.custom_calendar_note) || null;

  if (scheduleType === "semi_monthly") {
    if (
      !Number.isInteger(semiMonthlyFirstPeriodEndDay) ||
      semiMonthlyFirstPeriodEndDay < 1 ||
      semiMonthlyFirstPeriodEndDay > 28
    ) {
      throw httpError(
        400,
        "semi_monthly_first_period_end_day must be a whole number from 1 through 28."
      );
    }
  }

  if (scheduleType === "weekly") {
    if (
      !Object.prototype.hasOwnProperty.call(
        WEEKDAY_INDEX_BY_NAME,
        weeklyPeriodStartDay
      )
    ) {
      throw httpError(
        400,
        "weekly_period_start_day must be sunday through saturday."
      );
    }
  }

  if (scheduleType === "biweekly") {
    if (!biweeklyAnchorPeriodStart) {
      throw httpError(
        400,
        "biweekly_anchor_period_start is required for a biweekly schedule."
      );
    }

    parseUtcDate(biweeklyAnchorPeriodStart);
  }

  return {
    name,
    schedule_type: scheduleType,
    time_zone: timeZone,
    effective_start_date: effectiveStartDate,
    semi_monthly_first_period_end_day:
      scheduleType === "semi_monthly"
        ? semiMonthlyFirstPeriodEndDay
        : null,
    biweekly_anchor_period_start:
      scheduleType === "biweekly"
        ? biweeklyAnchorPeriodStart
        : null,
    weekly_period_start_day:
      scheduleType === "weekly"
        ? weeklyPeriodStartDay
        : null,
    custom_calendar_note:
      scheduleType === "custom_calendar"
        ? customCalendarNote
        : null,
  };
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
      "The payroll schedule has an invalid semi-monthly end day."
    );
  }

  const parsedReferenceDate = parseUtcDate(referenceDate);
  const referenceDay = parsedReferenceDate.getUTCDate();
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
      period_start: getMonthStart(referenceDate),
      period_end: firstPeriodEnd,
    };
  }

  return {
    period_start: addDays(firstPeriodEnd, 1),
    period_end: getMonthEnd(referenceDate),
  };
}

function resolveWeeklyPeriod(
  schedule: any,
  referenceDate: string
) {
  const weeklyPeriodStartDay = normalizeText(
    schedule?.weekly_period_start_day
  ).toLowerCase();

  if (
    !Object.prototype.hasOwnProperty.call(
      WEEKDAY_INDEX_BY_NAME,
      weeklyPeriodStartDay
    )
  ) {
    throw httpError(
      409,
      "The payroll schedule has an invalid weekly period-start day."
    );
  }

  const referenceDayOfWeek =
    parseUtcDate(referenceDate).getUTCDay();

  const offset =
    (referenceDayOfWeek -
      WEEKDAY_INDEX_BY_NAME[weeklyPeriodStartDay] +
      7) %
    7;

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
      "The payroll schedule has no biweekly anchor period start."
    );
  }

  const offsetDays = daysBetween(
    anchorPeriodStart,
    referenceDate
  );

  const completedPeriods = Math.floor(offsetDays / 14);
  const periodStart = addDays(
    anchorPeriodStart,
    completedPeriods * 14
  );

  return {
    period_start: periodStart,
    period_end: addDays(periodStart, 13),
  };
}

function resolveNonCustomPeriod(
  schedule: any,
  referenceDate: string
) {
  const scheduleType = normalizeText(
    schedule?.schedule_type
  ).toLowerCase();

  if (scheduleType === "semi_monthly") {
    return resolveSemiMonthlyPeriod(schedule, referenceDate);
  }

  if (scheduleType === "weekly") {
    return resolveWeeklyPeriod(schedule, referenceDate);
  }

  if (scheduleType === "biweekly") {
    return resolveBiweeklyPeriod(schedule, referenceDate);
  }

  throw httpError(
    409,
    "Custom-calendar schedules require explicit payroll periods and cannot be activated by this function."
  );
}

function assertScheduleBeginsAtPeriodBoundary(
  scheduleConfig: any
) {
  const firstPeriod = resolveNonCustomPeriod(
    scheduleConfig,
    scheduleConfig.effective_start_date
  );

  if (
    firstPeriod.period_start !==
    scheduleConfig.effective_start_date
  ) {
    throw httpError(
      400,
      `effective_start_date must be the first day of a complete ${scheduleConfig.schedule_type} payroll period.`
    );
  }

  if (
    scheduleConfig.schedule_type === "biweekly" &&
    scheduleConfig.biweekly_anchor_period_start !==
      scheduleConfig.effective_start_date
  ) {
    throw httpError(
      400,
      "For a biweekly schedule, biweekly_anchor_period_start must equal effective_start_date."
    );
  }
}

function isScheduleActiveForResolver(schedule: any) {
  return (
    schedule?.is_active !== false &&
    Boolean(normalizeDate(schedule?.effective_start_date))
  );
}

function scheduleOverlapsRange(
  schedule: any,
  rangeStart: string,
  rangeEnd: string | null
) {
  const scheduleStart = normalizeDate(
    schedule?.effective_start_date
  );
  const scheduleEnd =
    normalizeDate(schedule?.effective_end_date) ||
    "9999-12-31";
  const normalizedRangeEnd = rangeEnd || "9999-12-31";

  if (!scheduleStart) {
    return true;
  }

  return (
    scheduleStart <= normalizedRangeEnd &&
    rangeStart <= scheduleEnd
  );
}

function normalizeScheduleForResponse(schedule: any) {
  return {
    id: schedule.id,
    org_id: schedule.org_id,
    name: schedule.name,
    schedule_type: schedule.schedule_type,
    time_zone: schedule.time_zone,
    effective_start_date:
      schedule.effective_start_date,
    effective_end_date:
      schedule.effective_end_date ?? null,
    version: getScheduleVersion(schedule),
    supersedes_schedule_id:
      schedule.supersedes_schedule_id ?? null,
    is_active: schedule.is_active !== false,
    semi_monthly_first_period_end_day:
      schedule.semi_monthly_first_period_end_day ?? null,
    biweekly_anchor_period_start:
      schedule.biweekly_anchor_period_start ?? null,
    weekly_period_start_day:
      schedule.weekly_period_start_day ?? null,
    custom_calendar_note:
      schedule.custom_calendar_note ?? null,
    created_by_user_id:
      schedule.created_by_user_id ?? null,
    retired_at: schedule.retired_at ?? null,
    retired_by_user_id:
      schedule.retired_by_user_id ?? null,
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

  if (normalizeText(caller.role).toLowerCase() !== "admin") {
    throw httpError(
      403,
      "Only organization administrators may configure payroll schedules."
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

  return {
    caller,
    organizationId,
  };
}

async function loadOrganizationSchedules(
  base44: any,
  organizationId: string
) {
  const schedules =
    await base44.asServiceRole.entities.PayPeriodSchedule.filter({
      org_id: organizationId,
    });

  return asArray(schedules)
    .filter(
      (schedule: any) =>
        normalizeText(schedule?.org_id) === organizationId
    )
    .sort((left: any, right: any) => {
      const leftStart = normalizeDate(
        left?.effective_start_date
      );
      const rightStart = normalizeDate(
        right?.effective_start_date
      );

      return rightStart.localeCompare(leftStart);
    });
}

function getNextVersion(schedules: any[]) {
  const highestVersion = schedules.reduce(
    (highest: number, schedule: any) =>
      Math.max(highest, getScheduleVersion(schedule)),
    0
  );

  return highestVersion + 1;
}

function buildScheduleCreatePayload(
  organizationId: string,
  scheduleConfig: any,
  version: number,
  callerId: string,
  supersedesScheduleId: string | null = null
) {
  return {
    org_id: organizationId,
    name: scheduleConfig.name,
    schedule_type: scheduleConfig.schedule_type,
    time_zone: scheduleConfig.time_zone,
    effective_start_date:
      scheduleConfig.effective_start_date,
    effective_end_date: null,
    version,
    supersedes_schedule_id: supersedesScheduleId,
    is_active: true,
    semi_monthly_first_period_end_day:
      scheduleConfig.semi_monthly_first_period_end_day,
    biweekly_anchor_period_start:
      scheduleConfig.biweekly_anchor_period_start,
    weekly_period_start_day:
      scheduleConfig.weekly_period_start_day,
    custom_calendar_note:
      scheduleConfig.custom_calendar_note,
    created_by_user_id: callerId,
    retired_at: null,
    retired_by_user_id: null,
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
        "list",
        "preview",
        "create",
        "replace",
        "extend_start",
      ].includes(action)
    ) {
      throw httpError(
        400,
        "action must be list, preview, create, replace, or extend_start."
      );
    }

    const { caller, organizationId } = await getCaller(
      base44,
      authenticatedUser
    );

    const schedules = await loadOrganizationSchedules(
      base44,
      organizationId
    );

        if (action === "list") {
      return Response.json({
        ok: true,
        action,
        schedules: schedules.map(normalizeScheduleForResponse),
      });
    }

    if (action === "extend_start") {
      const scheduleId = normalizeText(
        body.schedule_id ??
          body.pay_period_schedule_id ??
          body.id
      );

      const requestedStartDate = normalizeDate(
        body.effective_start_date
      );

      if (!scheduleId) {
        throw httpError(
          400,
          "schedule_id is required when extending a payroll schedule backward."
        );
      }

      if (!requestedStartDate) {
        throw httpError(
          400,
          "effective_start_date is required in YYYY-MM-DD format."
        );
      }

      parseUtcDate(requestedStartDate);

      const targetSchedule = schedules.find(
        (schedule: any) =>
          normalizeText(schedule?.id) === scheduleId &&
          isScheduleActiveForResolver(schedule)
      );

      if (!targetSchedule) {
        throw httpError(
          404,
          "The active payroll schedule selected for extension was not found."
        );
      }

      if (normalizeDate(targetSchedule.effective_end_date)) {
        throw httpError(
          409,
          "Only the currently open payroll schedule may be extended backward."
        );
      }

      const currentStartDate = normalizeDate(
        targetSchedule.effective_start_date
      );

      if (!currentStartDate) {
        throw httpError(
          409,
          "The payroll schedule has no valid effective start date."
        );
      }

      if (requestedStartDate >= currentStartDate) {
        throw httpError(
          400,
          "effective_start_date must be earlier than the schedule's current effective start date."
        );
      }

      const firstAddedPeriod = resolveNonCustomPeriod(
        targetSchedule,
        requestedStartDate
      );

      if (
        firstAddedPeriod.period_start !==
        requestedStartDate
      ) {
        throw httpError(
          400,
          "effective_start_date must be the first day of a complete payroll period."
        );
      }

      const finalNewCoverageDate = addDays(
        currentStartDate,
        -1
      );

      const overlappingSchedule = schedules.find(
        (schedule: any) =>
          normalizeText(schedule?.id) !== scheduleId &&
          isScheduleActiveForResolver(schedule) &&
          scheduleOverlapsRange(
            schedule,
            requestedStartDate,
            finalNewCoverageDate
          )
      );

      if (overlappingSchedule) {
        throw httpError(
          409,
          `Another payroll schedule already covers part of this historical period (${overlappingSchedule.id}).`
        );
      }

      const updated =
        await base44.asServiceRole.entities.PayPeriodSchedule.update(
          targetSchedule.id,
          {
            effective_start_date: requestedStartDate,
          }
        );

      return Response.json({
        ok: true,
        action,
        prior_effective_start_date: currentStartDate,
        first_added_period: firstAddedPeriod,
        schedule: normalizeScheduleForResponse(updated),
      });
    }

    const scheduleInput = resolveScheduleInput(body);
    const scheduleConfig = normalizeScheduleConfig(
      scheduleInput
    );

    if (scheduleConfig.schedule_type === "custom_calendar") {
      throw httpError(
        409,
        "Custom-calendar schedules must be activated after explicit calendar periods are created. Configure a semi-monthly, weekly, or biweekly schedule here first."
      );
    }

    assertScheduleBeginsAtPeriodBoundary(scheduleConfig);

    const firstResolvedPeriod = resolveNonCustomPeriod(
      scheduleConfig,
      scheduleConfig.effective_start_date
    );

    if (action === "preview") {
      return Response.json({
        ok: true,
        action,
        configuration: scheduleConfig,
        next_version: getNextVersion(schedules),
        first_resolved_period: {
          period_start: firstResolvedPeriod.period_start,
          period_end: firstResolvedPeriod.period_end,
        },
      });
    }

    const nextVersion = getNextVersion(schedules);

    if (action === "create") {
      const conflictingSchedule = schedules.find(
        (schedule: any) =>
          isScheduleActiveForResolver(schedule) &&
          scheduleOverlapsRange(
            schedule,
            scheduleConfig.effective_start_date,
            null
          )
      );

      if (conflictingSchedule) {
        throw httpError(
          409,
          `An existing payroll schedule overlaps this effective date (${conflictingSchedule.id}). Use replace to create a new schedule version at a payroll-period boundary.`
        );
      }

      const created =
        await base44.asServiceRole.entities.PayPeriodSchedule.create(
          buildScheduleCreatePayload(
            organizationId,
            scheduleConfig,
            nextVersion,
            caller.id
          )
        );

      return Response.json({
        ok: true,
        action,
        schedule: normalizeScheduleForResponse(created),
        first_resolved_period: firstResolvedPeriod,
      });
    }

    const replacesScheduleId = normalizeText(
      body.replaces_schedule_id ??
        scheduleInput.replaces_schedule_id
    );

    if (!replacesScheduleId) {
      throw httpError(
        400,
        "replaces_schedule_id is required when replacing a payroll schedule."
      );
    }

    const replacedSchedule = schedules.find(
      (schedule: any) =>
        normalizeText(schedule?.id) === replacesScheduleId &&
        isScheduleActiveForResolver(schedule)
    );

    if (!replacedSchedule) {
      throw httpError(
        404,
        "The payroll schedule selected for replacement was not found."
      );
    }

    const existingEndDate = normalizeDate(
      replacedSchedule.effective_end_date
    );

    if (existingEndDate) {
      throw httpError(
        409,
        "Only the currently open payroll schedule may be replaced."
      );
    }

    const replacementStartDate =
      scheduleConfig.effective_start_date;
    const priorScheduleEndDate = addDays(
      replacementStartDate,
      -1
    );

    if (
      normalizeDate(replacedSchedule.effective_start_date) >
      priorScheduleEndDate
    ) {
      throw httpError(
        400,
        "The replacement effective date must occur after the prior schedule began."
      );
    }

    const oldSchedulePeriod = resolveNonCustomPeriod(
      replacedSchedule,
      priorScheduleEndDate
    );

    if (
      oldSchedulePeriod.period_end !==
      priorScheduleEndDate
    ) {
      throw httpError(
        400,
        "The replacement effective date must begin immediately after the prior schedule's payroll period ends."
      );
    }

    const otherConflict = schedules.find(
      (schedule: any) =>
        normalizeText(schedule?.id) !== replacesScheduleId &&
        isScheduleActiveForResolver(schedule) &&
        scheduleOverlapsRange(
          schedule,
          replacementStartDate,
          null
        )
    );

    if (otherConflict) {
      throw httpError(
        409,
        `Another payroll schedule already overlaps the replacement date (${otherConflict.id}).`
      );
    }

    const priorScheduleRollback = {
      effective_end_date:
        replacedSchedule.effective_end_date ?? null,
      retired_at: replacedSchedule.retired_at ?? null,
      retired_by_user_id:
        replacedSchedule.retired_by_user_id ?? null,
    };

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PayPeriodSchedule.update(
      replacedSchedule.id,
      {
        effective_end_date: priorScheduleEndDate,
        retired_at: now,
        retired_by_user_id: caller.id,
      }
    );

    let created: any = null;

    try {
      created =
        await base44.asServiceRole.entities.PayPeriodSchedule.create(
          buildScheduleCreatePayload(
            organizationId,
            scheduleConfig,
            nextVersion,
            caller.id,
            replacedSchedule.id
          )
        );
    } catch (error) {
      await base44.asServiceRole.entities.PayPeriodSchedule.update(
        replacedSchedule.id,
        priorScheduleRollback
      ).catch(() => null);

      throw httpError(
        500,
        "The replacement payroll schedule could not be created safely. The prior schedule was restored."
      );
    }

    return Response.json({
      ok: true,
      action,
      retired_schedule: {
        id: replacedSchedule.id,
        effective_end_date: priorScheduleEndDate,
      },
      schedule: normalizeScheduleForResponse(created),
      first_resolved_period: firstResolvedPeriod,
    });
  } catch (error: any) {
    console.error(
      "mutateAuthorizedPayPeriodSchedule error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to process the payroll schedule request.",
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
