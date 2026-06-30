import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Recursively collect all descendant user IDs under a given user
 * by traversing the manager_id tree.
 */
function getAllDescendantIds(userId, allUsers) {
  const directReports = allUsers.filter((user) => user.manager_id === userId);

  if (directReports.length === 0) {
    return [];
  }

  const ids = directReports.map((user) => user.id);

  for (const report of directReports) {
    ids.push(...getAllDescendantIds(report.id, allUsers));
  }

  return ids;
}

/**
 * Legacy client records may not yet have org_id.
 * They are only considered safe to return when their assignment or creator
 * is tied to a known user in the authenticated organization.
 */
function hasClientMembershipEvidence(client, userIds, userEmails) {
  const values = [
    client.assigned_employee_id,
    client.created_by,
  ];

  return values.some((value) => (
    typeof value === 'string' &&
    (userIds.has(value) || userEmails.has(value))
  ));
}

async function resolveAuthenticatedOrgId(base44, user, allUsers) {
  const currentUserRecord = allUsers.find((member) => member.id === user.id);
  const candidateOrgId = currentUserRecord?.org_id || user.org_id;

  if (candidateOrgId) {
    const matchingOrgs = await base44.asServiceRole.entities.Organization.filter({
      id: candidateOrgId,
    });

    if (matchingOrgs?.[0]?.id) {
      return matchingOrgs[0].id;
    }
  }

  const ownedOrgs = await base44.asServiceRole.entities.Organization.filter({
    owner_email: user.email,
  });

  return ownedOrgs?.[0]?.id || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Consume the request body without using browser-provided organization data
    // as an authorization boundary.
    await req.json().catch(() => ({}));

    const allUsers = await base44.asServiceRole.entities.User.list();
    const resolvedOrgId = await resolveAuthenticatedOrgId(base44, user, allUsers);

    const organizationUsers = resolvedOrgId
      ? allUsers.filter((member) => member.org_id === resolvedOrgId)
      : [];

    const organizationUserIds = new Set([
      user.id,
      ...organizationUsers.map((member) => member.id),
    ]);

    const organizationUserEmails = new Set([
      user.email,
      ...organizationUsers
        .map((member) => member.email)
        .filter(Boolean),
    ]);

    const allClients = await base44.asServiceRole.entities.Client.list("-created_date");

    // A tagged client must belong to the authenticated organization.
    // An older untagged client must have assignment/creator evidence connecting
    // it to a user in this organization.
    const organizationClients = allClients.filter((client) => {
      if (resolvedOrgId && client.org_id === resolvedOrgId) {
        return true;
      }

      if (client.org_id) {
        return false;
      }

      return hasClientMembershipEvidence(
        client,
        organizationUserIds,
        organizationUserEmails
      );
    });

    if (user.role === "admin") {
      return Response.json({ clients: organizationClients });
    }

    if (user.role === "management") {
      const hierarchyUsers = resolvedOrgId
        ? organizationUsers
        : allUsers.filter((member) => member.id === user.id);

      const descendantIds = getAllDescendantIds(user.id, hierarchyUsers);
      const visibleUserIds = new Set([user.id, ...descendantIds]);

      const visibleUserEmails = new Set(
        hierarchyUsers
          .filter((member) => visibleUserIds.has(member.id))
          .map((member) => member.email)
          .filter(Boolean)
      );

      const clients = organizationClients.filter((client) =>
        hasClientMembershipEvidence(client, visibleUserIds, visibleUserEmails)
      );

      return Response.json({ clients });
    }

    if (user.role === "employee") {
      const ownUserIds = new Set([user.id]);
      const ownEmails = new Set([user.email].filter(Boolean));

      const clients = organizationClients.filter((client) =>
        hasClientMembershipEvidence(client, ownUserIds, ownEmails)
      );

      return Response.json({ clients });
    }

    return Response.json({ clients: [] });
  } catch (error) {
    console.error("getClientsForUser error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
