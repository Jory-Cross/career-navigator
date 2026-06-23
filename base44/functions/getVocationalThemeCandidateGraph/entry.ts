import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_id, candidate_theme_name } = await req.json();
    if (!client_id || !candidate_theme_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Retrieve the graph record
    const graphs = await base44.entities.VocationalThemeCandidateGraph.filter({
      client_id,
      candidate_theme_name,
      is_active: true
    });

    if (graphs.length === 0) {
      return Response.json({
        ok: true,
        graph: null,
        message: 'Graph not found. Call rebuildVocationalThemeCandidateGraph to create it.'
      });
    }

    return Response.json({
      ok: true,
      graph: graphs[0]
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});