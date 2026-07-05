import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function isActiveMembership(record: any) {
  return (
    record?.membership_status === "active" &&
    record?.is_active !== false &&
    record?.is_archived !== true &&
    Boolean(normalizeText(record?.organization_id))
  );
}

function isActivePlatformAdmin(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const canonicalUser = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!canonicalUser || !isActive(canonicalUser)) {
      return Response.json(
        { ok: false, error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedOrganizationId = normalizeText(body?.organization_id);
    const now = Date.now();

    const [platformAdminRows, membershipRows] = await Promise.all([
      base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: canonicalUser.id,
      }),
      base44.asServiceRole.entities.OrganizationMembership.filter({
        user_id: canonicalUser.id,
        membership_status: "active",
      }),
    ]);

    const activePlatformAdmins = asArray(platformAdminRows).filter(
      isActivePlatformAdmin
    );
    const activeMemberships = asArray(membershipRows).filter(
      isActiveMembership
    );
    const membershipByOrganizationId = new Map(
      activeMemberships.map((membership: any) => [
        normalizeText(membership.organization_id),
        membership,
      ])
    );
    const membershipOrganizationIds = [...membershipByOrganizationId.keys()]
      .filter(Boolean)
      .sort();

    let resolvedOrganizationId = "";
    let membershipForResolvedOrganization: any = null;
    let activeSupportSession: any = null;

    const canonicalLegacyOrganizationId = normalizeText(canonicalUser.org_id);

    if (requestedOrganizationId) {
      membershipForResolvedOrganization =
        membershipByOrganizationId.get(requestedOrganizationId) || null;

      if (membershipForResolvedOrganization) {
        resolvedOrganizationId = requestedOrganizationId;
      } else {
        const mayUseSupport =
          getCanonicalStaffRole(canonicalUser) === "admin" &&
          activePlatformAdmins.some(
            (record: any) => record?.support_access_enabled === true
          );

        if (mayUseSupport) {
          const supportSessions =
            await base44.asServiceRole.entities.SupportAccessSession.filter({
              organization_id: requestedOrganizationId,
              platform_admin_user_id: canonicalUser.id,
              status: "active",
            });

          activeSupportSession = asArray(supportSessions).find(
            (session: any) => {
              const expiresAt = new Date(session?.expires_at || 0).getTime();
              return (
                session?.status === "active" &&
                session?.is_archived !== true &&
                Number.isFinite(expiresAt) &&
                expiresAt > now
              );
            }
          ) || null;

          if (activeSupportSession) {
            resolvedOrganizationId = requestedOrganizationId;
          }
        }
      }
    } else if (
      canonicalLegacyOrganizationId &&
      membershipByOrganizationId.has(canonicalLegacyOrganizationId)
    ) {
      resolvedOrganizationId = canonicalLegacyOrganizationId;
      membershipForResolvedOrganization =
        membershipByOrganizationId.get(canonicalLegacyOrganizationId) || null;
    } else if (membershipOrganizationIds.length === 1) {
      resolvedOrganizationId = membershipOrganizationIds[0];
      membershipForResolvedOrganization =
        membershipByOrganizationId.get(resolvedOrganizationId) || null;
    }

    if (requestedOrganizationId && !resolvedOrganizationId) {
      return Response.json(
        {
          ok: false,
          error:
            "You do not have active access to the requested organization.",
        },
        { status: 403 }
      );
    }

    let organization: any = null;
    let roles: any[] = [];
    let permissionKeys: string[] = [];
    let entitlements: any[] = [];
    let subscription: any = null;

    if (resolvedOrganizationId) {
      const organizationRecord =
        await base44.asServiceRole.entities.Organization.get(
          resolvedOrganizationId
        ).catch(() => null);

      if (!organizationRecord || !isActive(organizationRecord)) {
        return Response.json(
          {
            ok: false,
            error: "The requested organization is inactive or unavailable.",
          },
          { status: 403 }
        );
      }

      organization = organizationRecord;

      const [roleAssignmentRows, roleRows, entitlementRows, subscriptionRows] =
        await Promise.all([
          membershipForResolvedOrganization
            ? base44.asServiceRole.entities.OrganizationRoleAssignment.filter({
                organization_id: resolvedOrganizationId,
                organization_membership_id: membershipForResolvedOrganization.id,
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

      const activeRoleAssignments = asArray(roleAssignmentRows).filter(
        (assignment: any) =>
          assignment?.is_active !== false &&
          assignment?.is_archived !== true
      );
      const assignedRoleIds = new Set(
        activeRoleAssignments
          .map((assignment: any) => normalizeText(assignment?.organization_role_id))
          .filter(Boolean)
      );

      roles = asArray(roleRows)
        .filter(
          (role: any) =>
            role?.is_active !== false &&
            role?.is_archived !== true &&
            assignedRoleIds.has(normalizeText(role?.id))
        )
        .map((role: any) => ({
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
            Array.isArray(role.permission_keys) ? role.permission_keys : []
          )
        )
      ).sort();

      entitlements = asArray(entitlementRows)
        .filter(
          (entitlement: any) =>
            entitlement?.is_enabled === true &&
            entitlement?.is_archived !== true
        )
        .map((entitlement: any) => ({
          feature_key: entitlement.feature_key,
          is_enabled: true,
          limit_value: entitlement.limit_value ?? null,
          entitlement_source: entitlement.entitlement_source,
          starts_at: entitlement.starts_at || null,
          ends_at: entitlement.ends_at || null,
        }));

      const currentSubscriptions = asArray(subscriptionRows).filter(
        (row: any) => row?.is_current === true && row?.is_archived !== true
      );
      subscription =
        currentSubscriptions.find(
          (row: any) => row.subscription_status === "active"
        ) ||
        currentSubscriptions.find(
          (row: any) => row.subscription_status === "trialing"
        ) ||
        currentSubscriptions[0] ||
        null;
    }

    const activePlatformRoles = activePlatformAdmins
      .map((record: any) => normalizeText(record?.platform_role))
      .filter(Boolean);
    const supportEnabled = activePlatformAdmins.some(
      (record: any) => record?.support_access_enabled === true
    );
    const hasMembershipAccess = Boolean(membershipForResolvedOrganization);
    const hasSupportAccess = Boolean(activeSupportSession);

    return Response.json({
      ok: true,
      legacy_access: {
        role: canonicalUser.role || null,
        access_level: canonicalUser.access_level || null,
        org_id: canonicalUser.org_id || null,
        is_active: canonicalUser.is_active !== false,
      },
      platform_access: {
        is_platform_admin: activePlatformAdmins.length > 0,
        platform_roles: activePlatformRoles,
        support_access_enabled: supportEnabled,
      },
      organization_selector: {
        requested_organization_id: requestedOrganizationId || null,
        resolved_organization_id: resolvedOrganizationId || null,
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
              membership_status: membershipForResolvedOrganization.membership_status,
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
  } catch (error: any) {
    console.error(
      "resolveOrganizationAccess error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to resolve organization access.",
      },
      { status: 500 }
    );
  }
});