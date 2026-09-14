import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function normalizeText(value) {
  return String(value ?? "").trim();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me().catch(() => null);

    if (!currentUser?.id) {
      return Response.json(
        { ok: false, error: "Please sign in first." },
        { status: 401 }
      );
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: currentUser.id,
      });

    const isPlatformOwner = platformAdminRecords.some(
      (record) =>
        normalizeText(record?.platform_role) === "platform_owner" &&
        record?.is_active !== false
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error: "Platform Owner access is required to view all accounts.",
        },
        { status: 403 }
      );
    }

    const [users, organizations] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Organization.list(),
    ]);

    const orgNameById = new Map(
      organizations.map((organization) => [
        organization.id,
        organization.name ||
          organization.tenant_key ||
          "Unnamed organization",
      ])
    );

    const activeUsers = users
      .filter(
        (user) =>
          user &&
          user.is_active !== false &&
          user.is_archived !== true &&
          normalizeText(user.id)
      )
      .map((user) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        access_level: user.access_level || null,
        org_id: user.org_id || null,
        org_name: user.org_id ? orgNameById.get(user.org_id) || null : null,
      }));

    return Response.json({
      ok: true,
      users: activeUsers,
    });
  } catch (error) {
    console.error(
      "[getViewAsUsers] Unexpected error:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { ok: false, error: "The view-as directory could not be loaded." },
      { status: 500 }
    );
  }
}