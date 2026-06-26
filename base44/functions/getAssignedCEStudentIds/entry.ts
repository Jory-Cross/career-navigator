import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!["admin", "management", "ce_instructor"].includes(caller.role)) {
      return Response.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    let orgId = caller.org_id || null;

    if (!orgId) {
      const organizations =
        await base44.asServiceRole.entities.Organization.filter({
          owner_email: caller.email,
        });

      orgId = organizations[0]?.id || null;
    }

    if (!orgId) {
      return Response.json(
        { ok: false, error: "Organization could not be determined" },
        { status: 400 }
      );
    }

    const activeMemberRows =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        org_id: orgId,
        cohort_role: "member",
        is_active: true,
      });

    const assignedUserIds = Array.from(
      new Set(
        (Array.isArray(activeMemberRows) ? activeMemberRows : [])
          .map((membership) => membership.user_id)
          .filter(Boolean)
      )
    );

    return Response.json({
      ok: true,
      assigned_user_ids: assignedUserIds,
    });
  } catch (error) {
    console.error("getAssignedCEStudentIds error:", error.message);

    return Response.json(
      {
        ok: false,
        error: error.message || "Unable to load assigned students",
      },
      { status: 500 }
    );
  }
});
