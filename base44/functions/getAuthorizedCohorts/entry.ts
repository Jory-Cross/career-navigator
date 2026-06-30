import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();

    const caller = allUsers.find(
      (record: any) => record.id === authenticatedUser.id
    );

    if (!caller) {
      return Response.json(
        { error: "Authenticated user record was not found." },
        { status: 403 }
      );
    }

    const organizationId =
      typeof caller.org_id === "string"
        ? caller.org_id.trim()
        : "";

    if (!organizationId) {
      return Response.json(
        { error: "Your account is not assigned to an organization." },
        { status: 403 }
      );
    }

    const organizations =
      await base44.asServiceRole.entities.Organization.list();

    const organization = organizations.find(
      (record: any) => record.id === organizationId
    );

    if (!organization) {
      return Response.json(
        { error: "Your account has an invalid organization assignment." },
        { status: 403 }
      );
    }

    const canViewAllOrganizationCohorts =
      caller.role === "admin" || caller.role === "management";

    const isInstructor = caller.role === "ce_instructor";

    if (!canViewAllOrganizationCohorts && !isInstructor) {
      return Response.json(
        { error: "You are not authorized to view CE Training cohorts." },
        { status: 403 }
      );
    }

    const [organizationCohorts, organizationMemberships] =
      await Promise.all([
        base44.asServiceRole.entities.CETrainingCohort.filter({
          org_id: organizationId,
        }),
        base44.asServiceRole.entities.CETrainingCohortMember.filter({
          org_id: organizationId,
          is_active: true,
        }),
      ]);

    const validCohortIds = new Set(
      organizationCohorts.map((cohort: any) => cohort.id)
    );

    const activeMemberships = organizationMemberships.filter(
      (membership: any) =>
        validCohortIds.has(membership.cohort_id) &&
        membership.is_active !== false
    );

    let visibleCohortIds = validCohortIds;

    if (!canViewAllOrganizationCohorts) {
      visibleCohortIds = new Set(
        activeMemberships
          .filter(
            (membership: any) =>
              membership.user_id === caller.id &&
              ["manager", "trainer"].includes(membership.cohort_role)
          )
          .map((membership: any) => membership.cohort_id)
      );
    }

    const cohorts = organizationCohorts.filter((cohort: any) =>
      visibleCohortIds.has(cohort.id)
    );

    const memberships = activeMemberships.filter((membership: any) =>
      visibleCohortIds.has(membership.cohort_id)
    );

    return Response.json({
      ok: true,
      organization_id: organizationId,
      cohorts,
      memberships,
    });
  } catch (error: any) {
    console.error("getAuthorizedCohorts error:", error?.message);

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to load authorized CE Training cohorts.",
      },
      { status: 500 }
    );
  }
});
