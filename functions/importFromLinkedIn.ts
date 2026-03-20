import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileUrl } = await req.json();
    if (!profileUrl) {
      return Response.json({ error: 'profileUrl is required' }, { status: 400 });
    }

    // Fetch the LinkedIn profile page
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
      return Response.json({ error: 'Could not fetch LinkedIn profile. Make sure the URL is public.' }, { status: 422 });
    }

    // Strip scripts, styles, HTML tags
    const textContent = pageContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional data extraction assistant. Extract job application information from this LinkedIn profile page content.

Page content:
${textContent}

Extract job application data for companies where the person has worked. For each position, extract:
- Company name
- Job position/title
- Location (if available)
- When they worked there (as YYYY-MM-DD if possible, otherwise leave empty)
- Industry/type (if remote/hybrid/onsite can be inferred, include it)
- Any salary info mentioned

Also extract general profile info:
- Full name
- Professional headline/summary
- Skills list
- Work experience details
- Education

If a field is not found, use empty string or empty array.`,
      response_json_schema: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          headline: { type: "string" },
          summary: { type: "string" },
          job_applications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                position: { type: "string" },
                location: { type: "string" },
                applied_date: { type: "string" },
                work_type: { type: "string" },
                salary_range: { type: "string" }
              }
            }
          },
          experience: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                role: { type: "string" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                description: { type: "string" },
                current: { type: "boolean" }
              }
            }
          },
          education: {
            type: "array",
            items: {
              type: "object",
              properties: {
                institution: { type: "string" },
                degree: { type: "string" },
                field: { type: "string" },
                graduation_year: { type: "string" }
              }
            }
          },
          skills: {
            type: "array",
            items: { type: "string" }
          },
          certifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                issuer: { type: "string" },
                year: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});