import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
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

function isAuthorizedPreEtsStudent(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "pre_ets" &&
    normalizeText(user?.access_level).toLowerCase() === "client_portal"
  );
}

function isPreEtsClient(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function isValidDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function projectPlan(plan: any) {
  if (!plan) return null;

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
    payload[field] = normalizeText(rawPlan?.[field]).slice(0, maximumLength);
  }

  if (!isValidDate(payload.iep_date)) {
    throw new RequestError(400, "IEP Date must be a valid calendar date.");
  }
  if (!isValidDate(payload.next_review_date)) {
    throw new RequestError(400, "Next Review Date must be a valid calendar date.");
  }
  if (
    payload.counselor_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.counselor_email)
  ) {
    throw new RequestError(400, "Counselor Email must be a valid email address.");
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

async function resolveStaffClient(
  base44: any,
  caller: any,
  requestedClientId: string
) {
  const callerId = normalizeText(caller?.id);
  const callerRole = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!callerRole || !callerId || !organizationId) {
    throw new RequestError(
      403,
      "Only authorized staff may access Pre-ETS IEP plans."
    );
  }
  if (!requestedClientId) {
    throw new RequestError(
      400,
      "Choose a Pre-ETS student before accessing an IEP plan."
    );
  }

  await assertActiveOrganization(base44, organizationId);
  const [organizationUsers, client] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ org_id: organizationId }),
    base44.asServiceRole.entities.Client.get(requestedClientId).catch(() => null),
  ]);

  if (!isPreEtsClient(client, organizationId)) {
    throw new RequestError(
      404,
      "This Pre-ETS student is unavailable or is outside your organization."
    );
  }

  if (callerRole === "admin") {
    return { organizationId, client };
  }

  const visibleUserIds = new Set([callerId]);

  if (callerRole === "management") {
    const activeStaffById = new Map(
      asArray(organizationUsers)
        .filter(
          (user: any) =>
            isActive(user) &&
            normalizeText(user?.org_id) === organizationId &&
            Boolean(getCanonicalStaffRole(user))
        )
        .map((user: any) => [normalizeText(user?.id), user])
    );
    const assignments =
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        manager_user_id: callerId,
      });

    for (const assignment of asArray(assignments)) {
      const employeeId = normalizeText(assignment?.employee_user_id);
      const employee = activeStaffById.get(employeeId);
      if (
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment?.org_id) === organizationId &&
        normalizeText(assignment?.manager_user_id) === callerId &&
        employee
      ) {
        visibleUserIds.add(employeeId);
      }
    }
  }

  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  if (!visibleUserIds.has(assignedEmployeeId)) {
    throw new RequestError(
      403,
      "You are not assigned to this Pre-ETS student."
    );
  }

  return { organizationId, client };
}

async function resolveStudentClient(base44: any, caller: any) {
  if (!isAuthorizedPreEtsStudent(caller)) {
    throw new RequestError(
      403,
      "Only an authorized Pre-ETS student may view a student IEP plan."
    );
  }

  const organizationId = normalizeText(caller?.org_id);
  const clientId = normalizeText(caller?.linked_client_id);
  if (!organizationId || !clientId) {
    throw new RequestError(
      403,
      "Your Pre-ETS student account is missing its organization or student assignment."
    );
  }

  await assertActiveOrganization(base44, organizationId);
  const client = await base44.asServiceRole.entities.Client.get(clientId).catch(
    () => null
  );

  if (!isPreEtsClient(client, organizationId)) {
    throw new RequestError(
      403,
      "Your Pre-ETS student record is unavailable or is not assigned to your organization."
    );
  }

  return { organizationId, client };
}

async function loadSinglePlan(base44: any, organizationId: string, clientId: string) {
  const plans = await base44.asServiceRole.entities.IEPPlan.filter(
    { client_id: clientId },
    "-created_date"
  );
  const matchingPlans = asArray(plans).filter(
    (plan: any) =>
      isActive(plan) &&
      normalizeText(plan?.client_id) === clientId &&
      (!normalizeText(plan?.org_id) || normalizeText(plan?.org_id) === organizationId)
  );

  if (matchingPlans.length > 1) {
    throw new RequestError(
      409,
      "Multiple IEP plans exist for this student. Resolve duplicate records before editing the plan."
    );
  }

  return matchingPlans[0] || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This request must use POST." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();
    const requestedClientId = normalizeText(body?.client_id);
    if (!SUPPORTED_ACTIONS.has(action)) {
      throw new RequestError(400, 'Choose either "get_plan" or "save_plan".');
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);
    if (!authenticatedUser?.id) {
      throw new RequestError(401, "Please sign in before accessing an IEP plan.");
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);
    if (!caller || !isActive(caller)) {
      throw new RequestError(403, "Your account could not be verified as active.");
    }

    let context: { organizationId: string; client: any };
    if (action === "get_plan" && isAuthorizedPreEtsStudent(caller)) {
      context = await resolveStudentClient(base44, caller);
    } else {
      context = await resolveStaffClient(base44, caller, requestedClientId);
    }

    const existingPlan = await loadSinglePlan(
      base44,
      context.organizationId,
      normalizeText(context.client?.id)
    );

    if (action === "get_plan") {
      return Response.json({ ok: true, action, plan: projectPlan(existingPlan) });
    }

    const payload = buildPlanPayload(body?.plan);
    const savedPlan = existingPlan?.id
      ? await base44.asServiceRole.entities.IEPPlan.update(existingPlan.id, {
          org_id: context.organizationId,
          client_id: normalizeText(context.client?.id),
          ...payload,
        })
      : await base44.asServiceRole.entities.IEPPlan.create({
          org_id: context.organizationId,
          client_id: normalizeText(context.client?.id),
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
    if (!(error instanceof RequestError)) {
      console.error(
        "manageAuthorizedPreEtsIepPlanV2 error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The Pre-ETS IEP plan could not be saved. Please try again.",
      },
      { status }
    );
  }
});
