import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_name, current_category } = await req.json();

    return Response.json({
      suggested_category: current_category || "other",
      tags: ["test-tag-1", "test-tag-2"],
      confidence: 1
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
});