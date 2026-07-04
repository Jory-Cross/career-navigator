import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
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
      "Your current role does not allow CE cohort roster access."
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

async function requireCohortRosterAuthority(
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
    cohort?.is_active === false ||
    cohort?.is_archived === true
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
        cohort_id: cohortId,
        user_id: callerId,
        cohort_role: "manager",
        is_active: true,
      }
    );

  const isActiveManager = asArray(managerRows).some(
    (membership: any) =>
      normalizeText(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === callerId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        "manager" &&
      membership?.is_active !== false &&
      membership?.is_archived !== true
  );

  if (!isActiveManager) {
    throw new RequestError(
      403,
      "You must be an active manager of this cohort to review assigned CE students."
    );
  }

  return cohort;
}

async function getActiveAssignedCEStudentIds(
  base44: any,
  organizationId: string
) {
  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        org_id: organizationId,
        cohort_role: "member",
        is_active: true,
      }
    );

  const candidateUserIds = Array.from(
    new Set(
      asArray(membershipRows)
        .filter(
          (membership: any) =>
            normalizeText(membership?.org_id) === organizationId &&
            normalizeText(membership?.cohort_role).toLowerCase() ===
              "member" &&
            membership?.is_active !== false &&
            membership?.is_archived !== true &&
            !!normalizeText(membership?.user_id)
        )
        .map((membership: any) =>
          normalizeText(membership?.user_id)
        )
    )
  );

  const users = await Promise.all(
    candidateUserIds.map((userId) =>
      base44.asServiceRole.entities.User.get(userId).catch(
        () => null
      )
    )
  );

  return users
    .filter(
      (user: any) =>
        user &&
        isActiveRecord(user) &&
        normalizeText(user?.org_id) === organizationId &&
        normalizeText(user?.role).toLowerCase() === "ce_student" &&
        normalizeText(user?.access_level).toLowerCase() ===
          "ce_training_portal"
    )
    .map((user: any) => normalizeText(user?.id))
    .filter(Boolean)
    .sort();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student-assignment lookup must use POST.",
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
            "Please sign in before reviewing assigned CE students.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = getRequiredString(
      body?.cohort_id,
      "A cohort must be selected before assigned CE students can be reviewed."
    );

    const {
      callerId,
      organizationId,
      roleProfile,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    await requireCohortRosterAuthority(
      base44,
      callerId,
      organizationId,
      roleProfile,
      cohortId
    );

    const assignedUserIds =
      await getActiveAssignedCEStudentIds(
        base44,
        organizationId
      );

    return Response.json({
      ok: true,
      cohort_id: cohortId,
      assigned_user_ids: assignedUserIds,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[getAssignedCEStudentIds] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Assigned CE students could not be loaded. Please try again or contact an organization administrator.",
      },
      { status }
    );
  }
});
