import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CANONICAL_STAFF_ACCESS = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const SUPPORTED_ACTIONS = new Set(["get_plan", "save_plan"]);

const EDITABLE_FIELDS = [
  "school_name",
  "grade_level",
  "counselor_name",
  "counselor_email",
  "disability_category",
  "iep_date",
  "next_review_date",
  "post_secondary_goals",
  "transition_goals",
  "accommodation_notes",
  "strengths",
  "areas_of_support",
];

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

function limitText(value: unknown, maximumLength: number) {
  return normalizeText(value).slice(0, maximumLength);
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

function isValidDateOnly(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
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
  visibleUserIds: Set<string>,
  visibleEmails: Set<string>
) {
  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  const createdBy = normalizeEmail(client?.created_by);

  return (
    visibleUserIds.has(assignedEmployeeId) ||
    (createdBy && visibleEmails.has(createdBy))
  );
}

function projectPlan(plan: any) {
  if (!plan) {
    return null;
  }

  return {
    id: normalizeText(plan?.id),
    client_id: normalizeText(plan?.client_id),
    school_name: normalizeText(plan?.school_name),
    grade_level: normalizeText(plan?.grade_level),
    counselor_name: normalizeText(plan?.counselor_name),
    counselor_email: normalizeText(plan?.counselor_email),
    disability_category: normalizeText(plan?.disability_category),
    iep_date: normalizeText(plan?.iep_date),
    next_review_date: normalizeText(plan?.next_review_date),
    post_secondary_goals: normalizeText(plan?.post_secondary_goals),
    transition_goals: normalizeText(plan?.transition_goals),
    accommodation_notes: normalizeText(plan?.accommodation_notes),
    strengths: normalizeText(plan?.strengths),
    areas_of_support: normalizeText(plan?.areas_of_support),
    created_date: normalizeText(plan?.created_date),
    updated_date: normalizeText(plan?.updated_date),
  };
}

function buildPlanPayload(rawPlan: any) {
  const payload: Record<string, string> = {};

  for (const field of EDITABLE_FIELDS) {
    const maximumLength =
      field === "counselor_email"
        ? 254
        : field === "iep_date" || field === "next_review_date"
        ? 10
        : field === "school_name" ||
          field === "counselor_name" ||
          field === "disability_category"
        ? 300
        : 5000;

    payload[field] = limitText(rawPlan?.[field], maximumLength);
  }

  if (!isValidDateOnly(payload.iep_date)) {
    throw new RequestError(400, "IEP Date must be a valid calendar date.");
  }

  if (!isValidDateOnly(payload.next_review_date)) {
    throw new RequestError(
      400,
      "Next Review Date must be a valid calendar date."
    );
  }

  if (
    payload.counselor_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.counselor_email)
  ) {
    throw new RequestError(
      400,
      "Counselor Email must be a valid email address."
    );
  }

  return payload;
}

async function assertActiveOrganization(base44: any, organizationId: string) {
  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }
}

async function resolveAuthorizedStaffClient(
  base44: any,
  caller: any,
  requestedClientId: string
) {
  const callerId = normalizeText(caller?.id);
  const callerRole = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!callerRole) {
    throw new RequestError(
      403,
      "Only authorized staff may access Pre-ETS IEP plans."
    );
  }

  if (!callerId || !organizationId) {
    throw new RequestError(
      403,
      "Your staff account is missing its organization assignment."
    );
  }

  if (!requestedClientId) {
    throw new RequestError(
      400,
      "Choose a Pre-ETS student before accessing an IEP plan."
    );
  }

  const [organizationUsers, client] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ org_id: organizationId }),
    base44.asServiceRole.entities.Client.get(requestedClientId).catch(
      () => null
    ),
    assertActiveOrganization(base44, organizationId),
  ]).then(([users, resolvedClient]) => [users, resolvedClient]);

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

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(
      404,
      "This Pre-ETS student is unavailable or is outside your organization."
    );
  }

  if (callerRole === "admin") {
    return { organizationId, client };
  }

  const visibleUserIds = new Set<string>([callerId]);
  const visibleEmails = new Set<string>(
    [normalizeEmail(caller?.email)].filter(Boolean)
  );

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
        const employeeEmail = normalizeEmail(employee.email);
        if (employeeEmail) {
          visibleEmails.add(employeeEmail);
        }
      }
    }
  }

  if (!clientMatchesVisibleStaff(client, visibleUserIds, visibleEmails)) {
    throw new RequestError(
      403,
      "You are not assigned to this Pre-ETS student."
    );
  }

  return { organizationId, client };
}

