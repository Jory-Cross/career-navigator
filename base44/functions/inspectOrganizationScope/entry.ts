import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRealRecordId(value) {
  return isNonEmptyString(value) && value.trim().length >= 20;
}

function uniqueById(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function matchesKnownUser(record, userIds, userEmails) {
  const possibleValues = [
    record.assigned_employee_id,
    record.employee_id,
    record.created_by,
    record.created_by_user_id,
  ];

  return possibleValues.some((value) => (
    userIds.has(value) || userEmails.has(value)
  ));
}

function getCanonicalOrganization({
  requestedOrgId,
  authenticatedUser,
  storedUser,
  organizations,
}) {
  if (isRealRecordId(requestedOrgId)) {
    return organizations.find((organization) => organization.id === requestedOrgId) || null;
  }

  const possibleOrgIds = [
    storedUser?.org_id,
    authenticatedUser?.org_id,
  ].filter(isRealRecordId);

  for (const orgId of possibleOrgIds) {
    const organization = organizations.find((item) => item.id === orgId);
    if (organization) {
      return organization;
    }
  }

  const ownedOrganizations = organizations.filter(
    (organization) => organization.owner_email === authenticatedUser.email
  );

  return ownedOrganizations.length === 1 ? ownedOrganizations[0] : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin =
      authenticatedUser.role === "admin" ||
      authenticatedUser.access_level === "admin";

    if (!isAdmin) {
      return Response.json(
        { error: "Only an administrator can inspect organization repair data." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const legacyOrgKey = isNonEmptyString(body.legacy_org_key)
      ? body.legacy_org_key.trim()
      : null;

    if (!legacyOrgKey) {
      return Response.json(
        { error: "legacy_org_key is required." },
        { status: 400 }
      );
    }

    const [
      allUsers,
      allOrganizations,
      allClients,
      allTimeEntries,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.TimeEntry.list(),
    ]);

    const storedUser = allUsers.find(
      (user) => user.id === authenticatedUser.id
    );

    const canonicalOrganization = getCanonicalOrganization({
      requestedOrgId: body.canonical_org_id,
      authenticatedUser,
      storedUser,
      organizations: allOrganizations,
    });

    if (!canonicalOrganization) {
      return Response.json({
        error: "Could not determine the canonical organization automatically.",
        available_organizations: allOrganizations.map((organization) => ({
          id: organization.id,
          owner_email: organization.owner_email || null,
          name: organization.name || organization.organization_name || null,
        })),
      }, { status: 409 });
    }

    const legacyUsers = allUsers.filter(
      (user) => user.org_id === legacyOrgKey
    );

    const legacyUserIds = new Set(legacyUsers.map((user) => user.id));
    const legacyUserEmails = new Set(
      legacyUsers.map((user) => user.email).filter(Boolean)
    );

    const clientCandidates = allClients.filter((client) => {
      const needsRepair =
        !client.org_id ||
        client.org_id === legacyOrgKey;

      return needsRepair && matchesKnownUser(
        client,
        legacyUserIds,
        legacyUserEmails
      );
    });

    const clientCandidateIds = new Set(
      clientCandidates.map((client) => client.id)
    );

    const timeEntryCandidates = allTimeEntries.filter((entry) => {
      const needsRepair =
        !entry.org_id ||
        entry.org_id === legacyOrgKey;

      return needsRepair && (
        clientCandidateIds.has(entry.client_id) ||
        matchesKnownUser(entry, legacyUserIds, legacyUserEmails)
      );
    });

    const ambiguousClients = allClients.filter((client) => (
      !client.org_id &&
      !clientCandidateIds.has(client.id)
    ));

    return Response.json({
      preview_only: true,
      canonical_organization: {
        id: canonicalOrganization.id,
        owner_email: canonicalOrganization.owner_email || null,
        name: canonicalOrganization.name || canonicalOrganization.organization_name || null,
      },
      legacy_org_key: legacyOrgKey,
      repair_counts: {
        users: legacyUsers.length,
        clients: clientCandidates.length,
        time_entries: timeEntryCandidates.length,
        ambiguous_unscoped_clients: ambiguousClients.length,
      },
      sample_clients: clientCandidates.slice(0, 10).map((client) => ({
        id: client.id,
        name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
        assigned_employee_id: client.assigned_employee_id || null,
        current_org_id: client.org_id || null,
      })),
      sample_ambiguous_clients: ambiguousClients.slice(0, 10).map((client) => ({
        id: client.id,
        name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
        assigned_employee_id: client.assigned_employee_id || null,
        created_by: client.created_by || null,
      })),
    });
  } catch (error) {
    console.error("inspectOrganizationScope error:", error.message);

    return Response.json(
      { error: error.message || "Unable to inspect organization scope." },
      { status: 500 }
    );
  }
});
