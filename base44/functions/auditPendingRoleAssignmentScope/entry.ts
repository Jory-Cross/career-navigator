import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

const OPEN_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  client: "client_portal",
  pre_ets: "client_portal",
  dspd: "client_portal",
  pre_ets_employer: "pre_ets_employer_portal",
  ce_instructor: "ce_training_portal",
  ce_student: "ce_training_portal",
};

const CLIENT_LINKED_ROLES = new Set([
  "client",
  "pre_ets",
  "dspd",
  "pre_ets_employer",
]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

  if (role === "admin" && accessLevel === "admin") return role;

  if (
    ["management", "employee"].includes(role) &&
    accessLevel === "staff"
  ) {
    return role;
  }

  return "";
}

function getRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return ROLE_ACCESS_LEVELS[role] === accessLevel
    ? { role, access_level: accessLevel }
    : null;
}

function inviterMayInvite(profile: any, targetRole: string) {
  if (!profile) return false;
  if (profile.role === "admin") return true;

  if (profile.role === "management") {
    return [
      "employee",
      "client",
      "pre_ets",
      "dspd",
      "pre_ets_employer",
      "ce_instructor",
      "ce_student",
    ].includes(targetRole);
  }

  if (profile.role === "employee") {
    return ["client", "pre_ets", "dspd", "pre_ets_employer"].includes(
      targetRole
    );
  }

  return profile.role === "ce_instructor" && targetRole === "ce_student";
}

function expectedClientType(role: string) {
  if (role === "pre_ets" || role === "pre_ets_employer") return "pre_ets";
  if (role === "dspd") return "dspd";
  return "";
}

