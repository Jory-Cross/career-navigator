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

const prompt = `Analyze this document and provide:
1. A suggested category (choose from: resume, cover_letter, assessment, authorization, certification, portfolio, other)
2. Auto-generated tags (5-7 relevant tags based on content and type)

Document name: ${file_name}
Current category: ${current_category}
Notes: ${notes || "None"}

Respond in this exact JSON format:
{
  "suggested_category": "category_name",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95
}`;

const { data: analysisResult } = await base44.integrations.Core.InvokeLLM({
  prompt,
  response_json_schema: {
    type: 'object',
    properties: {
      suggested_category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' }
    },
    required: ['suggested_category', 'tags', 'confidence']
  }
});

return Response.json(analysisResult);
  } catch (error) {
    console.error("analyzeDocumentContent fatal error:", error);
    return Response.json(
      { error: String(error?.message || error || "Unknown error") },
      { status: 500 }
    );
  }
});