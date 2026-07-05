import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  ce_instructor: "ce_training_portal",
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
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActiveRecord(record: any) {
  return Boolean(
    record && record.is_active !== false && record.is_archived !== true
  );
}

function getCanonicalRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return { role, access_level: accessLevel };
}

function isCanonicalStaffUser(user: any) {
  const profile = getCanonicalRoleProfile(user);
  return Boolean(
    profile && ["admin", "management", "employee"].includes(profile.role)
  );
}

function projectRosterUser(user: any) {
  return {
    id: normalizeText(user?.id),
    full_name: normalizeText(user?.full_name),
    email: normalizeEmail(user?.email),
    avatar_url: normalizeText(user?.avatar_url) || null,
    role: normalizeText(user?.role).toLowerCase(),
    access_level: normalizeText(user?.access_level).toLowerCase(),
    org_id: normalizeText(user?.org_id),
    is_active: user?.is_active !== false,
    is_archived: user?.is_archived === true,
  };
}

function isEligibleRosterCandidate(user: any, cohortRole: string) {
  const roleProfile = getCanonicalRoleProfile(user);

  if (!roleProfile || !isActiveRecord(user)) {
    return false;
  }

  if (cohortRole === "manager") {
    return (
      roleProfile.role === "management" ||
      roleProfile.role === "ce_instructor"
    );
  }

  return roleProfile.role === "ce_instructor";
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeText(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeText(caller?.org_id);
  const roleProfile = getCanonicalRoleProfile(caller);

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

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  if (!roleProfile) {
    throw new RequestError(
      403,
      "Your current role does not allow organization-user access."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
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
    roleProfile,
  };
}

async function requireCohortRosterAuthority(
  base44: any,
  callerId: string,
  organizationId: string,
  roleProfile: { role: string; access_level: string },
  cohortId: string
) {
  const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(
    cohortId
  ).catch(() => null);

  if (
    !cohort ||
    !isActiveRecord(cohort) ||
    normalizeText(cohort?.org_id) !== organizationId ||
    normalizeText(cohort?.status).toLowerCase() === "archived"
  ) {
    throw new RequestError(403, "The selected cohort is unavailable.");
  }

  if (roleProfile.role === "admin") {
    return cohort;
  }

  const managerRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id: organizationId,
      cohort_id: cohortId,
      user_id: callerId,
      cohort_role: "manager",
      is_active: true,
    });

  const isActiveCohortManager = asArray(managerRows).some(
    (membership: any) =>
      isActiveRecord(membership) &&
      normalizeText(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === callerId &&
      normalizeText(membership?.cohort_role).toLowerCase() === "manager"
  );

  if (!isActiveCohortManager) {
    throw new RequestError(
      403,
      "You must be an active manager of this cohort to review roster candidates."
    );
  }

  return cohort;
}

async function getManagementVisibleUserIds(
  base44: any,
  organizationId: string,
  managerUserId: string,
  organizationUsers: any[]
) {
  const assignmentRows =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
      manager_user_id: managerUserId,
      is_active: true,
    });
  const canonicalUserIds = new Set(
    asArray(organizationUsers)
      .filter((user: any) =>
        normalizeText(user?.org_id) === organizationId &&
        isCanonicalStaffUser(user)
      )
      .map((user: any) => normalizeText(user?.id))
      .filter(Boolean)
  );
  const visibleIds = new Set<string>([managerUserId]);

  for (const assignment of asArray(assignmentRows)) {
    const employeeUserId = normalizeText(assignment?.employee_user_id);

    if (
      assignment?.is_active === true &&
      assignment?.is_archived !== true &&
      normalizeText(assignment?.org_id) === organizationId &&
      normalizeText(assignment?.manager_user_id) === managerUserId &&
      canonicalUserIds.has(employeeUserId)
    ) {
      visibleIds.add(employeeUserId);
    }
  }

  return visibleIds;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This organization-user request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before viewing organization users.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const cohortId = normalizeText(body?.cohort_id);
    const cohortRole = normalizeText(body?.cohort_role).toLowerCase();
    const hasCohortContext = Boolean(cohortId || cohortRole);

    if (hasCohortContext) {
      if (!cohortId || !cohortRole) {
        throw new RequestError(
          400,
          "Both a cohort and roster role are required when reviewing cohort candidates."
        );
      }

      if (!['manager', 'trainer'].includes(cohortRole)) {
        throw new RequestError(
          400,
          "Only manager or trainer roster candidates may be requested."
        );
      }
    }

    const { callerId, organizationId, roleProfile } =
      await resolveCanonicalCaller(base44, authenticatedUser.id);

    if (
      !hasCohortContext &&
      !["admin", "management"].includes(roleProfile.role)
    ) {
      throw new RequestError(
        403,
        "Only organization administrators and management may view staff users."
      );
    }

    if (hasCohortContext) {
      await requireCohortRosterAuthority(
        base44,
        callerId,
        organizationId,
        roleProfile,
        cohortId
      );
    }

    const organizationUsers = asArray(
      await base44.asServiceRole.entities.User.filter({ org_id: organizationId })
    ).filter(
      (user: any) => normalizeText(user?.org_id) === organizationId
    );

    if (hasCohortContext) {
      const eligibleUsers = organizationUsers.filter((user: any) =>
        isEligibleRosterCandidate(user, cohortRole)
      );

      return Response.json({
        ok: true,
        organization_id: organizationId,
        cohort_id: cohortId,
        cohort_role: cohortRole,
        users: eligibleUsers.map(projectRosterUser),
        inactive_users: [],
      });
    }

    const visibleUserIds =
      roleProfile.role === "admin"
        ? new Set(
            organizationUsers
              .filter((user: any) => isCanonicalStaffUser(user))
              .map((user: any) => normalizeText(user?.id))
              .filter(Boolean)
          )
        : await getManagementVisibleUserIds(
            base44,
            organizationId,
            callerId,
            organizationUsers
          );

    const users = organizationUsers.filter(
      (user: any) => isActiveRecord(user) && visibleUserIds.has(normalizeText(user?.id))
    );
    const inactiveUsers = organizationUsers.filter(
      (user: any) =>
        !isActiveRecord(user) && visibleUserIds.has(normalizeText(user?.id))
    );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      users: users.map(projectRosterUser),
      inactive_users: inactiveUsers.map(projectRosterUser),
    });
  } catch (error: unknown) {
    const status = error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[getOrgUsers] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Organization users could not be loaded. Please try again or contact an organization administrator.",
      },
      { status }
    );
  }
});
