import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const {
      client_id,
      candidate_theme_name,
      category_label,
      status,
      status_notes,
    } = payload;

    // Validate required fields
    if (!client_id || !candidate_theme_name || !category_label || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate status enum
    const validStatuses = ['untested', 'emerging', 'supported', 'needs_validation', 'refuted', 'archived'];
    if (!validStatuses.includes(status)) {
      return Response.json(
        { error: `Invalid status. Allowed: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // ── HARDENED VALIDATION: Client must exist ──────────────────────────────────
    let client;
    try {
      client = await base44.asServiceRole.entities.Client.get(client_id);
    } catch (err) {
      console.error(`[saveVocationalThemeCandidateStatus] Client lookup failed for ID: ${client_id}`, err);
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── ACCESS CHECK: platform hierarchy ─────────────────────
    let hasAccess = false;

    // Platform access: admin, management, or assigned employee
    if (user.role === 'admin' || user.role === 'management') {
      hasAccess = true;
    } else if (client.assigned_employee_id === user.id) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return Response.json({ error: 'Access denied to this client' }, { status: 403 });
    }

    // ── SAVE STATUS ──────────────────────────────────────────────────────────────
    const statusData = {
      org_id: client.org_id,
      client_id,
      candidate_theme_name,
      category_label,
      status,
      status_date: new Date().toISOString().split('T')[0],
      status_notes: status_notes || '',
      reviewer_user_id: user.id,
      reviewer_role: user.role,
      is_active: true,
    };

    let statusRecord;

    try {
      // Query for existing active record for this client + candidate
      const existingRecords = await base44.asServiceRole.entities.VocationalThemeCandidateStatus.filter({
        client_id,
        candidate_theme_name,
        is_active: true,
      });

      if (existingRecords && existingRecords.length > 0) {
        // Active record exists; update it
        statusRecord = await base44.asServiceRole.entities.VocationalThemeCandidateStatus.update(
          existingRecords[0].id,
          statusData
        );

        // Deactivate any other active records (shouldn't happen, but safeguard)
        if (existingRecords.length > 1) {
          for (const dup of existingRecords.slice(1)) {
            try {
              await base44.asServiceRole.entities.VocationalThemeCandidateStatus.update(dup.id, {
                is_active: false,
              });
            } catch (dupErr) {
              console.error(`[saveVocationalThemeCandidateStatus] Failed to deactivate duplicate ${dup.id}:`, dupErr.message);
            }
          }
        }
      } else {
        // No active record exists; create one
        try {
          statusRecord = await base44.asServiceRole.entities.VocationalThemeCandidateStatus.create(statusData);
        } catch (createErr) {
          // Create failed; likely a concurrent request created the same record
          console.error('[saveVocationalThemeCandidateStatus] Create conflict detected, re-querying:', createErr.message);
          
          const retryRecords = await base44.asServiceRole.entities.VocationalThemeCandidateStatus.filter({
            client_id,
            candidate_theme_name,
            is_active: true,
          });

          if (retryRecords && retryRecords.length > 0) {
            // Record now exists (created by concurrent request); update it
            statusRecord = await base44.asServiceRole.entities.VocationalThemeCandidateStatus.update(
              retryRecords[0].id,
              statusData
            );
          } else {
            // Still no record; original create error must be something else
            throw createErr;
          }
        }
      }
    } catch (error) {
      console.error('[saveVocationalThemeCandidateStatus] Fatal error:', error.message);
      return Response.json({ error: 'Failed to save status' }, { status: 500 });
    }

    if (!statusRecord) {
      return Response.json({ error: 'Failed to save status' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      status_id: statusRecord.id,
      status: statusRecord.status,
      message: 'Status saved',
    });
  } catch (error) {
    console.error('saveVocationalThemeCandidateStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});