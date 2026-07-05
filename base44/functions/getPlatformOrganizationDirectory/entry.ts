import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isStaffUser(user) {
  return ["admin", "management", "employee"].includes(
    normalizeText(user?.role).toLowerCase()
  );
}

function getOrganizationName(organization) {
  return (
    normalizeText(organization?.name) ||
    normalizeText(organization?.tenant_key) ||
    "Unnamed organization"
  );
}

function emptyMemberCounts() {
  return {
    total_members: 0,
    staff_members: 0,
    admins: 0,
    managers: 0,
    employees: 0,
    ce_students: 0,
    ce_instructors: 0,
  };
}

function emptyClientCounts() {
  return {
    total_clients: 0,
    active_clients: 0,
    archived_clients: 0,
    job_seekers: 0,
    pre_ets_clients: 0,
    dspd_clients: 0,
    employed_clients: 0,
    customized_employment_clients: 0,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to view the organization directory." },
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

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });
    const platformOwnerRecord = platformAdminRecords.find(
      (record) =>
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE && isActive(record)
    );

    if (!platformOwnerRecord) {
      return Response.json(
        {
          error:
            "Platform Owner access is required to view the organization directory.",
        },
        { status: 403 }
      );
    }

    const [organizations, users, clients] = await Promise.all([
      base44.asServiceRole.entities.Organization.list("-created_date"),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list("-created_date"),
    ]);

    const validOrganizationIds = new Set(
      organizations
        .map((organization) => normalizeText(organization?.id))
        .filter(Boolean)
    );
    const usersByOrganizationId = new Map();
    const clientsByOrganizationId = new Map();

    for (const user of users) {
      const organizationId = normalizeText(user?.org_id);
      if (!organizationId) continue;

      const current =
        usersByOrganizationId.get(organizationId) || emptyMemberCounts();
      const role = normalizeText(user?.role).toLowerCase();

      current.total_members += 1;
      if (isStaffUser(user)) current.staff_members += 1;
      if (role === "admin") current.admins += 1;
      if (role === "management") current.managers += 1;
      if (role === "employee") current.employees += 1;
      if (role === "ce_student") current.ce_students += 1;
      if (role === "ce_instructor") current.ce_instructors += 1;

      usersByOrganizationId.set(organizationId, current);
    }

    for (const client of clients) {
      const organizationId = normalizeText(client?.org_id);
      if (!organizationId) continue;

      const current =
        clientsByOrganizationId.get(organizationId) || emptyClientCounts();
      const clientType = normalizeText(client?.client_type) || "job_seeker";

      current.total_clients += 1;
      if (client?.is_archived === true) {
        current.archived_clients += 1;
      } else {
        current.active_clients += 1;
      }

      if (clientType === "job_seeker") current.job_seekers += 1;
      if (clientType === "pre_ets") current.pre_ets_clients += 1;
      if (clientType === "dspd") current.dspd_clients += 1;
      if (clientType === "employed") current.employed_clients += 1;
      if (clientType === "customized_employment") {
        current.customized_employment_clients += 1;
      }

      clientsByOrganizationId.set(organizationId, current);
    }

    const organizationDirectory = organizations
      .map((organization) => {
        const organizationId = normalizeText(organization?.id);

        return {
          id: organizationId,
          name: getOrganizationName(organization),
          tenant_key: normalizeText(organization?.tenant_key) || null,
          owner_email: normalizeText(organization?.owner_email) || null,
          industry: normalizeText(organization?.industry) || null,
          website: normalizeText(organization?.website) || null,
          subscription_tier:
            normalizeText(organization?.subscription_tier) || null,
          subscription_status:
            normalizeText(organization?.subscription_status) || null,
          is_active: organization?.is_active !== false,
          max_employees: organization?.max_employees ?? null,
          max_clients: organization?.max_clients ?? null,
          members:
            usersByOrganizationId.get(organizationId) || emptyMemberCounts(),
          clients:
            clientsByOrganizationId.get(organizationId) || emptyClientCounts(),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const unscopedClients = clients.filter(
      (client) => !normalizeText(client?.org_id)
    );
    const unscopedStaffUsers = users.filter(
      (user) => isStaffUser(user) && !normalizeText(user?.org_id)
    );
    const clientsWithInvalidOrganization = clients.filter(
      (client) =>
        normalizeText(client?.org_id) &&
        !validOrganizationIds.has(normalizeText(client?.org_id))
    );
    const usersWithInvalidOrganization = users.filter(
      (user) =>
        normalizeText(user?.org_id) &&
        !validOrganizationIds.has(normalizeText(user?.org_id))
    );

    return Response.json({
      generated_at: new Date().toISOString(),
      organizations: organizationDirectory,
      totals: {
        organizations: organizationDirectory.length,
        active_organizations: organizationDirectory.filter(
          (organization) => organization.is_active
        ).length,
        members: users.length,
        clients: clients.length,
      },
      data_health: {
        unscoped_clients: unscopedClients.length,
        unscoped_staff_users: unscopedStaffUsers.length,
        clients_with_invalid_org_id: clientsWithInvalidOrganization.length,
        users_with_invalid_org_id: usersWithInvalidOrganization.length,
        sample_unscoped_clients: unscopedClients.slice(0, 10).map(
          (client) => ({
            id: normalizeText(client?.id),
            name:
              `${normalizeText(client?.first_name)} ${normalizeText(
                client?.last_name
              )}`.trim() || "Unnamed client",
            assigned_employee_id:
              normalizeText(client?.assigned_employee_id) || null,
          })
        ),
      },
    });
  } catch (error) {
    console.error(
      "getPlatformOrganizationDirectory error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to load the platform organization directory." },
      { status: 500 }
    );
  }
});
