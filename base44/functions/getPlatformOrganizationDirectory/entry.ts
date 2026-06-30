import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";

function isStaffUser(user) {
  return ["admin", "management", "employee"].includes(user?.role);
}

function getOrganizationName(organization) {
  return organization.name || organization.tenant_key || "Unnamed organization";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: currentUser.id,
      });

    const platformOwnerRecord = platformAdminRecords.find(
      (record) =>
        record.platform_role === PLATFORM_OWNER_ROLE &&
        record.is_active !== false
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
      organizations.map((organization) => organization.id)
    );

    const usersByOrganizationId = new Map();
    const clientsByOrganizationId = new Map();

    for (const user of users) {
      if (!user.org_id) continue;

      const current = usersByOrganizationId.get(user.org_id) || {
        total_members: 0,
        staff_members: 0,
        admins: 0,
        managers: 0,
        employees: 0,
        ce_students: 0,
        ce_instructors: 0,
      };

      current.total_members += 1;

      if (isStaffUser(user)) {
        current.staff_members += 1;
      }

      if (user.role === "admin") current.admins += 1;
      if (user.role === "management") current.managers += 1;
      if (user.role === "employee") current.employees += 1;
      if (user.role === "ce_student") current.ce_students += 1;
      if (user.role === "ce_instructor") current.ce_instructors += 1;

      usersByOrganizationId.set(user.org_id, current);
    }

    for (const client of clients) {
      if (!client.org_id) continue;

      const current = clientsByOrganizationId.get(client.org_id) || {
        total_clients: 0,
        active_clients: 0,
        archived_clients: 0,
        job_seekers: 0,
        pre_ets_clients: 0,
        dspd_clients: 0,
        employed_clients: 0,
        customized_employment_clients: 0,
      };

      current.total_clients += 1;

      if (client.is_archived) {
        current.archived_clients += 1;
      } else {
        current.active_clients += 1;
      }

      const clientType = client.client_type || "job_seeker";

      if (clientType === "job_seeker") current.job_seekers += 1;
      if (clientType === "pre_ets") current.pre_ets_clients += 1;
      if (clientType === "dspd") current.dspd_clients += 1;
      if (clientType === "employed") current.employed_clients += 1;
      if (clientType === "customized_employment") {
        current.customized_employment_clients += 1;
      }

      clientsByOrganizationId.set(client.org_id, current);
    }

    const organizationDirectory = organizations
      .map((organization) => ({
        id: organization.id,
        name: getOrganizationName(organization),
        tenant_key: organization.tenant_key || null,
        owner_email: organization.owner_email || null,
        industry: organization.industry || null,
        website: organization.website || null,
        subscription_tier: organization.subscription_tier || null,
        subscription_status: organization.subscription_status || null,
        is_active: organization.is_active !== false,
        max_employees: organization.max_employees ?? null,
        max_clients: organization.max_clients ?? null,
        members: usersByOrganizationId.get(organization.id) || {
          total_members: 0,
          staff_members: 0,
          admins: 0,
          managers: 0,
          employees: 0,
          ce_students: 0,
          ce_instructors: 0,
        },
        clients: clientsByOrganizationId.get(organization.id) || {
          total_clients: 0,
          active_clients: 0,
          archived_clients: 0,
          job_seekers: 0,
          pre_ets_clients: 0,
          dspd_clients: 0,
          employed_clients: 0,
          customized_employment_clients: 0,
        },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const unscopedClients = clients.filter((client) => !client.org_id);
    const unscopedStaffUsers = users.filter(
      (user) => isStaffUser(user) && !user.org_id
    );
    const clientsWithInvalidOrganization = clients.filter(
      (client) =>
        client.org_id && !validOrganizationIds.has(client.org_id)
    );
    const usersWithInvalidOrganization = users.filter(
      (user) =>
        user.org_id && !validOrganizationIds.has(user.org_id)
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
            id: client.id,
            name:
              `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
              "Unnamed client",
            assigned_employee_id: client.assigned_employee_id || null,
          })
        ),
      },
    });
  } catch (error) {
    console.error("getPlatformOrganizationDirectory error:", error.message);

    return Response.json(
      {
        error:
          error.message || "Unable to load the platform organization directory.",
      },
      { status: 500 }
    );
  }
});
