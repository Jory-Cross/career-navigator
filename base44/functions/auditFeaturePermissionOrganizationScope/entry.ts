import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;

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
        { error: "You must be signed in to review feature-permission scope." },
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
    const isPlatformOwner = platformAdminRecords.some(
      (record: any) =>
        isActive(record) &&
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          error:
            "Platform Owner access is required to review feature-permission scope.",
        },
        { status: 403 }
      );
    }

    const [organizations, permissions] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.FeaturePermission.list("-created_date"),
    ]);

    const activeOrganizationIds = new Set(
      organizations
        .filter((organization: any) => isActive(organization))
        .map((organization: any) => normalizeText(organization?.id))
        .filter(Boolean)
    );
    const unscoped = permissions.filter(
      (permission: any) => !normalizeText(permission?.org_id)
    );
    const invalidOrganization = permissions.filter((permission: any) => {
      const organizationId = normalizeText(permission?.org_id);
      return organizationId && !activeOrganizationIds.has(organizationId);
    });

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_permissions: permissions.length,
        correctly_scoped_permissions:
          permissions.length - unscoped.length - invalidOrganization.length,
        unscoped_permissions: unscoped.length,
        permissions_with_invalid_org_id: invalidOrganization.length,
      },
      samples: {
        unscoped_permissions: unscoped.slice(0, SAMPLE_LIMIT).map(
          (permission: any) => ({
            id: normalizeText(permission?.id),
            role: normalizeText(permission?.role),
            feature_key: normalizeText(permission?.feature_key),
            visible: permission?.visible !== false,
            can_interact: permission?.can_interact !== false,
          })
        ),
        permissions_with_invalid_org_id: invalidOrganization
          .slice(0, SAMPLE_LIMIT)
          .map((permission: any) => ({
            id: normalizeText(permission?.id),
            org_id: normalizeText(permission?.org_id),
            role: normalizeText(permission?.role),
            feature_key: normalizeText(permission?.feature_key),
          })),
      },
      instructions:
        "This audit does not change records. Do not assign unscoped permissions to an organization without reviewing the intended organization policy.",
    });
  } catch (error: any) {
    console.error(
      "auditFeaturePermissionOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to review feature-permission organization scope." },
      { status: 500 }
    );
  }
});
