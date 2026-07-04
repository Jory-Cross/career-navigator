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
  return Boolean(
    record &&
      record?.is_active !== false &&
      record?.is_archived !== true
  );
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
      "Your current role does not allow CE Training cohort access."
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

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE Training cohort-directory request must use POST.",
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
            "Please sign in before viewing CE Training cohorts.",
        },
        { status: 401 }
      );
    }

    const {
      callerId,
      organizationId,
      roleProfile,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const organizationCohortRows =
      await base44.asServiceRole.entities.CETrainingCohort.filter(
        {
          org_id: organizationId,
        }
      );

    const organizationCohorts = asArray(
      organizationCohortRows
    ).filter(
      (cohort: any) =>
        normalizeText(cohort?.org_id) === organizationId &&
        isActiveRecord(cohort) &&
        normalizeText(cohort?.status).toLowerCase() !==
          "archived"
    );

    const validCohortIds = new Set(
      organizationCohorts
        .map((cohort: any) => normalizeText(cohort?.id))
        .filter(Boolean)
    );

    const membershipRows =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter(
        {
          org_id: organizationId,
          is_active: true,
        }
      );

    const activeMemberships = asArray(membershipRows).filter(
      (membership: any) =>
        normalizeText(membership?.org_id) === organizationId &&
        validCohortIds.has(
          normalizeText(membership?.cohort_id)
        ) &&
        isActiveRecord(membership)
    );

    const canViewAllOrganizationCohorts =
      roleProfile.role === "admin" ||
      roleProfile.role === "management";

    const visibleCohortIds = canViewAllOrganizationCohorts
      ? validCohortIds
      : new Set(
          activeMemberships
            .filter(
              (membership: any) =>
                normalizeText(membership?.user_id) === callerId &&
                ["manager", "trainer"].includes(
                  normalizeText(
                    membership?.cohort_role
                  ).toLowerCase()
                )
            )
            .map((membership: any) =>
              normalizeText(membership?.cohort_id)
            )
            .filter(Boolean)
        );

    const cohorts = organizationCohorts.filter((cohort: any) =>
      visibleCohortIds.has(normalizeText(cohort?.id))
    );

    const memberships = activeMemberships.filter(
      (membership: any) =>
        visibleCohortIds.has(
          normalizeText(membership?.cohort_id)
        )
    );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      cohorts,
      memberships,
    });
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[getAuthorizedCohorts] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "CE Training cohorts could not be loaded. Please try again or contact an organization administrator.",
      },
      { status }
    );
  }
});