async function resolveAuthorizedStudentClient(base44: any, caller: any) {
  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account could not be verified as active.");
  }

  if (!isStudentPortalUser(caller)) {
    throw new RequestError(
      403,
      "Only an authorized Pre-ETS student may view a student IEP plan."
    );
  }

  const organizationId = normalizeText(caller?.org_id);
  const linkedClientId = normalizeText(caller?.linked_client_id);

  if (!organizationId || !linkedClientId) {
    throw new RequestError(
      403,
      "Your Pre-ETS student account is missing its organization or student assignment."
    );
  }

  const [, client] = await Promise.all([
    assertActiveOrganization(base44, organizationId),
    base44.asServiceRole.entities.Client.get(linkedClientId).catch(
      () => null
    ),
  ]);

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(
      403,
      "Your Pre-ETS student record is unavailable or is not assigned to your organization."
    );
  }

  return { organizationId, client };
}

async function loadSinglePlan(base44: any, clientId: string) {
  const plans = await base44.asServiceRole.entities.IEPPlan.filter(
    { client_id: clientId },
    "-created_date"
  );
  const activePlans = asArray(plans).filter(
    (plan: any) => isActive(plan) && normalizeText(plan?.client_id) === clientId
  );

  if (activePlans.length > 1) {
    throw new RequestError(
      409,
      "Multiple IEP plans exist for this student. Resolve the duplicate records before editing the plan."
    );
  }

  return activePlans[0] || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This request must use POST." },
        { status: 405 }
      );
    }

    const requestBody: any = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action).toLowerCase();
    const requestedClientId = normalizeText(requestBody?.client_id);

    if (!SUPPORTED_ACTIONS.has(action)) {
      throw new RequestError(
        400,
        'Choose either "get_plan" or "save_plan".'
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before accessing an IEP plan.",
        },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      throw new RequestError(403, "Your account could not be verified as active.");
    }

    let client: any;

    if (action === "get_plan" && isStudentPortalUser(caller)) {
      client = (await resolveAuthorizedStudentClient(base44, caller)).client;
    } else {
      client = (
        await resolveAuthorizedStaffClient(base44, caller, requestedClientId)
      ).client;
    }

    const existingPlan = await loadSinglePlan(
      base44,
      normalizeText(client?.id)
    );

    if (action === "get_plan") {
      return Response.json({ ok: true, action, plan: projectPlan(existingPlan) });
    }

    const payload = buildPlanPayload(requestBody?.plan);
    const savedPlan = existingPlan
      ? await base44.asServiceRole.entities.IEPPlan.update(
          normalizeText(existingPlan?.id),
          payload
        )
      : await base44.asServiceRole.entities.IEPPlan.create({
          client_id: normalizeText(client?.id),
          ...payload,
        });

    return Response.json({
      ok: true,
      action,
      plan: projectPlan(savedPlan),
      message: existingPlan ? "IEP plan updated." : "IEP plan created.",
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "The Pre-ETS IEP plan could not be saved.";

    if (!(error instanceof RequestError)) {
      console.error(
        "manageAuthorizedPreEtsIepPlan error:",
        error?.message || error
      );
    }

    return Response.json({ ok: false, error: message }, { status });
  }
});
