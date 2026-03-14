import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileUrl, clientId } = await req.json();

    if (!profileUrl || !clientId) {
      return Response.json({ error: 'profileUrl and clientId required' }, { status: 400 });
    }

    // Fetch the Indeed profile page
    let pageContent = '';
    try {
      const res = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      pageContent = await res.text();
    } catch (fetchErr) {
      return Response.json({ error: 'Could not fetch Indeed profile. Make sure the URL is public.' }, { status: 422 });
    }

    // Strip HTML tags, keep readable text
    const textContent = pageContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // limit to avoid token overflow

    // Use AI to extract job applications from the page text
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a data extraction assistant. Extract any job applications, work experience, or applied jobs from this Indeed profile page content.

Page content:
${textContent}

Extract as many job entries as you can find. For each entry, extract:
- company name
- job position/title
- location (if available)
- approximate date applied or work period (if available, convert to YYYY-MM-DD format)
- job type (remote/hybrid/onsite if mentioned)
- any salary info

If this doesn't appear to be a valid Indeed profile with job data, return an empty array.`,
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
          },
          profile_name: { type: "string" }
        }
      }
    });

    return Response.json({
      applications: result.applications || [],
      profile_name: result.profile_name || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});