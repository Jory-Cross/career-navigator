import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log("analyzeDocumentContent body:", body);

    const file_name = body?.file_name || "";
    const current_category = body?.current_category || "other";
    const notes = body?.notes || "";

    return Response.json({
      suggested_category: current_category,
      tags: ["debug-tag-1", "debug-tag-2"],
      confidence: 1,
      debug_received: {
        file_name,
        current_category,
        notes
      }
    });
  } catch (error) {
    console.error("analyzeDocumentContent fatal error:", error);
    return Response.json(
      { error: String(error?.message || error || "Unknown error") },
      { status: 500 }
    );
  }
});