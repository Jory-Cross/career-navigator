import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const OFFBOARDABLE_ROLES = new Set(["management", "employee"]);
const REASSIGNMENT_ROLES = new Set(["admin", "management"]);

class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

class ReassignmentRequiredError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

function isValidReassignmentRecipient(
  user: any,
  organizationId: string,
  excludedUserId: string
) {
  const profile = getCanonicalStaffProfile(user);

  return (
    isActiveRecord(user) &&
    normalizeIdentifier(user?.id) !== excludedUserId &&
    normalizeIdentifier(user?.org_id) === organizationId &&
    profile &&
    REASSIGNMENT_ROLES.has(profile.role)
  );
}

function getDisplayName(user: any) {
  return (
    normalizeText(user?.full_name) ||
    normalizeEmail(user?.email) ||
    "an authorized staff member"
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
      "You are not authorized to offboard employees."
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

async function resolveOffboardTarget(
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
    !isActiveRecord(employee) ||
    normalizeIdentifier(employee?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected active employee was not found in your organization."
    );
  }

  const canonicalEmployeeId = normalizeIdentifier(employee?.id);
  const profile = getCanonicalStaffProfile(employee);

  if (!profile || !OFFBOARDABLE_ROLES.has(profile.role)) {
    throw new RequestError(
      403,
      "Only active employees or managers can be offboarded through this workflow."
    );
  }

  if (canonicalEmployeeId === callerId) {
    throw new RequestError(
      403,
      "You cannot offboard your own account."
    );
  }

  return {
    employee,
    employeeId: canonicalEmployeeId,
    employeeRole: profile.role,
  };
}

async function getActiveManagerAssignments(
  base44: any,
  organizationId: string,
  employeeId: string
) {
  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      employee_user_id: employeeId,
      is_active: true,
    });

  return asArray(assignments).filter(
    (assignment: any) =>
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeIdentifier(assignment?.org_id) === organizationId &&
      normalizeIdentifier(assignment?.employee_user_id) === employeeId &&
      normalizeIdentifier(assignment?.manager_user_id)
  );
}

async function resolveReassignmentRecipient(
  base44: any,
  caller: any,
  callerId: string,
  callerRole: string,
  organizationId: string,
  employeeId: string,
  employeeRole: string,
  overrideManagerId: string
) {
  if (callerRole === "management") {
    if (employeeRole !== "employee") {
      throw new RequestError(
        403,
        "Managers may only offboard employees who report directly to them."
      );
    }

    const directAssignments = await getActiveManagerAssignments(
      base44,
      organizationId,
      employeeId
    );

    const callerManagesEmployee = directAssignments.some(
      (assignment: any) =>
        normalizeIdentifier(assignment?.manager_user_id) === callerId
    );

    if (!callerManagesEmployee) {
      throw new RequestError(
        403,
        "You may only offboard employees who are active direct reports."
      );
    }

    if (overrideManagerId && overrideManagerId !== callerId) {
      throw new RequestError(
        403,
        "Managers may reassign clients only to themselves during employee offboarding."
      );
    }

    return caller;
  }

  if (overrideManagerId) {
    const overrideManager =
      await base44.asServiceRole.entities.User.get(
        overrideManagerId
      ).catch(() => null);

    if (
      !isValidReassignmentRecipient(
        overrideManager,
        organizationId,
        employeeId
      )
    ) {
      throw new RequestError(
        403,
        "Choose an active manager or administrator from this organization to receive the employee's clients."
      );
    }

    return overrideManager;
  }

  const activeAssignments = await getActiveManagerAssignments(
    base44,
    organizationId,
    employeeId
  );

  const managerIds = [
    ...new Set(
      activeAssignments
        .map((assignment: any) =>
          normalizeIdentifier(assignment?.manager_user_id)
        )
        .filter(Boolean)
    ),
  ];

  const candidateManagers = (
    await Promise.all(
      managerIds.map((managerId) =>
        base44.asServiceRole.entities.User.get(managerId)
          .catch(() => null)
      )
    )
  ).filter((manager: any) =>
    isValidReassignmentRecipient(
      manager,
      organizationId,
      employeeId
    )
  );

  if (candidateManagers.length !== 1) {
    throw new ReassignmentRequiredError(
      candidateManagers.length > 1
        ? "This employee has more than one active manager. Select the manager who should receive the employee's clients before completing offboarding."
        : "This employee does not have one active manager available for client reassignment. Select a manager before completing offboarding."
    );
  }

  return candidateManagers[0];
}

