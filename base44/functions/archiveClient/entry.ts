import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Archives a client:
 *   1. Sets Client.is_archived = true
 *   2. Revokes all PendingRoleAssignment records for this client
 *   3. Sets is_active = false on any linked portal User (blocks login)
 *   4. Logs an Activity audit record
 *
 * Does NOT delete any records (documents, assessments, time entries, tasks, etc.)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller || !['admin', 'management', 'employee'].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    // ── 1. Load client ────────────────────────────────────────────────────
    const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const clientRecord = client?.[0];
    if (!clientRecord) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── 2. Archive the client record ──────────────────────────────────────
    await base44.asServiceRole.entities.Client.update(client_id, {
      is_archived: true,
      status: 'inactive',
    });
    console.log(`[archiveClient] Archived client id=${client_id}`);

    // ── 3. Revoke all PendingRoleAssignments for this client ──────────────
    const pras = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ client_id });
    await Promise.allSettled(
      (pras || []).map(p =>
        base44.asServiceRole.entities.PendingRoleAssignment.update(p.id, { status: 'revoked' })
      )
    );

    // Also revoke by email for any staff-linked PRAs
    if (clientRecord.email) {
      const emailPras = await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        email: clientRecord.email.toLowerCase().trim()
      });
      await Promise.allSettled(
        (emailPras || []).filter(p => p.status !== 'revoked').map(p =>
          base44.asServiceRole.entities.PendingRoleAssignment.update(p.id, { status: 'revoked' })
        )
      );
    }

    console.log(`[archiveClient] Revoked ${(pras || []).length} PRA record(s)`);

    // ── 4. Block portal user login ────────────────────────────────────────
    // Find any User with linked_client_id or matching email that has portal access
    const portalUsers = await base44.asServiceRole.entities.User.filter({
      linked_client_id: client_id
    });
    const emailUsers = clientRecord.email
      ? await base44.asServiceRole.entities.User.filter({ email: clientRecord.email.toLowerCase().trim() })
      : [];

    const userMap = new Map();
    for (const u of [...(portalUsers || []), ...(emailUsers || [])]) userMap.set(u.id, u);

    const PORTAL_ROLES = new Set(['client', 'pre_ets', 'dspd', 'pre_ets_employer']);
    await Promise.allSettled(
      [...userMap.values()]
        .filter(u => PORTAL_ROLES.has(u.role) || u.access_level === 'client_portal' || u.access_level === 'pre_ets_employer_portal')
        .map(u =>
          base44.asServiceRole.entities.User.update(u.id, {
            is_active: false,
            linked_client_id: null,
            access_level: null,
          })
        )
    );
    console.log(`[archiveClient] Blocked ${userMap.size} portal user account(s)`);

    // ── 5. Log activity ───────────────────────────────────────────────────
    await base44.asServiceRole.entities.Activity.create({
      client_id,
      org_id: clientRecord.org_id,
      activity_type: 'status_changed',
      title: 'Client archived',
      description: `Client archived by ${caller.full_name || caller.email}. Portal access revoked. All historical records preserved.`,
    });

    return Response.json({
      success: true,
      client_id,
      pras_revoked: (pras || []).length,
      portal_users_blocked: userMap.size,
    });

  } catch (error) {
    console.error('[archiveClient] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});