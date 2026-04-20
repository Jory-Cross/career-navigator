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

2. Extract ONLY real job-related skills, tools, certifications, software, equipment, or work abilities mentioned in the document.
Examples of valid tags:
- forklift
- customer service
- Microsoft Excel
- welding
- inventory management
- cash handling
- food preparation
- CNA
- CPR
- bilingual Spanish

DO NOT include:
- resume
- skills
- education
- work history
- employment history
- job history
- professional summary
- contact information
- job seeking
- employment goals
- section titles
- generic headings
- document structure labels

3. Extract job titles if clearly mentioned.

4. Write a short summary in 1-2 sentences.

Respond in this exact JSON format:
{
  "suggested_category": "",
  "tags": [],
  "job_titles": [],
  "summary": ""
}`;

try {
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
"Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
   model: "gpt-5.4-mini",
    messages: [
{
  role: "system",
  content: "You analyze documents for a vocational rehab CRM and must return valid JSON only."
},
{
  role: "user",
  content: `${prompt}

Document name: ${file_name}
Current category: ${current_category}
Notes: ${notes || "None"}`
}
    ]
  })
});

const data = await response.json();

console.log("OPENAI RAW RESPONSE:", data);

if (!response.ok) {
  return Response.json({
    suggested_category: current_category,
    tags: ["openai-error"],
    confidence: 0,
    debug_error: JSON.stringify(data)
  });
}

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