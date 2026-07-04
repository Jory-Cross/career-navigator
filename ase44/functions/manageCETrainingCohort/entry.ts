import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const COHORT_TYPES = new Set([
  "testing",
  "training",
  "production",
]);

const COHORT_STATUSES = new Set([
  "planned",
  "active",
  "completed",
  "archived",
]);

const CREATE_ALLOWED_STATUSES = new Set([
  "planned",
  "active",
]);

const STATUS_TRANSITIONS: Record<string, Set<string>> = {
  planned: new Set(["planned", "active", "archived"]),
  active: new Set(["active", "completed", "archived"]),
  completed: new Set(["completed", "archived"]),
  archived: new Set([]),
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActiveRecord(record: any) {
  return Boolean(
    record &&
      record.is_active !== false &&
      record.is_archived !== true
  );
}

function hasOwn(object: any, key: string) {
  return Boolean(
    object &&
      typeof object === "object" &&
      !Array.isArray(object) &&
      Object.prototype.hasOwnProperty.call(object, key)
  );
}

function getRequiredAction(value: unknown) {
  const action = normalizeText(value).toLowerCase();

  if (!["create", "update"].includes(action)) {
    throw new RequestError(
      400,
      "Choose a valid CE cohort action."
    );
  }

  return action;
}

function getRequiredString(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new RequestError(400, message);
  }

  return normalized;
}

function getTextField(
  source: any,
  field: string,
  maximumLength: number,
  options: {
    required?: boolean;
    label: string;
  }
) {
  if (!hasOwn(source, field)) {
    if (options.required) {
      throw new RequestError(
        400,
        `${options.label} is required.`
      );
    }

    return undefined;
  }

  const value = normalizeText(source[field]);

  if (options.required && !value) {
    throw new RequestError(
      400,
      `${options.label} is required.`
    );
  }

  if (value.length > maximumLength) {
    throw new RequestError(
      400,
      `${options.label} is too long.`
    );
  }

  return value;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function getDateField(
  source: any,
  field: string,
  label: string
) {
  if (!hasOwn(source, field)) {
    return undefined;
  }

  const value = normalizeText(source[field]);

  if (!value) {
    return "";
  }

  if (!isValidDate(value)) {
    throw new RequestError(
      400,
      `${label} must be a valid calendar date.`
    );
  }

  return value;
}

function getCohortInput(body: any) {
  const cohort = body?.cohort;

  if (
    !cohort ||
    typeof cohort !== "object" ||
    Array.isArray(cohort)
  ) {
    throw new RequestError(
      400,
      "CE cohort details are required."
    );
  }

  return cohort;
}

function getCreatePayload(input: any) {
  const cohortType = normalizeText(
    hasOwn(input, "cohort_type")
      ? input.cohort_type
      : "testing"
  ).toLowerCase();

  const status = normalizeText(
    hasOwn(input, "status")
      ? input.status
      : "planned"
  ).toLowerCase();

  if (!COHORT_TYPES.has(cohortType)) {
    throw new RequestError(
      400,
      "Choose a valid CE cohort type."
    );
  }

  if (!CREATE_ALLOWED_STATUSES.has(status)) {
    throw new RequestError(
      400,
      "New CE cohorts may begin only as Planned or Active."
    );
  }

  const startDate =
    getDateField(input, "start_date", "Start date") || "";
  const endDate =
    getDateField(input, "end_date", "End date") || "";

  if (startDate && endDate && endDate < startDate) {
    throw new RequestError(
      400,
      "End date cannot be before the start date."
    );
  }

  return {
    name: getTextField(input, "name", 200, {
      required: true,
      label: "Cohort name",
    }),
    code:
      getTextField(input, "code", 80, {
        label: "Cohort code",
      }) || "",
    description:
      getTextField(input, "description", 4000, {
        label: "Cohort description",
      }) || "",
    course_name:
      getTextField(input, "course_name", 200, {
        label: "Course name",
      }) || "",
    course_version:
      getTextField(input, "course_version", 80, {
        label: "Course version",
      }) || "",
    instructor_notes:
      getTextField(input, "instructor_notes", 8000, {
        label: "Instructor notes",
      }) || "",
    cohort_type: cohortType,
    status,
    start_date: startDate,
    end_date: endDate,
  };
}

function getUpdatePayload(input: any, existingCohort: any) {
  const patch: Record<string, unknown> = {};

  const fieldDefinitions = [
    ["name", 200, "Cohort name"],
    ["code", 80, "Cohort code"],
    ["description", 4000, "Cohort description"],
    ["course_name", 200, "Course name"],
    ["course_version", 80, "Course version"],
    ["instructor_notes", 8000, "Instructor notes"],
  ] as const;

  for (const [field, maximumLength, label] of fieldDefinitions) {
    if (!hasOwn(input, field)) {
      continue;
    }

    const value = getTextField(input, field, maximumLength, {
      required: field === "name",
      label,
    });

    patch[field] = value ?? "";
  }

  if (hasOwn(input, "cohort_type")) {
    const requestedType = normalizeText(
      input.cohort_type
    ).toLowerCase();
    const currentType = normalizeText(
      existingCohort?.cohort_type
    ).toLowerCase();

    if (!COHORT_TYPES.has(requestedType)) {
      throw new RequestError(
        400,
        "Choose a valid CE cohort type."
      );
    }

    if (requestedType !== currentType) {
      throw new RequestError(
        409,
        "CE cohort type cannot be changed after the cohort is created."
      );
    }
  }

  if (hasOwn(input, "status")) {
    const requestedStatus = normalizeText(
      input.status
    ).toLowerCase();
    const currentStatus =
      normalizeText(existingCohort?.status).toLowerCase() ||
      "planned";

    if (!COHORT_STATUSES.has(requestedStatus)) {
      throw new RequestError(
        400,
        "Choose a valid CE cohort status."
      );
    }

    if (
      !STATUS_TRANSITIONS[currentStatus]?.has(
        requestedStatus
      )
    ) {
      throw new RequestError(
        409,
        "This CE cohort status cannot be changed through the normal cohort administration workflow."
      );
    }

    patch.status = requestedStatus;
  }

  const requestedStartDate = getDateField(
    input,
    "start_date",
    "Start date"
  );
  const requestedEndDate = getDateField(
    input,
    "end_date",
    "End date"
  );

  if (requestedStartDate !== undefined) {
    patch.start_date = requestedStartDate;
  }

  if (requestedEndDate !== undefined) {
    patch.end_date = requestedEndDate;
  }

  const effectiveStartDate =
    requestedStartDate !== undefined
      ? requestedStartDate
      : normalizeText(existingCohort?.start_date);

  const effectiveEndDate =
    requestedEndDate !== undefined
      ? requestedEndDate
      : normalizeText(existingCohort?.end_date);

  if (
    effectiveStartDate &&
    effectiveEndDate &&
    effectiveEndDate < effectiveStartDate
  ) {
    throw new RequestError(
      400,
      "End date cannot be before the start date."
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new RequestError(
      400,
      "Provide at least one CE cohort field to update."
    );
  }

  return patch;
}

async function resolveCanonicalAdmin(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeIdentifier(caller?.org_id);

  if (
    !caller ||
    !isActiveRecord(caller) ||
    !callerId ||
    !isValidEmail(callerEmail)
  ) {
    throw new RequestError(
      403,
      "Your account is unavailable or does not have a verified email address."
    );
  }

  if (
    normalizeText(caller?.role).toLowerCase() !== "admin" ||
    normalizeText(caller?.access_level).toLowerCase() !==
      "admin"
  ) {
    throw new RequestError(
      403,
      "Only an active organization administrator may create or update CE cohorts."
    );
  }

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

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is unavailable or inactive."
    );
  }

  return {
    caller,
    callerId,
    organizationId,
  };
}

