import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const VALID_ACTIONS = new Set(["validate", "create", "update", "delete"]);
const VALID_STATUSES = new Set([
  "draft",
  "submitted",
  "approved",
  "locked",
  "void",
]);
const TIME_CARD_LOCKED_STATUSES = new Set(["submitted", "approved"]);

const LEGACY_STATIC_FORM_FIELDS_BY_ENTRY_TYPE: Record<string, Set<string>> = {
  dspd: new Set([
    "job_coaching",
    "individual_support",
    "community_outreach",
    "job_application_process",
    "resume_writing",
    "job_interview_process",
  ]),
  life_skills: new Set([
    "billable_service_date",
    "billable_hours",
    "life_skills_area",
    "specific_skill_taught",
    "client_progress_mastery_level",
    "practice_homework_assigned",
    "activity_description",
    "observations_comments",
  ]),
};

const LEGACY_FORM_FIELD_KEY_ALIASES_BY_ENTRY_TYPE: Record<
  string,
  Record<string, string>
> = {
  csb_hours: {
    billable_service_date: "billable_date",
    life_skills_area: "skill_area",
    specific_skill_taught: "skill_taught",
    client_progress_mastery_level: "client_progress",
    practice_homework_assigned: "practice_completed",
    activity_description: "billable_activity",
    observations_comments: "billable_observations",
  },
};

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

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeDate(value: unknown) {
  const date = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : "";
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function hasOwn(record: any, key: string) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isFilled(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function getLegacyStaticFormFields(entryTypeCode: string) {
  return (
    LEGACY_STATIC_FORM_FIELDS_BY_ENTRY_TYPE[
      normalizeText(entryTypeCode).toLowerCase()
    ] || new Set<string>()
  );
}

function normalizeLegacyFormDataKeys(formData: unknown, entryTypeCode: string) {
  const source = asObject(formData);
  const aliases =
    LEGACY_FORM_FIELD_KEY_ALIASES_BY_ENTRY_TYPE[
      normalizeText(entryTypeCode).toLowerCase()
    ] || {};
  const normalized = { ...source };

  for (const [legacyKey, canonicalKey] of Object.entries(aliases)) {
    if (hasOwn(source, legacyKey) && !hasOwn(source, canonicalKey)) {
      normalized[canonicalKey] = source[legacyKey];
    }
    delete normalized[legacyKey];
  }

  return normalized;
}

function isAuthorizationCounted(entry: any) {
  const status = normalizeText(entry?.status).toLowerCase();

  if (status === "approved" || status === "locked") {
    return true;
  }

  return status === "submitted" && entry?.authorization_usage_eligible === true;
}

function calculateReportingPeriodKey(date: string, reportMode: string) {
  const [year, monthValue] = date.split("-");
  const month = Number(monthValue);

  if (!year || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RequestError(
      400,
      "Unable to determine the reporting period from the TimeEntry date."
    );
  }

  return reportMode === "usor148_service_period"
    ? `${year}-Q${Math.ceil(month / 3)}`
    : `${year}-${String(month).padStart(2, "0")}`;
}

function resolveStatus(requestedStatus: unknown, fallbackStatus: unknown, role: string) {
  const status =
    normalizeText(requestedStatus).toLowerCase() ||
    normalizeText(fallbackStatus).toLowerCase() ||
    "submitted";

  if (!VALID_STATUSES.has(status)) {
    throw new RequestError(400, "Choose a valid TimeEntry status.");
  }

  if (status === "locked") {
    throw new RequestError(
      403,
      "Locked Time Entries can only be created by the report-finalization workflow."
    );
  }

  if (role === "employee" && !["draft", "submitted"].includes(status)) {
    throw new RequestError(
      403,
      "Only management or organization administrators may approve or void Time Entries."
    );
  }

  return status;
}

function projectEntry(entry: any) {
  return entry;
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const role = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller.org_id);

  if (!role || !organizationId) {
    throw new RequestError(
      403,
      "Your account is not authorized to manage Time Entries."
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
    role,
    organizationId,
    isAdmin: role === "admin",
    isManagement: role === "management",
  };
}

async function assertEmployeeAuthority(
  base44: any,
  context: any,
  employeeId: string
) {
  const target = await base44.asServiceRole.entities.User.get(employeeId).catch(
    () => null
  );

  if (
    !target ||
    !isActive(target) ||
    normalizeText(target.org_id) !== context.organizationId ||
    !getCanonicalStaffRole(target)
  ) {
    throw new RequestError(
      403,
      "The selected employee is not active in your organization."
    );
  }

  if (employeeId === context.caller.id || context.isAdmin) {
    return target;
  }

  if (!context.isManagement) {
    throw new RequestError(403, "You may only manage your own Time Entries.");
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: context.caller.id,
      employee_user_id: employeeId,
    });

  const isDirectReport = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === context.organizationId
  );

  if (!isDirectReport) {
    throw new RequestError(
      403,
      "Management may only manage their own or active direct-report Time Entries."
    );
  }

  return target;
}

