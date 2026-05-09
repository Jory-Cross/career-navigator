import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered by entity automation on Client update.
 *
 * 1. Auto-archives client when status → inactive/completed.
 * 2. Auto-unarchives client when status → active.
 * 3. When is_archived flips true: revokes all client_portal access linked to that client.
 *    Safe guard: ONLY touches users with access_level=client_portal or role in {client, pre_ets, dspd}.
 *    Never touches: pre_ets_employer, staff, admin, management, employee.
 */

const CLIENT_PORTAL_ROLES = new Set(['client', 'pre_ets', 'dspd']);

async function revokeClientPortalAccess(base44, clientId, clientEmail, reason) {
  const results = {
    pending_revoked: [],
    pending_deleted: [],
    users_stripped: [],
    errors: [],
  };

  // ── 1. Revoke PendingRoleAssignments tied to this client ─────────────────
  const allPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ client_id: clientId });
  for (const pra of allPending || []) {
    try {
      if (!pra.role || !pra.access_level || !pra.org_id) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(pra.id);
        results.pending_deleted.push(pra.id);
        console.log(`[${reason}] Deleted incomplete PRA ${pra.id} (email=${pra.email})`);
      } else {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(pra.id, { status: 'revoked' });
        results.pending_revoked.push(pra.id);
        console.log(`[${reason}] Revoked PRA ${pra.id} (email=${pra.email})`);
      }
    } catch (err) {
      results.errors.push(`PRA ${pra.id}: ${err.message}`);
      console.error(`[${reason}] Error processing PRA ${pra.id}:`, err.message);
    }
  }

  // ── 2. Strip portal access from linked Users ─────────────────────────────
  const [usersByClientId, usersByEmail] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ linked_client_id: clientId }),
    clientEmail
      ? base44.asServiceRole.entities.User.filter({ email: clientEmail.toLowerCase().trim() })
      : Promise.resolve([]),
  ]);

  const userMap = new Map();
  for (const u of [...(usersByClientId || []), ...(usersByEmail || [])]) {
    userMap.set(u.id, u);
  }

  // Safe guard: only strip client_portal access — never touch employer/staff roles
  const portalUsers = [...userMap.values()].filter(
    u => u.access_level === 'client_portal' || CLIENT_PORTAL_ROLES.has(u.role)
  );

  for (const u of portalUsers) {
    try {
      await base44.asServiceRole.entities.User.update(u.id, {
        linked_client_id: null,
        access_level: null,
        role: 'user',
      });
      results.users_stripped.push({ id: u.id, email: u.email });
      console.log(`[${reason}] Stripped portal access from user ${u.email} (was linked to client ${clientId})`);
    } catch (err) {
      results.errors.push(`User ${u.id}: ${err.message}`);
      console.error(`[${reason}] Error stripping user ${u.id}:`, err.message);
    }
  }

  // ── 3. Log activity on the client record ─────────────────────────────────
  try {
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      activity_type: 'status_changed',
      title: 'Portal access revoked',
      description: `Client portal access revoked due to: ${reason}. Users stripped: ${results.users_stripped.map(u => u.email).join(', ') || 'none'}. PRAs revoked: ${results.pending_revoked.length}.`,
    });
  } catch (err) {
    console.warn(`[${reason}] Could not log Activity:`, err.message);
  }

  console.log(`[${reason}] Done. PRA revoked=${results.pending_revoked.length} deleted=${results.pending_deleted.length} users_stripped=${results.users_stripped.length} errors=${results.errors.length}`);
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data, old_data, event } = payload;

    if (event?.type !== 'update') {
      return Response.json({ message: 'Not an update event, skipping.' });
    }

    const clientId = event?.entity_id;
    const clientEmail = data?.email || old_data?.email || null;
    const newStatus = data?.status;
    const oldStatus = old_data?.status;
    const wasArchived = old_data?.is_archived === true;
    const isNowArchived = data?.is_archived === true;
    const justArchived = isNowArchived && !wasArchived;

    const responses = [];

    // ── Auto-archive on status change ────────────────────────────────────────
    if ((newStatus === 'inactive' || newStatus === 'completed') && oldStatus !== newStatus) {
      try {
        await base44.asServiceRole.entities.Client.update(clientId, { is_archived: true });
        console.log(`[archiveClientOnStatusChange] Client ${clientId} archived due to status → ${newStatus}`);
      } catch (err) {
        console.warn(`[archiveClientOnStatusChange] Could not set is_archived on client ${clientId}:`, err.message);
      }
      responses.push(`archived_status_${newStatus}`);
    }

    // ── Auto-unarchive on status → active ────────────────────────────────────
    if (newStatus === 'active' && oldStatus !== 'active' && (old_data?.is_archived || data?.is_archived)) {
      try {
        await base44.asServiceRole.entities.Client.update(clientId, { is_archived: false });
        console.log(`[archiveClientOnStatusChange] Client ${clientId} unarchived due to status → active`);
      } catch (err) {
        console.warn(`[archiveClientOnStatusChange] Could not unarchive client ${clientId}:`, err.message);
      }
      responses.push('unarchived');
    }

    // ── Revoke portal access when is_archived flips to true ──────────────────
    if (justArchived) {
      console.log(`[archiveClientOnStatusChange] Client ${clientId} just archived — revoking portal access`);
      const revokeResults = await revokeClientPortalAccess(
        base44,
        clientId,
        clientEmail,
        'client_archived'
      );
      responses.push('portal_access_revoked');
      return Response.json({
        message: responses.join(', '),
        client_id: clientId,
        ...revokeResults,
      });
    }

    return Response.json({ message: responses.length ? responses.join(', ') : 'no_action', client_id: clientId });

  } catch (error) {
    console.error('[archiveClientOnStatusChange] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});