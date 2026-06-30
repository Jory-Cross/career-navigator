import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";

function isStaffUser(user: any) {
  return ["admin", "management", "employee"].includes(user?.role);
}

function getClientName(client: any) {
  return (
    `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
    "Unnamed client"
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.list();

    const platformOwnerRecord = platformAdminRecords.find(
      (record: any) =>
        record.user_id === currentUser.id &&
        record.platform_role === PLATFORM_OWNER_ROLE &&
        record.is_active !== false
    );

    if (!platformOwnerRecord) {
      return Response.json(
        {
          error:
            "Platform Owner access is required to inspect platform data health.",
        },
        { status: 403 }
      );
    }

    const [organizations, users, clients] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list("-created_date"),
    ]);

    const validOrganizationIds = new Set(
      organizations.map((organization: any) => organization.id)
    );

    const usersById = new Map(
      users.map((user: any) => [user.id, user])
    );

    const unscopedClients = clients
      .filter((client: any) => !client.org_id)
      .map((client: any) => {
        const assignedEmployee = usersById.get(client.assigned_employee_id);

        return {
          id: client.id,
          name: getClientName(client),
          client_type: client.client_type || "job_seeker",
          is_archived: client.is_archived === true,
          current_org_id: null,
          assigned_employee_id: client.assigned_employee_id || null,
          assigned_employee_email: assignedEmployee?.email || null,
          created_by: client.created_by || null,
        };
      });

    const clientsWithInvalidOrganization = clients
      .filter(
        (client: any) =>
          client.org_id &&
          !validOrganizationIds.has(client.org_id)
      )
      .map((client: any) => {
        const assignedEmployee = usersById.get(client.assigned_employee_id);

        return {
          id: client.id,
          name: getClientName(client),
          client_type: client.client_type || "job_seeker",
          is_archived: client.is_archived === true,
          current_org_id: client.org_id,
          assigned_employee_id: client.assigned_employee_id || null,
          assigned_employee_email: assignedEmployee?.email || null,
          created_by: client.created_by || null,
        };
      });

    const unscopedStaffUsers = users
      .filter((user: any) => isStaffUser(user) && !user.org_id)
      .map((user: any) => ({
        id: user.id,
        email: user.email || null,
        full_name: user.full_name || null,
        role: user.role || null,
        access_level: user.access_level || null,
        current_org_id: null,
      }));

    const usersWithInvalidOrganization = users
      .filter(
        (user: any) =>
          user.org_id &&
          !validOrganizationIds.has(user.org_id)
      )
      .map((user: any) => ({
        id: user.id,
        email: user.email || null,
        full_name: user.full_name || null,
        role: user.role || null,
        access_level: user.access_level || null,
        current_org_id: user.org_id,
      }));

    return Response.json({
      generated_at: new Date().toISOString(),
      counts: {
        unscoped_clients: unscopedClients.length,
        clients_with_invalid_org_id: clientsWithInvalidOrganization.length,
        unscoped_staff_users: unscopedStaffUsers.length,
        users_with_invalid_org_id: usersWithInvalidOrganization.length,
      },
      unscoped_clients: unscopedClients,
      clients_with_invalid_org_id: clientsWithInvalidOrganization,
      unscoped_staff_users: unscopedStaffUsers,
      users_with_invalid_org_id: usersWithInvalidOrganization,
    });
  } catch (error) {
    console.error("getPlatformDataHealthDetails error:", error.message);

    return Response.json(
      {
        error:
          error.message ||
          "Unable to load platform data-health details.",
      },
      { status: 500 }
    );
  }
});