async function recordOffboardingActivity(
  base44: any,
  organizationId: string,
  client: any,
  employee: any,
  recipient: any,
  caller: any
) {
  try {
    await base44.asServiceRole.entities.Activity.create({
      client_id: client.id,
      org_id: organizationId,
      activity_type: "status_changed",
      title: "Employee offboarded — client reassigned",
      description:
        `Client reassigned from ${getDisplayName(employee)} to ` +
        `${getDisplayName(recipient)} by ${getDisplayName(caller)} ` +
        "during staff offboarding.",
    });
  } catch (error) {
    console.error(
      "[offboardEmployee] Could not write activity:",
      error instanceof Error ? error.message : error
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure(
      "This employee offboarding request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = normalizeIdentifier(body?.employee_id);
    const overrideManagerId = normalizeIdentifier(
      body?.override_manager_id
    );

    if (!employeeId) {
      return failure(
        "An employee must be selected before offboarding can begin."
      );
    }

    if (overrideManagerId && overrideManagerId === employeeId) {
      return failure(
        "The departing employee cannot be selected to receive their own clients."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before offboarding an employee.",
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
    } = await resolveOffboardTarget(
      base44,
      employeeId,
      organizationId,
      callerId
    );

    const recipient = await resolveReassignmentRecipient(
      base44,
      caller,
      callerId,
      callerRole,
      organizationId,
      canonicalEmployeeId,
      employeeRole,
      overrideManagerId
    );

    const [clientRows, employeeAssignments, pendingAssignments] =
      await Promise.all([
        base44.asServiceRole.entities.Client.filter({
          org_id: organizationId,
          assigned_employee_id: canonicalEmployeeId,
        }),
        base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          org_id: organizationId,
          employee_user_id: canonicalEmployeeId,
          is_active: true,
        }),
        base44.asServiceRole.entities.PendingRoleAssignment.filter({
          org_id: organizationId,
          email: normalizeEmail(employee?.email),
        }),
      ]);

    const clientsToReassign = asArray(clientRows).filter(
      (client: any) =>
        client?.is_archived !== true &&
        normalizeIdentifier(client?.org_id) === organizationId &&
        normalizeIdentifier(client?.assigned_employee_id) ===
          canonicalEmployeeId
    );

    const assignmentsToDeactivate = asArray(
      employeeAssignments
    ).filter(
      (assignment: any) =>
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeIdentifier(assignment?.org_id) === organizationId &&
        normalizeIdentifier(assignment?.employee_user_id) ===
          canonicalEmployeeId
    );

    const staffInvitationsToRevoke = asArray(
      pendingAssignments
    ).filter((assignment: any) => {
      const assignmentRole = normalizeText(
        assignment?.role
      ).toLowerCase();
      const assignmentAccessLevel = normalizeText(
        assignment?.access_level
      ).toLowerCase();

      return (
        assignment?.is_archived !== true &&
        normalizeIdentifier(assignment?.org_id) === organizationId &&
        normalizeEmail(assignment?.email) ===
          normalizeEmail(employee?.email) &&
        STAFF_ROLE_ACCESS[assignmentRole] ===
          assignmentAccessLevel &&
        normalizeText(assignment?.status).toLowerCase() !==
          "revoked"
      );
    });

    const reassignedClients: Array<{
      id: string;
      priorEmployeeId: string | null;
    }> = [];

    const deactivatedAssignmentIds: string[] = [];

    const revokedInvitations: Array<{
      id: string;
      priorStatus: string;
    }> = [];

    let employeeAccessChanged = false;

    try {
      for (const client of clientsToReassign) {
        await base44.asServiceRole.entities.Client.update(
          client.id,
          {
            assigned_employee_id: recipient.id,
          }
        );

        reassignedClients.push({
          id: client.id,
          priorEmployeeId:
            normalizeIdentifier(client?.assigned_employee_id) ||
            null,
        });
      }

      for (const assignment of assignmentsToDeactivate) {
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
          assignment.id,
          {
            is_active: false,
          }
        );

        deactivatedAssignmentIds.push(assignment.id);
      }

      await base44.asServiceRole.entities.User.update(
        canonicalEmployeeId,
        {
          is_active: false,
          access_level: null,
        }
      );

      employeeAccessChanged = true;

      for (const assignment of staffInvitationsToRevoke) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          assignment.id,
          {
            status: "revoked",
          }
        );

        revokedInvitations.push({
          id: assignment.id,
          priorStatus:
            normalizeText(assignment?.status) || "pending",
        });
      }
    } catch (writeError) {
      for (const invitation of revokedInvitations.reverse()) {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(
          invitation.id,
          {
            status: invitation.priorStatus,
          }
        ).catch(() => null);
      }

      if (employeeAccessChanged) {
        await base44.asServiceRole.entities.User.update(
          canonicalEmployeeId,
          {
            is_active: employee?.is_active !== false,
            access_level: employee?.access_level ?? null,
          }
        ).catch(() => null);
      }

      for (const assignmentId of deactivatedAssignmentIds.reverse()) {
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(
          assignmentId,
          {
            is_active: true,
          }
        ).catch(() => null);
      }

      for (const client of reassignedClients.reverse()) {
        await base44.asServiceRole.entities.Client.update(
          client.id,
          {
            assigned_employee_id: client.priorEmployeeId,
          }
        ).catch(() => null);
      }

      throw writeError;
    }

    await Promise.all(
      clientsToReassign.map((client: any) =>
        recordOffboardingActivity(
          base44,
          organizationId,
          client,
          employee,
          recipient,
          caller
        )
      )
    );

    return Response.json({
      success: true,
      message: "Employee offboarding was completed.",
      employee_id: canonicalEmployeeId,
      reassigned_to_manager_id: recipient.id,
      reassigned_to_manager_name: getDisplayName(recipient),
      clients_reassigned: reassignedClients.length,
      assignments_deactivated: deactivatedAssignmentIds.length,
      staff_invitations_revoked: revokedInvitations.length,
    });
  } catch (error) {
    if (error instanceof ReassignmentRequiredError) {
      return Response.json({
        success: false,
        error: "no_manager",
        message: error.message,
      });
    }

    if (!(error instanceof RequestError)) {
      console.error(
        "[offboardEmployee] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return failure(
      error instanceof RequestError
        ? error.message
        : "The employee could not be offboarded. Please try again or contact your organization administrator.",
      error instanceof RequestError ? error.status : 500
    );
  }
});
