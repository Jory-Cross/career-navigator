import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActiveOrganization(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      allUsers,
      allPlatformAdmins,
      allOrganizations,
      allClients,
      allAuthorizations,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.PlatformAdmin.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.ServiceAuthorization.list(),
    ]);

    const users = Array.isArray(allUsers) ? allUsers : [];
    const platformAdmins = Array.isArray(allPlatformAdmins)
      ? allPlatformAdmins
      : [];
    const organizations = Array.isArray(allOrganizations)
      ? allOrganizations
      : [];
    const clients = Array.isArray(allClients) ? allClients : [];
    const authorizations = Array.isArray(allAuthorizations)
      ? allAuthorizations
      : [];

    const callerId = normalizeText(authenticatedUser.id);

    const caller = users.find(
      (user: any) => normalizeText(user?.id) === callerId
    );

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Authenticated user record was not found or is inactive." },
        { status: 403 }
      );
    }

    const isPlatformOwner = platformAdmins.some(
      (record: any) =>
        normalizeText(record?.user_id) === callerId &&
        normalizeText(record?.platform_role).toLowerCase() ===
          "platform_owner" &&
        isActive(record)
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          error:
            "Only an active platform owner may audit service authorization organization scope.",
        },
        { status: 403 }
      );
    }

    const clientsById = new Map(
      clients
        .map((client: any) => [normalizeText(client?.id), client])
        .filter(([clientId]) => Boolean(clientId))
    );

    const organizationsById = new Map(
      organizations
        .map((organization: any) => [
          normalizeText(organization?.id),
          organization,
        ])
        .filter(([organizationId]) => Boolean(organizationId))
    );

    const auditRows = authorizations.map((authorization: any) => {
      const authorizationId = normalizeText(authorization?.id);
      const authorizationOrgId = normalizeText(authorization?.org_id);
      const clientId = normalizeText(authorization?.client_id);
      const authorizationNumber = normalizeText(
        authorization?.authorization_number
      );
      const entryTypeCode = normalizeText(authorization?.entry_type_code);
      const status = normalizeText(authorization?.status).toLowerCase();

      const client = clientsById.get(clientId);
      const clientExists = Boolean(client);
      const clientOrgId = normalizeText(client?.org_id);
      const clientOrganization = organizationsById.get(clientOrgId);
      const clientOrganizationIsActive =
        Boolean(clientOrganization) && isActiveOrganization(clientOrganization);

      let disposition = "unresolved";
      let suggestedOrgId = "";

      if (!clientId) {
        disposition = "missing_client_id";
      } else if (!clientExists) {
        disposition = "missing_client_record";
      } else if (!clientOrgId) {
        disposition = "client_missing_org_id";
      } else if (!clientOrganizationIsActive) {
        disposition = "client_org_invalid_or_inactive";
      } else if (!authorizationOrgId) {
        disposition = "missing_org_resolvable";
        suggestedOrgId = clientOrgId;
      } else if (authorizationOrgId !== clientOrgId) {
        disposition = "authorization_org_conflict";
        suggestedOrgId = clientOrgId;
      } else {
        disposition = "valid_scoped";
        suggestedOrgId = authorizationOrgId;
      }

      return {
        authorization_id: authorizationId,
        org_id: authorizationOrgId || null,
        client_id: clientId || null,
        authorization_number: authorizationNumber || null,
        entry_type_code: entryTypeCode || null,
        status: status || null,
        client_exists: clientExists,
        client_org_id: clientOrgId || null,
        client_organization_is_active: clientOrganizationIsActive,
        disposition,
        suggested_org_id: suggestedOrgId || null,
      };
    });

    const countByDisposition = (disposition: string) =>
      auditRows.filter((row: any) => row.disposition === disposition).length;

    const backfillCandidates = auditRows.filter(
      (row: any) => row.disposition === "missing_org_resolvable"
    );

    const conflicts = auditRows.filter(
      (row: any) => row.disposition !== "valid_scoped"
    );

    return Response.json({
      ok: true,
      read_only: true,
      audit_scope: "ServiceAuthorization",
      summary: {
        total_authorizations: auditRows.length,
        active_authorizations: auditRows.filter(
          (row: any) => row.status === "active"
        ).length,
        draft_authorizations: auditRows.filter(
          (row: any) => row.status === "draft"
        ).length,
        valid_scoped: countByDisposition("valid_scoped"),
        missing_org_resolvable: countByDisposition(
          "missing_org_resolvable"
        ),
        authorization_org_conflicts: countByDisposition(
          "authorization_org_conflict"
        ),
        missing_client_id: countByDisposition("missing_client_id"),
        missing_client_records: countByDisposition(
          "missing_client_record"
        ),
        clients_missing_org_id: countByDisposition(
          "client_missing_org_id"
        ),
        client_org_invalid_or_inactive: countByDisposition(
          "client_org_invalid_or_inactive"
        ),
        unresolved: auditRows.filter(
          (row: any) => row.disposition !== "valid_scoped"
        ).length,
      },
      backfill_candidates: backfillCandidates,
      conflicts,
      authorizations: auditRows,
    });
  } catch (error: any) {
    console.error(
      "auditServiceAuthorizationOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to audit service authorization organization scope.",
      },
      { status: 500 }
    );
  }
});
