import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const COMOP_TENANT_KEY = "COMOP";

/**
 * bootstrapComopTestStaffMembership
 *
 * Creates an active, non-owner OrganizationMembership for the current
 * Platform Owner inside the COMOP test organization.
 *
 * This is intentionally separate from PlatformAdmin support access and does
 * not grant COMOP ownership, billing control, role-management control, or
 * any new permission keys yet.
 *
 * It does NOT change legacy User.role, User.access_level, or User.org_id.
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
          error: "Deactivated users cannot create test memberships.",
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
            "Only an active Platform Owner may bootstrap the COMOP test-staff membership.",
        },
        { status: 403 }
      );
    }

    const organizationRows =
      await base44.asServiceRole.entities.Organization.filter({
        tenant_key: COMOP_TENANT_KEY,
      });

    const organizations = Array.isArray(organizationRows)
      ? organizationRows
      : [];

    if (organizations.length !== 1) {
      return Response.json(
        {
          ok: false,
          error:
            "COMOP could not be resolved to exactly one Organization record.",
        },
        { status: 409 }
      );
    }

    const organization = organizations[0];

    if (organization.is_active === false) {
      return Response.json(
        {
          ok: false,
          error: "The COMOP Organization is inactive.",
        },
        { status: 403 }
      );
    }

    const existingMembershipRows =
      await base44.asServiceRole.entities.OrganizationMembership.filter({
        organization_id: organization.id,
        user_id: user.id,
      });

    const existingMemberships = Array.isArray(existingMembershipRows)
      ? existingMembershipRows
      : [];

    const existingMembership = existingMemberships[0] || null;

    if (
      existingMembership &&
      existingMembership.is_organization_owner === true
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This user is already marked as the COMOP organization owner. Bootstrap stopped without changing ownership.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    let membership = existingMembership;
    let created = false;
    let reactivated = false;

    if (!membership) {
      membership =
        await base44.asServiceRole.entities.OrganizationMembership.create({
          organization_id: organization.id,
          user_id: user.id,
          membership_status: "active",
          is_organization_owner: false,
          joined_at: now,
        });

      created = true;
    } else if (membership.membership_status !== "active") {
      await base44.asServiceRole.entities.OrganizationMembership.update(
        membership.id,
        {
          membership_status: "active",
          ended_at: undefined,
        }
      );

      membership = {
        ...membership,
        membership_status: "active",
        ended_at: undefined,
      };

      reactivated = true;
    }

    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        organization_id: organization.id,
        platform_admin_user_id: user.id,
        event_key: "comop_test_staff_membership_bootstrapped",
        event_summary:
          "A non-owner test-staff membership was created or reactivated for the Platform Owner within COMOP.",
        actor_type: "platform_admin",
        target_entity: "OrganizationMembership",
        target_record_id: membership.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          tenant_key: COMOP_TENANT_KEY,
          membership_created: created,
          membership_reactivated: reactivated,
          is_organization_owner: false,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "bootstrapComopTestStaffMembership audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      created,
      reactivated,
      audit_logged: auditLogged,
      message:
        "COMOP test-staff membership is active. Legacy access and platform support remain separate.",
      organization: {
        id: organization.id,
        name: organization.name,
        tenant_key: organization.tenant_key,
      },
      membership: {
        id: membership.id,
        membership_status: membership.membership_status,
        is_organization_owner:
          membership.is_organization_owner === true,
      },
    });
  } catch (error) {
    console.error(
      "bootstrapComopTestStaffMembership error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to bootstrap the COMOP test-staff membership.",
      },
      { status: 500 }
    );
  }
});