async function loadScopedClient(base44: any, context: any, clientId: string) {
  const client = await base44.asServiceRole.entities.Client.get(clientId).catch(
    () => null
  );

  if (
    !client ||
    client?.is_archived === true ||
    normalizeText(client?.org_id) !== context.organizationId
  ) {
    throw new RequestError(404, "The selected client is unavailable to your account.");
  }

  if (context.isAdmin) return client;

  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  const createdBy = normalizeEmail(client?.created_by);
  const callerEmail = normalizeEmail(context.caller?.email);

  if (assignedEmployeeId === context.caller.id || (callerEmail && createdBy === callerEmail)) {
    return client;
  }

  if (!context.isManagement) {
    throw new RequestError(
      403,
      "You may only manage Time Entries for clients assigned to you."
    );
  }

  if (!assignedEmployeeId) {
    throw new RequestError(
      403,
      "This client does not have an authorized staff assignment."
    );
  }

  await assertEmployeeAuthority(base44, context, assignedEmployeeId);
  return client;
}

async function loadEntryType(
  base44: any,
  organizationId: string,
  requestedId: string,
  requestedCode: string
) {
  let entryType: any = null;

  if (requestedId) {
    entryType = await base44.asServiceRole.entities.EntryType.get(requestedId).catch(
      () => null
    );

    if (!entryType || entryType?.is_active === false) {
      throw new RequestError(404, "The selected service type is unavailable.");
    }

    const entryTypeOrgId = normalizeText(entryType?.org_id);
    if (entryTypeOrgId && entryTypeOrgId !== organizationId) {
      throw new RequestError(403, "The selected service type belongs to another organization.");
    }
  } else {
    if (!requestedCode) {
      throw new RequestError(400, "Choose a service type before saving a TimeEntry.");
    }

    const candidates = asArray(
      await base44.asServiceRole.entities.EntryType.filter({
        code: requestedCode,
        is_active: true,
      })
    ).filter((candidate: any) => {
      const candidateOrgId = normalizeText(candidate?.org_id);
      return (
        candidate?.is_active !== false &&
        (!candidateOrgId || candidateOrgId === organizationId)
      );
    });

    const ownOrganizationCandidate = candidates.find(
      (candidate: any) => normalizeText(candidate?.org_id) === organizationId
    );
    entryType = ownOrganizationCandidate || candidates[0] || null;

    if (!entryType || candidates.length > 1 && !ownOrganizationCandidate) {
      throw new RequestError(
        409,
        "The selected service type is ambiguous. Choose the service type again."
      );
    }
  }

  const canonicalCode = normalizeText(entryType?.code);
  if (!canonicalCode) {
    throw new RequestError(409, "The selected service type has an invalid code.");
  }

  if (requestedCode && requestedCode !== canonicalCode) {
    throw new RequestError(
      400,
      "The selected service type does not match the submitted service code."
    );
  }

  return entryType;
}

async function loadTemplates(base44: any, organizationId: string, entryType: any) {
  const templates = asArray(
    await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true,
    })
  );

  return templates
    .filter((template: any) => {
      const templateOrgId = normalizeText(template?.org_id);
      return (
        template?.is_active !== false &&
        normalizeText(template?.entry_type_id) === normalizeText(entryType?.id) &&
        normalizeText(template?.entry_type_code) === normalizeText(entryType?.code) &&
        (!templateOrgId || templateOrgId === organizationId)
      );
    })
    .sort((left: any, right: any) => Number(left?.order || 0) - Number(right?.order || 0));
}

function mergeFormData(
  requestedFormData: unknown,
  existingFormData: unknown,
  entryTypeCode: string,
  templates: any[],
  isUpdate: boolean
) {
  const incoming = normalizeLegacyFormDataKeys(requestedFormData, entryTypeCode);
  const existing = normalizeLegacyFormDataKeys(existingFormData, entryTypeCode);
  const allowedKeys = new Set(
    templates
      .map((template: any) => normalizeText(template?.field_key))
      .filter(Boolean)
  );

  for (const key of getLegacyStaticFormFields(entryTypeCode)) {
    allowedKeys.add(key);
  }

  const invalidKeys = Object.keys(incoming).filter(
    (key) => !allowedKeys.has(key) && !(isUpdate && hasOwn(existing, key))
  );

  if (invalidKeys.length > 0) {
    throw new RequestError(
      400,
      `The submitted form contains fields that are not active for this service type: ${invalidKeys.join(
        ", "
      )}.`
    );
  }

  return isUpdate ? { ...existing, ...incoming } : incoming;
}

