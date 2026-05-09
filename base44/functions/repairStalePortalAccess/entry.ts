import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Admin utility — audits and repairs stale portal access records.
 *
 * Finds:
 *   - Users whose linked_client_id no longer exists → strip portal access
 *   - PendingRoleAssignments whose client_id no longer exists → revoke
 *
 * Supports dry_run=true to preview without making changes.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    console.log(`[repairStalePortalAccess] Starting${dryRun ? ' (DRY RUN)' : ''}...`);

    // ── Load all Client IDs ──────────────────────────────────────────────────
    const allClients = await base44.asServiceRole.entities.Client.list();
    const validClientIds = new Set((allClients || []).map(c => c.id));
    console.log(`[repairStalePortalAccess] Found ${validClientIds.size} active clients`);

    const results = {
      dry_run: dryRun,
      users_checked: 0,
      users_repaired: [],
      pending_checked: 0,
      pending_revoked: [],
      pending_deleted: [],
      errors: [],
    };

    // ── 1. Audit Users with linked_client_id ────────────────────────────────
    // ONLY touch client_portal users — never pre_ets_employer, staff, admin, etc.
    const CLIENT_PORTAL_ROLES = new Set(['client', 'pre_ets', 'dspd']);
    const allUsers = await base44.asServiceRole.entities.User.list();
    for (const u of allUsers || []) {
      if (!u.linked_client_id) continue;

      // Skip anyone who is NOT a client_portal access user
      const isClientPortalUser = u.access_level === 'client_portal' || CLIENT_PORTAL_ROLES.has(u.role);
      if (!isClientPortalUser) {
        console.log(`[repairStalePortalAccess] Skipping ${u.email} — role=${u.role} access_level=${u.access_level} (not client portal)`);
        continue;
      }

      results.users_checked++;

      if (!validClientIds.has(u.linked_client_id)) {
        const entry = {
          id: u.id,
          email: u.email,
          stale_client_id: u.linked_client_id,
          old_role: u.role,
          old_access_level: u.access_level,
        };
        results.users_repaired.push(entry);
        console.log(`[repairStalePortalAccess] Stale client portal user: ${u.email} → linked_client_id=${u.linked_client_id} (not found)`);

        if (!dryRun) {
          await base44.asServiceRole.entities.User.update(u.id, {
            linked_client_id: null,
            access_level: null,
            role: 'user',
          });
        }
      }
    }

    // ── 2. Audit PendingRoleAssignments with stale client_id ────────────────
    const allPRAs = await base44.asServiceRole.entities.PendingRoleAssignment.list();
    for (const pra of allPRAs || []) {
      if (!pra.client_id) continue;
      results.pending_checked++;

      if (!validClientIds.has(pra.client_id)) {
        const entry = {
          id: pra.id,
          email: pra.email,
          stale_client_id: pra.client_id,
          status: pra.status,
        };

        if (!pra.role || !pra.access_level || !pra.org_id) {
          // Incomplete — delete
          results.pending_deleted.push(entry);
          console.log(`[repairStalePortalAccess] Deleting incomplete stale PRA: ${pra.id} (email=${pra.email})`);
          if (!dryRun) {
            await base44.asServiceRole.entities.PendingRoleAssignment.delete(pra.id);
          }
        } else if (pra.status === 'pending') {
          // Valid but orphaned — revoke
          results.pending_revoked.push(entry);
          console.log(`[repairStalePortalAccess] Revoking stale PRA: ${pra.id} (email=${pra.email})`);
          if (!dryRun) {
            await base44.asServiceRole.entities.PendingRoleAssignment.update(pra.id, { status: 'revoked' });
          }
        }
        // Already accepted/revoked/expired — skip
      }
    }

    console.log(
      `[repairStalePortalAccess] Complete${dryRun ? ' (DRY RUN)' : ''}. ` +
      `Users repaired=${results.users_repaired.length}/${results.users_checked} ` +
      `PRAs revoked=${results.pending_revoked.length} deleted=${results.pending_deleted.length}`
    );

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('[repairStalePortalAccess] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});