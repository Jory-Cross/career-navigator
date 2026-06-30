import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

  const allPlatformAdminRecords =
  await base44.asServiceRole.entities.PlatformAdmin.list();

const activePlatformRecord = allPlatformAdminRecords.find(
  (record) =>
    record.user_id === currentUser.id &&
    record.is_active !== false
);

    const platformRole = activePlatformRecord?.platform_role || null;

    return Response.json({
      is_platform_owner: platformRole === "platform_owner",
      platform_role: platformRole,
      support_access_enabled:
        activePlatformRecord?.support_access_enabled === true,
    });
  } catch (error) {
    console.error("getMyPlatformAccess error:", error.message);

    return Response.json(
      {
        error:
          error.message ||
          "Unable to determine platform-level access.",
      },
      { status: 500 }
    );
  }
});
