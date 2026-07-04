import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

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
    access_level: accessLevel,
  };
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

function projectAssignment(assignment: any) {
  return {
    id: normalizeText(assignment?.id),
    org_id: normalizeText(assignment?.org_id),
    manager_user_id: normalizeText(
      assignment?.manager_user_id
    ),
    employee_user_id: normalizeText(
      assignment?.employee_user_id
    ),
    is_active: assignment?.is_active === true,
  };
}

async function resolveCanonicalAdmin(
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

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const profile = getCanonicalStaffProfile(caller);

  if (
    !callerId ||
    !organizationId ||
    !profile ||
    profile.role !== "admin"
  ) {
    throw new RequestError(
      403,
      "Only organization administrators may manage manager assignments."
    );
  }

  const [organization, organizationUsers] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null),
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
  ]);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is unavailable or inactive."
    );
  }

  const callerIsActiveOrganizationMember = asArray(
    organizationUsers
  ).some(
    (user: any) =>
      isActiveRecord(user) &&
      normalizeText(user?.id) === callerId &&
      normalizeText(user?.org_id) === organizationId &&
      getCanonicalStaffProfile(user)?.role === "admin"
  );

  if (!callerIsActiveOrganizationMember) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  return {
    callerId,
    organizationId,
  };
}

async function resolveAssignmentUsers(
  base44: any,
  organizationId: string,
  managerUserId: string,
  employeeUserId: string
) {
  const [manager, employee] = await Promise.all([
    base44.asServiceRole.entities.User.get(managerUserId)
      .catch(() => null),
    base44.asServiceRole.entities.User.get(employeeUserId)
      .catch(() => null),
  ]);

  const managerProfile = getCanonicalStaffProfile(manager);
  const employeeProfile = getCanonicalStaffProfile(employee);

  if (
    !isActiveRecord(manager) ||
    normalizeText(manager?.org_id) !== organizationId ||
    !managerProfile ||
    managerProfile.role !== "management"
  ) {
    throw new RequestError(
      403,
      "Choose an active manager from this organization."
    );
  }

  if (
    !isActiveRecord(employee) ||
    normalizeText(employee?.org_id) !== organizationId ||
    !employeeProfile ||
    employeeProfile.role !== "employee"
  ) {
    throw new RequestError(
      403,
      "Choose an active employee from this organization."
    );
  }

  return {
    manager,
    employee,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure(
      "This manager-assignment request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const action = normalizeText(body?.action).toLowerCase();
    const managerUserId = normalizeText(body?.manager_user_id);
    const employeeUserId = normalizeText(body?.employee_user_id);
    const assignmentId = normalizeText(body?.assignment_id);

    if (!["list", "assign", "remove"].includes(action)) {
      return failure(
        "Choose a manager-assignment action."
      );
    }

    if (action === "assign") {
      if (!managerUserId || !employeeUserId) {
        return failure(
          "Choose both a manager and an employee before saving a manager assignment."
        );
      }

      if (managerUserId === employeeUserId) {
        return failure(
          "An employee cannot be assigned as their own manager."
        );
      }
    }

    if (action === "remove" && !assignmentId) {
      return failure(
        "Choose a manager assignment before removing it."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before managing manager assignments.",
        401
      );
    }

    const { organizationId } = await resolveCanonicalAdmin(
      base44,
      authenticatedUser.id
    );

    if (action === "list") {
      const assignmentRows =
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
          {
            org_id: organizationId,
            is_active: true,
          }
        );

      const assignments = asArray(assignmentRows)
        .filter(
          (assignment: any) =>
            assignment?.is_active === true &&
            assignment?.is_archived !== true &&
            normalizeText(assignment?.org_id) === organizationId &&
            normalizeText(assignment?.manager_user_id) &&
            normalizeText(assignment?.employee_user_id)
        )
        .map(projectAssignment);

      return Response.json({
        success: true,
        assignments,
      });
    }

    if (action === "assign") {
      await resolveAssignmentUsers(
        base44,
        organizationId,
        managerUserId,
        employeeUserId
      );

      const matchingRows =
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
          {
            org_id: organizationId,
            manager_user_id: managerUserId,
            employee_user_id: employeeUserId,
          }
        );

      const matchingAssignments = asArray(matchingRows).filter(
        (assignment: any) =>
          assignment?.is_archived !== true &&
          normalizeText(assignment?.org_id) === organizationId &&
          normalizeText(assignment?.manager_user_id) ===
            managerUserId &&
          normalizeText(assignment?.employee_user_id) ===
            employeeUserId
      );

      const activeAssignments = matchingAssignments.filter(
        (assignment: any) => assignment?.is_active === true
      );

      if (activeAssignments.length > 1) {
        return failure(
          "More than one active manager assignment exists for this employee. Administrator review is required before changes can be made."
        );
      }

      if (activeAssignments.length === 1) {
        return Response.json({
          success: true,
          assignment: projectAssignment(activeAssignments[0]),
          created: false,
          reactivated: false,
        });
      }

      if (matchingAssignments.length > 1) {
        return failure(
          "More than one historical manager assignment exists for this employee. Administrator review is required before changes can be made."
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

        return Response.json({
          success: true,
          assignment: projectAssignment({
            ...assignment,
            is_active: true,
          }),
          created: false,
          reactivated: true,
        });
      }

      const createdAssignment =
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.create(
          {
            org_id: organizationId,
            manager_user_id: managerUserId,
            employee_user_id: employeeUserId,
            is_active: true,
          }
        );

      return Response.json({
        success: true,
        assignment: projectAssignment(createdAssignment),
        created: true,
        reactivated: false,
      });
    }

    const assignment =
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.get(
        assignmentId
      ).catch(() => null);

    if (
      !assignment ||
      assignment?.is_archived === true ||
      assignment?.is_active !== true ||
      normalizeText(assignment?.org_id) !== organizationId
    ) {
      return failure(
        "The selected active manager assignment was not found in your organization."
      );
    }

    await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
      assignment.id,
      {
        is_active: false,
      }
    );

    return Response.json({
      success: true,
      assignment_id: assignment.id,
      message: "Manager assignment removed.",
    });
  } catch (error) {
    if (!(error instanceof RequestError)) {
      console.error(
        "[manageManagerEmployeeAssignment] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return failure(
      error instanceof RequestError
        ? error.message
        : "Manager assignments could not be updated. Please try again or contact an organization administrator.",
      error instanceof RequestError ? error.status : 500
    );
  }
});
