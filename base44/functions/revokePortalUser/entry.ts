import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Revokes all portal access for a given email + clientId:
 *   - PendingRoleAssignment: status = "revoked"
 *   - User (if linked_client_id matches): strip access_level, linked_client_id, revert role to "user"
 *
 * Called from in-app admin UI — staff/admin only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me();
    if (!caller || !['admin', 'management', 'employee'].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, clientId } = await req.json();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[revokePortalUser] Revoking portal access for ${normalizedEmail} (client=${clientId}) by ${caller.email}`);

    const results = { pra_revoked: [], user_stripped: null, errors: [] };

    // ── 1. Revoke matching PendingRoleAssignments ────────────────────────────
    const pras = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    for (const pra of pras || []) {
      if (clientId && pra.client_id !== clientId) continue; // scope to this client if provided
      if (pra.status === 'revoked') continue;
      try {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(pra.id, { status: 'revoked' });
        results.pra_revoked.push(pra.id);
        console.log(`[revokePortalUser] Revoked PRA ${pra.id}`);
      } catch (err) {
        results.errors.push(`PRA ${pra.id}: ${err.message}`);
      }
    }

    // ── 2. Strip User portal access ──────────────────────────────────────────
    const users = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    const portalUser = (users || []).find(u =>
      u.access_level === 'client_portal' &&
      (!clientId || u.linked_client_id === clientId)
    );

    if (portalUser) {
      try {
        await base44.asServiceRole.entities.User.update(portalUser.id, {
          linked_client_id: null,
          access_level: null,
          role: 'user',
        });
        results.user_stripped = { id: portalUser.id, email: portalUser.email };
        console.log(`[revokePortalUser] Stripped user ${portalUser.email}`);
      } catch (err) {
        results.errors.push(`User ${portalUser.id}: ${err.message}`);
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('[revokePortalUser] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});