function validateFieldAnswers(
  templates: any[],
  formData: Record<string, any>,
  status: string,
  requiresFieldAnswers: boolean,
  entryTypeCode: string
) {
  if (
    requiresFieldAnswers &&
    templates.length === 0 &&
    getLegacyStaticFormFields(entryTypeCode).size === 0
  ) {
    throw new RequestError(
      409,
      "This service type requires field answers but has no active field configuration."
    );
  }

  const requiredOnEntry = templates.filter(
    (template: any) => template?.required_on_entry === true
  );
  const requiredForReport = templates.filter(
    (template: any) => template?.required_for_report === true
  );
  const allRequired = new Map<string, any>();
  for (const template of [...requiredOnEntry, ...requiredForReport]) {
    allRequired.set(normalizeText(template?.id), template);
  }

  const missingOnEntry = requiredOnEntry
    .filter((template: any) => !isFilled(formData[template?.field_key]))
    .map((template: any) => template.field_key);
  const missingForReport = requiredForReport
    .filter((template: any) => !isFilled(formData[template?.field_key]))
    .map((template: any) => template.field_key);

  if (status !== "draft" && status !== "void" && missingOnEntry.length > 0) {
    throw new RequestError(
      400,
      `Required entry fields are missing: ${missingOnEntry.join(", ")}.`
    );
  }

  const completedRequired = Array.from(allRequired.values()).filter(
    (template: any) => isFilled(formData[template?.field_key])
  ).length;
  const completionPercent =
    allRequired.size > 0
      ? Math.round((completedRequired / allRequired.size) * 100)
      : 0;
  const validationErrors = Array.from(
    new Set([...missingOnEntry, ...missingForReport])
  );

  return {
    required_fields_complete: validationErrors.length === 0,
    report_ready:
      status !== "draft" && status !== "void" && missingForReport.length === 0,
    validation_errors: validationErrors,
    completion_percent: completionPercent,
    missing_required_on_entry: missingOnEntry,
    missing_required_for_report: missingForReport,
  };
}

function buildSchemaSnapshot(templates: any[]) {
  const snapshot: Record<string, any> = {};

  for (const template of templates) {
    const key = normalizeText(template?.field_key);
    if (!key) continue;

    snapshot[key] = {
      label: normalizeText(template?.label),
      field_type: normalizeText(template?.field_type) || "text",
      is_required: template?.is_required === true,
      required_on_entry: template?.required_on_entry === true,
      required_for_report: template?.required_for_report === true,
      is_reportable: template?.is_reportable !== false,
      is_internal_only: template?.is_internal_only === true,
      order: Number(template?.order) || 0,
      section: normalizeText(template?.section) || null,
      field_group: normalizeText(template?.field_group) || null,
      options: Array.isArray(template?.options) ? template.options : [],
      schema_version: Number(template?.schema_version) || 1,
    };
  }

  return snapshot;
}

function buildFieldAnswerPayload(
  organizationId: string,
  timeEntryId: string,
  entryType: any,
  templates: any[],
  formData: any,
  validation: any,
  isCreate: boolean
) {
  const payload: Record<string, any> = {
    org_id: organizationId,
    time_entry_id: timeEntryId,
    entry_type_id: entryType.id,
    entry_type_code: normalizeText(entryType.code),
    field_schema_version: Math.max(
      1,
      ...templates.map((template: any) => Number(template?.schema_version) || 1)
    ),
    field_schema_snapshot: buildSchemaSnapshot(templates),
    answers: formData,
    required_fields_complete: validation.required_fields_complete,
    report_ready: validation.report_ready,
    submitted_at: new Date().toISOString(),
    validation_errors: validation.validation_errors,
    completion_percent: validation.completion_percent,
  };

  if (isCreate) payload.locked_in_report_id = null;
  return payload;
}

