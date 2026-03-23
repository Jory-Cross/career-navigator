import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { document_id, file_url, file_name, current_category } = await req.json();

    // Analyze document content and generate tags/category
    const prompt = `Analyze this document and provide:
1. A suggested category (choose from: resume, cover_letter, contract, notes, reference, certification, portfolio, other)
2. Auto-generated tags (5-7 relevant tags based on content and type)

Document name: ${file_name}
Current category: ${current_category}

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});