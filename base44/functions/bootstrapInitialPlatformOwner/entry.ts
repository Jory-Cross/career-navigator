import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_EMAIL = "admin@ability4hire.com";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function callerCanBootstrap(user) {
  return user?.role === "admin" || user?.access_level === "admin";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!callerCanBootstrap(caller)) {
      return Response.json(
        { error: "Only an existing administrator can bootstrap the platform owner." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;

    const allUsers = await base44.asServiceRole.entities.User.list();
    const ownerUser = allUsers.find(
      (user) => normalizeEmail(user.email) === PLATFORM_OWNER_EMAIL
    );

    if (!ownerUser) {
      return Response.json(
        {
          error: `No User record exists for ${PLATFORM_OWNER_EMAIL}.`,
          next_step:
            "Sign in to the app once with admin@ability4hire.com, then run this function again.",
        },
        { status: 404 }
      );
    }

    const existingRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: ownerUser.id,
      });

    const existingPlatformAdmin = existingRecords?.[0] || null;

    const preview = {
      preview_only: !apply,
      target_user: {
        id: ownerUser.id,
        email: ownerUser.email,
        current_role: ownerUser.role || null,
        current_access_level: ownerUser.access_level || null,
        required_role: "admin",
        required_access_level: "admin",
      },
      platform_admin: {
        exists: Boolean(existingPlatformAdmin),
        current_platform_role: existingPlatformAdmin?.platform_role || null,
        required_platform_role: "platform_owner",
        required_is_active: true,
        support_access_enabled: false,
      },
    };

    if (!apply) {
      return Response.json(preview);
    }

    await base44.asServiceRole.entities.User.update(ownerUser.id, {
      role: "admin",
      access_level: "admin",
    });

    let platformAdminResult;

    if (existingPlatformAdmin) {
      platformAdminResult =
        await base44.asServiceRole.entities.PlatformAdmin.update(
          existingPlatformAdmin.id,
          {
            platform_role: "platform_owner",
            is_active: true,
            support_access_enabled: false,
          }
        );
    } else {
      platformAdminResult =
        await base44.asServiceRole.entities.PlatformAdmin.create({
          user_id: ownerUser.id,
          platform_role: "platform_owner",
          is_active: true,
          support_access_enabled: false,
        });
    }

    return Response.json({
      ...preview,
      preview_only: false,
      bootstrap_complete: true,
      platform_admin_id: platformAdminResult.id,
      message:
        "admin@ability4hire.com is now the active Platform Owner. Sign out and back in with that account before testing platform-owner pages.",
    });
  } catch (error) {
    console.error("bootstrapInitialPlatformOwner error:", error.message);

    return Response.json(
      { error: error.message || "Unable to bootstrap the platform owner." },
      { status: 500 }
    );
  }
});
