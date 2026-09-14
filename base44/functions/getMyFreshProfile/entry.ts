import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Returns the caller's fresh, server-verified profile straight from the
// database. Used after an account activation when the sign-in session still
// carries the pre-activation identity — the client merges this profile in so
// the activated account is usable without a sign-out/sign-in.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, reason: "unauthorized" },
        { status: 401 }
      );
    }

    // Read from the DB via service role so the record is current (the
    // session's embedded claims may be stale). Only the caller's own
    // record is returned.
    const user = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!user) {
      return Response.json(
        { ok: false, reason: "user_not_found" },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        access_level: user.access_level,
        org_id: user.org_id,
        manager_id: user.manager_id,
        linked_client_id: user.linked_client_id,
        cohort_id: user.cohort_id,
        cohort_role: user.cohort_role,
        is_active: user.is_active,
      },
    });
  } catch (error) {
    console.error("[getMyFreshProfile] Unexpected error:", error?.message || error);
    return Response.json(
      { ok: false, reason: "unexpected_error" },
      { status: 500 }
    );
  }
}