async function loadSingleFieldAnswer(base44: any, organizationId: string, entryId: string) {
  const answers = asArray(
    await base44.asServiceRole.entities.ReportFieldAnswer.filter({
      time_entry_id: entryId,
    })
  );

  if (answers.length > 1) {
    throw new RequestError(
      409,
      "Multiple structured-answer records exist for this TimeEntry and must be repaired before it can be changed."
    );
  }

  const answer = answers[0] || null;
  if (answer && normalizeText(answer?.org_id) !== organizationId) {
    throw new RequestError(403, "The structured-answer record is outside your organization.");
  }

  return answer;
}

function assertMutable(entry: any, fieldAnswer: any) {
  if (
    normalizeText(entry?.status).toLowerCase() === "locked" ||
    normalizeText(entry?.locked_in_report_id) ||
    normalizeText(fieldAnswer?.locked_in_report_id)
  ) {
    throw new RequestError(
      409,
      "This TimeEntry is part of a finalized report and cannot be changed."
    );
  }
}

function dateWithinPeriod(date: string, start: string, end: string) {
  return Boolean(date && start && end && date >= start && date <= end);
}

async function assertTimeCardOpen(
  base44: any,
  organizationId: string,
  employeeId: string,
  dates: string[],
  actionLabel: string
) {
  const normalizedDates = Array.from(
    new Set(dates.map(normalizeDate).filter(Boolean))
  );
  if (normalizedDates.length === 0) return;

  const cards = asArray(
    await base44.asServiceRole.entities.TimeCard.filter({ employee_id: employeeId })
  ).filter(
    (card: any) =>
      normalizeText(card?.org_id) === organizationId &&
      normalizeText(card?.employee_id) === employeeId &&
      TIME_CARD_LOCKED_STATUSES.has(normalizeText(card?.status).toLowerCase())
  );

  for (const card of cards) {
    const start = normalizeDate(card?.period_start);
    const end = normalizeDate(card?.period_end);
    if (!start || !end || start > end) {
      throw new RequestError(
        409,
        "A submitted or approved Time Card has invalid payroll-period dates and must be repaired before Time Entries can be changed."
      );
    }

    if (normalizedDates.some((date) => dateWithinPeriod(date, start, end))) {
      throw new RequestError(
        409,
        `A ${normalizeText(card?.status)} Time Card locks this employee's entries for ${start} through ${end}. A manager must return the Time Card for correction before this entry can be ${actionLabel}.`
      );
    }
  }
}

async function validateAuthorization(
  base44: any,
  organizationId: string,
  client: any,
  entryType: any,
  preparedEntry: any,
  authorizationId: string,
  excludeEntryId = ""
) {
  if (entryType?.requires_authorization === true && !authorizationId) {
    throw new RequestError(400, `Authorization is required for ${entryType.name}.`);
  }

  if (!authorizationId) {
    if (entryType?.requires_employer === true && !normalizeText(preparedEntry.employer_name)) {
      throw new RequestError(400, `Employer is required for ${entryType.name}.`);
    }

    return {
      authorization: null,
      validation: {
        isValid: true,
        message: "No ServiceAuthorization is required or supplied.",
        warnings: [],
      },
    };
  }

  if (!client) {
    throw new RequestError(
      400,
      "A client-linked TimeEntry is required when using a ServiceAuthorization."
    );
  }

  const authorization = await base44.asServiceRole.entities.ServiceAuthorization.get(
    authorizationId
  ).catch(() => null);

  if (
    !authorization ||
    normalizeText(authorization?.org_id) !== organizationId ||
    normalizeText(authorization?.client_id) !== normalizeText(client?.id) ||
    normalizeText(authorization?.entry_type_code) !== normalizeText(entryType?.code)
  ) {
    throw new RequestError(
      403,
      "The selected ServiceAuthorization is unavailable for this TimeEntry."
    );
  }

  if (normalizeText(authorization?.status).toLowerCase() !== "active") {
    throw new RequestError(409, "The selected ServiceAuthorization is not active.");
  }

  const startDate = normalizeDate(authorization?.service_start_date);
  const endDate = normalizeDate(authorization?.service_end_date);
  if (startDate && preparedEntry.date < startDate) {
    throw new RequestError(
      400,
      "The TimeEntry date is before the ServiceAuthorization start date."
    );
  }
  if (endDate && preparedEntry.date > endDate) {
    throw new RequestError(
      400,
      "The TimeEntry date is after the ServiceAuthorization end date."
    );
  }

  const authorizationEmployer = normalizeText(authorization?.employer_name);
  if (entryType?.requires_employer === true && !authorizationEmployer) {
    throw new RequestError(
      400,
      "This service type requires an employer on the selected ServiceAuthorization."
    );
  }
  if (!normalizeText(preparedEntry.employer_name) && authorizationEmployer) {
    preparedEntry.employer_name = authorizationEmployer;
  }

  const relatedEntries = asArray(
    await base44.asServiceRole.entities.TimeEntry.filter({
      service_authorization_id: authorization.id,
    })
  );
  const usedMinutes = relatedEntries
    .filter((entry: any) => entry?.id !== excludeEntryId)
    .filter(
      (entry: any) =>
        normalizeText(entry?.org_id) === organizationId &&
        normalizeText(entry?.client_id) === normalizeText(client?.id) &&
        isAuthorizationCounted(entry)
    )
    .reduce((total: number, entry: any) => total + asNumber(entry?.duration_minutes), 0);

  const totalHours = asNumber(authorization?.total_authorized_hours);
  const remainingHours = Math.max(0, totalHours - usedMinutes / 60);
  const proposedHours = isAuthorizationCounted(preparedEntry)
    ? asNumber(preparedEntry.duration_minutes) / 60
    : 0;

  if (proposedHours > remainingHours + 0.0001) {
    throw new RequestError(
      409,
      `This TimeEntry exceeds the remaining authorized hours (${remainingHours.toFixed(2)}).`
    );
  }

  const resultingRemainingHours = remainingHours - proposedHours;
  const warnings =
    resultingRemainingHours > 0 && resultingRemainingHours < 5
      ? [`Only ${resultingRemainingHours.toFixed(2)} authorized hours will remain.`]
      : [];

  return {
    authorization,
    validation: {
      isValid: true,
      message: "ServiceAuthorization is valid.",
      warnings,
      authorization: {
        id: authorization.id,
        authorization_number: authorization.authorization_number || null,
        total_authorized_hours: totalHours,
        used_hours: usedMinutes / 60,
        remaining_hours: resultingRemainingHours,
      },
    },
  };
}

