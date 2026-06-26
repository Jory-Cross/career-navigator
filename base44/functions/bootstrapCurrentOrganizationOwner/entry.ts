import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const OWNER_PERMISSION_KEYS = [
  "organization.manage_members",
  "organization.manage_roles",
  "organization.manage_settings",
  "organization.view_billing",
  "organization.view_security_history",
  "ce_training.manage_cohorts",
  "ce_training.manage_trainers",
  "ce_training.manage_students",
  "ce_training.view_all_cohort_clients",
  "ce_practice.manage_clients",
  "client_management.view_all_clients",
];

/**
 * bootstrapCurrentOrganizationOwner
 *
 * Creates the first new-model OrganizationMembership, OrganizationRole,
 * and OrganizationRoleAssignment for the current platform owner inside
 * their existing legacy organization.
 *
 * This function is idempotent:
 * - Reuses an existing active membership when one exists.
 * - Reuses/reactivates the protected organization_owner role.
 * - Reuses/reactivates an existing owner-role assignment.
 *
 * It does NOT modify:
 * - User.role
 * - User.access_level
 * - User.org_id
 * - existing cohorts, clients, subscriptions, or invitations
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
        { ok: false, error: "Deactivated users cannot bootstrap organization ownership." },
        { status: 403 }
      );
    }

    if (user.role !== "admin") {
      return Response.json(
        {
          ok: false,
          error: "Only the current legacy global admin may run this bootstrap.",
        },
        { status: 403 }
      );
    }

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        platform_role: "platform_owner",
        is_active: true,
      });

    const isPlatformOwner = (Array.isArray(platformAdminRows)
      ? platformAdminRows
      : []
    ).some((row) => row?.is_active !== false);

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error: "Current user is not an active platform owner.",
        },
        { status: 403 }
      );
    }

    const organizationId =
      typeof user.org_id === "string" ? user.org_id.trim() : "";

    if (!organizationId) {
      return Response.json(
        {
          ok: false,
          error:
            "Current user has no legacy organization ID. Organization owner bootstrap cannot continue.",
        },
        { status: 400 }
      );
    }

    const organizationRows =
      await base44.asServiceRole.entities.Organization.filter({
        id: organizationId,
      });

    const organization = Array.isArray(organizationRows)
      ? organizationRows[0] || null
      : null;

    if (!organization) {
      return Response.json(
        {
          ok: false,
          error:
            "No Organization record was found for the current user's legacy organization ID.",
        },
        { status: 404 }
      );
    }

    if (organization.is_active === false) {
      return Response.json(
        {
          ok: false,
          error:
            "The current legacy organization is inactive. Organization owner bootstrap cannot continue.",
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    const existingMembershipRows =
      await base44.asServiceRole.entities.OrganizationMembership.filter({
        organization_id: organizationId,
        user_id: user.id,
      });

    const existingMemberships = Array.isArray(existingMembershipRows)
      ? existingMembershipRows
      : [];

    let membership =
      existingMemberships.find(
        (row) => row?.membership_status === "active"
      ) ||
      existingMemberships[0] ||
      null;

    let membershipCreated = false;
    let membershipReactivated = false;

    if (!membership) {
      membership =
        await base44.asServiceRole.entities.OrganizationMembership.create({
          organization_id: organizationId,
          user_id: user.id,
          membership_status: "active",
          is_organization_owner: true,
          joined_at: now,
        });

      membershipCreated = true;
    } else {
      const membershipUpdate = {};

      if (membership.membership_status !== "active") {
        membershipUpdate.membership_status = "active";
        membershipReactivated = true;
      }

      if (membership.is_organization_owner !== true) {
        membershipUpdate.is_organization_owner = true;
      }

      if (!membership.joined_at) {
        membershipUpdate.joined_at = now;
      }

      if (Object.keys(membershipUpdate).length > 0) {
        await base44.asServiceRole.entities.OrganizationMembership.update(
          membership.id,
          membershipUpdate
        );

        membership = {
          ...membership,
          ...membershipUpdate,
        };
      }
    }

    const existingRoleRows =
      await base44.asServiceRole.entities.OrganizationRole.filter({
        organization_id: organizationId,
        role_key: "organization_owner",
      });

    const existingRoles = Array.isArray(existingRoleRows)
      ? existingRoleRows
      : [];

    let ownerRole = existingRoles[0] || null;
    let ownerRoleCreated = false;
    let ownerRoleReactivated = false;

    if (ownerRole && ownerRole.is_system_role !== true) {
      return Response.json(
        {
          ok: false,
          error:
            'A non-system OrganizationRole already uses the protected role_key "organization_owner".',
        },
        { status: 409 }
      );
    }

    if (!ownerRole) {
      ownerRole =
        await base44.asServiceRole.entities.OrganizationRole.create({
          organization_id: organizationId,
          role_key: "organization_owner",
          role_name: "Organization Owner",
          description:
            "Protected tenant owner role created during organization bootstrap.",
          hierarchy_level: 0,
          permission_keys: OWNER_PERMISSION_KEYS,
          is_active: true,
          is_system_role: true,
        });

      ownerRoleCreated = true;
    } else {
      const currentPermissionKeys = Array.isArray(
        ownerRole.permission_keys
      )
        ? ownerRole.permission_keys
        : [];

      const mergedPermissionKeys = Array.from(
        new Set([...currentPermissionKeys, ...OWNER_PERMISSION_KEYS])
      ).sort();

      const roleUpdate = {};

      if (ownerRole.is_active !== true) {
        roleUpdate.is_active = true;
        ownerRoleReactivated = true;
      }

      if (ownerRole.role_name !== "Organization Owner") {
        roleUpdate.role_name = "Organization Owner";
      }

      if (ownerRole.hierarchy_level !== 0) {
        roleUpdate.hierarchy_level = 0;
      }

      if (
        JSON.stringify(currentPermissionKeys.slice().sort()) !==
        JSON.stringify(mergedPermissionKeys)
      ) {
        roleUpdate.permission_keys = mergedPermissionKeys;
      }

      if (Object.keys(roleUpdate).length > 0) {
        await base44.asServiceRole.entities.OrganizationRole.update(
          ownerRole.id,
          roleUpdate
        );

        ownerRole = {
          ...ownerRole,
          ...roleUpdate,
        };
      }
    }

    const existingAssignmentRows =
      await base44.asServiceRole.entities.OrganizationRoleAssignment.filter({
        organization_id: organizationId,
        organization_membership_id: membership.id,
        organization_role_id: ownerRole.id,
      });

    const existingAssignments = Array.isArray(existingAssignmentRows)
      ? existingAssignmentRows
      : [];

    let roleAssignment =
      existingAssignments.find((row) => row?.is_active === true) ||
      existingAssignments[0] ||
      null;

    let roleAssignmentCreated = false;
    let roleAssignmentReactivated = false;

    if (!roleAssignment) {
      roleAssignment =
        await base44.asServiceRole.entities.OrganizationRoleAssignment.create({
          organization_id: organizationId,
          organization_membership_id: membership.id,
          organization_role_id: ownerRole.id,
          is_active: true,
          assigned_at: now,
          assigned_by: user.id,
        });

      roleAssignmentCreated = true;
    } else {
      const assignmentUpdate = {};

      if (roleAssignment.is_active !== true) {
        assignmentUpdate.is_active = true;
        assignmentUpdate.revoked_at = undefined;
        assignmentUpdate.revoked_by = undefined;
        roleAssignmentReactivated = true;
      }

      if (!roleAssignment.assigned_at) {
        assignmentUpdate.assigned_at = now;
      }

      if (!roleAssignment.assigned_by) {
        assignmentUpdate.assigned_by = user.id;
      }

      if (Object.keys(assignmentUpdate).length > 0) {
        await base44.asServiceRole.entities.OrganizationRoleAssignment.update(
          roleAssignment.id,
          assignmentUpdate
        );

        roleAssignment = {
          ...roleAssignment,
          ...assignmentUpdate,
        };
      }
    }

    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        organization_id: organizationId,
        platform_admin_user_id: user.id,
        event_key: "organization_owner_bootstrapped",
        event_summary:
          "The initial organization owner membership and protected owner role were created for the legacy organization.",
        actor_type: "platform_admin",
        target_entity: "OrganizationMembership",
        target_record_id: membership.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          organization_role_id: ownerRole.id,
          organization_role_assignment_id: roleAssignment.id,
          membership_created: membershipCreated,
          membership_reactivated: membershipReactivated,
          owner_role_created: ownerRoleCreated,
          owner_role_reactivated: ownerRoleReactivated,
          role_assignment_created: roleAssignmentCreated,
          role_assignment_reactivated: roleAssignmentReactivated,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "bootstrapCurrentOrganizationOwner audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      audit_logged: auditLogged,
      message:
        "Organization owner bootstrap completed without changing legacy app access.",
      organization: {
        id: organization.id,
        name: organization.name,
      },
      membership: {
        id: membership.id,
        membership_status: membership.membership_status,
        is_organization_owner:
          membership.is_organization_owner === true,
        created: membershipCreated,
        reactivated: membershipReactivated,
      },
      organization_role: {
        id: ownerRole.id,
        role_key: ownerRole.role_key,
        role_name: ownerRole.role_name,
        created: ownerRoleCreated,
        reactivated: ownerRoleReactivated,
      },
      role_assignment: {
        id: roleAssignment.id,
        is_active: roleAssignment.is_active === true,
        created: roleAssignmentCreated,
        reactivated: roleAssignmentReactivated,
      },
    });
  } catch (error) {
    console.error(
      "bootstrapCurrentOrganizationOwner error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to bootstrap the current organization owner.",
      },
      { status: 500 }
    );
  }
});
