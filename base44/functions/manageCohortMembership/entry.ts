import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  ce_instructor: "ce_training_portal",
};

const MANAGEABLE_COHORT_ROLES = new Set([
  "manager",
  "trainer",
]);

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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function getRequiredString(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new RequestError(400, message);
  }

  return normalized;
}

function getCanonicalRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
}

function isEligibleManagerUser(user: any) {
  const roleProfile = getCanonicalRoleProfile(user);

  return Boolean(
    roleProfile &&
      (
        roleProfile.role === "management" ||
        roleProfile.role === "ce_instructor"
      )
  );
}

function isEligibleTrainerUser(user: any) {
  const roleProfile = getCanonicalRoleProfile(user);

  return Boolean(
    roleProfile &&
      roleProfile.role === "ce_instructor"
  );
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
      "Your current role does not allow CE cohort roster administration."
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
    roleProfile,
  };
}

async function resolveAuthorizedCohort(
  base44: any,
  callerId: string,
  organizationId: string,
  roleProfile: {
    role: string;
    access_level: string;
  },
  cohortId: string
) {
  const cohort =
    await base44.asServiceRole.entities.CETrainingCohort.get(
      cohortId
    ).catch(() => null);

  if (
    !cohort ||
    normalizeText(cohort?.org_id) !== organizationId ||
    !isActiveRecord(cohort)
  ) {
    throw new RequestError(
      403,
      "The selected cohort is unavailable."
    );
  }

  if (roleProfile.role === "admin") {
    return cohort;
  }

  const managerRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        org_id: organizationId,
        cohort_id: cohortId,
        user_id: callerId,
        cohort_role: "manager",
        is_active: true,
      }
    );

  const isActiveCohortManager = asArray(managerRows).some(
    (membership: any) =>
      normalizeText(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === callerId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        "manager" &&
      isActiveRecord(membership)
  );

  if (!isActiveCohortManager) {
    throw new RequestError(
      403,
      "You must be an active manager of this cohort to manage its roster."
    );
  }

  return cohort;
}

async function resolveEligibleTargetUser(
  base44: any,
  userId: string,
  organizationId: string,
  cohortRole: string
) {
  const targetUser = await base44.asServiceRole.entities.User.get(
    userId
  ).catch(() => null);

  if (
    !targetUser ||
    !isActiveRecord(targetUser) ||
    normalizeText(targetUser?.id) !== userId
  ) {
    throw new RequestError(
      404,
      "The selected roster user was not found or is inactive."
    );
  }

  if (normalizeText(targetUser?.org_id) !== organizationId) {
    throw new RequestError(
      403,
      "The selected roster user does not belong to this organization."
    );
  }

  const eligible =
    cohortRole === "manager"
      ? isEligibleManagerUser(targetUser)
      : isEligibleTrainerUser(targetUser);

  if (!eligible) {
    throw new RequestError(
      409,
      cohortRole === "manager"
        ? "Only active organization managers or CE instructors may be assigned as cohort managers."
        : "Only active CE instructors may be assigned as cohort trainers."
    );
  }

  return targetUser;
}

