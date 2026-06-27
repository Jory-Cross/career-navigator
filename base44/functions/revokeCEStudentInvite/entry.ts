import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const REVOCABLE_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

async function resolveOrganizationId(base44: any, caller: any) {
  const directOrgId = String(caller?.org_id || "").trim();

  if (directOrgId) {
    return directOrgId;
  }

  const organizations =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller.email,
    });

  return String(organizations?.[0]?.id || "").trim();
}

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

    if (!ALLOWED_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users may revoke student invitations.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingInviteId = String(body?.pending_invite_id || "").trim();

    if (!pendingInviteId) {
      return Response.json(
        {
          ok: false,
          error: "pending_invite_id is required.",
        },
        { status: 400 }
      );
    }

    const organizationId = await resolveOrganizationId(base44, caller);

    if (!organizationId) {
      return Response.json(
        {
          ok: false,
          error: "Your account is not connected to an organization.",
        },
        { status: 400 }
      );
    }

    const inviteRows =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        id: pendingInviteId,
      });

    const invite = Array.isArray(inviteRows)
      ? inviteRows[0]
      : null;

    if (!invite) {
      return Response.json(
        {
          ok: false,
          error: "CE student invitation not found.",
        },
        { status: 404 }
      );
    }

    if (
      invite.role !== "ce_student" ||
      String(invite.org_id || "").trim() !== organizationId
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student invitation does not belong to your organization.",
        },
        { status: 403 }
      );
    }

    if (!REVOCABLE_INVITE_STATUSES.has(invite.status)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only pending CE student invitations may be revoked.",
        },
        { status: 409 }
      );
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      invite.id,
      {
        status: "revoked",
      }
    );

    return Response.json({
      ok: true,
      message: "CE student invitation revoked.",
      pending_invite_id: invite.id,
      email: invite.email,
      status: "revoked",
    });
  } catch (error) {
    console.error(
      "revokeCEStudentInvite error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to revoke the CE student invitation.",
      },
      { status: 500 }
    );
  }
});
