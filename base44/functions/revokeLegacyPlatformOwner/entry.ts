import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const AUTHORIZED_OWNER_EMAIL = "admin@ability4hire.com";
const LEGACY_OWNER_EMAIL = "arbranger@gmail.com";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (normalizeEmail(currentUser.email) !== AUTHORIZED_OWNER_EMAIL) {
      return Response.json(
        { error: "Only admin@ability4hire.com can run this repair." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;

    const [allUsers, allPlatformAdminRecords] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.PlatformAdmin.list(),
    ]);

    const legacyUser = allUsers.find(
      (user) => normalizeEmail(user.email) === LEGACY_OWNER_EMAIL
    );

    if (!legacyUser) {
      return Response.json(
        { error: `No User record exists for ${LEGACY_OWNER_EMAIL}.` },
        { status: 404 }
      );
    }

    const recordsToDeactivate = allPlatformAdminRecords.filter(
      (record) =>
        record.user_id === legacyUser.id &&
        record.is_active !== false
    );

    const preview = {
      preview_only: !apply,
      legacy_user: {
        id: legacyUser.id,
        email: legacyUser.email,
      },
      platform_admin_records_to_deactivate: recordsToDeactivate.map(
        (record) => ({
          id: record.id,
          platform_role: record.platform_role || null,
          is_active: record.is_active !== false,
          support_access_enabled: record.support_access_enabled === true,
        })
      ),
      count: recordsToDeactivate.length,
    };

    if (!apply) {
      return Response.json(preview);
    }

    const results = [];

    for (const record of recordsToDeactivate) {
      try {
        await base44.asServiceRole.entities.PlatformAdmin.update(record.id, {
          is_active: false,
          support_access_enabled: false,
        });

        results.push({ id: record.id, success: true });
      } catch (error) {
        results.push({
          id: record.id,
          success: false,
          error: error.message || "Unknown update error",
        });
      }
    }

    return Response.json({
      ...preview,
      preview_only: false,
      repair_complete: true,
      deactivated: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success),
    });
  } catch (error) {
    console.error("revokeLegacyPlatformOwner error:", error.message);

    return Response.json(
      { error: error.message || "Unable to revoke legacy Platform Owner access." },
      { status: 500 }
    );
  }
});
