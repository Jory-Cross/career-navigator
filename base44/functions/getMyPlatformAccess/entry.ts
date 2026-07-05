import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
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
        { error: "You must be signed in." },
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

    const canonicalAdmin =
      normalizeText(caller?.role).toLowerCase() === "admin" &&
      normalizeText(caller?.access_level).toLowerCase() === "admin";

    if (!canonicalAdmin) {
      return Response.json({
        is_platform_owner: false,
        platform_role: null,
        support_access_enabled: false,
      });
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });

    const activePlatformRecord = (Array.isArray(platformAdminRecords)
      ? platformAdminRecords
      : []
    ).find(
      (record: any) =>
        isActive(record) && normalizeText(record?.user_id) === caller.id
    );

    const platformRole = normalizeText(activePlatformRecord?.platform_role) || null;

    return Response.json({
      is_platform_owner: platformRole === "platform_owner",
      platform_role: platformRole,
      support_access_enabled:
        activePlatformRecord?.support_access_enabled === true,
    });
  } catch (error: any) {
    console.error(
      "getMyPlatformAccess error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to determine platform-level access." },
      { status: 500 }
    );
  }
});