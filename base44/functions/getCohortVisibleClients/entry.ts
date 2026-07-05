import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_ACCESS_BY_ROLE: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  ce_instructor: "ce_training_portal",
};

const COHORT_AUTHORIZATION_ROLES = new Set(["manager", "trainer"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isCanonicalCaller(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return CANONICAL_ACCESS_BY_ROLE[role] === accessLevel ? role : "";
}

function isActiveCohort(cohort: any, organizationId: string) {
  return (
    isActive(cohort) &&
    normalizeText(cohort?.org_id) === organizationId &&
    normalizeText(cohort?.status).toLowerCase() !== "archived"
  );
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

function projectClient(client: any) {
  return {
    id: normalizeText(client?.id),
    org_id: normalizeText(client?.org_id),
    first_name: normalizeText(client?.first_name),
    last_name: normalizeText(client?.last_name),
    email: normalizeText(client?.email),
    status: normalizeText(client?.status) || "active",
    client_type: normalizeText(client?.client_type) || "job_seeker",
    assigned_employee_id: normalizeText(client?.assigned_employee_id) || null,
    is_archived: client?.is_archived === true,
    created_date: client?.created_date ?? null,
    updated_date: client?.updated_date ?? null,
  };
}

/**
 * Returns cohort-based client visibility only. Browser-supplied user IDs are
 * ignored. The canonical User, organization, active cohort memberships, and
 * active same-organization client records determine every returned row.
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    // Never accept a browser-provided caller identity or organization scope.
    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to view cohort clients." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const callerRole = isCanonicalCaller(caller);
    const callerId = normalizeText(caller?.id);
    const organizationId = normalizeText(caller?.org_id);

    if (!callerRole || !callerId || !organizationId) {
      return Response.json(
        { error: "Your account is not authorized to view cohort clients." },
        { status: 403 }
      );
    }

    const [organization, organizationUsers, organizationClients, cohorts, memberships] =
      await Promise.all([
        base44.asServiceRole.entities.Organization.get(organizationId).catch(
          () => null
        ),
        base44.asServiceRole.entities.User.filter({ org_id: organizationId }),
        base44.asServiceRole.entities.Client.filter({ org_id: organizationId }),
        base44.asServiceRole.entities.CETrainingCohort.filter({
          org_id: organizationId,
        }),
        base44.asServiceRole.entities.CETrainingCohortMember.filter({
          org_id: organizationId,
        }),
      ]);

    if (!organization || !isActive(organization)) {
      return Response.json(
        { error: "Your organization is inactive or unavailable." },
        { status: 403 }
      );
    }

    const activeOrganizationUserIds = new Set(
      asArray(organizationUsers)
        .filter(
          (user: any) =>
            isActive(user) && normalizeText(user?.org_id) === organizationId
        )
        .map((user: any) => normalizeText(user?.id))
        .filter(Boolean)
    );

    if (!activeOrganizationUserIds.has(callerId)) {
      return Response.json(
        { error: "Your account is not validly scoped to this organization." },
        { status: 403 }
      );
    }

    const activeCohortIds = new Set(
      asArray(cohorts)
        .filter((cohort: any) => isActiveCohort(cohort, organizationId))
        .map((cohort: any) => normalizeText(cohort?.id))
        .filter(Boolean)
    );

    const activeMemberships = asArray(memberships).filter((membership: any) =>
      isActiveMembership(membership, organizationId, activeCohortIds)
    );

    const activeClients = asArray(organizationClients).filter(
      (client: any) =>
        isActive(client) && normalizeText(client?.org_id) === organizationId
    );

    if (callerRole === "admin") {
      return Response.json({
        isAdmin: true,
        cohortIds: [],
        memberUserIds: [],
        clientIds: activeClients.map((client: any) => normalizeText(client?.id)).filter(Boolean),
        clients: activeClients.map(projectClient),
      });
    }

    const authorizedCohortIds = new Set(
      activeMemberships
        .filter(
          (membership: any) =>
            normalizeText(membership?.user_id) === callerId &&
            COHORT_AUTHORIZATION_ROLES.has(
              normalizeText(membership?.cohort_role).toLowerCase()
            )
        )
        .map((membership: any) => normalizeText(membership?.cohort_id))
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

    const visibleMemberUserIds = new Set(
      activeMemberships
        .filter(
          (membership: any) =>
            authorizedCohortIds.has(normalizeText(membership?.cohort_id)) &&
            activeOrganizationUserIds.has(normalizeText(membership?.user_id))
        )
        .map((membership: any) => normalizeText(membership?.user_id))
        .filter(Boolean)
    );

    const visibleClients = activeClients.filter((client: any) =>
      visibleMemberUserIds.has(normalizeText(client?.assigned_employee_id))
    );

    return Response.json({
      isAdmin: false,
      cohortIds: Array.from(authorizedCohortIds),
      memberUserIds: Array.from(visibleMemberUserIds),
      clientIds: visibleClients.map((client: any) => normalizeText(client?.id)).filter(Boolean),
      clients: visibleClients.map(projectClient),
    });
  } catch (error: any) {
    console.error(
      "getCohortVisibleClients error:",
      error?.message || error
    );

    return Response.json(
      { error: "Cohort client visibility could not be loaded." },
      { status: 500 }
    );
  }
});
