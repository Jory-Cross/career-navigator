import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
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
        { ok: false, error: "You must be signed in to audit manager assignments." },
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
            "Canonical administrator access is required to audit manager assignments.",
        },
        { status: 403 }
      );
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });
    const platformOwnerRecord = platformAdminRecords.find(
      (record: any) =>
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE && isActive(record)
    );

    if (!platformOwnerRecord) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may audit manager assignments.",
        },
        { status: 403 }
      );
    }

    const [allUsers, allAssignments] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.ManagerEmployeeAssignment.list(),
    ]);

    const users = Array.isArray(allUsers) ? allUsers : [];
    const assignments = Array.isArray(allAssignments)
      ? allAssignments
      : [];

    const usersById = new Map(
      users
        .map((user: any) => [normalizeText(user?.id), user])
        .filter(([userId]) => Boolean(userId))
    );

    const auditRows = assignments.map((assignment: any) => {
      const assignmentId = normalizeText(assignment?.id);
      const assignmentOrgId = normalizeText(assignment?.org_id);
      const managerUserId = normalizeText(assignment?.manager_user_id);
      const employeeUserId = normalizeText(assignment?.employee_user_id);

      const manager = usersById.get(managerUserId);
      const employee = usersById.get(employeeUserId);

      const managerOrgId = normalizeText(manager?.org_id);
      const employeeOrgId = normalizeText(employee?.org_id);

      const managerExists = Boolean(manager);
      const employeeExists = Boolean(employee);
      const managerIsActive = managerExists && isActive(manager);
      const employeeIsActive = employeeExists && isActive(employee);
      const assignmentIsActive = isActive(assignment);

      const sameCanonicalOrganization =
        managerExists &&
        employeeExists &&
        managerOrgId &&
        employeeOrgId &&
        managerOrgId === employeeOrgId;

      let disposition = "unresolved";
      let suggestedOrgId = "";

      if (!managerExists || !employeeExists) {
        disposition = "missing_user_record";
      } else if (!managerOrgId || !employeeOrgId) {
        disposition = "user_missing_org_id";
      } else if (!sameCanonicalOrganization) {
        disposition = "cross_org_user_pair";
      } else if (!assignmentOrgId) {
        disposition = "missing_org_resolvable";
        suggestedOrgId = managerOrgId;
      } else if (assignmentOrgId !== managerOrgId) {
        disposition = "assignment_org_conflict";
        suggestedOrgId = managerOrgId;
      } else {
        disposition = "valid_scoped";
        suggestedOrgId = assignmentOrgId;
      }

      return {
        assignment_id: assignmentId,
        org_id: assignmentOrgId || null,
        manager_user_id: managerUserId || null,
        employee_user_id: employeeUserId || null,
        is_active: assignmentIsActive,
        manager_exists: managerExists,
        employee_exists: employeeExists,
        manager_is_active: managerIsActive,
        employee_is_active: employeeIsActive,
        manager_org_id: managerOrgId || null,
        employee_org_id: employeeOrgId || null,
        disposition,
        suggested_org_id: suggestedOrgId || null,
      };
    });

    const countByDisposition = (disposition: string) =>
      auditRows.filter((row: any) => row.disposition === disposition).length;

    const backfillCandidates = auditRows.filter(
      (row: any) => row.disposition === "missing_org_resolvable"
    );

    const conflicts = auditRows.filter(
      (row: any) =>
        row.disposition === "assignment_org_conflict" ||
        row.disposition === "cross_org_user_pair" ||
        row.disposition === "missing_user_record" ||
        row.disposition === "user_missing_org_id"
    );

    return Response.json({
      ok: true,
      read_only: true,
      audit_scope: "ManagerEmployeeAssignment",
      summary: {
        total_assignments: auditRows.length,
        active_assignments: auditRows.filter(
          (row: any) => row.is_active
        ).length,
        valid_scoped: countByDisposition("valid_scoped"),
        missing_org_resolvable: countByDisposition(
          "missing_org_resolvable"
        ),
        assignment_org_conflicts: countByDisposition(
          "assignment_org_conflict"
        ),
        cross_org_user_pairs: countByDisposition(
          "cross_org_user_pair"
        ),
        missing_user_records: countByDisposition(
          "missing_user_record"
        ),
        users_missing_org_id: countByDisposition(
          "user_missing_org_id"
        ),
        unresolved: auditRows.filter(
          (row: any) => row.disposition !== "valid_scoped"
        ).length,
      },
      backfill_candidates: backfillCandidates,
      conflicts,
      assignments: auditRows,
    });
  } catch (error: any) {
    console.error(
      "auditManagerEmployeeAssignmentOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to audit manager assignment organization scope.",
      },
      { status: 500 }
    );
  }
});