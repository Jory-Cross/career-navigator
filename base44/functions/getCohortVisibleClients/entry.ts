import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

/**
 * Cohort Visibility Engine
 *
 * Determines only the authenticated caller's CE cohort-based client visibility.
 *
 * SECURITY RULE:
 * - Browser-supplied user_id is never accepted as authorization.
 * - The authenticated database User determines the tenant and visibility scope.
 * - The caller must have a valid canonical Organization.org_id.
 *
 * Response shape remains compatible with existing UI callers:
 *   { isAdmin, cohortIds, memberUserIds, clientIds, clients }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      allUsers,
      allOrganizations,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
    ]);

    const callerUser = allUsers.find(
      (record) => record.id === authenticatedUser.id
    );

    if (!callerUser) {
      return Response.json(
        { error: "Authenticated user record was not found." },
        { status: 403 }
      );
    }

    const orgId =
      typeof callerUser.org_id === "string"
        ? callerUser.org_id.trim()
        : "";

    if (!orgId) {
      return Response.json(
        {
          error:
            "Your account is not assigned to an organization. Cohort visibility is unavailable.",
        },
        { status: 403 }
      );
    }

    const organization = allOrganizations.find(
      (record) => record.id === orgId
    );

    if (!organization) {
      return Response.json(
        {
          error:
            "Your account has an invalid organization assignment. Cohort visibility is unavailable.",
        },
        { status: 403 }
      );
    }

    const isAdmin =
      callerUser.role === "admin" ||
      callerUser.access_level === "admin";

    const [
      orgClients,
      orgCohorts,
      activeOrgMemberships,
    ] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({
        org_id: orgId,
        is_archived: false,
      }),
      base44.asServiceRole.entities.CETrainingCohort.filter({
        org_id: orgId,
      }),
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        org_id: orgId,
        is_active: true,
      }),
    ]);

    const orgUserIds = new Set(
      allUsers
        .filter((record) => record.org_id === orgId)
        .map((record) => record.id)
        .filter(Boolean)
    );

    if (!orgUserIds.has(callerUser.id)) {
      return Response.json(
        {
          error:
            "Your account is not validly scoped to this organization.",
        },
        { status: 403 }
      );
    }

    // Organization admins can view all active clients in their own organization.
    if (isAdmin) {
      return Response.json({
        isAdmin: true,
        cohortIds: [],
        memberUserIds: [],
        clientIds: orgClients.map((client) => client.id),
        clients: orgClients,
      });
    }

    const orgCohortIds = new Set(
      orgCohorts.map((cohort) => cohort.id).filter(Boolean)
    );

    const managerCohortIds = activeOrgMemberships
      .filter(
        (membership) =>
          membership.user_id === callerUser.id &&
          membership.cohort_role === "manager" &&
          orgCohortIds.has(membership.cohort_id)
      )
      .map((membership) => membership.cohort_id);

    const visibleMemberUserIds = new Set([callerUser.id]);

    if (managerCohortIds.length > 0) {
      const managedCohortIdSet = new Set(managerCohortIds);

      for (const membership of activeOrgMemberships) {
        if (
          managedCohortIdSet.has(membership.cohort_id) &&
          orgUserIds.has(membership.user_id)
        ) {
          visibleMemberUserIds.add(membership.user_id);
        }
      }
    }

    const visibleClients = orgClients.filter(
      (client) =>
        client.assigned_employee_id &&
        visibleMemberUserIds.has(client.assigned_employee_id)
    );

    return Response.json({
      isAdmin: false,
      cohortIds: managerCohortIds,
      memberUserIds: Array.from(visibleMemberUserIds),
      clientIds: visibleClients.map((client) => client.id),
      clients: visibleClients,
    });
  } catch (error) {
    console.error(
      "getCohortVisibleClients error:",
      error?.message
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
