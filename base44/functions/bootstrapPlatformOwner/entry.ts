import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

/**
 * bootstrapPlatformOwner
 *
 * One-time setup for the first internal platform owner.
 *
 * Safety rules:
 * - Requires the current legacy global admin role.
 * - Refuses to run after any active platform owner already exists.
 * - Creates only one PlatformAdmin record for the authenticated user.
 * - Does not change User.role, User.access_level, User.org_id,
 *   organizations, subscriptions, memberships, cohorts, or clients.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.is_active === false) {
      return Response.json(
        { ok: false, error: "Deactivated users cannot bootstrap platform access." },
        { status: 403 }
      );
    }

    if (user.role !== "admin") {
      return Response.json(
        {
          ok: false,
          error:
            "Only the current legacy global admin may bootstrap the first platform owner.",
        },
        { status: 403 }
      );
    }

    const activeOwnerRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        platform_role: "platform_owner",
        is_active: true,
      });

    const activeOwners = Array.isArray(activeOwnerRows)
      ? activeOwnerRows.filter((row) => row?.is_active !== false)
      : [];

    if (activeOwners.length > 0) {
      const existingOwnerForCurrentUser = activeOwners.find(
        (row) => row.user_id === user.id
      );

      if (existingOwnerForCurrentUser) {
        return Response.json({
          ok: true,
          already_initialized: true,
          platform_admin_id: existingOwnerForCurrentUser.id,
          message: "This user is already the active platform owner.",
        });
      }

      return Response.json(
        {
          ok: false,
          error:
            "An active platform owner already exists. This bootstrap function cannot create a second owner.",
        },
        { status: 409 }
      );
    }

    const existingAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
      });

    const existingPlatformAdmin = (Array.isArray(existingAdminRows)
      ? existingAdminRows
      : []
    ).find((row) => row?.is_active !== false);

    if (existingPlatformAdmin) {
      return Response.json(
        {
          ok: false,
          error:
            "This user already has a PlatformAdmin record but is not the platform owner. Bootstrap cannot change an existing platform role.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const platformAdmin =
      await base44.asServiceRole.entities.PlatformAdmin.create({
        user_id: user.id,
        platform_role: "platform_owner",
        is_active: true,
        support_access_enabled: true,
      });

    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: user.id,
        event_key: "platform_owner_bootstrapped",
        event_summary:
          "Initial platform owner account was created through the protected bootstrap workflow.",
        actor_type: "platform_admin",
        target_entity: "PlatformAdmin",
        target_record_id: platformAdmin.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          bootstrap_version: "v1",
          actor_email: user.email || null,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "bootstrapPlatformOwner audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      already_initialized: false,
      audit_logged: auditLogged,
      platform_admin: {
        id: platformAdmin.id,
        user_id: platformAdmin.user_id,
        platform_role: platformAdmin.platform_role,
        support_access_enabled:
          platformAdmin.support_access_enabled === true,
      },
      message: "Platform owner bootstrapped successfully.",
    });
  } catch (error) {
    console.error(
      "bootstrapPlatformOwner error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to bootstrap the platform owner.",
      },
      { status: 500 }
    );
  }
});
