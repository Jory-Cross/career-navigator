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

try {
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_OPENAI_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Analyze documents for a vocational rehab CRM. Return JSON: {suggested_category, tags, confidence}"
      },
      {
        role: "user",
        content: `
Document name: ${file_name}
Category: ${current_category}
Notes: ${notes || "None"}

Return 5–7 relevant tags and a category.
`
      }
    ]
  })
});

const data = await response.json();
const content = data.choices?.[0]?.message?.content || "{}";

let parsed;
try {
  parsed = JSON.parse(content);
} catch {
  parsed = {
    suggested_category: current_category,
    tags: ["parse-error"],
    confidence: 0
  };
}

return Response.json(parsed);

  return Response.json(analysisResult);
} catch (llmError) {
  return Response.json({
    suggested_category: current_category || "other",
    tags: ["llm-error"],
    confidence: 0,
    debug_error: String(llmError?.message || llmError || "InvokeLLM failed")
  });
}
  } catch (error) {
    console.error("analyzeDocumentContent fatal error:", error);
    return Response.json(
      { error: String(error?.message || error || "Unknown error") },
      { status: 500 }
    );
  }
});