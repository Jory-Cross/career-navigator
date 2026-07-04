import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const REACTIVATABLE_ROLES = new Set(["management", "employee"]);
const ASSIGNABLE_MANAGER_ROLES = new Set(["admin", "management"]);

class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function failure(error: string, status = 400) {
  return Response.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function getCanonicalStaffProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (STAFF_ROLE_ACCESS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    accessLevel,
  };
}

function getTargetRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();

  return REACTIVATABLE_ROLES.has(role) ? role : "";
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeText(user?.email) ||
    "the selected employee"
  );
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActiveRecord(caller)) {
    throw new RequestError(
      403,
      "Your account is unavailable or inactive."
    );
  }

  const callerId = normalizeIdentifier(caller?.id);
  const organizationId = normalizeIdentifier(caller?.org_id);
  const profile = getCanonicalStaffProfile(caller);

  if (
    !callerId ||
    !profile ||
    !["admin", "management"].includes(profile.role)
  ) {
    throw new RequestError(
      403,
      "You are not authorized to reactivate employees."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  return {
    caller,
    callerId,
    callerRole: profile.role,
    organizationId,
  };
}

async function resolveReactivationTarget(
  base44: any,
  employeeId: string,
  organizationId: string,
  callerId: string
) {
  const employee = await base44.asServiceRole.entities.User.get(
    employeeId
  ).catch(() => null);

  if (
    !employee ||
    employee?.is_archived === true ||
    normalizeIdentifier(employee?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected employee was not found in your organization."
    );
  }

  const canonicalEmployeeId = normalizeIdentifier(employee?.id);
  const employeeRole = getTargetRole(employee);

  if (!employeeRole) {
    throw new RequestError(
      403,
      "Only inactive employees or managers can be reactivated through this workflow."
    );
  }

  if (canonicalEmployeeId === callerId) {
    throw new RequestError(
      403,
      "You cannot reactivate your own account through this workflow."
    );
  }

  const expectedAccessLevel = STAFF_ROLE_ACCESS[employeeRole];
  const alreadyActive =
    employee?.is_active !== false &&
    normalizeText(employee?.access_level).toLowerCase() ===
      expectedAccessLevel;

  if (alreadyActive) {
    throw new RequestError(
      400,
      "This employee account is already active."
    );
  }

  return {
    employee,
    employeeId: canonicalEmployeeId,
    employeeRole,
    expectedAccessLevel,
  };
}

async function getHistoricalManagerAssignments(
  base44: any,
  organizationId: string,
  employeeId: string,
  managerId?: string
) {
  const filters: Record<string, string> = {
    org_id: organizationId,
    employee_user_id: employeeId,
  };

  if (managerId) {
    filters.manager_user_id = managerId;
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
      filters
    );

  return asArray(assignments).filter(
    (assignment: any) =>
      assignment?.is_archived !== true &&
      normalizeIdentifier(assignment?.org_id) === organizationId &&
      normalizeIdentifier(assignment?.employee_user_id) === employeeId &&
      (!managerId ||
        normalizeIdentifier(assignment?.manager_user_id) === managerId)
  );
}

async function resolveAssignmentRecipient(
  base44: any,
  caller: any,
  callerId: string,
  callerRole: string,
  organizationId: string,
  employeeId: string,
  employeeRole: string,
  managerId: string
) {
  if (!managerId) {
    return null;
  }

  if (employeeRole !== "employee") {
    throw new RequestError(
      400,
      "Manager assignment can only be changed when reactivating an employee."
    );
  }

  if (callerRole === "management" && managerId !== callerId) {
    throw new RequestError(
      403,
      "Managers may only assign reactivated employees to themselves."
    );
  }

  const recipient =
    managerId === callerId
      ? caller
      : await base44.asServiceRole.entities.User.get(managerId)
          .catch(() => null);

  const profile = getCanonicalStaffProfile(recipient);

  if (
    !isActiveRecord(recipient) ||
    normalizeIdentifier(recipient?.id) === employeeId ||
    normalizeIdentifier(recipient?.org_id) !== organizationId ||
    !profile ||
    !ASSIGNABLE_MANAGER_ROLES.has(profile.role)
  ) {
    throw new RequestError(
      403,
      "Choose an active manager or administrator from this organization."
    );
  }

  if (callerRole === "management") {
    const historicalAssignments =
      await getHistoricalManagerAssignments(
        base44,
        organizationId,
        employeeId,
        callerId
      );

    if (!historicalAssignments.length) {
      throw new RequestError(
        403,
        "You may only reactivate employees who were previously assigned to you."
      );
    }
  }

  return recipient;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure(
      "This employee reactivation request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = normalizeIdentifier(body?.employee_id);
    const managerId = normalizeIdentifier(body?.manager_id);

    if (!employeeId) {
      return failure(
        "An employee must be selected before reactivation can begin."
      );
    }

    if (managerId && managerId === employeeId) {
      return failure(
        "The employee being reactivated cannot be selected as their own manager."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before reactivating an employee.",
        401
      );
    }

    const {
      caller,
      callerId,
      callerRole,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const {
      employee,
      employeeId: canonicalEmployeeId,
      employeeRole,
      expectedAccessLevel,
    } = await resolveReactivationTarget(
      base44,
      employeeId,
      organizationId,
      callerId
    );

    const recipient = await resolveAssignmentRecipient(
      base44,
      caller,
      callerId,
      callerRole,
      organizationId,
      canonicalEmployeeId,
      employeeRole,
      managerId
    );

    let assignmentRollback:
      | {
          type: "created";
          id: string;
        }
      | {
          type: "updated";
          id: string;
          wasActive: boolean;
        }
      | null = null;

    try {
      if (recipient) {
        const matchingAssignments =
          await getHistoricalManagerAssignments(
            base44,
            organizationId,
            canonicalEmployeeId,
            normalizeIdentifier(recipient.id)
          );

        if (matchingAssignments.length > 1) {
          throw new RequestError(
            400,
            "More than one manager assignment exists for this employee. Administrator review is required before reactivation."
          );
        }

        if (matchingAssignments.length === 1) {
          const assignment = matchingAssignments[0];

          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
            assignment.id,
            {
              is_active: true,
            }
          );

          assignmentRollback = {
            type: "updated",
            id: assignment.id,
            wasActive: assignment?.is_active === true,
          };
        } else {
          const assignment =
            await base44.asServiceRole.entities.ManagerEmployeeAssignment.create(
              {
                org_id: organizationId,
                manager_user_id: recipient.id,
                employee_user_id: canonicalEmployeeId,
                is_active: true,
              }
            );

          assignmentRollback = {
            type: "created",
            id: assignment.id,
          };
        }
      }

      await base44.asServiceRole.entities.User.update(
        canonicalEmployeeId,
        {
          is_active: true,
          access_level: expectedAccessLevel,
        }
      );
    } catch (writeError) {
      if (assignmentRollback?.type === "created") {
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.delete(
          assignmentRollback.id
        ).catch(() => null);
      }

      if (assignmentRollback?.type === "updated") {
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
          assignmentRollback.id,
          {
            is_active: assignmentRollback.wasActive,
          }
        ).catch(() => null);
      }

      throw writeError;
    }

    return Response.json({
      success: true,
      message: "Employee reactivation was completed.",
      employee_id: canonicalEmployeeId,
      employee_name: getDisplayName(employee),
      manager_assigned: Boolean(recipient),
      manager_id: recipient?.id || null,
    });
  } catch (error) {
    if (!(error instanceof RequestError)) {
      console.error(
        "[reactivateEmployee] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return failure(
      error instanceof RequestError
        ? error.message
        : "The employee could not be reactivated. Please try again or contact your organization administrator.",
      error instanceof RequestError ? error.status : 500
    );
  }
});
