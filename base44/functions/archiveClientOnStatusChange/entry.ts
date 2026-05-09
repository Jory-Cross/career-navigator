import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered by entity automation on Client update.
 *
 * 1. Auto-archives client when status → inactive/completed.
 * 2. Auto-unarchives client when status → active.
 * 3. When is_archived is true in current data AND either:
 *      a) old_data.is_archived was false/null (detected flip), OR
 *      b) old_data is unavailable (Base44 did not send it) — treat is_archived=true as actionable
 *    → revoke all client_portal access linked to that client.
 *
 * Safe guard: ONLY touches users with access_level=client_portal or role in {client, pre_ets, dspd}.
 * Never touches: pre_ets_employer, staff, admin, management, employee.
 */

const CLIENT_PORTAL_ROLES = new Set(['client', 'pre_ets', 'dspd']);

async function revokeClientPortalAccess(base44, clientId, clientEmail, reason) {
  console.log(`[${reason}] === revokeClientPortalAccess START === clientId=${clientId} email=${clientEmail}`);

  const results = {
    pending_revoked: [],
    pending_deleted: [],
    users_stripped: [],
    errors: [],
  };

  // ── 1. Revoke PendingRoleAssignments tied to this client ──────────────────
  console.log(`[${reason}] Step 1: querying PendingRoleAssignment for client_id=${clientId}`);
  let allPending = [];
  try {
    allPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ client_id: clientId }) || [];
  } catch (err) {
    console.error(`[${reason}] Failed to query PendingRoleAssignment:`, err.message);
    results.errors.push(`PRA query: ${err.message}`);
  }
  console.log(`[${reason}] Step 1: found ${allPending.length} PendingRoleAssignment records`);

  for (const pra of allPending) {
    try {
      if (!pra.role || !pra.access_level || !pra.org_id) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(pra.id);
        results.pending_deleted.push(pra.id);
        console.log(`[${reason}] Deleted incomplete PRA ${pra.id} (email=${pra.email})`);
      } else {
        await base44.asServiceRole.entities.PendingRoleAssignment.update(pra.id, { status: 'revoked' });
        results.pending_revoked.push(pra.id);
        console.log(`[${reason}] Revoked PRA ${pra.id} (email=${pra.email}, status was ${pra.status})`);
      }
    } catch (err) {
      results.errors.push(`PRA ${pra.id}: ${err.message}`);
      console.error(`[${reason}] Error processing PRA ${pra.id}:`, err.message);
    }
  }

  // ── 2. Find Users linked to this client ──────────────────────────────────
  console.log(`[${reason}] Step 2: querying Users by linked_client_id=${clientId} and email=${clientEmail}`);
  let usersByClientId = [];
  let usersByEmail = [];
  try {
    [usersByClientId, usersByEmail] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ linked_client_id: clientId }),
      clientEmail
        ? base44.asServiceRole.entities.User.filter({ email: clientEmail.toLowerCase().trim() })
        : Promise.resolve([]),
    ]);
  } catch (err) {
    console.error(`[${reason}] Failed to query Users:`, err.message);
    results.errors.push(`User query: ${err.message}`);
  }

  console.log(`[${reason}] Step 2: found ${(usersByClientId || []).length} by linked_client_id, ${(usersByEmail || []).length} by email`);

  // Dedupe by id
  const userMap = new Map();
  for (const u of [...(usersByClientId || []), ...(usersByEmail || [])]) {
    userMap.set(u.id, u);
  }
  console.log(`[${reason}] Step 2: ${userMap.size} unique users total`);

  // Safe guard: only strip client_portal access — never touch employer/staff roles
  const allUsers = [...userMap.values()];
  const portalUsers = allUsers.filter(
    u => u.access_level === 'client_portal' || CLIENT_PORTAL_ROLES.has(u.role)
  );
  const skippedUsers = allUsers.filter(
    u => !(u.access_level === 'client_portal' || CLIENT_PORTAL_ROLES.has(u.role))
  );

  console.log(`[${reason}] Step 2: ${portalUsers.length} portal users to strip, ${skippedUsers.length} skipped (non-client roles: ${skippedUsers.map(u => `${u.email}[${u.role}/${u.access_level}]`).join(', ') || 'none'})`);

  // ── 3. Strip portal access ────────────────────────────────────────────────
  for (const u of portalUsers) {
    console.log(`[${reason}] Step 3: stripping user ${u.email} (role=${u.role}, access_level=${u.access_level}, linked_client_id=${u.linked_client_id})`);
    try {
      await base44.asServiceRole.entities.User.update(u.id, {
        linked_client_id: null,
        access_level: null,
        role: 'user',
      });
      results.users_stripped.push({ id: u.id, email: u.email });
      console.log(`[${reason}] Step 3: SUCCESS stripped ${u.email}`);
    } catch (err) {
      results.errors.push(`User ${u.id}: ${err.message}`);
      console.error(`[${reason}] Step 3: FAILED to strip user ${u.email}:`, err.message);
    }
  }

  // ── 4. Log Activity ───────────────────────────────────────────────────────
  try {
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      activity_type: 'status_changed',
      title: 'Portal access revoked',
      description: `Portal access revoked due to: ${reason}. Users stripped: ${results.users_stripped.map(u => u.email).join(', ') || 'none'}. PRAs revoked: ${results.pending_revoked.length}.`,
    });
    console.log(`[${reason}] Step 4: Activity logged`);
  } catch (err) {
    console.warn(`[${reason}] Step 4: Could not log Activity:`, err.message);
  }

  console.log(`[${reason}] === DONE === PRA revoked=${results.pending_revoked.length} deleted=${results.pending_deleted.length} users_stripped=${results.users_stripped.length} errors=${results.errors.length}`);
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data, old_data, event } = payload;

    // ── Diagnostic: log raw payload shape ────────────────────────────────────
    console.log(`[archiveClientOnStatusChange] event.type=${event?.type} entity_id=${event?.entity_id}`);
    console.log(`[archiveClientOnStatusChange] data.is_archived=${data?.is_archived} data.status=${data?.status}`);
    console.log(`[archiveClientOnStatusChange] old_data present=${!!old_data} old_data.is_archived=${old_data?.is_archived} old_data.status=${old_data?.status}`);
    console.log(`[archiveClientOnStatusChange] payload_too_large=${payload?.payload_too_large}`);

    if (event?.type !== 'update') {
      console.log(`[archiveClientOnStatusChange] Not an update event — skipping.`);
      return Response.json({ message: 'Not an update event, skipping.' });
    }

    const clientId = event?.entity_id;
    if (!clientId) {
      console.error(`[archiveClientOnStatusChange] No entity_id in event — cannot proceed.`);
      return Response.json({ error: 'No entity_id' }, { status: 400 });
    }

    // If payload was too large, re-fetch the client data directly
    let resolvedData = data;
    let resolvedOldData = old_data;
    if (payload?.payload_too_large) {
      console.log(`[archiveClientOnStatusChange] payload_too_large=true — fetching client ${clientId} directly`);
      try {
        resolvedData = await base44.asServiceRole.entities.Client.get(clientId);
        console.log(`[archiveClientOnStatusChange] Re-fetched client: is_archived=${resolvedData?.is_archived} status=${resolvedData?.status}`);
      } catch (err) {
        console.error(`[archiveClientOnStatusChange] Failed to re-fetch client ${clientId}:`, err.message);
      }
    }

    const clientEmail = resolvedData?.email || resolvedOldData?.email || null;
    const newStatus = resolvedData?.status;
    const oldStatus = resolvedOldData?.status;
    const isNowArchived = resolvedData?.is_archived === true;
    const wasArchived = resolvedOldData?.is_archived === true;
    const oldDataMissing = !resolvedOldData || Object.keys(resolvedOldData).length === 0;

    // A "just archived" event is:
    //   - is_archived is true in current data, AND
    //   - either old_data had it false/null, OR old_data is entirely missing (Base44 didn't send it)
    const justArchived = isNowArchived && (!wasArchived || oldDataMissing);

    console.log(`[archiveClientOnStatusChange] clientId=${clientId} email=${clientEmail} isNowArchived=${isNowArchived} wasArchived=${wasArchived} oldDataMissing=${oldDataMissing} justArchived=${justArchived}`);

    const responses = [];

    // ── Auto-archive on status change ────────────────────────────────────────
    if ((newStatus === 'inactive' || newStatus === 'completed') && oldStatus !== newStatus) {
      console.log(`[archiveClientOnStatusChange] Status changed to ${newStatus} — setting is_archived=true`);
      try {
        await base44.asServiceRole.entities.Client.update(clientId, { is_archived: true });
        console.log(`[archiveClientOnStatusChange] Client ${clientId} is_archived set to true`);
      } catch (err) {
        console.warn(`[archiveClientOnStatusChange] Could not set is_archived on client ${clientId}:`, err.message);
      }
      responses.push(`archived_status_${newStatus}`);
      // NOTE: Portal revocation will fire on the NEXT update event when is_archived=true is in data.
      // We do not duplicate-fire here to avoid double-revoking when both status + is_archived change together.
    }

    // ── Auto-unarchive on status → active ────────────────────────────────────
    if (newStatus === 'active' && oldStatus !== 'active' && (resolvedOldData?.is_archived || resolvedData?.is_archived)) {
      console.log(`[archiveClientOnStatusChange] Status changed to active — setting is_archived=false`);
      try {
        await base44.asServiceRole.entities.Client.update(clientId, { is_archived: false });
        console.log(`[archiveClientOnStatusChange] Client ${clientId} unarchived`);
      } catch (err) {
        console.warn(`[archiveClientOnStatusChange] Could not unarchive client ${clientId}:`, err.message);
      }
      responses.push('unarchived');
    }

    // ── Revoke portal access when is_archived is/becomes true ────────────────
    if (justArchived) {
      console.log(`[archiveClientOnStatusChange] justArchived=true — initiating portal revocation for client ${clientId}`);
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

    console.log(`[archiveClientOnStatusChange] justArchived=false — no portal revocation needed. isNowArchived=${isNowArchived} wasArchived=${wasArchived}`);
    return Response.json({ message: responses.length ? responses.join(', ') : 'no_action', client_id: clientId });

  } catch (error) {
    console.error('[archiveClientOnStatusChange] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});