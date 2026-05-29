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

const WSA_FIELD_KEYS = Object.keys(WSA_CHAR_LIMITS).join(', ');
const wsaCharLimitsText = Object.entries(WSA_CHAR_LIMITS)
  .map(([k, v]) => `${k}: max ${v} chars`)
  .join('\n');

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

    let detailed_wsa_fields = null;
    let official_wsa_fields = null;
    let supplemental_wsa_report_html = null;
    const staff_should_verify = [];
    const evidence_summary = [];

    // ─── STEP 1: Generate detailed_wsa_fields (needed for detailed_report and both modes, or as fallback for field_draft) ───
    const needDetailedFields = mode === 'detailed_report' || mode === 'both';
    const existingDetailedFields = current_wsa_responses && current_wsa_responses._detailed_wsa_fields;
    const hasExistingDetailedFields = existingDetailedFields && typeof existingDetailedFields === 'object' &&
      Object.keys(existingDetailedFields).length > 0;

    if (needDetailedFields || (mode === 'field_draft' && !hasExistingDetailedFields)) {
      const detailedFieldsPrompt = `You are a vocational rehabilitation specialist completing the Utah DWS Work Strategy Assessment (WSA) for a client.

TASK: Generate a full detailed WSA answer for each official WSA field key. These are the same fields as the official Utah WSA PDF form, but with NO character limits — write complete, thorough answers for each field.

CLIENT AND ASSESSMENT DATA:
${contextBlock}

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No extra text.
- The JSON must have a single key "detailed_wsa_fields" containing an object keyed by WSA field names.
- Only use these exact field keys: ${WSA_FIELD_KEYS}
- Each value must be a plain string — no markdown, no HTML, no bullet symbols.
- There are NO character limits. Write complete, detailed answers.
- Do not use broad narrative report sections. Every answer must directly address its specific WSA field.

FIELD COVERAGE REQUIREMENTS:
- work_assessment_observations: Detailed observations of work skills, pace, quality, task completion, and work behaviors observed or reported.
- natural_support_observations: Who provides natural support, their relationship, availability, reliability, and vocational implications.
- life_skills_observations: ADL and life skill performance relevant to employment readiness.
- transportation_public: Public transportation access, ability, barriers, current use.
- transportation_private: Private vehicle access, driver status, barriers.
- transportation_observations: Full transportation analysis including barriers, solutions, and vocational impact.
- computer_skills_other: Specific computer skill level, programs used, limitations.
- computer_skill_observations: Detailed computer skill analysis and employment implications.
- interview_skill_observations: Communication, presentation, interview readiness observations.
- other_observations: Any other relevant vocational observations not captured elsewhere.
- current_work_skills: Specific transferable skills, work history, demonstrated competencies.
- work_skill_development_needs: Specific skill gaps, training needs, and learning considerations.
- recommended_supports_on_job: Specific on-the-job supports, accommodations, and strategies.
- job_development_supports: Job development strategy, employer approach, placement considerations.
- ongoing_supports: Long-term support needs post-placement.
- behavioral_self_regulation: Self-regulation, emotional regulation, stress tolerance, behavioral concerns.
- activities_of_daily_living: ADL independence level, personal care, daily living skills relevant to work.
- family_issues_supports: Family dynamics, supports, barriers, natural support network.
- criminal_background: Criminal history concerns, disclosure needs, employer considerations.
- school_academic: Academic history, educational level, learning considerations.
- communication_needs: Communication style, barriers, accommodations needed.
- assistive_technology_needs: Assistive technology currently used or potentially needed.
- interpersonal_social_skills: Social skill level, workplace relationship considerations, peer interaction.
- referral_question: What specific vocational questions this WSA was meant to answer.
- jobs_of_interest: Jobs the client has expressed interest in.
- life_skills_needed: Specific life skills that need development for employment success.
- planned_job_search_hours_week: How many hours per week the client plans to job search.
- recommended_target_occupations: Specific occupations recommended based on assessment findings.
- industry_targeted_pay_range: Target industry and pay range based on skills and goals.
- job_goal: The client's stated and assessed vocational goal.
- benefits_other: Benefits considerations, SSI/SSDI concerns, work incentives.
- hours_available_to_work: How many hours per week the client is available to work and any restrictions.
- worksite_simulation_location: Where the worksite simulation or assessment was conducted.

EVIDENCE GUIDANCE:
- Use FACTS/VFP, assessment responses, uploaded documents, resume data, staff notes, and current_wsa_responses as evidence.
- Preserve specific details: scores, ratings, dates, transportation distances, support names, training programs, behavioral examples, medical/disability considerations when stated.
- Do not invent facts. If evidence is absent for a field, write a brief note like "[Staff: verify with client]" or leave as empty string.
- Do not include greetings or preamble.

Also include:
- "staff_should_verify": array of strings for fields or topics needing staff review.
- "evidence_summary": array of strings describing what evidence sources were used.

Return JSON like:
{
  "detailed_wsa_fields": { ... },
  "staff_should_verify": ["...", "..."],
  "evidence_summary": ["...", "..."]
}`;

      console.log('Generating detailed_wsa_fields...');
      const detailedResult = await base44.integrations.Core.InvokeLLM({
        prompt: detailedFieldsPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            detailed_wsa_fields: { type: 'object' },
            staff_should_verify: { type: 'array', items: { type: 'string' } },
            evidence_summary: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      if (detailedResult && detailedResult.detailed_wsa_fields) {
        detailed_wsa_fields = detailedResult.detailed_wsa_fields;
        if (detailedResult.staff_should_verify) staff_should_verify.push(...detailedResult.staff_should_verify);
        if (detailedResult.evidence_summary) evidence_summary.push(...detailedResult.evidence_summary);
      }
    } else if (mode === 'field_draft' && hasExistingDetailedFields) {
      // Use the already-saved detailed_wsa_fields from current_wsa_responses
      detailed_wsa_fields = existingDetailedFields;
      console.log('Using existing detailed_wsa_fields from current_wsa_responses...');
    }

    // ─── STEP 2: Generate official_wsa_fields (field_draft and both modes) ───
    if (mode === 'field_draft' || mode === 'both') {
      const sourceDetailedFields = detailed_wsa_fields || existingDetailedFields;
      const hasDetailedFieldsForCompression = sourceDetailedFields && Object.keys(sourceDetailedFields).length > 0;

      let officialPrompt;

      if (hasDetailedFieldsForCompression) {
        officialPrompt = `You are a vocational rehabilitation specialist completing the Utah DWS Work Strategy Assessment (WSA) for a client.

TASK: Compress the provided detailed WSA field answers into official WSA PDF field values that fit the strict character limits.

DETAILED WSA FIELDS (PRIMARY SOURCE — compress these into official_wsa_fields):
${JSON.stringify(sourceDetailedFields, null, 2)}

BACKUP CONTEXT (use only to fill gaps not in the detailed fields):
${contextBlock}

STRICT CHARACTER LIMITS FOR EACH FIELD (do not exceed):
${wsaCharLimitsText}

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No extra text.
- The JSON must have a single key "official_wsa_fields" containing an object with WSA field keys.
- Only use these exact field keys: ${WSA_FIELD_KEYS}
- Each value must be a plain string — no markdown formatting, no HTML.
- Each value must NOT exceed its character limit.

COMPRESSION WORKFLOW:
- For each official WSA field, read the matching detailed_wsa_fields value.
- Compress it into the character limit, preserving the most important facts, barriers, supports, ratings, scores, examples, and vocational implications.
- official_wsa_fields must be a compressed version of detailed_wsa_fields — not a vague generic summary.
- Use backup context only to fill gaps absent from the detailed fields.

LENGTH EXPECTATIONS:
- For fields with limits of 700 characters or more, use approximately 70–95% of available space when the detailed field has enough content.
- For fields under 300 characters, keep it brief and direct.
- Use information-dense sentences. Avoid filler phrases.

CONTENT REQUIREMENTS:
- Do not invent facts.
- Preserve: scores, ratings, transportation barriers, training needs, support names/roles, behavioral examples, communication needs, ADL concerns, computer skill limits, job development strategy, safety concerns.
- If evidence is absent, leave as "" or "[Staff: verify with client]".
- No greetings. No preamble. No markdown in values.
- Also include "staff_should_verify" and "evidence_summary" arrays.

Return JSON like:
{
  "official_wsa_fields": { ... },
  "staff_should_verify": ["...", "..."],
  "evidence_summary": ["...", "..."]
}`;
        console.log('Generating official_wsa_fields by compressing detailed_wsa_fields...');
      } else {
        officialPrompt = `You are a vocational rehabilitation specialist helping complete the Utah DWS Work Strategy Assessment (WSA) for a client.

TASK: Develop a detailed vocational analysis for each WSA section internally, then compress it into official WSA PDF field values that fit the character limits.

CLIENT AND ASSESSMENT DATA:
${contextBlock}

STRICT CHARACTER LIMITS FOR EACH FIELD (do not exceed):
${wsaCharLimitsText}

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No extra text.
- The JSON must have a single key "official_wsa_fields" containing an object with WSA field keys.
- Only use these exact field keys: ${WSA_FIELD_KEYS}
- Each value must be a plain string, no markdown formatting.
- Each value must NOT exceed its character limit.

WORKFLOW:
- For each WSA field, analyze the full available evidence, then compress into the official field.
- Preserve the most important details, examples, barriers, supports, and vocational implications.

LENGTH EXPECTATIONS:
- For observation/recommendation fields with limits of 700 characters or more, use approximately 70–95% of the available limit when evidence supports it.
- For fields under 300 characters, keep the answer brief and direct.
- Use complete, information-dense sentences.

CONTENT REQUIREMENTS:
- Treat current_wsa_responses as important draft evidence.
- Preserve concrete facts: scores, ratings, transportation limits, observed behaviors, support people, training needs, work-setting concerns, job-development implications.
- Do not invent facts.
- If evidence is absent, leave as "" or "[Staff: verify with client]".
- No greetings. No preamble. No markdown in values.
- Also include "staff_should_verify" and "evidence_summary" arrays.

Return JSON like:
{
  "official_wsa_fields": { ... },
  "staff_should_verify": ["...", "..."],
  "evidence_summary": ["...", "..."]
}`;
        console.log('Generating official_wsa_fields from raw context (no detailed fields available)...');
      }

      const officialResult = await base44.integrations.Core.InvokeLLM({
        prompt: officialPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            official_wsa_fields: { type: 'object' },
            staff_should_verify: { type: 'array', items: { type: 'string' } },
            evidence_summary: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      if (officialResult && officialResult.official_wsa_fields) {
        // Enforce char limits as a safety clamp
        const raw = officialResult.official_wsa_fields;
        const clamped = {};
        for (const key of Object.keys(WSA_CHAR_LIMITS)) {
          if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
            const val = String(raw[key]);
            const limit = WSA_CHAR_LIMITS[key];
            clamped[key] = val.length <= limit ? val : val.slice(0, limit - 20).trimEnd() + '... [see report]';
          }
        }
        official_wsa_fields = clamped;
        if (officialResult.staff_should_verify) staff_should_verify.push(...officialResult.staff_should_verify);
        if (officialResult.evidence_summary) evidence_summary.push(...officialResult.evidence_summary);
      }
    }

    // ─── STEP 3: Generate supplemental_wsa_report_html (detailed_report and both modes) ───
    if (mode === 'detailed_report' || mode === 'both') {
      const reportPrompt = `You are a vocational rehabilitation specialist writing a supplemental narrative Work Strategy Assessment (WSA) report for a Utah DWS client file.

TASK: Write a detailed HTML narrative report covering broader vocational rehabilitation context. This is a supplemental add-on report — not the field-by-field WSA form itself.

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

      console.log('Generating supplemental_wsa_report_html...');
      supplemental_wsa_report_html = await base44.integrations.Core.InvokeLLM({
        prompt: reportPrompt,
      });
    }

    console.log(`generateWSAAIOutputs complete. mode=${mode}`);
    return Response.json({
      success: true,
      mode,
      detailed_wsa_fields: detailed_wsa_fields || null,
      official_wsa_fields: official_wsa_fields || null,
      supplemental_wsa_report_html: supplemental_wsa_report_html || null,
      // Compatibility alias: keep detailed_wsa_report_html pointing to supplemental until frontend is updated
      detailed_wsa_report_html: supplemental_wsa_report_html || null,
      staff_should_verify,
      evidence_summary,
    });

  } catch (error) {
    console.error('generateWSAAIOutputs error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});