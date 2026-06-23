import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { client_id, candidate_theme_name } = payload;

    // Validate required fields
    if (!client_id || !candidate_theme_name) {
      return Response.json(
        { error: 'Missing required fields: client_id, candidate_theme_name' },
        { status: 400 }
      );
    }

    // Retrieve active status record
    const statusRecords = await base44.entities.VocationalThemeCandidateStatus.filter({
      client_id,
      candidate_theme_name,
      is_active: true
    });

    if (statusRecords.length === 0) {
      // No status record exists yet; return default untested status
      return Response.json({
        status: 'untested',
        status_date: new Date().toISOString().split('T')[0],
        status_notes: '',
        exists: false,
        message: 'No status record found; candidate is untested by default'
      });
    }

    // Return the most recent active status record
    const latestStatus = statusRecords[0];
    return Response.json({
      ...latestStatus,
      exists: true
    });
  } catch (error) {
    console.error('getVocationalThemeCandidateStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});