function isTrainingCohort(cohort: any, organizationId: string) {
  return (
    cohort &&
    cohort?.is_active !== false &&
    cohort?.is_archived !== true &&
    normalizeText(cohort?.org_id) === organizationId &&
    normalizeText(cohort?.cohort_type).toLowerCase() === "training" &&
    normalizeText(cohort?.status).toLowerCase() !== "archived"
  );
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
        {
          ok: false,
          error: "You must be signed in to audit pending invitations.",
        },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        {
          ok: false,
          error: "Your account is inactive or unavailable.",
        },
        { status: 403 }
      );
    }

    if (getCanonicalStaffRole(caller) !== "admin") {
      return Response.json(
        {
          ok: false,
          error:
            "Canonical administrator access is required to audit pending invitations.",
        },
        { status: 403 }
      );
    }

    const platformAdmins =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });

    const isPlatformOwner = asArray(platformAdmins).some(
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
            "Only an active Platform Owner may audit pending invitations.",
        },
        { status: 403 }
      );
    }

    const [organizations, users, clients, cohorts, assignments] =
      await Promise.all([
        base44.asServiceRole.entities.Organization.list(),
        base44.asServiceRole.entities.User.list(),
        base44.asServiceRole.entities.Client.list(),
        base44.asServiceRole.entities.CETrainingCohort.list(),
        base44.asServiceRole.entities.PendingRoleAssignment.list(),
      ]);

    const activeOrganizationIds = new Set(
      asArray(organizations)
        .filter((organization: any) => isActive(organization))
        .map((organization: any) => normalizeText(organization?.id))
        .filter(Boolean)
    );

    const usersById = new Map(
      asArray(users)
        .map((user: any) => [normalizeText(user?.id), user])
        .filter(([userId]) => Boolean(userId))
    );

    const clientsById = new Map(
      asArray(clients)
        .map((client: any) => [normalizeText(client?.id), client])
        .filter(([clientId]) => Boolean(clientId))
    );

    const cohortsById = new Map(
      asArray(cohorts)
        .map((cohort: any) => [normalizeText(cohort?.id), cohort])
        .filter(([cohortId]) => Boolean(cohortId))
    );

    const auditRows = asArray(assignments).map((assignment: any) => {
      const assignmentId = normalizeText(assignment?.id);
      const status = normalizeText(assignment?.status).toLowerCase();
      const role = normalizeText(assignment?.role).toLowerCase();
      const accessLevel = normalizeText(assignment?.access_level).toLowerCase();
      const organizationId = normalizeText(assignment?.org_id);
      const clientId = normalizeText(assignment?.client_id);
      const cohortId = normalizeText(assignment?.cohort_id);
      const inviterId = normalizeText(assignment?.invited_by_id);
      const findings: string[] = [];

      if (!assignmentId) findings.push("missing_assignment_id");
      if (!normalizeEmail(assignment?.email)) findings.push("missing_email");

      if (!ROLE_ACCESS_LEVELS[role] || ROLE_ACCESS_LEVELS[role] !== accessLevel) {
        findings.push("invalid_role_access_pair");
      }

      if (!organizationId) {
        findings.push("missing_org_id");
      } else if (!activeOrganizationIds.has(organizationId)) {
        findings.push("org_invalid_or_inactive");
      }

      const inviter = usersById.get(inviterId) || null;
      const inviterProfile = getRoleProfile(inviter);

      if (!inviterId) {
        findings.push("missing_inviter");
      } else if (
        !inviter ||
        !isActive(inviter) ||
        normalizeText(inviter?.org_id) !== organizationId
      ) {
        findings.push("inviter_invalid_or_cross_org");
      } else if (!inviterMayInvite(inviterProfile, role)) {
        findings.push("inviter_not_authorized_for_role");
      }

      if (CLIENT_LINKED_ROLES.has(role)) {
        const client = clientsById.get(clientId) || null;
        const neededClientType = expectedClientType(role);

        if (!clientId) {
          findings.push("missing_client_id");
        } else if (
          !client ||
          !isActive(client) ||
          normalizeText(client?.org_id) !== organizationId
        ) {
          findings.push("client_invalid_or_cross_org");
        } else if (
          neededClientType &&
          normalizeText(client?.client_type).toLowerCase() !== neededClientType
        ) {
          findings.push("client_type_mismatch");
        } else if (
          inviterProfile?.role !== "admin" &&
          normalizeText(client?.assigned_employee_id) !== inviterId
        ) {
          findings.push("inviter_not_exact_client_assignee");
        }
      } else if (clientId) {
        findings.push("unexpected_client_id");
      }

      if (role === "ce_student") {
        const cohort = cohortsById.get(cohortId) || null;

        if (!cohortId) {
          findings.push("missing_training_cohort_id");
        } else if (!isTrainingCohort(cohort, organizationId)) {
          findings.push("training_cohort_invalid_or_cross_org");
        }
      } else if (cohortId) {
        findings.push("unexpected_cohort_id");
      }

      const disposition =
        findings.length === 0
          ? "valid"
          : findings.includes("inviter_not_exact_client_assignee")
            ? "legacy_client_ownership_fallback_required"
            : "requires_review";

      return {
        pending_role_assignment_id: assignmentId || null,
        email: normalizeEmail(assignment?.email) || null,
        status: status || null,
        is_open: OPEN_STATUSES.has(status),
        role: role || null,
        access_level: accessLevel || null,
        org_id: organizationId || null,
        client_id: clientId || null,
        cohort_id: cohortId || null,
        invited_by_id: inviterId || null,
        disposition,
        findings,
      };
    });

    const count = (predicate: (row: any) => boolean) =>
      auditRows.filter(predicate).length;

    return Response.json({
      ok: true,
      read_only: true,
      audit_scope: "PendingRoleAssignment",
      generated_at: new Date().toISOString(),
      summary: {
        total_assignments: auditRows.length,
        open_assignments: count((row: any) => row.is_open),
        valid_assignments: count((row: any) => row.disposition === "valid"),
        open_valid_assignments: count(
          (row: any) => row.is_open && row.disposition === "valid"
        ),
        legacy_client_ownership_fallback_required: count(
          (row: any) =>
            row.disposition === "legacy_client_ownership_fallback_required"
        ),
        requires_review: count(
          (row: any) => row.disposition === "requires_review"
        ),
      },
      assignment_rows: auditRows,
      activation_block_candidates: auditRows.filter(
        (row: any) => row.is_open && row.disposition !== "valid"
      ),
    });
  } catch (error: any) {
    console.error(
      "auditPendingRoleAssignmentScope error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to audit pending invitation scope.",
      },
      { status: 500 }
    );
  }
});
