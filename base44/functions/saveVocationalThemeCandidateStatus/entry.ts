import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { client_id, candidate_theme_name, category_label, status, status_notes } = payload;

    console.log('[saveVocationalThemeCandidateStatus] Payload:', {
      client_id,
      candidate_theme_name,
      category_label,
      status,
      status_notes,
      user_id: user.id,
      user_role: user.role
    });

    // Validate required fields
    if (!client_id || !candidate_theme_name || !category_label || !status) {
      console.error('[saveVocationalThemeCandidateStatus] Missing required fields');
      return Response.json(
        { error: 'Missing required fields: client_id, candidate_theme_name, category_label, status' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['untested', 'emerging', 'supported', 'needs_validation', 'refuted', 'archived'];
    if (!validStatuses.includes(status)) {
      return Response.json(
        { error: `Invalid status. Allowed: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await base44.entities.Client.get(client_id);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check for existing active status record
    const existing = await base44.entities.VocationalThemeCandidateStatus.filter({
      client_id,
      candidate_theme_name,
      is_active: true
    });

    // Soft-delete previous active record if exists
    if (existing.length > 0) {
      for (const record of existing) {
        await base44.entities.VocationalThemeCandidateStatus.update(record.id, { is_active: false });
      }
    }

    // Create new active status record
    const newStatus = await base44.entities.VocationalThemeCandidateStatus.create({
      org_id: client.org_id,
      client_id,
      candidate_theme_name,
      category_label,
      status,
      status_date: new Date().toISOString().split('T')[0],
      status_notes: status_notes || '',
      reviewer_user_id: user.id,
      reviewer_role: user.role,
      is_active: true
    });

    console.log('[saveVocationalThemeCandidateStatus] Created record:', {
      id: newStatus.id,
      client_id: newStatus.client_id,
      candidate_theme_name: newStatus.candidate_theme_name,
      status: newStatus.status,
      is_active: newStatus.is_active
    });

    return Response.json({
      success: true,
      status: newStatus,
      message: `Status updated to "${status}" for ${candidate_theme_name}`
    });
  } catch (error) {
    console.error('saveVocationalThemeCandidateStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});