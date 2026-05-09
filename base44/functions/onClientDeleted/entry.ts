import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered by entity automation on Client delete.
 * Cleans up all portal access tied to the deleted client:
 *   - PendingRoleAssignment: status = "revoked" (or delete if incomplete)
 *   - User: strip linked_client_id, access_level, revert role to "user"
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;
    const clientId = event?.entity_id || old_data?.id || data?.id;

    if (!clientId) {
      console.warn('[onClientDeleted] No client ID found in payload — skipping.');
      return Response.json({ skipped: true, reason: 'no_client_id' });
    }

    const clientEmail = old_data?.email || data?.email || null;
    console.log(`[onClientDeleted] Processing deletion of client ${clientId} (email=${clientEmail})`);

    const results = {
      pending_revoked: [],
      pending_deleted: [],
      users_stripped: [],
      errors: [],
    };

    // ── 1. Revoke PendingRoleAssignments tied to this client_id ─────────────
    const allPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ client_id: clientId });
    for (const pra of allPending || []) {
      try {
        if (!pra.role || !pra.access_level || !pra.org_id) {
          // Incomplete record — just delete
          await base44.asServiceRole.entities.PendingRoleAssignment.delete(pra.id);
          results.pending_deleted.push(pra.id);
          console.log(`[onClientDeleted] Deleted incomplete PendingRoleAssignment ${pra.id} (email=${pra.email})`);
        } else {
          await base44.asServiceRole.entities.PendingRoleAssignment.update(pra.id, { status: 'revoked' });
          results.pending_revoked.push(pra.id);
          console.log(`[onClientDeleted] Revoked PendingRoleAssignment ${pra.id} (email=${pra.email})`);
        }
      } catch (err) {
        results.errors.push(`PRA ${pra.id}: ${err.message}`);
        console.error(`[onClientDeleted] Error processing PRA ${pra.id}:`, err.message);
      }
    }

    // ── 2. Strip portal access from Users whose linked_client_id = this client ──
    // Also catch by email fallback (in case linked_client_id was never stamped)
    const [usersByClientId, usersByEmail] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ linked_client_id: clientId }),
      clientEmail
        ? base44.asServiceRole.entities.User.filter({ email: clientEmail.toLowerCase().trim() })
        : Promise.resolve([]),
    ]);

    // Dedupe by id
    const userMap = new Map();
    for (const u of [...(usersByClientId || []), ...(usersByEmail || [])]) {
      userMap.set(u.id, u);
    }

    // Only strip users that have client_portal access (don't accidentally strip staff)
    const portalUsers = [...userMap.values()].filter(
      u => u.access_level === 'client_portal' || u.linked_client_id === clientId
    );

    for (const u of portalUsers) {
      try {
        await base44.asServiceRole.entities.User.update(u.id, {
          linked_client_id: null,
          access_level: null,
          role: 'user',
        });
        results.users_stripped.push({ id: u.id, email: u.email });
        console.log(`[onClientDeleted] Stripped portal access from user ${u.email} (linked_client_id was ${clientId})`);
      } catch (err) {
        results.errors.push(`User ${u.id}: ${err.message}`);
        console.error(`[onClientDeleted] Error stripping user ${u.id}:`, err.message);
      }
    }

    console.log(`[onClientDeleted] Done. PRA revoked=${results.pending_revoked.length} deleted=${results.pending_deleted.length} users_stripped=${results.users_stripped.length} errors=${results.errors.length}`);

    return Response.json({
      success: true,
      client_id: clientId,
      client_email: clientEmail,
      ...results,
    });
  } catch (error) {
    console.error('[onClientDeleted] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});