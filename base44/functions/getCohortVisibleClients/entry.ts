import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const COHORT_AUTHORIZATION_ROLES = new Set([
  "manager",
  "trainer",
]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActiveMembership(
  membership: any,
  organizationId: string,
  activeCohortIds: Set<string>
) {
  return (
    membership?.is_active === true &&
    membership?.is_archived !== true &&
    normalizeText(membership?.org_id) === organizationId &&
    activeCohortIds.has(normalizeText(membership?.cohort_id))
  );
}

function isCanonicalOrganizationAdmin(user: any) {
  return normalizeText(user?.role).toLowerCase() === "admin";
}

/**
 * Cohort Visibility Engine
 *
 * Determines the authenticated caller's CE cohort-based client visibility.
 *
 * SECURITY RULES:
 * - Browser-supplied user_id is never accepted as authorization.
 * - The canonical database User determines caller identity and organization.
 * - Only an active organization admin, or an active cohort manager/trainer,
 *   can receive cohort-based client visibility.
 * - Cohort visibility never starts with the caller's own assigned clients.
 * - All returned users, cohorts, memberships, and clients are exact-org scoped.
 *
 * Response shape remains compatible with existing UI callers:
 *   { isAdmin, cohortIds, memberUserIds, clientIds, clients }
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const callerUser =
      await base44.asServiceRole.entities.User.get(
        authenticatedUser.id
      ).catch(() => null);

    if (!callerUser || !isActive(callerUser)) {
      return Response.json(
        { error: "Authenticated user record was not found or is inactive." },
        { status: 403 }
      );
    }

    const organizationId = normalizeText(callerUser.org_id);

    if (!organizationId) {
      return Response.json(
        {
          error:
            "Your account is not assigned to an organization. Cohort visibility is unavailable.",
        },
        { status: 403 }
      );
    }

    const organization =
      await base44.asServiceRole.entities.Organization.get(
        organizationId
      ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        {
          error:
            "Your account has an invalid or inactive organization assignment. Cohort visibility is unavailable.",
        },
        { status: 403 }
      );
    }

    const [
      organizationUsers,
      organizationClients,
      organizationCohorts,
      organizationMemberships,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.Client.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.CETrainingCohort.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        org_id: organizationId,
      }),
    ]);

    const activeOrganizationUsers = asArray(organizationUsers).filter(
      (user: any) =>
        isActive(user) &&
        normalizeText(user?.org_id) === organizationId
    );

    const activeOrganizationUserIds = new Set(
      activeOrganizationUsers
        .map((user: any) => normalizeText(user?.id))
        .filter(Boolean)
    );

    if (!activeOrganizationUserIds.has(callerUser.id)) {
      return Response.json(
        {
          error:
            "Your account is not validly scoped to this organization.",
        },
        { status: 403 }
      );
    }

    const activeCohortIds = new Set(
      asArray(organizationCohorts)
        .filter(
          (cohort: any) =>
            isActive(cohort) &&
            normalizeText(cohort?.org_id) === organizationId
        )
        .map((cohort: any) => normalizeText(cohort?.id))
        .filter(Boolean)
    );

    const activeMemberships = asArray(organizationMemberships).filter(
      (membership: any) =>
        isActiveMembership(
          membership,
          organizationId,
          activeCohortIds
        )
    );

    const activeOrganizationClients = asArray(organizationClients).filter(
      (client: any) =>
        isActive(client) &&
        normalizeText(client?.org_id) === organizationId
    );

    if (isCanonicalOrganizationAdmin(callerUser)) {
      return Response.json({
        isAdmin: true,
        cohortIds: [],
        memberUserIds: [],
        clientIds: activeOrganizationClients
          .map((client: any) => client.id)
          .filter(Boolean),
        clients: activeOrganizationClients,
      });
    }

    const authorizedCohortIds = new Set(
      activeMemberships
        .filter(
          (membership: any) =>
            normalizeText(membership?.user_id) === callerUser.id &&
            COHORT_AUTHORIZATION_ROLES.has(
              normalizeText(membership?.cohort_role).toLowerCase()
            )
        )
        .map((membership: any) =>
          normalizeText(membership?.cohort_id)
        )
        .filter(Boolean)
    );

    if (authorizedCohortIds.size === 0) {
      return Response.json({
        isAdmin: false,
        cohortIds: [],
        memberUserIds: [],
        clientIds: [],
        clients: [],
      });
    }

    const visibleMemberUserIds = new Set<string>();

    for (const membership of activeMemberships) {
      const cohortId = normalizeText(membership?.cohort_id);
      const memberUserId = normalizeText(membership?.user_id);

      if (
        authorizedCohortIds.has(cohortId) &&
        activeOrganizationUserIds.has(memberUserId)
      ) {
        visibleMemberUserIds.add(memberUserId);
      }
    }

    const visibleClients = activeOrganizationClients.filter(
      (client: any) =>
        visibleMemberUserIds.has(
          normalizeText(client?.assigned_employee_id)
        )
    );

    return Response.json({
      isAdmin: false,
      cohortIds: Array.from(authorizedCohortIds),
      memberUserIds: Array.from(visibleMemberUserIds),
      clientIds: visibleClients
        .map((client: any) => client.id)
        .filter(Boolean),
      clients: visibleClients,
    });
  } catch (error: any) {
    console.error(
      "getCohortVisibleClients error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to determine cohort client visibility.",
      },
      { status: 500 }
    );
  }
});
