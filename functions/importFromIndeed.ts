import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pastedText, clientId } = await req.json();

    if (!pastedText || !clientId) {
      return Response.json({ error: 'pastedText and clientId required' }, { status: 400 });
    }

    // Limit text size to avoid token overflow
    const textContent = pastedText.trim().slice(0, 10000);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a data extraction assistant. The user has copied and pasted text from their Indeed "Applied Jobs" page. Extract all job applications from this text.

Pasted text:
${textContent}

Extract every job application you can find. For each entry, extract:
- company name
- job position/title  
- location (if available)
- date applied (if available, convert to YYYY-MM-DD format, otherwise leave empty string)
- job type (remote/hybrid/onsite if mentioned, otherwise empty string)
- salary info (if mentioned, otherwise empty string)

Return as many entries as you can identify. If no job applications are found, return an empty array.`,
      response_json_schema: {
        type: "object",
        properties: {
          applications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                position: { type: "string" },
                location: { type: "string" },
                applied_date: { type: "string" },
                work_type: { type: "string", enum: ["remote", "hybrid", "onsite", ""] },
                salary_range: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({
      applications: result.applications || []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});