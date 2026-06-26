import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

/**
 * resolveOrganizationAccess
 *
 * Read-only authorization resolver for the new multi-tenant architecture.
 *
 * This function does NOT replace legacy User.role / User.access_level yet.
 * It allows the app to safely inspect the new tenant model while all current
 * staff, client portal, Pre-ETS, and CE Training Portal access continues
 * operating through the existing compatibility bridge.
 *
 * Optional request body:
 * {
 *   organization_id?: string
 * }
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

    const body = await req.json().catch(() => ({}));
    const requestedOrganizationId =
      typeof body?.organization_id === "string" &&
      body.organization_id.trim()
        ? body.organization_id.trim()
        : null;

    const now = Date.now();

    const [
      platformAdminRows,
      membershipRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        is_active: true,
      }),
      base44.asServiceRole.entities.OrganizationMembership.filter({
        user_id: user.id,
        membership_status: "active",
      }),
    ]);

    const activePlatformAdmins = Array.isArray(platformAdminRows)
      ? platformAdminRows.filter((row) => row?.is_active !== false)
      : [];

    const activeMemberships = Array.isArray(membershipRows)
      ? membershipRows.filter(
          (row) =>
            row?.membership_status === "active" &&
            Boolean(row?.organization_id)
        )
      : [];

    const membershipOrganizationIds = Array.from(
      new Set(activeMemberships.map((row) => row.organization_id))
    );

    let resolvedOrganizationId = requestedOrganizationId;

    if (!resolvedOrganizationId && user.org_id) {
      const legacyOrganizationMembership = activeMemberships.find(
        (row) => row.organization_id === user.org_id
      );

      if (legacyOrganizationMembership) {
        resolvedOrganizationId = user.org_id;
      }
    }

    if (!resolvedOrganizationId && membershipOrganizationIds.length === 1) {
      resolvedOrganizationId = membershipOrganizationIds[0];
    }

    const activePlatformRoles = activePlatformAdmins
      .map((row) => row.platform_role)
      .filter(Boolean);

    const supportEnabled = activePlatformAdmins.some(
      (row) => row.support_access_enabled === true
    );

    const membershipForResolvedOrganization = resolvedOrganizationId
      ? activeMemberships.find(
          (row) => row.organization_id === resolvedOrganizationId
        ) || null
      : null;

    let activeSupportSession = null;

    if (
      resolvedOrganizationId &&
      activePlatformAdmins.length > 0 &&
      supportEnabled
    ) {
      const supportSessions =
        await base44.asServiceRole.entities.SupportAccessSession.filter({
          organization_id: resolvedOrganizationId,
          platform_admin_user_id: user.id,
          status: "active",
        });

      activeSupportSession = (Array.isArray(supportSessions)
        ? supportSessions
        : []
      ).find((session) => {
        const expiresAt = new Date(session?.expires_at || 0).getTime();
        return Number.isFinite(expiresAt) && expiresAt > now;
      }) || null;
    }

    let organization = null;
    let roleAssignments = [];
    let roles = [];
    let permissionKeys = [];
    let entitlements = [];
    let subscription = null;

    if (resolvedOrganizationId) {
      const [
        organizationRows,
        roleAssignmentRows,
        roleRows,
        entitlementRows,
        subscriptionRows,
      ] = await Promise.all([
        base44.asServiceRole.entities.Organization.filter({
          id: resolvedOrganizationId,
        }),
        membershipForResolvedOrganization
          ? base44.asServiceRole.entities.OrganizationRoleAssignment.filter({
              organization_id: resolvedOrganizationId,
              organization_membership_id:
                membershipForResolvedOrganization.id,
              is_active: true,
            })
          : Promise.resolve([]),
        base44.asServiceRole.entities.OrganizationRole.filter({
          organization_id: resolvedOrganizationId,
          is_active: true,
        }),
        base44.asServiceRole.entities.OrganizationFeatureEntitlement.filter({
          organization_id: resolvedOrganizationId,
          is_enabled: true,
        }),
        base44.asServiceRole.entities.OrganizationPlanSubscription.filter({
          organization_id: resolvedOrganizationId,
          is_current: true,
        }),
      ]);

      organization = Array.isArray(organizationRows)
        ? organizationRows[0] || null
        : null;

      roleAssignments = Array.isArray(roleAssignmentRows)
        ? roleAssignmentRows.filter((row) => row?.is_active !== false)
        : [];

      const activeRoles = Array.isArray(roleRows)
        ? roleRows.filter(
            (row) =>
              row?.is_active !== false &&
              Boolean(row?.id)
          )
        : [];

      const assignedRoleIds = new Set(
        roleAssignments
          .map((row) => row.organization_role_id)
          .filter(Boolean)
      );

      roles = activeRoles
        .filter((role) => assignedRoleIds.has(role.id))
        .map((role) => ({
          id: role.id,
          role_key: role.role_key,
          role_name: role.role_name,
          hierarchy_level: role.hierarchy_level,
          permission_keys: Array.isArray(role.permission_keys)
            ? role.permission_keys
            : [],
          is_system_role: role.is_system_role === true,
        }));

      permissionKeys = Array.from(
        new Set(
          roles.flatMap((role) =>
            Array.isArray(role.permission_keys)
              ? role.permission_keys
              : []
          )
        )
      ).sort();

      entitlements = (Array.isArray(entitlementRows)
        ? entitlementRows
        : []
      )
        .filter((row) => row?.is_enabled === true)
        .map((row) => ({
          feature_key: row.feature_key,
          is_enabled: row.is_enabled === true,
          limit_value: row.limit_value ?? null,
          entitlement_source: row.entitlement_source,
          starts_at: row.starts_at || null,
          ends_at: row.ends_at || null,
        }));

      const currentSubscriptions = Array.isArray(subscriptionRows)
        ? subscriptionRows.filter((row) => row?.is_current === true)
        : [];

      subscription =
        currentSubscriptions.find((row) => row.subscription_status === "active") ||
        currentSubscriptions.find((row) => row.subscription_status === "trialing") ||
        currentSubscriptions[0] ||
        null;
    }

    const hasMembershipAccess = Boolean(membershipForResolvedOrganization);
    const hasSupportAccess = Boolean(activeSupportSession);

    return Response.json({
      ok: true,
      legacy_access: {
        role: user.role || null,
        access_level: user.access_level || null,
        org_id: user.org_id || null,
        is_active: user.is_active !== false,
      },
      platform_access: {
        is_platform_admin: activePlatformAdmins.length > 0,
        platform_roles: activePlatformRoles,
        support_access_enabled: supportEnabled,
      },
      organization_selector: {
        requested_organization_id: requestedOrganizationId,
        resolved_organization_id: resolvedOrganizationId,
        available_organization_ids: membershipOrganizationIds,
      },
      organization_access: {
        has_access: hasMembershipAccess || hasSupportAccess,
        access_source: hasMembershipAccess
          ? "organization_membership"
          : hasSupportAccess
            ? "support_session"
            : "none",
        organization: organization
          ? {
              id: organization.id,
              name: organization.name,
              is_active: organization.is_active !== false,
            }
          : null,
        membership: membershipForResolvedOrganization
          ? {
              id: membershipForResolvedOrganization.id,
              membership_status:
                membershipForResolvedOrganization.membership_status,
              is_organization_owner:
                membershipForResolvedOrganization.is_organization_owner === true,
            }
          : null,
        roles,
        permission_keys: permissionKeys,
        entitlements,
        subscription: subscription
          ? {
              id: subscription.id,
              platform_plan_id: subscription.platform_plan_id,
              subscription_status: subscription.subscription_status,
              billing_interval: subscription.billing_interval,
              current_period_ends_at:
                subscription.current_period_ends_at || null,
              ends_at: subscription.ends_at || null,
            }
          : null,
        support_session: activeSupportSession
          ? {
              id: activeSupportSession.id,
              access_mode: activeSupportSession.access_mode,
              expires_at: activeSupportSession.expires_at,
              reason: activeSupportSession.reason,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(
      "resolveOrganizationAccess error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to resolve organization access.",
      },
      { status: 500 }
    );
  }
});
