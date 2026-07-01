import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const TIME_ENTRY_STATUSES = new Set([
  "draft",
  "submitted",
  "approved",
  "locked",
  "void",
]);

const AUTHORIZATION_COUNTED_STATUSES = new Set([
  "submitted",
  "approved",
  "locked",
]);

function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeDate(value: unknown) {
  const date = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "";
  }

  return date;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asObject(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(record: any, key: string) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isPrivileged(caller: any) {
  return (
    caller?.role === "admin" ||
    caller?.access_level === "admin" ||
    caller?.role === "management" ||
    caller?.access_level === "management"
  );
}

function isOrganizationAdmin(caller: any) {
  return (
    caller?.role === "admin" ||
    caller?.access_level === "admin"
  );
}

function isManagement(caller: any) {
  return (
    caller?.role === "management" ||
    caller?.access_level === "management"
  );
}

function isTimeTrackingStaff(caller: any) {
  return (
    isOrganizationAdmin(caller) ||
    isManagement(caller) ||
    caller?.role === "employee" ||
    caller?.access_level === "staff"
  );
}

function getRequestedTimeEntry(body: any) {
  const candidate = body?.time_entry ?? body?.timeEntry ?? {};

  return asObject(candidate);
}

function isAuthorizationCounted(entry: any) {
  return AUTHORIZATION_COUNTED_STATUSES.has(
    normalizeText(entry?.status)
  );
}

function getRequestedAuthorizationId(
  body: any,
  timeEntry: any,
  existingEntry: any = null
) {
  if (hasOwn(timeEntry, "service_authorization_id")) {
    return normalizeText(timeEntry.service_authorization_id);
  }

  if (hasOwn(body, "service_authorization_id")) {
    return normalizeText(body.service_authorization_id);
  }

  return normalizeText(existingEntry?.service_authorization_id);
}

function resolveStatus(
  requestedStatus: unknown,
  fallbackStatus: unknown,
  caller: any
) {
  const status =
    normalizeText(requestedStatus) ||
    normalizeText(fallbackStatus) ||
    "submitted";

  if (!TIME_ENTRY_STATUSES.has(status)) {
    throw httpError(400, "Invalid TimeEntry status.");
  }

  if (status === "locked") {
    throw httpError(
      403,
      "Locked Time Entries can only be created by the report-finalization workflow."
    );
  }

  if (
    !isPrivileged(caller) &&
    status !== "draft" &&
    status !== "submitted"
  ) {
    throw httpError(
      403,
      "Only management or organization administrators may approve or void Time Entries."
    );
  }

  return status;
}

function buildCreatePayload(
  input: any,
  organizationId: string,
  employeeId: string,
  clientId: string | null,
  caller: any
) {
  const date = normalizeDate(input.date);
  const durationMinutes = asNumber(input.duration_minutes, NaN);
  const entryTypeId = normalizeText(input.entry_type_id);
  const entryTypeCode = normalizeText(input.entry_type_code);

  if (!date) {
    throw httpError(
      400,
      "A valid TimeEntry date in YYYY-MM-DD format is required."
    );
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw httpError(
      400,
      "duration_minutes must be a number that is zero or greater."
    );
  }

  if (!entryTypeId && !entryTypeCode) {
    throw httpError(
      400,
      "An entry_type_id or entry_type_code is required."
    );
  }

  return {
    org_id: organizationId,
    client_id: clientId,
    employee_id: employeeId,
    service_authorization_id: null,
    entry_type_id: entryTypeId || null,
    entry_type_code: entryTypeCode || null,
    date,
    start_time: normalizeText(input.start_time) || null,
    end_time: normalizeText(input.end_time) || null,
    duration_minutes: durationMinutes,
    reporting_period_key:
      normalizeText(input.reporting_period_key) || null,
    location: normalizeText(input.location) || null,
    description: normalizeText(input.description) || null,
    form_data: asObject(input.form_data),
    is_billable: asBoolean(input.is_billable, false),
    is_payroll_eligible: asBoolean(
      input.is_payroll_eligible,
      true
    ),
    is_reportable: asBoolean(input.is_reportable, true),
    status: resolveStatus(input.status, "submitted", caller),
    legacy_category: normalizeText(input.legacy_category) || null,
    employer_name: normalizeText(input.employer_name) || null,
    report_ready: isPrivileged(caller)
      ? asBoolean(input.report_ready, false)
      : false,
    locked_in_report_id: null,
  };
}

function buildUpdatePayload(
  input: any,
  existingEntry: any,
  caller: any
) {
  const date = hasOwn(input, "date")
    ? normalizeDate(input.date)
    : normalizeDate(existingEntry.date);

  const durationMinutes = hasOwn(input, "duration_minutes")
    ? asNumber(input.duration_minutes, NaN)
    : asNumber(existingEntry.duration_minutes, NaN);

  const entryTypeId = hasOwn(input, "entry_type_id")
    ? normalizeText(input.entry_type_id)
    : normalizeText(existingEntry.entry_type_id);

  const entryTypeCode = hasOwn(input, "entry_type_code")
    ? normalizeText(input.entry_type_code)
    : normalizeText(existingEntry.entry_type_code);

  if (!date) {
    throw httpError(
      400,
      "A valid TimeEntry date in YYYY-MM-DD format is required."
    );
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw httpError(
      400,
      "duration_minutes must be a number that is zero or greater."
    );
  }

  if (!entryTypeId && !entryTypeCode) {
    throw httpError(
      400,
      "An entry_type_id or entry_type_code is required."
    );
  }

  return {
    entry_type_id: entryTypeId || null,
    entry_type_code: entryTypeCode || null,
    date,
    start_time: hasOwn(input, "start_time")
      ? normalizeText(input.start_time) || null
      : existingEntry.start_time ?? null,
    end_time: hasOwn(input, "end_time")
      ? normalizeText(input.end_time) || null
      : existingEntry.end_time ?? null,
    duration_minutes: durationMinutes,
    reporting_period_key: hasOwn(input, "reporting_period_key")
      ? normalizeText(input.reporting_period_key) || null
      : existingEntry.reporting_period_key ?? null,
    location: hasOwn(input, "location")
      ? normalizeText(input.location) || null
      : existingEntry.location ?? null,
    description: hasOwn(input, "description")
      ? normalizeText(input.description) || null
      : existingEntry.description ?? null,
    form_data: hasOwn(input, "form_data")
      ? asObject(input.form_data)
      : asObject(existingEntry.form_data),
    is_billable: hasOwn(input, "is_billable")
      ? asBoolean(input.is_billable, false)
      : asBoolean(existingEntry.is_billable, false),
    is_payroll_eligible: hasOwn(input, "is_payroll_eligible")
      ? asBoolean(input.is_payroll_eligible, true)
      : asBoolean(existingEntry.is_payroll_eligible, true),
    is_reportable: hasOwn(input, "is_reportable")
      ? asBoolean(input.is_reportable, true)
      : asBoolean(existingEntry.is_reportable, true),
    status: resolveStatus(
      hasOwn(input, "status") ? input.status : existingEntry.status,
      existingEntry.status,
      caller
    ),
    legacy_category: hasOwn(input, "legacy_category")
      ? normalizeText(input.legacy_category) || null
      : existingEntry.legacy_category ?? null,
    employer_name: hasOwn(input, "employer_name")
      ? normalizeText(input.employer_name) || null
      : existingEntry.employer_name ?? null,
    report_ready: isPrivileged(caller)
      ? hasOwn(input, "report_ready")
        ? asBoolean(input.report_ready, false)
        : asBoolean(existingEntry.report_ready, false)
      : asBoolean(existingEntry.report_ready, false),
  };
}

async function getCaller(base44: any, authenticatedUser: any) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUser.id
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw httpError(
      403,
      "Authenticated user record was not found or is inactive."
    );
  }

  if (!isTimeTrackingStaff(caller)) {
    throw httpError(
      403,
      "You are not authorized to create, edit, or delete Time Entries."
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

  if (!organization || organization.is_active === false) {
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

async function assertTargetEmployeeAccess(
  base44: any,
  caller: any,
  organizationId: string,
  targetEmployeeId: string
) {
  const targetEmployee =
    await base44.asServiceRole.entities.User.get(
      targetEmployeeId
    ).catch(() => null);

  if (
    !targetEmployee ||
    !isActive(targetEmployee) ||
    normalizeText(targetEmployee.org_id) !== organizationId
  ) {
    throw httpError(
      403,
      "The requested employee is not active in your organization."
    );
  }

  if (targetEmployeeId === caller.id || isOrganizationAdmin(caller)) {
    return targetEmployee;
  }

  if (!isManagement(caller)) {
    throw httpError(
      403,
      "You may only create or modify your own Time Entries."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: caller.id,
      employee_user_id: targetEmployeeId,
    });

  const isDirectReport = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active !== false &&
      normalizeText(assignment?.org_id) === organizationId
  );

  if (!isDirectReport) {
    throw httpError(
      403,
      "Management may only modify their own or active direct-report Time Entries."
    );
  }

  return targetEmployee;
}

async function loadScopedClient(
  base44: any,
  organizationId: string,
  clientId: string
) {
  const client =
    await base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null);

  if (!client) {
    throw httpError(404, "Client record was not found.");
  }

  if (normalizeText(client.org_id) !== organizationId) {
    throw httpError(
      403,
      "The requested client belongs to a different organization."
    );
  }

  return client;
}

function assertEmployeeCanCreateForClient(
  caller: any,
  client: any
) {
  if (isPrivileged(caller)) {
    return;
  }

  const assignedEmployeeId =
    normalizeText(client.assigned_employee_id) ||
    normalizeText(client.employee_id);

  const createdByEmail = normalizeEmail(client.created_by);
  const callerEmail = normalizeEmail(caller.email);

  const isAssignedEmployee = assignedEmployeeId === caller.id;
  const isClientCreator =
    Boolean(callerEmail) &&
    createdByEmail === callerEmail;

  if (!isAssignedEmployee && !isClientCreator) {
    throw httpError(
      403,
      "You may only create Time Entries for clients assigned to you."
    );
  }
}

async function validateAuthorization(
  base44: any,
  organizationId: string,
  client: any,
  timeEntry: any,
  authorizationId: string,
  excludeEntryId: string | null = null
) {
  if (!authorizationId) {
    return {
      authorization: null,
      validation: {
        isValid: true,
        message: "No ServiceAuthorization was supplied.",
        warnings: [],
      },
    };
  }

  if (!client) {
    throw httpError(
      400,
      "A client-linked Time Entry is required when using a ServiceAuthorization."
    );
  }

  const authorization =
    await base44.asServiceRole.entities.ServiceAuthorization.get(
      authorizationId
    ).catch(() => null);

  if (!authorization) {
    throw httpError(404, "ServiceAuthorization was not found.");
  }

  const authorizationOrgId = normalizeText(authorization.org_id);
  const authorizationClientId = normalizeText(authorization.client_id);

  if (
    authorizationOrgId &&
    authorizationOrgId !== organizationId
  ) {
    throw httpError(
      403,
      "The ServiceAuthorization belongs to a different organization."
    );
  }

  if (authorizationClientId !== client.id) {
    throw httpError(
      403,
      "The ServiceAuthorization does not belong to this client."
    );
  }

  if (
    normalizeText(authorization.entry_type_code) !==
    normalizeText(timeEntry.entry_type_code)
  ) {
    throw httpError(
      400,
      "The ServiceAuthorization does not match this Time Entry type."
    );
  }

  if (authorization.status !== "active") {
    throw httpError(
      409,
      "The selected ServiceAuthorization is not active."
    );
  }

  if (
    authorization.service_start_date &&
    timeEntry.date < authorization.service_start_date
  ) {
    throw httpError(
      400,
      "The Time Entry date is before the ServiceAuthorization start date."
    );
  }

  if (
    authorization.service_end_date &&
    timeEntry.date > authorization.service_end_date
  ) {
    throw httpError(
      400,
      "The Time Entry date is after the ServiceAuthorization end date."
    );
  }

  const authorizationEntries =
    await base44.asServiceRole.entities.TimeEntry.filter({
      service_authorization_id: authorization.id,
    });

  const usedMinutes = asArray(authorizationEntries)
    .filter((entry: any) => entry?.id !== excludeEntryId)
    .filter(
      (entry: any) =>
        normalizeText(entry?.org_id) === organizationId &&
        normalizeText(entry?.client_id) === client.id &&
        isAuthorizationCounted(entry)
    )
    .reduce(
      (total: number, entry: any) =>
        total + asNumber(entry?.duration_minutes, 0),
      0
    );

  const usedHours = usedMinutes / 60;
  const totalAuthorizedHours = asNumber(
    authorization.total_authorized_hours,
    0
  );
  const remainingHours = Math.max(
    0,
    totalAuthorizedHours - usedHours
  );

  const proposedHours = isAuthorizationCounted(timeEntry)
    ? asNumber(timeEntry.duration_minutes, 0) / 60
    : 0;

  if (proposedHours > remainingHours + 0.0001) {
    throw httpError(
      409,
      `This Time Entry exceeds the remaining authorized hours (${remainingHours.toFixed(
        2
      )}).`
    );
  }

  const warnings: string[] = [];
  const resultingRemainingHours =
    remainingHours - proposedHours;

  if (
    resultingRemainingHours > 0 &&
    resultingRemainingHours < 5
  ) {
    warnings.push(
      `Only ${resultingRemainingHours.toFixed(
        2
      )} authorized hours will remain.`
    );
  }

  return {
    authorization,
    validation: {
      isValid: true,
      message: "ServiceAuthorization is valid.",
      warnings,
      authorization: {
        id: authorization.id,
        authorization_number:
          authorization.authorization_number || null,
        total_authorized_hours: totalAuthorizedHours,
        used_hours: usedHours,
        remaining_hours: resultingRemainingHours,
      },
    },
  };
}

async function recalculateAuthorizationTotals(
  base44: any,
  organizationId: string,
  authorizationId: string
) {
  if (!authorizationId) {
    return;
  }

  const authorization =
    await base44.asServiceRole.entities.ServiceAuthorization.get(
      authorizationId
    ).catch(() => null);

  if (!authorization) {
    return;
  }

  const authorizationOrgId = normalizeText(authorization.org_id);

  if (
    authorizationOrgId &&
    authorizationOrgId !== organizationId
  ) {
    return;
  }

  const authorizationEntries =
    await base44.asServiceRole.entities.TimeEntry.filter({
      service_authorization_id: authorizationId,
    });

  const usedMinutes = asArray(authorizationEntries)
    .filter(
      (entry: any) =>
        normalizeText(entry?.org_id) === organizationId &&
        normalizeText(entry?.client_id) ===
          normalizeText(authorization.client_id) &&
        isAuthorizationCounted(entry)
    )
    .reduce(
      (total: number, entry: any) =>
        total + asNumber(entry?.duration_minutes, 0),
      0
    );

  const usedHours = usedMinutes / 60;
  const totalAuthorizedHours = asNumber(
    authorization.total_authorized_hours,
    0
  );
  const remainingHours = Math.max(
    0,
    totalAuthorizedHours - usedHours
  );

  await base44.asServiceRole.entities.ServiceAuthorization.update(
    authorizationId,
    {
      used_hours: Number(usedHours.toFixed(2)),
      remaining_hours: Number(remainingHours.toFixed(2)),
    }
  );
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
    const action = normalizeText(body.action);

    if (!["validate", "create", "update", "delete"].includes(action)) {
      throw httpError(
        400,
        "action must be validate, create, update, or delete."
      );
    }

    const { caller, organizationId } = await getCaller(
      base44,
      authenticatedUser
    );

    const timeEntryInput = getRequestedTimeEntry(body);

    if (action === "validate" || action === "create") {
      const requestedEmployeeId =
        normalizeText(timeEntryInput.employee_id) || caller.id;

      await assertTargetEmployeeAccess(
        base44,
        caller,
        organizationId,
        requestedEmployeeId
      );

      const requestedClientId = normalizeText(
        timeEntryInput.client_id
      );

      const client = requestedClientId
        ? await loadScopedClient(
            base44,
            organizationId,
            requestedClientId
          )
        : null;

      if (client) {
        assertEmployeeCanCreateForClient(caller, client);
      }

      const preparedEntry = buildCreatePayload(
        timeEntryInput,
        organizationId,
        requestedEmployeeId,
        client?.id || null,
        caller
      );

      const requestedAuthorizationId =
        getRequestedAuthorizationId(
          body,
          timeEntryInput
        );

      const authorizationResult =
        await validateAuthorization(
          base44,
          organizationId,
          client,
          preparedEntry,
          requestedAuthorizationId
        );

      preparedEntry.service_authorization_id =
        authorizationResult.authorization?.id || null;

      if (action === "validate") {
        return Response.json({
          ok: true,
          action,
          organization_id: organizationId,
          employee_id: requestedEmployeeId,
          validation: authorizationResult.validation,
        });
      }

      const created =
        await base44.asServiceRole.entities.TimeEntry.create(
          preparedEntry
        );

      if (authorizationResult.authorization?.id) {
        await recalculateAuthorizationTotals(
          base44,
          organizationId,
          authorizationResult.authorization.id
        );
      }

      return Response.json({
        ok: true,
        action,
        entry: created,
        validation: authorizationResult.validation,
      });
    }

    const entryId = normalizeText(
      body.entry_id || body.time_entry_id || body.id
    );

    if (!entryId) {
      throw httpError(
        400,
        "A TimeEntry ID is required for update or delete."
      );
    }

    const existingEntry =
      await base44.asServiceRole.entities.TimeEntry.get(
        entryId
      ).catch(() => null);

    if (!existingEntry) {
      throw httpError(404, "TimeEntry was not found.");
    }

    if (
      normalizeText(existingEntry.org_id) !== organizationId
    ) {
      throw httpError(
        403,
        "The requested TimeEntry belongs to a different organization."
      );
    }

    if (
      existingEntry.status === "locked" ||
      normalizeText(existingEntry.locked_in_report_id)
    ) {
      throw httpError(
        409,
        "A locked or reported TimeEntry cannot be changed."
      );
    }

    const existingEmployeeId = normalizeText(
      existingEntry.employee_id
    );

    if (!existingEmployeeId) {
      throw httpError(
        409,
        "The existing TimeEntry has no employee owner."
      );
    }

    await assertTargetEmployeeAccess(
      base44,
      caller,
      organizationId,
      existingEmployeeId
    );

    const existingClientId = normalizeText(
      existingEntry.client_id
    );

    const existingClient = existingClientId
      ? await loadScopedClient(
          base44,
          organizationId,
          existingClientId
        )
      : null;

    if (
      hasOwn(timeEntryInput, "client_id") &&
      normalizeText(timeEntryInput.client_id) !==
        existingClientId
    ) {
      throw httpError(
        400,
        "client_id cannot be changed after a TimeEntry is created."
      );
    }

    if (
      hasOwn(timeEntryInput, "employee_id") &&
      normalizeText(timeEntryInput.employee_id) !==
        existingEmployeeId
    ) {
      throw httpError(
        400,
        "employee_id cannot be changed after a TimeEntry is created."
      );
    }

    if (action === "delete") {
      await base44.asServiceRole.entities.TimeEntry.delete(
        entryId
      );

      const previousAuthorizationId = normalizeText(
        existingEntry.service_authorization_id
      );

      if (previousAuthorizationId) {
        await recalculateAuthorizationTotals(
          base44,
          organizationId,
          previousAuthorizationId
        );
      }

      return Response.json({
        ok: true,
        action,
        deleted_time_entry_id: entryId,
      });
    }

    const updatePayload = buildUpdatePayload(
      timeEntryInput,
      existingEntry,
      caller
    );

    const requestedAuthorizationId =
      getRequestedAuthorizationId(
        body,
        timeEntryInput,
        existingEntry
      );

    const existingAuthorizationId = normalizeText(
      existingEntry.service_authorization_id
    );

    if (
      !isPrivileged(caller) &&
      requestedAuthorizationId !== existingAuthorizationId
    ) {
      throw httpError(
        403,
        "Only management or organization administrators may change a TimeEntry ServiceAuthorization."
      );
    }

    const authorizationResult =
      await validateAuthorization(
        base44,
        organizationId,
        existingClient,
        {
          ...updatePayload,
          client_id: existingClient?.id || null,
          employee_id: existingEmployeeId,
          org_id: organizationId,
        },
        requestedAuthorizationId,
        entryId
      );

    updatePayload.service_authorization_id =
      authorizationResult.authorization?.id || null;

    const updated =
      await base44.asServiceRole.entities.TimeEntry.update(
        entryId,
        updatePayload
      );

    const authorizationIdsToRecalculate = new Set(
      [
        existingAuthorizationId,
        normalizeText(
          authorizationResult.authorization?.id
        ),
      ].filter(Boolean)
    );

    for (const authorizationId of authorizationIdsToRecalculate) {
      await recalculateAuthorizationTotals(
        base44,
        organizationId,
        authorizationId
      );
    }

    return Response.json({
      ok: true,
      action,
      entry: updated,
      validation: authorizationResult.validation,
    });
  } catch (error: any) {
    console.error(
      "mutateAuthorizedTimeEntry error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to process the TimeEntry request.",
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
