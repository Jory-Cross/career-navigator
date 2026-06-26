import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const COMOP_TENANT_KEY = "COMOP";
const COMOP_OWNER_EMAIL = "shannon.wilkins@comop.org";

/**
 * bootstrapComopOrganization
 *
 * Creates the first canonical Organization record for the legacy COMOP tenant.
 *
 * Safety rules:
 * - Requires the current active Platform Owner and legacy global admin.
 * - Creates an Organization only when no Organization already uses tenant_key=COMOP.
 * - Refuses to proceed if more than one Organization uses tenant_key=COMOP.
 * - Does not create memberships, roles, subscriptions, cohorts, clients, or
 *   change any legacy User fields.
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
        {
          ok: false,
          error: "Deactivated users cannot bootstrap an organization.",
        },
        { status: 403 }
      );
    }

    if (user.role !== "admin") {
      return Response.json(
        {
          ok: false,
          error:
            "Only the current legacy global admin may bootstrap the COMOP organization.",
        },
        { status: 403 }
      );
    }

    const platformOwnerRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        platform_role: "platform_owner",
        is_active: true,
      });

    const isPlatformOwner = (Array.isArray(platformOwnerRows)
      ? platformOwnerRows
      : []
    ).some((row) => row?.is_active !== false);

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may bootstrap the COMOP organization.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.Organization.filter({
        tenant_key: COMOP_TENANT_KEY,
      });

    const matchingOrganizations = Array.isArray(existingRows)
      ? existingRows
      : [];

    if (matchingOrganizations.length > 1) {
      return Response.json(
        {
          ok: false,
          error:
            "More than one Organization record uses tenant_key COMOP. Bootstrap stopped to prevent an incorrect tenant mapping.",
        },
        { status: 409 }
      );
    }

    if (matchingOrganizations.length === 1) {
      const organization = matchingOrganizations[0];
      const existingOwnerEmail = String(
        organization.owner_email || ""
      ).toLowerCase();

      if (
        existingOwnerEmail &&
        existingOwnerEmail !== COMOP_OWNER_EMAIL.toLowerCase()
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "An Organization already uses tenant_key COMOP but has a different owner_email. Bootstrap stopped without changing that record.",
          },
          { status: 409 }
        );
      }

      return Response.json({
        ok: true,
        created: false,
        message:
          "COMOP Organization already exists. No changes were made.",
        organization: {
          id: organization.id,
          name: organization.name,
          tenant_key: organization.tenant_key,
          owner_email: organization.owner_email,
        },
      });
    }

    const organization =
      await base44.asServiceRole.entities.Organization.create({
        name: "COMOP",
        tenant_key: COMOP_TENANT_KEY,
        owner_email: COMOP_OWNER_EMAIL,
        is_active: true,
      });

    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        organization_id: organization.id,
        platform_admin_user_id: user.id,
        event_key: "organization_bootstrapped",
        event_summary:
          "The canonical Organization record for the COMOP legacy tenant was created.",
        actor_type: "platform_admin",
        target_entity: "Organization",
        target_record_id: organization.id,
        tenant_visible: false,
        occurred_at: new Date().toISOString(),
        details: {
          tenant_key: COMOP_TENANT_KEY,
          owner_email: COMOP_OWNER_EMAIL,
          bootstrap_version: "v1",
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "bootstrapComopOrganization audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      created: true,
      audit_logged: auditLogged,
      message:
        "COMOP Organization was created without changing legacy app access.",
      organization: {
        id: organization.id,
        name: organization.name,
        tenant_key: organization.tenant_key,
        owner_email: organization.owner_email,
      },
    });
  } catch (error) {
    console.error(
      "bootstrapComopOrganization error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to bootstrap the COMOP organization.",
      },
      { status: 500 }
    );
  }
});