async function recalculateAuthorization(base44: any, organizationId: string, authorizationId: string) {
  if (!authorizationId) return;

  const authorization = await base44.asServiceRole.entities.ServiceAuthorization.get(
    authorizationId
  ).catch(() => null);
  if (!authorization || normalizeText(authorization?.org_id) !== organizationId) return;

  const entries = asArray(
    await base44.asServiceRole.entities.TimeEntry.filter({
      service_authorization_id: authorizationId,
    })
  );
  const usedMinutes = entries
    .filter(
      (entry: any) =>
        normalizeText(entry?.org_id) === organizationId &&
        normalizeText(entry?.client_id) === normalizeText(authorization?.client_id) &&
        isAuthorizationCounted(entry)
    )
    .reduce((total: number, entry: any) => total + asNumber(entry?.duration_minutes), 0);
  const totalHours = asNumber(authorization?.total_authorized_hours);

  await base44.asServiceRole.entities.ServiceAuthorization.update(authorizationId, {
    used_hours: Number((usedMinutes / 60).toFixed(2)),
    remaining_hours: Number(Math.max(0, totalHours - usedMinutes / 60).toFixed(2)),
  });
}

function buildPreparedEntry(input: any, existing: any, entryType: any, role: string) {
  const date = hasOwn(input, "date") ? normalizeDate(input.date) : normalizeDate(existing?.date);
  const durationMinutes = hasOwn(input, "duration_minutes")
    ? asNumber(input.duration_minutes, NaN)
    : asNumber(existing?.duration_minutes, NaN);

  if (!date) {
    throw new RequestError(400, "A valid TimeEntry date is required.");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw new RequestError(400, "Duration must be zero or greater.");
  }

  const status = resolveStatus(
    hasOwn(input, "status") ? input.status : undefined,
    existing?.status || "submitted",
    role
  );

  return {
    entry_type_id: entryType.id,
    entry_type_code: normalizeText(entryType.code),
    date,
    start_time: hasOwn(input, "start_time")
      ? normalizeText(input.start_time) || null
      : existing?.start_time ?? null,
    end_time: hasOwn(input, "end_time")
      ? normalizeText(input.end_time) || null
      : existing?.end_time ?? null,
    duration_minutes: durationMinutes,
    reporting_period_key: calculateReportingPeriodKey(
      date,
      normalizeText(entryType?.report_mode)
    ),
    location: hasOwn(input, "location")
      ? normalizeText(input.location) || null
      : existing?.location ?? null,
    description: hasOwn(input, "description")
      ? normalizeText(input.description) || null
      : existing?.description ?? null,
    employer_name: hasOwn(input, "employer_name")
      ? normalizeText(input.employer_name) || null
      : existing?.employer_name ?? null,
    is_billable: entryType?.is_billable === true,
    is_payroll_eligible: entryType?.is_payroll_eligible !== false,
    is_reportable: normalizeText(entryType?.report_mode) !== "none",
    legacy_category: normalizeText(entryType?.code) || null,
    status,
  };
}