async function assertUniqueCohortCode(
  base44: any,
  organizationId: string,
  code: string,
  excludedCohortId = ""
) {
  if (!code) {
    return;
  }

  const rows =
    await base44.asServiceRole.entities.CETrainingCohort.filter(
      {
        org_id: organizationId,
      }
    );

  const normalizedCode = code.toLowerCase();

  const conflictingCohort = asArray(rows).find(
    (cohort: any) =>
      normalizeIdentifier(cohort?.org_id) === organizationId &&
      normalizeIdentifier(cohort?.id) !== excludedCohortId &&
      normalizeText(cohort?.code).toLowerCase() ===
        normalizedCode
  );

  if (conflictingCohort) {
    throw new RequestError(
      409,
      "Another CE cohort in this organization already uses that cohort code."
    );
  }
}

async function resolveEditableCohort(
  base44: any,
  organizationId: string,
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    ).catch(() => null);

  if (
    !cohort ||
    normalizeIdentifier(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.status).toLowerCase() === "archived" ||
    !isActiveRecord(cohort)
  ) {
    throw new RequestError(
      403,
      "The selected CE cohort is unavailable for editing."
    );
  }

  return cohort;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE cohort administration request must use POST.",
        },
        { status: 405 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = getRequiredAction(body?.action);
    const cohortInput = getCohortInput(body);

    const requestedCohortId =
      action === "update"
        ? getRequiredString(
            body?.cohort_id,
            "A CE cohort must be selected before it can be updated."
          )
        : "";

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error:
            "Please sign in before managing CE cohorts.",
        },
        { status: 401 }
      );
    }

    const {
      callerId,
      organizationId,
    } = await resolveCanonicalAdmin(
      base44,
      authenticatedUser.id
    );

    if (action === "create") {
      const cohortPayload = getCreatePayload(cohortInput);

      await assertUniqueCohortCode(
        base44,
        organizationId,
        cohortPayload.code
      );

      const createdCohort =
        await base44.asServiceRole.entities.CETrainingCohort.create(
          {
            org_id: organizationId,
            ...cohortPayload,
            created_by: callerId,
          }
        );

      return Response.json({
        ok: true,
        action,
        message: "CE cohort created.",
        cohort: createdCohort,
      });
    }

    const existingCohort = await resolveEditableCohort(
      base44,
      organizationId,
      requestedCohortId
    );

    const cohortPatch = getUpdatePayload(
      cohortInput,
      existingCohort
    );

    if (typeof cohortPatch.code === "string") {
      await assertUniqueCohortCode(
        base44,
        organizationId,
        cohortPatch.code,
        requestedCohortId
      );
    }

    const updatedCohort =
      await base44.asServiceRole.entities.CETrainingCohort.update(
        requestedCohortId,
        cohortPatch
      );

    return Response.json({
      ok: true,
      action,
      message: "CE cohort updated.",
      cohort: updatedCohort,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[manageCETrainingCohort] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE cohort could not be saved. Please try again or contact an organization administrator.",
      },
      { status }
    );
  }
});
