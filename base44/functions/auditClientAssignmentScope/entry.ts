import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";
const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function getClientName(client: any) {
  return (
    `${normalizeText(client?.first_name)} ${normalizeText(client?.last_name)}`.trim() ||
    "Unnamed client"
  );
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in to audit client assignments." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { ok: false, error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    if (getCanonicalStaffRole(caller) !== "admin") {
      return Response.json(
        {
          ok: false,
          error:
            "Canonical administrator access is required to audit client assignments.",
        },
        { status: 403 }
      );
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });
    const isPlatformOwner = (Array.isArray(platformAdminRecords)
      ? platformAdminRecords
      : []
    ).some(
      (record: any) =>
        isActive(record) &&
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may audit client assignment scope.",
        },
        { status: 403 }
      );
    }

    const [organizations, users, clients] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list("-created_date"),
    ]);

    const activeOrganizationIds = new Set(
      (Array.isArray(organizations) ? organizations : [])
        .filter((organization: any) => isActive(organization))
        .map((organization: any) => normalizeText(organization?.id))
        .filter(Boolean)
    );

    const usersById = new Map(
      (Array.isArray(users) ? users : [])
        .map((user: any) => [normalizeText(user?.id), user])
        .filter(([userId]) => Boolean(userId))
    );

    const usersByOrgAndEmail = new Map<string, any[]>();
    for (const user of Array.isArray(users) ? users : []) {
      const organizationId = normalizeText(user?.org_id);
      const email = normalizeEmail(user?.email);
      if (!organizationId || !email) continue;

      const key = `${organizationId}::${email}`;
      const rows = usersByOrgAndEmail.get(key) || [];
      rows.push(user);
      usersByOrgAndEmail.set(key, rows);
    }

    const rows = (Array.isArray(clients) ? clients : []).map((client: any) => {
      const clientId = normalizeText(client?.id);
      const organizationId = normalizeText(client?.org_id);
      const assignedValue = normalizeText(client?.assigned_employee_id);
      const archived = client?.is_archived === true;

      let disposition = "valid_canonical_assignment";
      let suggestedUserId: string | null = null;
      let suggestedUserEmail: string | null = null;

      if (!organizationId) {
        disposition = "client_missing_org_id";
      } else if (!activeOrganizationIds.has(organizationId)) {
        disposition = "client_org_invalid_or_inactive";
      } else if (!assignedValue) {
        disposition = "unassigned";
      } else {
        const assignedUser = usersById.get(assignedValue) || null;

        if (assignedUser) {
          if (
            !isActive(assignedUser) ||
            normalizeText(assignedUser?.org_id) !== organizationId ||
            !getCanonicalStaffRole(assignedUser)
          ) {
            disposition = "assigned_user_invalid_or_cross_org";
          }
        } else if (isEmailLike(assignedValue)) {
          const candidates = (usersByOrgAndEmail.get(
            `${organizationId}::${normalizeEmail(assignedValue)}`
          ) || []).filter(
            (user: any) => isActive(user) && Boolean(getCanonicalStaffRole(user))
          );

          if (candidates.length === 1) {
            disposition = "legacy_email_resolvable";
            suggestedUserId = normalizeText(candidates[0]?.id) || null;
            suggestedUserEmail = normalizeEmail(candidates[0]?.email) || null;
          } else if (candidates.length > 1) {
            disposition = "legacy_email_ambiguous";
          } else {
            disposition = "legacy_email_unresolvable";
          }
        } else {
          disposition = "assigned_user_missing";
        }
      }

      return {
        client_id: clientId || null,
        client_name: getClientName(client),
        org_id: organizationId || null,
        client_type: normalizeText(client?.client_type) || "job_seeker",
        is_archived: archived,
        assigned_employee_id: assignedValue || null,
        disposition,
        suggested_user_id: suggestedUserId,
        suggested_user_email: suggestedUserEmail,
      };
    });

    const count = (disposition: string) =>
      rows.filter((row: any) => row.disposition === disposition).length;

    return Response.json({
      ok: true,
      read_only: true,
      audit_scope: "Client.assigned_employee_id",
      generated_at: new Date().toISOString(),
      summary: {
        total_clients: rows.length,
        active_clients: rows.filter((row: any) => !row.is_archived).length,
        valid_canonical_assignment: count("valid_canonical_assignment"),
        unassigned: count("unassigned"),
        legacy_email_resolvable: count("legacy_email_resolvable"),
        legacy_email_ambiguous: count("legacy_email_ambiguous"),
        legacy_email_unresolvable: count("legacy_email_unresolvable"),
        assigned_user_missing: count("assigned_user_missing"),
        assigned_user_invalid_or_cross_org: count(
          "assigned_user_invalid_or_cross_org"
        ),
        client_missing_org_id: count("client_missing_org_id"),
        client_org_invalid_or_inactive: count(
          "client_org_invalid_or_inactive"
        ),
      },
      assignment_rows: rows,
      migration_candidates: rows.filter(
        (row: any) => row.disposition === "legacy_email_resolvable"
      ),
      conflicts: rows.filter(
        (row: any) =>
          ![
            "valid_canonical_assignment",
            "legacy_email_resolvable",
          ].includes(row.disposition)
      ),
    });
  } catch (error: any) {
    console.error(
      "auditClientAssignmentScope error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to audit client assignment scope.",
      },
      { status: 500 }
    );
  }
});