function buildEntryRollback(existing: any) {
  return {
    entry_type_id: existing?.entry_type_id ?? null,
    entry_type_code: existing?.entry_type_code ?? null,
    date: existing?.date,
    start_time: existing?.start_time ?? null,
    end_time: existing?.end_time ?? null,
    duration_minutes: existing?.duration_minutes,
    reporting_period_key: existing?.reporting_period_key ?? null,
    location: existing?.location ?? null,
    description: existing?.description ?? null,
    form_data: asObject(existing?.form_data),
    is_billable: existing?.is_billable === true,
    is_payroll_eligible: existing?.is_payroll_eligible !== false,
    is_reportable: existing?.is_reportable !== false,
    status: existing?.status,
    legacy_category: existing?.legacy_category ?? null,
    employer_name: existing?.employer_name ?? null,
    report_ready: existing?.report_ready === true,
    service_authorization_id: existing?.service_authorization_id ?? null,
    authorization_usage_eligible: existing?.authorization_usage_eligible === true,
    authorization_usage_eligible_at: existing?.authorization_usage_eligible_at ?? null,
  };
}

async function saveFieldAnswer(
  base44: any,
  existingFieldAnswer: any,
  payload: any
) {
  if (existingFieldAnswer?.id) {
    await base44.asServiceRole.entities.ReportFieldAnswer.update(
      existingFieldAnswer.id,
      payload
    );
  } else {
    await base44.asServiceRole.entities.ReportFieldAnswer.create(payload);
  }
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
    if (!VALID_ACTIONS.has(action)) {
      throw new RequestError(400, "Choose a valid TimeEntry action.");
    }

    const timeEntryInput =
      body?.time_entry && typeof body.time_entry === "object" && !Array.isArray(body.time_entry)
        ? body.time_entry
        : body?.timeEntry && typeof body.timeEntry === "object" && !Array.isArray(body.timeEntry)
        ? body.timeEntry
        : {};

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();
    if (!authenticatedUser?.id) {
      throw new RequestError(401, "You must be signed in to manage Time Entries.");
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);

    if (action === "validate" || action === "create") {
      const employeeId = normalizeText(timeEntryInput?.employee_id) || context.caller.id;
      await assertEmployeeAuthority(base44, context, employeeId);

      const entryType = await loadEntryType(
        base44,
        context.organizationId,
        normalizeText(timeEntryInput?.entry_type_id),
        normalizeText(timeEntryInput?.entry_type_code)
      );
      const clientId = normalizeText(timeEntryInput?.client_id);
      const requiresClient = entryType?.requires_client !== false;
      if (requiresClient && !clientId) {
        throw new RequestError(400, `A client is required for ${entryType.name}.`);
      }
      const client = clientId ? await loadScopedClient(base44, context, clientId) : null;
      const prepared = buildPreparedEntry(timeEntryInput, null, entryType, context.role);

      await assertTimeCardOpen(
        base44,
        context.organizationId,
        employeeId,
        [prepared.date],
        "created"
      );

      const templates = await loadTemplates(base44, context.organizationId, entryType);
      const requestedFormData = hasOwn(timeEntryInput, "form_data")
        ? timeEntryInput.form_data
        : hasOwn(timeEntryInput, "field_answers")
        ? timeEntryInput.field_answers
        : {};
      const formData = mergeFormData(
        requestedFormData,
        {},
        prepared.entry_type_code,
        templates,
        false
      );
      const fieldValidation = validateFieldAnswers(
        templates,
        formData,
        prepared.status,
        entryType?.requires_field_answers === true,
        prepared.entry_type_code
      );
      prepared.form_data = formData;
      prepared.report_ready = fieldValidation.report_ready;

      const authorizationId = normalizeText(
        timeEntryInput?.service_authorization_id ?? body?.service_authorization_id
      );
      prepared.service_authorization_id = authorizationId || null;
      prepared.authorization_usage_eligible =
        Boolean(authorizationId) && ["submitted", "approved"].includes(prepared.status);
      prepared.authorization_usage_eligible_at = prepared.authorization_usage_eligible
        ? new Date().toISOString()
        : null;

      const authorizationResult = await validateAuthorization(
        base44,
        context.organizationId,
        client,
        entryType,
        prepared,
        authorizationId
      );
      prepared.service_authorization_id = authorizationResult.authorization?.id || null;

      if (action === "validate") {
        return Response.json({
          ok: true,
          action,
          organization_id: context.organizationId,
          employee_id: employeeId,
          entry_type: { id: entryType.id, code: entryType.code },
          validation: {
            ...authorizationResult.validation,
            field_answers: {
              missing_required_on_entry: fieldValidation.missing_required_on_entry,
              missing_required_for_report: fieldValidation.missing_required_for_report,
              completion_percent: fieldValidation.completion_percent,
              report_ready: fieldValidation.report_ready,
            },
          },
        });
      }

      const created = await base44.asServiceRole.entities.TimeEntry.create({
        org_id: context.organizationId,
        client_id: client?.id || null,
        employee_id: employeeId,
        ...prepared,
        locked_in_report_id: null,
      });

      try {
        await saveFieldAnswer(
          base44,
          null,
          buildFieldAnswerPayload(
            context.organizationId,
            created.id,
            entryType,
            templates,
            formData,
            fieldValidation,
            true
          )
        );
      } catch (error) {
        await base44.asServiceRole.entities.TimeEntry.delete(created.id).catch(() => null);
        throw new RequestError(500, "TimeEntry creation could not be completed safely.");
      }

      await recalculateAuthorization(
        base44,
        context.organizationId,
        normalizeText(created.service_authorization_id)
      );

      return Response.json({
        ok: true,
        success: true,
        action,
        entry: projectEntry(created),
        time_entry_id: created.id,
        report_ready: fieldValidation.report_ready,
        completion_percent: fieldValidation.completion_percent,
        validation: authorizationResult.validation,
      });
    }

    const entryId = normalizeText(body?.entry_id || body?.time_entry_id || body?.id);
    if (!entryId) {
      throw new RequestError(400, "Choose a TimeEntry before continuing.");
    }

    const existingEntry = await base44.asServiceRole.entities.TimeEntry.get(entryId).catch(
      () => null
    );
    if (
      !existingEntry ||
      normalizeText(existingEntry?.org_id) !== context.organizationId
    ) {
      throw new RequestError(404, "The requested TimeEntry is unavailable to your account.");
    }

    const existingFieldAnswer = await loadSingleFieldAnswer(
      base44,
      context.organizationId,
      entryId
    );
    assertMutable(existingEntry, existingFieldAnswer);

    const employeeId = normalizeText(existingEntry?.employee_id);
    if (!employeeId) {
      throw new RequestError(409, "This TimeEntry has no employee owner.");
    }
    await assertEmployeeAuthority(base44, context, employeeId);

    const clientId = normalizeText(existingEntry?.client_id);
    const client = clientId ? await loadScopedClient(base44, context, clientId) : null;

    if (hasOwn(timeEntryInput, "client_id") && normalizeText(timeEntryInput.client_id) !== clientId) {
      throw new RequestError(400, "A TimeEntry client cannot be changed after creation.");
    }
    if (hasOwn(timeEntryInput, "employee_id") && normalizeText(timeEntryInput.employee_id) !== employeeId) {
      throw new RequestError(400, "A TimeEntry employee cannot be changed after creation.");
    }

    if (action === "delete") {
      await assertTimeCardOpen(
        base44,
        context.organizationId,
        employeeId,
        [normalizeDate(existingEntry?.date)],
        "deleted"
      );

      const answerBackup = existingFieldAnswer
        ? {
            org_id: context.organizationId,
            time_entry_id: entryId,
            entry_type_id: existingFieldAnswer.entry_type_id,
            entry_type_code: existingFieldAnswer.entry_type_code,
            field_schema_version: existingFieldAnswer.field_schema_version,
            field_schema_snapshot: asObject(existingFieldAnswer.field_schema_snapshot),
            answers: asObject(existingFieldAnswer.answers),
            required_fields_complete: existingFieldAnswer.required_fields_complete === true,
            report_ready: existingFieldAnswer.report_ready === true,
            submitted_at: existingFieldAnswer.submitted_at || new Date().toISOString(),
            validation_errors: asArray(existingFieldAnswer.validation_errors),
            completion_percent: asNumber(existingFieldAnswer.completion_percent),
            locked_in_report_id: null,
          }
        : null;

      if (existingFieldAnswer?.id) {
        await base44.asServiceRole.entities.ReportFieldAnswer.delete(existingFieldAnswer.id);
      }

      try {
        await base44.asServiceRole.entities.TimeEntry.delete(entryId);
      } catch (error) {
        if (answerBackup) {
          await base44.asServiceRole.entities.ReportFieldAnswer.create(answerBackup).catch(() => null);
        }
        throw new RequestError(
          500,
          "TimeEntry deletion failed. Its structured answers were restored."
        );
      }

      await recalculateAuthorization(
        base44,
        context.organizationId,
        normalizeText(existingEntry?.service_authorization_id)
      );

      return Response.json({ ok: true, action, deleted_time_entry_id: entryId });
    }

    const entryType = await loadEntryType(
      base44,
      context.organizationId,
      hasOwn(timeEntryInput, "entry_type_id")
        ? normalizeText(timeEntryInput.entry_type_id)
        : normalizeText(existingEntry.entry_type_id),
      hasOwn(timeEntryInput, "entry_type_code")
        ? normalizeText(timeEntryInput.entry_type_code)
        : normalizeText(existingEntry.entry_type_code)
    );
    if (entryType?.requires_client !== false && !client) {
      throw new RequestError(400, `A client is required for ${entryType.name}.`);
    }

    const prepared = buildPreparedEntry(timeEntryInput, existingEntry, entryType, context.role);
    await assertTimeCardOpen(
      base44,
      context.organizationId,
      employeeId,
      [normalizeDate(existingEntry?.date), prepared.date],
      "changed"
    );

    const templates = await loadTemplates(base44, context.organizationId, entryType);
    const requestedFormData = hasOwn(timeEntryInput, "form_data")
      ? timeEntryInput.form_data
      : hasOwn(timeEntryInput, "field_answers")
      ? timeEntryInput.field_answers
      : {};
    const formData = mergeFormData(
      requestedFormData,
      existingEntry.form_data,
      prepared.entry_type_code,
      templates,
      true
    );
    const fieldValidation = validateFieldAnswers(
      templates,
      formData,
      prepared.status,
      entryType?.requires_field_answers === true,
      prepared.entry_type_code
    );
    prepared.form_data = formData;
    prepared.report_ready = fieldValidation.report_ready;

    const existingAuthorizationId = normalizeText(existingEntry?.service_authorization_id);
    const requestedAuthorizationId = hasOwn(timeEntryInput, "service_authorization_id")
      ? normalizeText(timeEntryInput.service_authorization_id)
      : existingAuthorizationId;
    if (requestedAuthorizationId !== existingAuthorizationId && context.role === "employee") {
      throw new RequestError(
        403,
        "Only management or organization administrators may change a TimeEntry ServiceAuthorization."
      );
    }

    // Forward-only rule: preserve a historical marker exactly as stored. An
    // update must never retroactively stamp a legacy submitted entry.
    prepared.authorization_usage_eligible =
      existingEntry?.authorization_usage_eligible === true;
    prepared.authorization_usage_eligible_at =
      existingEntry?.authorization_usage_eligible_at ?? null;
    prepared.service_authorization_id = requestedAuthorizationId || null;

    const authorizationResult = await validateAuthorization(
      base44,
      context.organizationId,
      client,
      entryType,
      prepared,
      requestedAuthorizationId,
      entryId
    );
    prepared.service_authorization_id = authorizationResult.authorization?.id || null;

    const updated = await base44.asServiceRole.entities.TimeEntry.update(entryId, prepared);

    try {
      await saveFieldAnswer(
        base44,
        existingFieldAnswer,
        buildFieldAnswerPayload(
          context.organizationId,
          entryId,
          entryType,
          templates,
          formData,
          fieldValidation,
          !existingFieldAnswer
        )
      );
    } catch (error) {
      await base44.asServiceRole.entities.TimeEntry.update(
        entryId,
        buildEntryRollback(existingEntry)
      ).catch(() => null);
      throw new RequestError(500, "TimeEntry update could not be completed safely.");
    }

    await recalculateAuthorization(
      base44,
      context.organizationId,
      existingAuthorizationId
    );
    if (requestedAuthorizationId !== existingAuthorizationId) {
      await recalculateAuthorization(
        base44,
        context.organizationId,
        requestedAuthorizationId
      );
    }

    return Response.json({
      ok: true,
      success: true,
      action,
      entry: projectEntry(updated),
      report_ready: fieldValidation.report_ready,
      completion_percent: fieldValidation.completion_percent,
      validation: authorizationResult.validation,
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "Unable to process the TimeEntry request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedTimeEntryV2 error:",
        error?.message || error
      );
    }

    return Response.json({ ok: false, error: message }, { status });
  }
});
