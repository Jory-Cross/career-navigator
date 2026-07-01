import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const TIME_ENTRY_STATUSES = new Set([
  "draft",
  "submitted",
  "approved",
  "locked",
  "void",
]);

const AUTHORIZATION_COUNTED_STATUSES = new Set([
  "approved",
  "locked",
]);

const INTERNAL_TIME_ENTRY_ROLES = new Set([
  "admin",
  "management",
  "employee",
]);

const LEGACY_STATIC_FORM_FIELDS_BY_ENTRY_TYPE: Record<
  string,
  Set<string>
> = {
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

function getLegacyStaticFormFields(entryTypeCode: unknown) {
  return (
    LEGACY_STATIC_FORM_FIELDS_BY_ENTRY_TYPE[
      normalizeText(entryTypeCode).toLowerCase()
    ] || new Set<string>()
  );
}

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

function isAuthorizationCounted(entry: any) {
  return AUTHORIZATION_COUNTED_STATUSES.has(
    normalizeText(entry?.status).toLowerCase()
  );
}

function isFilled(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

/**
 * Temporary capability bridge.
 *
 * Tenant isolation is permanent and server-enforced.
 * Organization-defined feature permissions will later replace this bridge.
 *
 * Current allowed internal roles:
 * - admin: organization-wide TimeEntry authority
 * - management: own + active same-org direct reports
 * - employee: own entries only
 *
 * CE, client, Pre-ETS, DSPD, employer, and student roles are denied.
 * access_level is intentionally not used to expand TimeEntry authority.
 */
function getCurrentTimeEntryCapabilities(caller: any) {
  const role = normalizeText(caller?.role).toLowerCase();

  if (!INTERNAL_TIME_ENTRY_ROLES.has(role)) {
    throw httpError(
      403,
      "You are not authorized to create, edit, or delete Time Entries."
    );
  }

  return {
    role,
    isOrganizationAdmin: role === "admin",
    isManagement: role === "management",
    mayApproveOrVoid: role === "admin" || role === "management",
    mayManageDirectReports: role === "admin" || role === "management",
  };
}

function resolveRequestedTimeEntry(body: any) {
  const candidate = body?.time_entry ?? body?.timeEntry ?? {};

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw httpError(400, "time_entry must be an object.");
  }

  return candidate;
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

function getRequestedFormData(timeEntry: any) {
  const hasFormData = hasOwn(timeEntry, "form_data");
  const hasFieldAnswers = hasOwn(timeEntry, "field_answers");

  if (hasFormData && hasFieldAnswers) {
    throw httpError(
      400,
      "Provide either form_data or field_answers, not both."
    );
  }

  if (!hasFormData && !hasFieldAnswers) {
    return null;
  }

  const value = hasFormData
    ? timeEntry.form_data
    : timeEntry.field_answers;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw httpError(
      400,
      "form_data or field_answers must be an object."
    );
  }

  return value;
}

function calculateReportingPeriodKey(
  date: string,
  reportMode: string
) {
  const [year, monthValue] = date.split("-");
  const month = Number(monthValue);

  if (
    !year ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw httpError(
      400,
      "Unable to determine the reporting period from the TimeEntry date."
    );
  }

  if (reportMode === "usor148_service_period") {
    return `${year}-Q${Math.ceil(month / 3)}`;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

function resolveStatus(
  requestedStatus: unknown,
  fallbackStatus: unknown,
  capabilities: any
) {
  const status =
    normalizeText(requestedStatus).toLowerCase() ||
    normalizeText(fallbackStatus).toLowerCase() ||
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
    !capabilities.mayApproveOrVoid &&
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

async function getCaller(
  base44: any,
  authenticatedUser: any
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUser.id
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw httpError(
      403,
      "Authenticated user record was not found or is inactive."
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
    capabilities: getCurrentTimeEntryCapabilities(caller),
  };
}

async function assertTargetEmployeeAccess(
  base44: any,
  caller: any,
  organizationId: string,
  capabilities: any,
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

  const targetRole = normalizeText(targetEmployee.role).toLowerCase();

  if (!INTERNAL_TIME_ENTRY_ROLES.has(targetRole)) {
    throw httpError(
      403,
      "The requested employee is not eligible for TimeEntry ownership."
    );
  }

  if (targetEmployeeId === caller.id) {
    return targetEmployee;
  }

  if (capabilities.isOrganizationAdmin) {
    return targetEmployee;
  }

  if (!capabilities.isManagement) {
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

  const isActiveSameOrgDirectReport = asArray(assignments).some(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId
  );

  if (!isActiveSameOrgDirectReport) {
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

  if (
    client?.is_archived === true ||
    normalizeText(client.org_id) !== organizationId
  ) {
    throw httpError(
      403,
      "The requested client is not available in your organization."
    );
  }

  return client;
}

function assertClientAccess(
  caller: any,
  capabilities: any,
  client: any
) {
  if (!client || capabilities.isOrganizationAdmin || capabilities.isManagement) {
    return;
  }

  if (normalizeText(client.assigned_employee_id) !== caller.id) {
    throw httpError(
      403,
      "You may only create or modify Time Entries for clients assigned to you."
    );
  }
}

async function loadEntryType(
  base44: any,
  organizationId: string,
  requestedEntryTypeId: string,
  requestedEntryTypeCode: string
) {
  let entryType: any = null;

  if (requestedEntryTypeId) {
    entryType =
      await base44.asServiceRole.entities.EntryType.get(
        requestedEntryTypeId
      ).catch(() => null);

    if (!entryType || entryType.is_active === false) {
      throw httpError(
        404,
        "The requested EntryType was not found or is inactive."
      );
    }

    const entryTypeOrganizationId = normalizeText(entryType.org_id);

    if (
      entryTypeOrganizationId &&
      entryTypeOrganizationId !== organizationId
    ) {
      throw httpError(
        403,
        "The requested EntryType belongs to a different organization."
      );
    }
  } else {
    if (!requestedEntryTypeCode) {
      throw httpError(
        400,
        "entry_type_id or entry_type_code is required."
      );
    }

    const matchingEntryTypes =
      await base44.asServiceRole.entities.EntryType.filter({
        code: requestedEntryTypeCode,
        is_active: true,
      });

    const allowedMatches = asArray(matchingEntryTypes).filter(
      (candidate: any) => {
        const candidateOrganizationId = normalizeText(
          candidate?.org_id
        );

        return (
          candidate?.is_active !== false &&
          (
            !candidateOrganizationId ||
            candidateOrganizationId === organizationId
          )
        );
      }
    );

    if (allowedMatches.length === 0) {
      throw httpError(
        404,
        "The requested EntryType was not found or is inactive."
      );
    }

    if (allowedMatches.length > 1) {
      throw httpError(
        409,
        "Multiple active EntryTypes match this code. entry_type_id is required."
      );
    }

    entryType = allowedMatches[0];
  }

  const canonicalEntryTypeCode = normalizeText(entryType.code);

  if (!canonicalEntryTypeCode) {
    throw httpError(
      409,
      "The requested EntryType has no valid code."
    );
  }

  if (
    requestedEntryTypeCode &&
    requestedEntryTypeCode !== canonicalEntryTypeCode
  ) {
    throw httpError(
      400,
      "entry_type_code does not match the requested EntryType."
    );
  }

  return entryType;
}
async function loadActiveTemplates(
  base44: any,
  organizationId: string,
  entryType: any
) {
  const templates =
    await base44.asServiceRole.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      is_active: true,
    });

  return asArray(templates)
    .filter(
      (template: any) =>
        template?.is_active !== false &&
        normalizeText(template.entry_type_id) === entryType.id &&
        normalizeText(template.entry_type_code) ===
          normalizeText(entryType.code)
    )
    .filter((template: any) => {
      const templateOrganizationId = normalizeText(template.org_id);

      return (
        !templateOrganizationId ||
        templateOrganizationId === organizationId
      );
    });
}

function assertAndMergeFormData(
  incomingFormData: any,
  existingFormData: any,
  activeTemplates: any[],
  entryTypeCode: string,
  isUpdate: boolean
) {
  const incoming = incomingFormData || {};
  const existing = asObject(existingFormData);

  const allowedNewKeys = new Set(
    activeTemplates
      .map((template: any) => normalizeText(template.field_key))
      .filter(Boolean)
  );

  for (const fieldKey of getLegacyStaticFormFields(entryTypeCode)) {
    allowedNewKeys.add(fieldKey);
  }

  const existingKeys = new Set(Object.keys(existing));

  const invalidIncomingKeys = Object.keys(incoming).filter(
    (key) =>
      !allowedNewKeys.has(key) &&
      !(isUpdate && existingKeys.has(key))
  );

  if (invalidIncomingKeys.length > 0) {
    throw httpError(
      400,
      `form_data contains fields that are not active for this EntryType: ${invalidIncomingKeys.join(
        ", "
      )}.`
    );
  }

  return isUpdate
    ? { ...existing, ...incoming }
    : { ...incoming };
}

function getFieldValidation(
  templates: any[],
  formData: any,
  status: string,
  requiresFieldAnswers: boolean,
  entryTypeCode: string
) {
  const legacyStaticFields = getLegacyStaticFormFields(entryTypeCode);

  if (
    requiresFieldAnswers &&
    templates.length === 0 &&
    legacyStaticFields.size === 0
  ) {
    throw httpError(
      409,
      "This EntryType requires field answers but has no active field templates."
    );
  }

  const requiredOnEntry = templates.filter(
    (template: any) => template.required_on_entry === true
  );

  const requiredForReport = templates.filter(
    (template: any) => template.required_for_report === true
  );

  const allRequired = [
    ...new Map(
      [...requiredOnEntry, ...requiredForReport].map(
        (template: any) => [template.id, template]
      )
    ).values(),
  ];

  const missingRequiredOnEntry = requiredOnEntry
    .filter(
      (template: any) => !isFilled(formData[template.field_key])
    )
    .map((template: any) => template.field_key);

  const missingRequiredForReport = requiredForReport
    .filter(
      (template: any) => !isFilled(formData[template.field_key])
    )
    .map((template: any) => template.field_key);

  if (
    status !== "draft" &&
    status !== "void" &&
    missingRequiredOnEntry.length > 0
  ) {
    throw httpError(
      400,
      `Required entry fields are missing: ${missingRequiredOnEntry.join(
        ", "
      )}.`
    );
  }

  const completedRequiredCount = allRequired.filter(
    (template: any) => isFilled(formData[template.field_key])
  ).length;

  const completionPercent =
    allRequired.length > 0
      ? Math.round(
          (completedRequiredCount / allRequired.length) * 100
        )
      : 0;

  const validationErrors = Array.from(
    new Set([
      ...missingRequiredOnEntry,
      ...missingRequiredForReport,
    ])
  );

  return {
    required_fields_complete: validationErrors.length === 0,
    report_ready:
      status !== "draft" &&
      status !== "void" &&
      missingRequiredForReport.length === 0,
    validation_errors: validationErrors,
    completion_percent: completionPercent,
    missing_required_on_entry: missingRequiredOnEntry,
    missing_required_for_report: missingRequiredForReport,
  };
}

function buildFieldSchemaSnapshot(templates: any[]) {
  const snapshot: Record<string, any> = {};

  for (const template of templates) {
    const fieldKey = normalizeText(template.field_key);

    if (!fieldKey) {
      continue;
    }

    snapshot[fieldKey] = {
      label: template.label || "",
      field_type: template.field_type || "text",
      is_required: template.is_required === true,
      required_on_entry: template.required_on_entry === true,
      required_for_report: template.required_for_report === true,
      is_reportable: template.is_reportable !== false,
      is_internal_only: template.is_internal_only === true,
      order: template.order ?? null,
      section: template.section ?? null,
      field_group: template.field_group ?? null,
      options: Array.isArray(template.options)
        ? template.options
        : [],
      schema_version: Number.isFinite(
        Number(template.schema_version)
      )
        ? Number(template.schema_version)
        : 1,
    };
  }

  return snapshot;
}

function getFieldSchemaVersion(templates: any[]) {
  const versions = templates
    .map((template: any) => Number(template.schema_version))
    .filter((version: number) => Number.isFinite(version));

  return versions.length > 0 ? Math.max(...versions) : 1;
}

async function loadSingleReportFieldAnswer(
  base44: any,
  organizationId: string,
  timeEntryId: string
) {
  const answers =
    await base44.asServiceRole.entities.ReportFieldAnswer.filter({
      time_entry_id: timeEntryId,
    });

  const matchingAnswers = asArray(answers);

  if (matchingAnswers.length > 1) {
    throw httpError(
      409,
      "Multiple ReportFieldAnswer records exist for this TimeEntry and must be repaired before mutation."
    );
  }

  const answer = matchingAnswers[0] || null;

  if (
    answer &&
    normalizeText(answer.org_id) &&
    normalizeText(answer.org_id) !== organizationId
  ) {
    throw httpError(
      403,
      "The ReportFieldAnswer belongs to a different organization."
    );
  }

  return answer;
}

function assertMutable(
  timeEntry: any,
  reportFieldAnswer: any
) {
  if (
    normalizeText(timeEntry?.status).toLowerCase() === "locked" ||
    normalizeText(timeEntry?.locked_in_report_id)
  ) {
    throw httpError(
      409,
      "A locked or reported TimeEntry cannot be changed."
    );
  }

  if (normalizeText(reportFieldAnswer?.locked_in_report_id)) {
    throw httpError(
      409,
      "The ReportFieldAnswer is locked in a finalized report and cannot be changed."
    );
  }
}

function buildBaseEntryValues(
  input: any,
  existingEntry: any,
  entryType: any,
  capabilities: any
) {
  const isUpdate = Boolean(existingEntry?.id);

  const date = hasOwn(input, "date")
    ? normalizeDate(input.date)
    : normalizeDate(existingEntry?.date);

  const durationMinutes = hasOwn(input, "duration_minutes")
    ? asNumber(input.duration_minutes, NaN)
    : asNumber(existingEntry?.duration_minutes, NaN);

  if (!date) {
    throw httpError(
      400,
      "A valid TimeEntry date in YYYY-MM-DD format is required."
    );
  }

  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 0
  ) {
    throw httpError(
      400,
      "duration_minutes must be a number that is zero or greater."
    );
  }

  const status = resolveStatus(
    hasOwn(input, "status") ? input.status : undefined,
    existingEntry?.status || "submitted",
    capabilities
  );

  const employerName = hasOwn(input, "employer_name")
    ? normalizeText(input.employer_name) || null
    : normalizeText(existingEntry?.employer_name) || null;

  return {
    date,
    start_time: hasOwn(input, "start_time")
      ? normalizeText(input.start_time) || null
      : existingEntry?.start_time ?? null,
    end_time: hasOwn(input, "end_time")
      ? normalizeText(input.end_time) || null
      : existingEntry?.end_time ?? null,
    duration_minutes: durationMinutes,
    reporting_period_key: calculateReportingPeriodKey(
      date,
      normalizeText(entryType.report_mode)
    ),
    location: hasOwn(input, "location")
      ? normalizeText(input.location) || null
      : existingEntry?.location ?? null,
    description: hasOwn(input, "description")
      ? normalizeText(input.description) || null
      : existingEntry?.description ?? null,
    entry_type_id: entryType.id,
    entry_type_code: normalizeText(entryType.code),
    is_billable: entryType.is_billable === true,
    is_payroll_eligible:
      entryType.is_payroll_eligible !== false,
    is_reportable:
      normalizeText(entryType.report_mode) !== "none",
    status,
    legacy_category: normalizeText(entryType.code) || null,
    employer_name: employerName,
    service_authorization_id: null,
    report_ready: false,
    form_data: {},
    is_update: isUpdate,
  };
}

async function validateAuthorization(
  base44: any,
  organizationId: string,
  entryType: any,
  client: any,
  preparedEntry: any,
  authorizationId: string,
  excludeEntryId: string | null = null
) {
  const requiresAuthorization =
    entryType.requires_authorization === true;

  if (requiresAuthorization && !authorizationId) {
    throw httpError(
      400,
      `Authorization is required for ${entryType.name}.`
    );
  }

  if (!authorizationId) {
    if (
      entryType.requires_employer === true &&
      !normalizeText(preparedEntry.employer_name)
    ) {
      throw httpError(
        400,
        `employer_name is required for ${entryType.name}.`
      );
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
    throw httpError(
      400,
      "A client-linked TimeEntry is required when using a ServiceAuthorization."
    );
  }

  const authorization =
    await base44.asServiceRole.entities.ServiceAuthorization.get(
      authorizationId
    ).catch(() => null);

  if (!authorization) {
    throw httpError(404, "ServiceAuthorization was not found.");
  }

  if (normalizeText(authorization.org_id) !== organizationId) {
    throw httpError(
      403,
      "The ServiceAuthorization does not have a valid organization scope for this TimeEntry."
    );
  }

  if (normalizeText(authorization.client_id) !== client.id) {
    throw httpError(
      403,
      "The ServiceAuthorization does not belong to this client."
    );
  }

  if (
    normalizeText(authorization.entry_type_code) !==
    normalizeText(entryType.code)
  ) {
    throw httpError(
      400,
      "The ServiceAuthorization does not match this TimeEntry type."
    );
  }

  if (normalizeText(authorization.status) !== "active") {
    throw httpError(
      409,
      "The selected ServiceAuthorization is not active."
    );
  }

  if (
    normalizeText(authorization.service_start_date) &&
    preparedEntry.date < authorization.service_start_date
  ) {
    throw httpError(
      400,
      "The TimeEntry date is before the ServiceAuthorization start date."
    );
  }

  if (
    normalizeText(authorization.service_end_date) &&
    preparedEntry.date > authorization.service_end_date
  ) {
    throw httpError(
      400,
      "The TimeEntry date is after the ServiceAuthorization end date."
    );
  }

  const authorizationEmployerName = normalizeText(
    authorization.employer_name
  );

  if (
    entryType.requires_employer === true &&
    !authorizationEmployerName
  ) {
    throw httpError(
      400,
      "This EntryType requires an employer_name on the selected ServiceAuthorization."
    );
  }

  if (
    !preparedEntry.employer_name &&
    authorizationEmployerName
  ) {
    preparedEntry.employer_name = authorizationEmployerName;
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

  const proposedHours = isAuthorizationCounted(preparedEntry)
    ? asNumber(preparedEntry.duration_minutes, 0) / 60
    : 0;

  if (proposedHours > remainingHours + 0.0001) {
    throw httpError(
      409,
      `This TimeEntry exceeds the remaining authorized hours (${remainingHours.toFixed(
        2
      )}).`
    );
  }

  const resultingRemainingHours =
    remainingHours - proposedHours;

  const warnings: string[] = [];

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

  if (
    !authorization ||
    normalizeText(authorization.org_id) !== organizationId
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

  await base44.asServiceRole.entities.ServiceAuthorization.update(
    authorizationId,
    {
      used_hours: Number(usedHours.toFixed(2)),
      remaining_hours: Number(
        Math.max(0, totalAuthorizedHours - usedHours).toFixed(2)
      ),
    }
  );
}

function buildReportFieldAnswerPayload(
  organizationId: string,
  timeEntryId: string,
  entryType: any,
  activeTemplates: any[],
  formData: any,
  fieldValidation: any,
  isCreate: boolean
) {
  const payload: any = {
    org_id: organizationId,
    time_entry_id: timeEntryId,
    entry_type_id: entryType.id,
    entry_type_code: normalizeText(entryType.code),
    field_schema_version: getFieldSchemaVersion(activeTemplates),
    field_schema_snapshot: buildFieldSchemaSnapshot(
      activeTemplates
    ),
    answers: formData,
    required_fields_complete:
      fieldValidation.required_fields_complete,
    report_ready: fieldValidation.report_ready,
    submitted_at: new Date().toISOString(),
    validation_errors: fieldValidation.validation_errors,
    completion_percent: fieldValidation.completion_percent,
  };

  if (isCreate) {
    payload.locked_in_report_id = null;
  }

  return payload;
}

function buildEntryRollbackPayload(entry: any) {
  return {
    entry_type_id: entry.entry_type_id ?? null,
    entry_type_code: entry.entry_type_code ?? null,
    date: entry.date,
    start_time: entry.start_time ?? null,
    end_time: entry.end_time ?? null,
    duration_minutes: entry.duration_minutes,
    reporting_period_key: entry.reporting_period_key ?? null,
    location: entry.location ?? null,
    description: entry.description ?? null,
    form_data: asObject(entry.form_data),
    is_billable: entry.is_billable === true,
    is_payroll_eligible:
      entry.is_payroll_eligible !== false,
    is_reportable: entry.is_reportable !== false,
    status: entry.status,
    legacy_category: entry.legacy_category ?? null,
    employer_name: entry.employer_name ?? null,
    report_ready: entry.report_ready === true,
    service_authorization_id:
      entry.service_authorization_id ?? null,
  };
}

async function recalculateChangedAuthorizations(
  base44: any,
  organizationId: string,
  authorizationIds: string[]
) {
  const uniqueAuthorizationIds = Array.from(
    new Set(
      authorizationIds
        .map((authorizationId) =>
          normalizeText(authorizationId)
        )
        .filter(Boolean)
    )
  );

  const failedAuthorizationIds: string[] = [];

  for (const authorizationId of uniqueAuthorizationIds) {
    try {
      await recalculateAuthorizationTotals(
        base44,
        organizationId,
        authorizationId
      );
    } catch (error) {
      console.error(
        "Authorization total recalculation failed:",
        authorizationId,
        error?.message || error
      );

      failedAuthorizationIds.push(authorizationId);
    }
  }

  return failedAuthorizationIds;
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

    if (!["validate", "create", "update", "delete"].includes(action)) {
      throw httpError(
        400,
        "action must be validate, create, update, or delete."
      );
    }

    const {
      caller,
      organizationId,
      capabilities,
    } = await getCaller(base44, authenticatedUser);

    const timeEntryInput = resolveRequestedTimeEntry(body);

    if (action === "validate" || action === "create") {
      const requestedEmployeeId =
        normalizeText(timeEntryInput.employee_id) || caller.id;

      await assertTargetEmployeeAccess(
        base44,
        caller,
        organizationId,
        capabilities,
        requestedEmployeeId
      );

      const requestedEntryTypeId = normalizeText(
        timeEntryInput.entry_type_id
      );

      const entryType = await loadEntryType(
        base44,
        organizationId,
        requestedEntryTypeId,
        normalizeText(timeEntryInput.entry_type_code)
      );

      const requestedClientId = normalizeText(
        timeEntryInput.client_id
      );

      const requiresClient = entryType.requires_client !== false;

      if (requiresClient && !requestedClientId) {
        throw httpError(
          400,
          `A client is required for ${entryType.name}.`
        );
      }

      const client = requestedClientId
        ? await loadScopedClient(
            base44,
            organizationId,
            requestedClientId
          )
        : null;

      if (client) {
        assertClientAccess(caller, capabilities, client);
      }

      const preparedEntry = buildBaseEntryValues(
        timeEntryInput,
        null,
        entryType,
        capabilities
      );

      const activeTemplates = await loadActiveTemplates(
        base44,
        organizationId,
        entryType
      );

            const formData = assertAndMergeFormData(
        getRequestedFormData(timeEntryInput),
        {},
        activeTemplates,
        entryType.code,
        false
      );

      const fieldValidation = getFieldValidation(
        activeTemplates,
        formData,
        preparedEntry.status,
        entryType.requires_field_answers === true,
        entryType.code
      );

      preparedEntry.form_data = formData;
      preparedEntry.report_ready =
        fieldValidation.report_ready;

      const requestedAuthorizationId =
        getRequestedAuthorizationId(body, timeEntryInput);

      const authorizationResult =
        await validateAuthorization(
          base44,
          organizationId,
          entryType,
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
          entry_type: {
            id: entryType.id,
            code: entryType.code,
          },
          validation: {
            ...authorizationResult.validation,
            field_answers: {
              missing_required_on_entry:
                fieldValidation.missing_required_on_entry,
              missing_required_for_report:
                fieldValidation.missing_required_for_report,
              completion_percent:
                fieldValidation.completion_percent,
              report_ready: fieldValidation.report_ready,
            },
          },
        });
      }

      const createPayload = {
        org_id: organizationId,
        client_id: client?.id || null,
        employee_id: requestedEmployeeId,
        entry_type_id: preparedEntry.entry_type_id,
        entry_type_code: preparedEntry.entry_type_code,
        date: preparedEntry.date,
        start_time: preparedEntry.start_time,
        end_time: preparedEntry.end_time,
        duration_minutes: preparedEntry.duration_minutes,
        reporting_period_key:
          preparedEntry.reporting_period_key,
        location: preparedEntry.location,
        description: preparedEntry.description,
        form_data: preparedEntry.form_data,
        is_billable: preparedEntry.is_billable,
        is_payroll_eligible:
          preparedEntry.is_payroll_eligible,
        is_reportable: preparedEntry.is_reportable,
        status: preparedEntry.status,
        legacy_category: preparedEntry.legacy_category,
        employer_name: preparedEntry.employer_name,
        report_ready: preparedEntry.report_ready,
        locked_in_report_id: null,
        service_authorization_id:
          preparedEntry.service_authorization_id,
      };

           const created =
        await base44.asServiceRole.entities.TimeEntry.create(
          createPayload
        );

      let createdReportFieldAnswer: any = null;

      try {
        const reportFieldAnswerPayload =
          buildReportFieldAnswerPayload(
            organizationId,
            created.id,
            entryType,
            activeTemplates,
            formData,
            fieldValidation,
            true
          );

        createdReportFieldAnswer =
          await base44.asServiceRole.entities.ReportFieldAnswer.create(
            reportFieldAnswerPayload
          );
      } catch (error) {
        await base44.asServiceRole.entities.TimeEntry.delete(
          created.id
        ).catch(() => null);

        throw httpError(
          500,
          "TimeEntry creation could not be completed safely."
        );
      }

      const authorizationRecalculationFailures =
        await recalculateChangedAuthorizations(
          base44,
          organizationId,
          [
            authorizationResult.authorization?.id || "",
          ]
        );

      return Response.json({
        ok: true,
        success: true,
        action,
        entry: created,
        time_entry_id: created.id,
        field_answer_id: createdReportFieldAnswer.id,
        report_ready: fieldValidation.report_ready,
        completion_percent: fieldValidation.completion_percent,
        validation: authorizationResult.validation,
        authorization_recalculation_failures:
          authorizationRecalculationFailures,
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

    const existingReportFieldAnswer =
      await loadSingleReportFieldAnswer(
        base44,
        organizationId,
        entryId
      );

    assertMutable(existingEntry, existingReportFieldAnswer);

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
      capabilities,
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

    if (existingClient) {
      assertClientAccess(caller, capabilities, existingClient);
    }

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
      const reportFieldAnswerRestorePayload =
        existingReportFieldAnswer?.id
          ? {
              org_id: organizationId,
              time_entry_id: entryId,
              entry_type_id:
                normalizeText(
                  existingReportFieldAnswer.entry_type_id
                ) || normalizeText(existingEntry.entry_type_id),
              entry_type_code:
                normalizeText(
                  existingReportFieldAnswer.entry_type_code
                ) || normalizeText(existingEntry.entry_type_code),
              field_schema_version: Number.isFinite(
                Number(existingReportFieldAnswer.field_schema_version)
              )
                ? Number(existingReportFieldAnswer.field_schema_version)
                : 1,
              field_schema_snapshot: asObject(
                existingReportFieldAnswer.field_schema_snapshot
              ),
              answers: asObject(existingReportFieldAnswer.answers),
              required_fields_complete:
                existingReportFieldAnswer.required_fields_complete ===
                true,
              report_ready:
                existingReportFieldAnswer.report_ready === true,
              submitted_at:
                normalizeText(existingReportFieldAnswer.submitted_at) ||
                new Date().toISOString(),
              validation_errors: asArray(
                existingReportFieldAnswer.validation_errors
              ),
              completion_percent: asNumber(
                existingReportFieldAnswer.completion_percent,
                0
              ),
            }
          : null;

      if (existingReportFieldAnswer?.id) {
        try {
          await base44.asServiceRole.entities.ReportFieldAnswer.delete(
            existingReportFieldAnswer.id
          );
        } catch (error: any) {
          console.error(
            "ReportFieldAnswer deletion failed before TimeEntry deletion:",
            error?.message || error
          );

          throw httpError(
            500,
            "TimeEntry deletion was not started because its linked ReportFieldAnswer could not be deleted."
          );
        }
      }

      try {
        await base44.asServiceRole.entities.TimeEntry.delete(
          entryId
        );
      } catch (error: any) {
        console.error(
          "TimeEntry deletion failed:",
          error?.message || error
        );

        if (reportFieldAnswerRestorePayload) {
          try {
            await base44.asServiceRole.entities.ReportFieldAnswer.create(
              reportFieldAnswerRestorePayload
            );
          } catch (restoreError: any) {
            console.error(
              "ReportFieldAnswer restoration failed after TimeEntry deletion failure:",
              restoreError?.message || restoreError
            );

            throw httpError(
              500,
              "TimeEntry deletion failed and the linked ReportFieldAnswer could not be restored."
            );
          }
        }

        throw httpError(
          500,
          "TimeEntry deletion failed. Its linked ReportFieldAnswer was restored."
        );
      }

      const authorizationRecalculationFailures =
        await recalculateChangedAuthorizations(
          base44,
          organizationId,
          [
            normalizeText(
              existingEntry.service_authorization_id
            ),
          ]
        );

      return Response.json({
        ok: true,
        action,
        deleted_time_entry_id: entryId,
        authorization_recalculation_failures:
          authorizationRecalculationFailures,
      });
    }
    const requestedEntryTypeId = hasOwn(
      timeEntryInput,
      "entry_type_id"
    )
      ? normalizeText(timeEntryInput.entry_type_id)
      : normalizeText(existingEntry.entry_type_id);

    const requestedEntryTypeCode = hasOwn(
      timeEntryInput,
      "entry_type_code"
    )
      ? normalizeText(timeEntryInput.entry_type_code)
      : normalizeText(existingEntry.entry_type_code);

    const entryType = await loadEntryType(
      base44,
      organizationId,
      requestedEntryTypeId,
      requestedEntryTypeCode
    );

    const requiresClient = entryType.requires_client !== false;

    if (requiresClient && !existingClient) {
      throw httpError(
        400,
        `A client is required for ${entryType.name}.`
      );
    }

    const preparedEntry = buildBaseEntryValues(
      timeEntryInput,
      existingEntry,
      entryType,
      capabilities
    );

    const activeTemplates = await loadActiveTemplates(
      base44,
      organizationId,
      entryType
    );

        const formData = assertAndMergeFormData(
      getRequestedFormData(timeEntryInput),
      existingEntry.form_data,
      activeTemplates,
      entryType.code,
      true
    );

    const fieldValidation = getFieldValidation(
      activeTemplates,
      formData,
      preparedEntry.status,
      entryType.requires_field_answers === true,
      entryType.code
    );

    preparedEntry.form_data = formData;
    preparedEntry.report_ready =
      fieldValidation.report_ready;

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
      requestedAuthorizationId !== existingAuthorizationId &&
      !capabilities.mayApproveOrVoid
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
        entryType,
        existingClient,
        preparedEntry,
        requestedAuthorizationId,
        entryId
      );

    preparedEntry.service_authorization_id =
      authorizationResult.authorization?.id || null;

    const updatePayload = {
      entry_type_id: preparedEntry.entry_type_id,
      entry_type_code: preparedEntry.entry_type_code,
      date: preparedEntry.date,
      start_time: preparedEntry.start_time,
      end_time: preparedEntry.end_time,
      duration_minutes: preparedEntry.duration_minutes,
      reporting_period_key:
        preparedEntry.reporting_period_key,
      location: preparedEntry.location,
      description: preparedEntry.description,
      form_data: preparedEntry.form_data,
      is_billable: preparedEntry.is_billable,
      is_payroll_eligible:
        preparedEntry.is_payroll_eligible,
      is_reportable: preparedEntry.is_reportable,
      status: preparedEntry.status,
      legacy_category: preparedEntry.legacy_category,
      employer_name: preparedEntry.employer_name,
      report_ready: preparedEntry.report_ready,
      service_authorization_id:
        preparedEntry.service_authorization_id,
    };

    const updated =
      await base44.asServiceRole.entities.TimeEntry.update(
        entryId,
        updatePayload
      );

    try {
      const reportFieldAnswerPayload =
        buildReportFieldAnswerPayload(
          organizationId,
          entryId,
          entryType,
          activeTemplates,
          formData,
          fieldValidation,
          !existingReportFieldAnswer
        );

      if (existingReportFieldAnswer?.id) {
        await base44.asServiceRole.entities.ReportFieldAnswer.update(
          existingReportFieldAnswer.id,
          reportFieldAnswerPayload
        );
      } else {
        await base44.asServiceRole.entities.ReportFieldAnswer.create(
          reportFieldAnswerPayload
        );
      }
    } catch (error) {
      await base44.asServiceRole.entities.TimeEntry.update(
        entryId,
        buildEntryRollbackPayload(existingEntry)
      ).catch(() => null);

      throw httpError(
        500,
        "TimeEntry update could not be completed safely."
      );
    }

    const authorizationRecalculationFailures =
      await recalculateChangedAuthorizations(
        base44,
        organizationId,
        [
          existingAuthorizationId,
          authorizationResult.authorization?.id || "",
        ]
      );

    return Response.json({
      ok: true,
      action,
      entry: updated,
      validation: authorizationResult.validation,
      authorization_recalculation_failures:
        authorizationRecalculationFailures,
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