async function getExactMembership(
  base44: any,
  membershipId: string,
  organizationId: string,
  cohortId: string
) {
  const membership =
    await base44.asServiceRole.entities.CETrainingCohortMember.get(
      membershipId
    ).catch(() => null);

  if (
    !membership ||
    normalizeText(membership?.id) !== membershipId ||
    normalizeText(membership?.org_id) !== organizationId ||
    normalizeText(membership?.cohort_id) !== cohortId
  ) {
    return null;
  }

  return membership;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE cohort roster request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error:
            "Please sign in before managing the CE cohort roster.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();
    const cohortId = getRequiredString(
      body?.cohort_id,
      "A cohort must be selected."
    );
    const cohortRole = normalizeText(
      body?.cohort_role
    ).toLowerCase();
    const userId = normalizeText(body?.user_id);
    const membershipId = normalizeText(body?.membership_id);

    if (!["add", "remove"].includes(action)) {
      throw new RequestError(
        400,
        "Choose a valid cohort roster action."
      );
    }

    if (cohortRole === "member") {
      throw new RequestError(
        409,
        "CE student membership cannot be changed through roster administration. Use the verified CE invitation, payment settlement, registration, and durable enrollment workflow."
      );
    }

    if (!MANAGEABLE_COHORT_ROLES.has(cohortRole)) {
      throw new RequestError(
        400,
        "Only manager or trainer roster roles may be managed here."
      );
    }

    if (action === "add" && !userId) {
      throw new RequestError(
        400,
        "Choose a user before adding a cohort manager or trainer."
      );
    }

    if (
      action === "remove" &&
      !membershipId &&
      !userId
    ) {
      throw new RequestError(
        400,
        "Choose the cohort manager or trainer to remove."
      );
    }

    const {
      caller,
      callerId,
      organizationId,
      roleProfile,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const cohort = await resolveAuthorizedCohort(
      base44,
      callerId,
      organizationId,
      roleProfile,
      cohortId
    );

    const now = new Date().toISOString();

    if (action === "add") {
      await resolveEligibleTargetUser(
        base44,
        userId,
        organizationId,
        cohortRole
      );

      const existingRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            org_id: organizationId,
            cohort_id: cohortId,
            user_id: userId,
            cohort_role: cohortRole,
          }
        );

      const exactRows = asArray(existingRows).filter(
        (membership: any) =>
          normalizeText(membership?.org_id) === organizationId &&
          normalizeText(membership?.cohort_id) === cohortId &&
          normalizeText(membership?.user_id) === userId &&
          normalizeText(membership?.cohort_role).toLowerCase() ===
            cohortRole
      );

      if (exactRows.length > 1) {
        throw new RequestError(
          409,
          "More than one matching cohort membership record exists. No roster change was made."
        );
      }

      const existingMembership = exactRows[0] || null;

      if (existingMembership?.is_archived === true) {
        throw new RequestError(
          409,
          "This roster membership is archived and cannot be reactivated through normal roster administration."
        );
      }

      if (existingMembership && isActiveRecord(existingMembership)) {
        return Response.json({
          ok: true,
          message: "This user is already active in the selected cohort role.",
          membership_id: existingMembership.id,
        });
      }

      if (existingMembership) {
        await base44.asServiceRole.entities.CETrainingCohortMember.update(
          existingMembership.id,
          {
            is_active: true,
            joined_at: existingMembership.joined_at || now,
            added_by: caller.id,
          }
        );

        return Response.json({
          ok: true,
          message: "The existing cohort roster membership was reactivated.",
          membership_id: existingMembership.id,
        });
      }

      const createdMembership =
        await base44.asServiceRole.entities.CETrainingCohortMember.create(
          {
            org_id: organizationId,
            cohort_id: cohort.id,
            user_id: userId,
            cohort_role: cohortRole,
            is_active: true,
            joined_at: now,
            added_by: caller.id,
          }
        );

      return Response.json({
        ok: true,
        message:
          cohortRole === "manager"
            ? "Cohort manager added."
            : "Cohort trainer added.",
        membership_id: createdMembership.id,
      });
    }

    let targetMembership = null;

    if (membershipId) {
      targetMembership = await getExactMembership(
        base44,
        membershipId,
        organizationId,
        cohortId
      );
    } else {
      const matchingRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            org_id: organizationId,
            cohort_id: cohortId,
            user_id: userId,
            cohort_role: cohortRole,
            is_active: true,
          }
        );

      const exactRows = asArray(matchingRows).filter(
        (membership: any) =>
          normalizeText(membership?.org_id) === organizationId &&
          normalizeText(membership?.cohort_id) === cohortId &&
          normalizeText(membership?.user_id) === userId &&
          normalizeText(membership?.cohort_role).toLowerCase() ===
            cohortRole &&
          isActiveRecord(membership)
      );

      if (exactRows.length > 1) {
        throw new RequestError(
          409,
          "More than one matching active roster membership exists. No roster change was made."
        );
      }

      targetMembership = exactRows[0] || null;
    }

    if (
      !targetMembership ||
      !isActiveRecord(targetMembership) ||
      normalizeText(targetMembership?.cohort_role).toLowerCase() !==
        cohortRole
    ) {
      throw new RequestError(
        404,
        "The selected active cohort roster membership was not found."
      );
    }

    if (cohortRole === "manager") {
      const managerRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            org_id: organizationId,
            cohort_id: cohortId,
            cohort_role: "manager",
            is_active: true,
          }
        );

      const activeManagers = asArray(managerRows).filter(
        (membership: any) =>
          normalizeText(membership?.org_id) === organizationId &&
          normalizeText(membership?.cohort_id) === cohortId &&
          normalizeText(membership?.cohort_role).toLowerCase() ===
            "manager" &&
          isActiveRecord(membership)
      );

      if (activeManagers.length <= 1) {
        throw new RequestError(
          409,
          "The final active cohort manager cannot be removed."
        );
      }
    }

    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      targetMembership.id,
      {
        is_active: false,
      }
    );

    return Response.json({
      ok: true,
      message:
        cohortRole === "manager"
          ? "Cohort manager removed."
          : "Cohort trainer removed.",
      membership_id: targetMembership.id,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[manageCohortMembership] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "The CE cohort roster could not be updated. Please try again or contact an organization administrator.",
      },
      { status }
    );
  }
});
