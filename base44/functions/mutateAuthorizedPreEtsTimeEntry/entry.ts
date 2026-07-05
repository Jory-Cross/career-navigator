import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const SUPPORTED_ACTIONS = new Set([
  "create_student_entry",
  "resubmit_student_entry",
  "review_entry",
]);

const PRE_ETS_TIME_CARD_STATUSES = new Set([
  "submitted_to_staff",
  "returned_to_student",
  "submitted_to_manager_payroll",
  "returned_to_staff",
  "finalized",
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

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function isStudentPortalUser(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "pre_ets" &&
    normalizeText(user?.access_level).toLowerCase() === "client_portal"
  );
}

function isPreEtsClientInOrganization(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function clientMatchesVisibleStaff(
  client: any,
  visibleUserIds: Set<string>
) {
  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  return visibleUserIds.has(assignedEmployeeId);
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

  return minutes % 15 === 0 ? hours * 60 + minutes : null;
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
    throw new RequestError(400, "A valid service date is required.");
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
    throw new RequestError(400, "End time must be later than start time.");
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
      )}`.trim() ||
      "Pre-ETS student",
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
      "Your account could not be verified as active."
    );
  }

  const organizationId = normalizeText(caller.org_id);

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
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return { caller, organizationId };
}

async function resolveStudentClient(
  base44: any,
  caller: any,
  organizationId: string
) {
  if (!isStudentPortalUser(caller)) {
    throw new RequestError(
      403,
      "You are not authorized to submit Pre-ETS student time entries."
    );
  }

  const linkedClientId = normalizeText(caller?.linked_client_id);

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
  const callerRole = getCanonicalStaffRole(caller);

  if (!callerRole) {
    throw new RequestError(
      403,
      "You are not authorized to review Pre-ETS student time entries."
    );
  }

  const client = await base44.asServiceRole.entities.Client.get(clientId).catch(
    () => null
  );

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(404, "Pre-ETS client not found.");
  }

  if (callerRole === "admin") {
    return client;
  }

  const organizationUsers = await base44.asServiceRole.entities.User.filter({
    org_id: organizationId,
  });
  const activeCanonicalUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId &&
      Boolean(getCanonicalStaffRole(user))
  );

  if (
    !activeCanonicalUsers.some(
      (user: any) => normalizeText(user?.id) === callerId
    )
  ) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  const visibleUserIds = new Set<string>([callerId]);

  if (callerRole === "management") {
    const assignments =
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        manager_user_id: callerId,
      });
    const activeUsersById = new Map(
      activeCanonicalUsers.map((user: any) => [normalizeText(user?.id), user])
    );

    for (const assignment of asArray(assignments)) {
      const employeeId = normalizeText(assignment?.employee_user_id);
      const employee = activeUsersById.get(employeeId);

      if (
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment?.org_id) === organizationId &&
        employee
      ) {
        visibleUserIds.add(employeeId);
      }
    }
  }

  if (!clientMatchesVisibleStaff(client, visibleUserIds)) {
    throw new RequestError(404, "Pre-ETS client not found.");
  }

  return client;
}

async function resolveStaffEntry(
  base44: any,
  caller: any,
  organizationId: string,
  entryId: string
) {
  if (!entryId) {
    throw new RequestError(400, "Choose a Pre-ETS time entry to review.");
  }

  const entry =
    await base44.asServiceRole.entities.PreEtsClientTimeEntry.get(entryId).catch(
      () => null
    );

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

  return { entry, client };
}

function getTimeCardPeriod(card: any) {
  const periodStart = normalizeText(card?.period_start);
  const periodEnd = normalizeText(card?.period_end);

  if (
    !isValidIsoDate(periodStart) ||
    !isValidIsoDate(periodEnd) ||
    periodStart > periodEnd
  ) {
    return null;
  }

  return { periodStart, periodEnd };
}

async function loadClientTimeCards(
  base44: any,
  organizationId: string,
  clientId: string
) {
  const cards = await base44.asServiceRole.entities.PreEtsTimeCard.filter({
    client_id: clientId,
  });
  const matchingClientCards = asArray(cards).filter(
    (card: any) => normalizeText(card?.client_id) === clientId
  );

  if (
    matchingClientCards.some(
      (card: any) => normalizeText(card?.org_id) !== organizationId
    )
  ) {
    throw new RequestError(
      409,
      "Pre-ETS Time Card data cannot be safely scoped to this organization."
    );
  }

  const malformedCard = matchingClientCards.find((card: any) => {
    const status = normalizeText(card?.status).toLowerCase();
    return !PRE_ETS_TIME_CARD_STATUSES.has(status) || !getTimeCardPeriod(card);
  });

  if (malformedCard) {
    throw new RequestError(
      409,
      "A Pre-ETS Time Card for this student has invalid workflow or payroll-period data."
    );
  }

  return matchingClientCards;
}

function getTimeCardsCoveringDate(cards: any[], date: string) {
  const normalizedDate = normalizeText(date);

  if (!isValidIsoDate(normalizedDate)) {
    throw new RequestError(
      409,
      "The student time-entry date cannot be safely evaluated against Time Card periods."
    );
  }

  const matchingCards = cards.filter((card: any) => {
    const period = getTimeCardPeriod(card);
    return Boolean(
      period &&
        normalizedDate >= period.periodStart &&
        normalizedDate <= period.periodEnd
    );
  });

  if (matchingCards.length > 1) {
    throw new RequestError(
      409,
      "More than one Pre-ETS Time Card covers this student time-entry date."
    );
  }

  return matchingCards;
}

function assertStudentMayMutateTimeCardPeriods(cards: any[], dates: string[]) {
  const uniqueDates = Array.from(
    new Set(dates.map((date) => normalizeText(date)).filter(Boolean))
  );

  for (const date of uniqueDates) {
    const matchingCard = getTimeCardsCoveringDate(cards, date)[0];

    if (
      matchingCard &&
      normalizeText(matchingCard?.status).toLowerCase() !==
        "returned_to_student"
    ) {
      throw new RequestError(
        409,
        "This payroll period is locked by a submitted, manager-reviewed, or finalized Pre-ETS Time Card."
      );
    }
  }
}

function assertIndividualEntryReviewAvailable(cards: any[], entryDate: string) {
  const matchingCard = getTimeCardsCoveringDate(cards, entryDate)[0];

  if (matchingCard) {
    throw new RequestError(
      409,
      "Individual Pre-ETS time-entry review is unavailable once a Time Card exists for this payroll period. Use the Pre-ETS Time Card workflow."
    );
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const requestBody: any = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action).toLowerCase();

    if (!SUPPORTED_ACTIONS.has(action)) {
      return Response.json(
        { error: "Choose a valid Pre-ETS time-entry action." },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to manage Pre-ETS time entries." },
        { status: 401 }
      );
    }

    const { caller, organizationId } = await resolveCallerContext(
      base44,
      authenticatedUser.id
    );

    if (action === "create_student_entry") {
      const client = await resolveStudentClient(base44, caller, organizationId);
      const payload = buildStudentEntryPayload(
        requestBody?.entry,
        client,
        organizationId
      );
      const clientTimeCards = await loadClientTimeCards(
        base44,
        organizationId,
        normalizeText(client?.id)
      );

      assertStudentMayMutateTimeCardPeriods(clientTimeCards, [payload.date]);

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
      const client = await resolveStudentClient(base44, caller, organizationId);
      const entryId = normalizeText(requestBody?.entry_id);

      if (!entryId) {
        throw new RequestError(400, "Choose a Pre-ETS time entry to correct.");
      }

      const existingEntry =
        await base44.asServiceRole.entities.PreEtsClientTimeEntry.get(entryId).catch(
          () => null
        );

      if (
        !existingEntry ||
        !isActive(existingEntry) ||
        normalizeText(existingEntry?.org_id) !== organizationId ||
        normalizeText(existingEntry?.client_id) !== normalizeText(client?.id)
      ) {
        throw new RequestError(404, "Pre-ETS time entry not found.");
      }

      const payload = buildStudentEntryPayload(
        requestBody?.entry,
        client,
        organizationId
      );
      const clientTimeCards = await loadClientTimeCards(
        base44,
        organizationId,
        normalizeText(client?.id)
      );
      const existingEntryDate = normalizeText(existingEntry?.date);

      assertStudentMayMutateTimeCardPeriods(clientTimeCards, [
        existingEntryDate,
        payload.date,
      ]);

      const existingEntryCard = getTimeCardsCoveringDate(
        clientTimeCards,
        existingEntryDate
      )[0];
      const existingEntryStatus =
        (normalizeText(existingEntry?.status) || "pending").toLowerCase();
      const mayCorrectReturnedTimeCardEntry =
        normalizeText(existingEntryCard?.status).toLowerCase() ===
        "returned_to_student";

      if (
        existingEntryStatus !== "rejected" &&
        !mayCorrectReturnedTimeCardEntry
      ) {
        throw new RequestError(
          409,
          "This entry can be corrected only after staff rejects the entry or returns its Pre-ETS Time Card to you for correction."
        );
      }

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
        'Choose either "approve" or "reject" for the entry review.'
      );
    }

    const { entry, client } = await resolveStaffEntry(
      base44,
      caller,
      organizationId,
      entryId
    );
    const clientTimeCards = await loadClientTimeCards(
      base44,
      organizationId,
      normalizeText(client?.id)
    );

    assertIndividualEntryReviewAvailable(
      clientTimeCards,
      normalizeText(entry?.date)
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
        "Explain what the student needs to correct before rejecting this entry."
      );
    }

    const updated =
      await base44.asServiceRole.entities.PreEtsClientTimeEntry.update(entryId, {
        status: "rejected",
        approved_by: "",
        approved_at: null,
        rejected_by: callerId,
        rejected_at: now,
        rejection_reason: rejectionReason.slice(0, 4000),
      });

    return Response.json({
      ok: true,
      action,
      decision,
      entry: projectEntry(updated, client),
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "Unable to process the Pre-ETS time-entry request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsTimeEntry error:",
        error?.message || error
      );
    }

    return Response.json({ error: message }, { status });
  }
});
