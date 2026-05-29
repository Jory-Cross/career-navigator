import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const WSA_CHAR_LIMITS = {
  worksite_simulation_location: 180,
  work_assessment_observations: 900,
  natural_support_observations: 850,
  life_skills_observations: 850,
  transportation_public: 220,
  transportation_private: 220,
  transportation_observations: 850,
  computer_skills_other: 220,
  computer_skill_observations: 850,
  interview_skill_observations: 850,
  other_observations: 850,
  current_work_skills: 950,
  work_skill_development_needs: 950,
  recommended_supports_on_job: 950,
  job_development_supports: 950,
  ongoing_supports: 950,
  behavioral_self_regulation: 850,
  activities_of_daily_living: 850,
  family_issues_supports: 850,
  criminal_background: 850,
  school_academic: 850,
  communication_needs: 700,
  assistive_technology_needs: 700,
  interpersonal_social_skills: 700,
  referral_question: 900,
  jobs_of_interest: 300,
  life_skills_needed: 300,
  planned_job_search_hours_week: 80,
  recommended_target_occupations: 350,
  industry_targeted_pay_range: 180,
  job_goal: 350,
  benefits_other: 350,
  hours_available_to_work: 250,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_id, mode, current_wsa_responses } = await req.json();

    if (!client_id) return Response.json({ success: false, error: 'client_id is required' }, { status: 400 });
    if (!mode || !['field_draft', 'detailed_report', 'both'].includes(mode)) {
      return Response.json({ success: false, error: 'mode must be field_draft, detailed_report, or both' }, { status: 400 });
    }

    // Load client
    const client = await base44.asServiceRole.entities.Client.get(client_id);
    if (!client) return Response.json({ success: false, error: 'Client not found' }, { status: 404 });

    // Load assessments and documents in parallel
    const [assessments, documents] = await Promise.all([
      base44.asServiceRole.entities.Assessment.filter({ client_id }),
      base44.asServiceRole.entities.Document.filter({ client_id }),
    ]);

    // Build context summary
    const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    const vfp = client.vocational_facts_profile || null;

    const assessmentSummaries = (assessments || []).map(a => ({
      type: a.assessment_type,
      responses: a.responses,
      notes: a.notes,
      completed_by: a.completed_by,
      date: a.created_date,
    }));

    const documentSummaries = (documents || [])
      .filter(d => d.ai_summary || d.extracted_text || d.title)
      .map(d => ({
        title: d.title,
        category: d.category,
        summary: d.ai_summary || '',
        extracted_text: d.extracted_text ? d.extracted_text.slice(0, 800) : '',
        skills: d.resume_skills || [],
        job_titles: d.job_titles || [],
        work_history: d.work_history || [],
      }));

    const wsaCharLimitsText = Object.entries(WSA_CHAR_LIMITS)
      .map(([k, v]) => `${k}: max ${v} chars`)
      .join('\n');

    const contextBlock = JSON.stringify({
      client: {
        name: clientName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        client_type: client.client_type,
        target_role: client.target_role,
        industry: client.industry,
        school: client.school,
        graduation_year: client.graduation_year,
        case_number: client.case_number,
        notes: client.notes,
        employer_name: client.employer_name,
        workplace_name: client.workplace_name,
      },
      vocational_facts_profile: vfp,
      assessments: assessmentSummaries,
      documents: documentSummaries,
      current_wsa_responses: current_wsa_responses || {},
    }, null, 2);

    let official_wsa_fields = null;
    let detailed_wsa_report_html = null;
    const staff_should_verify = [];
    const evidence_summary = [];

    // Build prompts based on mode
    if (mode === 'field_draft' || mode === 'both') {
      // Check if a detailed report already exists to use as primary source
      const existingDetailedReport = current_wsa_responses && current_wsa_responses._detailed_wsa_report_html;
      const hasDetailedReport = existingDetailedReport && existingDetailedReport.trim().length > 200;

      let fieldPrompt;

      if (hasDetailedReport) {
        // PRIMARY PATH: Compress the detailed report into official WSA fields
        fieldPrompt = `You are a vocational rehabilitation specialist helping complete the Utah DWS Work Strategy Assessment (WSA) for a client.

TASK: Compress the provided detailed WSA narrative report into official WSA PDF field values that fit the character limits.

DETAILED WSA REPORT (PRIMARY SOURCE — use this as your main reference):
${existingDetailedReport}

BACKUP CONTEXT (use only to fill gaps not covered by the detailed report):
${contextBlock}

STRICT CHARACTER LIMITS FOR EACH FIELD (do not exceed):
${wsaCharLimitsText}

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No extra text.
- The JSON must have a single key "official_wsa_fields" containing an object with WSA field keys.
- Only include keys from this list: ${Object.keys(WSA_CHAR_LIMITS).join(', ')}
- Each value must be a plain string, no markdown formatting.
- Each value must NOT exceed its character limit.

COMPRESSION WORKFLOW:
- Read the detailed WSA report section by section.
- For each official WSA field, find the matching section(s) in the detailed report.
- Compress those section details into the official WSA field, preserving the most important facts, examples, ratings, scores, barriers, supports, and vocational implications.
- The official_wsa_fields should be a shortened/compressed version of the detailed report — not a brand-new generic summary.
- Do not replace detailed report content with vague or generic statements.
- Use the backup context only to fill in information that is missing from the detailed report.

LENGTH EXPECTATIONS:
- For observation/recommendation fields with limits of 700 characters or more, use approximately 70% to 95% of the available character limit when the detailed report contains enough information.
- For fields under 300 characters, keep the answer brief and direct.
- Use complete, information-dense sentences.
- Avoid filler phrases like "Based on the profile" unless absolutely necessary.

PRESERVE FROM THE DETAILED REPORT:
- Specific ratings, scores, test results, and observed behaviors.
- Transportation limits, distances, or barriers.
- Training needs and skill gaps.
- Family/natural supports and their roles.
- Self-regulation needs, communication needs, and social skill notes.
- ADL/life-skill concerns.
- Computer skill levels or limitations.
- Job-development concerns, placement considerations, and strategy notes.
- Support needs and staff verification flags.
- Safety concerns.

CONTENT REQUIREMENTS:
- Do not invent facts. Only use information from the provided data.
- If evidence is weak or absent for a field, either leave it as an empty string "" or write a brief note like "[Staff: verify with client]".
- Do not include greetings or preamble in field values.
- Do not include markdown formatting in field values.
- Keep values professional, factual, and appropriate for a government vocational assessment form.
- Also include a "staff_should_verify" array of strings listing fields or topics that need staff review, and an "evidence_summary" array of brief strings describing what evidence sources were used.

Return JSON like:
{
  "official_wsa_fields": { ... },
  "staff_should_verify": ["...", "..."],
  "evidence_summary": ["...", "..."]
}`;
        console.log('Generating official_wsa_fields from detailed report (compression mode)...');
      } else {
        // FALLBACK PATH: Generate fields directly from raw context
        fieldPrompt = `You are a vocational rehabilitation specialist helping complete the Utah DWS Work Strategy Assessment (WSA) for a client.

TASK: First develop a complete detailed vocational analysis for each WSA section internally, then compress that analysis into professional official WSA PDF field values that fit the character limits.

CLIENT AND ASSESSMENT DATA:
${contextBlock}

STRICT CHARACTER LIMITS FOR EACH FIELD (do not exceed):
${wsaCharLimitsText}

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No extra text.
- The JSON must have a single key "official_wsa_fields" containing an object with WSA field keys.
- Only include keys from this list: ${Object.keys(WSA_CHAR_LIMITS).join(', ')}
- Each value must be a plain string, no markdown formatting.
- Each value must NOT exceed its character limit.

WORKFLOW:
- For each WSA field, first think through the full detailed vocational analysis using the client profile, FACTS/VFP, assessments, documents, resume data, uploaded WSA content, and current_wsa_responses.
- Then compress that detailed analysis into the official WSA field.
- Do not output the internal full analysis in official_wsa_fields.
- The compressed field should preserve the most important details, examples, barriers, supports, and vocational implications.

LENGTH EXPECTATIONS:
- Do not make observation fields overly brief.
- For observation/recommendation fields with limits of 700 characters or more, use approximately 70% to 95% of the available character limit when evidence is available.
- For fields under 300 characters, keep the answer brief and direct.
- Use complete, information-dense sentences.
- Avoid filler phrases like "Based on the profile" unless absolutely necessary.
- Avoid generic summaries that could apply to any client.

PRESERVE EXISTING DETAIL:
- Treat current_wsa_responses as important draft evidence.
- If a current field already contains useful detail, compress and refine it rather than replacing it with a shorter generic summary.
- Preserve concrete facts such as scores, ratings, transportation limits, observed behaviors, support people, training needs, work-setting concerns, and specific job-development implications.

CONTENT REQUIREMENTS:
- Include specific vocational implications when supported by evidence, such as job setting limits, transportation constraints, training needs, support needs, social tolerance, stamina, communication needs, safety concerns, supervision needs, and job-development strategy.
- Do not invent facts. Only use information from the provided data.
- If evidence is weak or absent for a field, either leave it as an empty string "" or write a brief note like "[Staff: verify with client]".
- Do not include greetings or preamble in field values.
- Keep values professional, factual, and appropriate for a government vocational assessment form.
- Also include a "staff_should_verify" array of strings listing fields or topics that need staff review, and an "evidence_summary" array of brief strings describing what evidence sources were used.
Return JSON like:
{
  "official_wsa_fields": { ... },
  "staff_should_verify": ["...", "..."],
  "evidence_summary": ["...", "..."]
}`;
        console.log('Generating official_wsa_fields from raw context (no detailed report found)...');
      }

      const fieldResult = await base44.integrations.Core.InvokeLLM({
        prompt: fieldPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            official_wsa_fields: { type: 'object' },
            staff_should_verify: { type: 'array', items: { type: 'string' } },
            evidence_summary: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      if (fieldResult && fieldResult.official_wsa_fields) {
        // Enforce char limits as a safety net
        const raw = fieldResult.official_wsa_fields;
        const clamped = {};
        for (const key of Object.keys(WSA_CHAR_LIMITS)) {
          if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
            const val = String(raw[key]);
            const limit = WSA_CHAR_LIMITS[key];
            clamped[key] = val.length <= limit ? val : val.slice(0, limit - 20).trimEnd() + '... [see report]';
          }
        }
        official_wsa_fields = clamped;
        if (fieldResult.staff_should_verify) staff_should_verify.push(...fieldResult.staff_should_verify);
        if (fieldResult.evidence_summary) evidence_summary.push(...fieldResult.evidence_summary);
      }
    }

    if (mode === 'detailed_report' || mode === 'both') {
      const reportPrompt = `You are a vocational rehabilitation specialist writing a detailed narrative Work Strategy Assessment (WSA) report for a Utah DWS client file.

TASK: Write a detailed HTML report that documents the Work Strategy Assessment findings in depth.

CLIENT AND ASSESSMENT DATA:
${contextBlock}

REQUIREMENTS:
- Return ONLY clean HTML. No markdown. No script tags. No style tags. No external links. No unsafe HTML.
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags appropriately.
- Structure the report with these sections:
  1. Client Overview
  2. Evidence Reviewed (list all sources used)
  3. Vocational Skills & Work History Analysis
  4. Functional Capabilities & Limitations
  5. Work Environment & Behavioral Observations
  6. Transportation & Community Access
  7. Support & Accommodation Needs
  8. Interpersonal & Communication Skills
  9. Job Development Recommendations
  10. Ongoing Support Recommendations
  11. Staff Verification Items (list anything that needs staff follow-up or cannot be confirmed from the data)
- Be thorough and analytical. Use complete sentences and professional language.
- Do not invent facts. Only reference information present in the provided data.
- Do not include a greeting or closing salutation.
- Do not include today's date or report generation metadata.

Return ONLY the HTML content (starting with <h2> or <div>).`;

      console.log('Generating detailed_wsa_report_html...');
      detailed_wsa_report_html = await base44.integrations.Core.InvokeLLM({
        prompt: reportPrompt,
      });
    }

    console.log(`generateWSAAIOutputs complete. mode=${mode}`);
    return Response.json({
      success: true,
      mode,
      official_wsa_fields: official_wsa_fields || null,
      detailed_wsa_report_html: detailed_wsa_report_html || null,
      staff_should_verify,
      evidence_summary,
    });

  } catch (error) {
    console.error('generateWSAAIOutputs error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});