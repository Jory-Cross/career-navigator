import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// v2 - fix: added required arrays to both InvokeLLM response_json_schema calls
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

const WSA_FIELD_LABELS = {
  worksite_simulation_location: 'Worksite Simulation Location',
  work_assessment_observations: 'Work Assessment Observations',
  natural_support_observations: 'Natural Support Assessment Observations',
  life_skills_observations: 'Life Skills Observations',
  transportation_public: 'Public Transportation Options',
  transportation_private: 'Private Transportation Options',
  transportation_observations: 'Transportation Assessment Observations',
  computer_skills_other: 'Computer Skills - Other',
  computer_skill_observations: 'Computer Skill Assessment Observations',
  interview_skill_observations: 'Interview Skill Assessment Observations',
  other_observations: 'Other Observations',
  current_work_skills: 'Current Work Skills, Knowledge, Skills, and Abilities',
  work_skill_development_needs: 'Work Skill Development Needs',
  recommended_supports_on_job: 'Recommended Supports on the Job',
  job_development_supports: 'Joint VR/CRP Recommendations for Job Development Supports',
  ongoing_supports: 'Joint VR/CRP Recommendations for Ongoing Supports',
  behavioral_self_regulation: 'Behavioral / Self-Regulation',
  activities_of_daily_living: 'Activities of Daily Living',
  family_issues_supports: 'Family Issues / Supports',
  criminal_background: 'Criminal Background',
  school_academic: 'School / Academic Information',
  communication_needs: 'Communication Needs',
  assistive_technology_needs: 'Identified Assistive Technology Needs',
  interpersonal_social_skills: 'Interpersonal / Social Skills',
  referral_question: 'Referral Question',
  jobs_of_interest: 'Jobs of Interest',
  life_skills_needed: 'Life Skills Needed',
    planned_job_search_hours_week: 'Planned CRP / Job Coach Job Development Hours per Week',
  recommended_target_occupations: 'Recommended Target Occupations',
  industry_targeted_pay_range: 'Industry Targeted Pay Range',
  job_goal: 'Job Goal',
  benefits_other: 'Benefits / Other',
  hours_available_to_work: 'Hours Available to Work',
};

const WSA_FIELD_KEYS = Object.keys(WSA_CHAR_LIMITS);

const PLANNED_JOB_SEARCH_HOURS_STAFF_NOTE =
  '[Staff entry required: enter planned CRP/job coach job-development support hours per week from verified plan or authorization.]';

const RECOMMENDED_TARGET_OCCUPATIONS_STAFF_NOTE =
  '[Staff/client selection required: enter the finalized top 3 occupational targets after realistic job exploration and review.]';

const JOB_DEVELOPMENT_SUPPORTS_VR_NOTE =
  '[Leave blank for VR completion during the close-out meeting.]';

const ONGOING_SUPPORTS_VR_NOTE =
  '[Leave blank for VR completion during the close-out meeting.]';
function safeString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function escapeHtml(value) {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncateForPrompt(value, maxLength) {
  const limit = maxLength || 8000;
  const text = safeString(value).trim();

  if (text.length <= limit) return text;

  return text.slice(0, limit).trim() + '... [truncated for AI context]';
}

function clampOfficialText(value, maxLength) {
  const text = safeString(value).replace(/\s+/g, ' ').trim();

  if (!text) return '';
  if (text.length <= maxLength) return text;

  const suffix = '... [see detailed WSA]';
  const sliceLength = Math.max(0, maxLength - suffix.length);

  return text.slice(0, sliceLength).trimEnd() + suffix;
}

function normalizeObject(value) {
  const output = {};

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return output;
  }

  for (const key of WSA_FIELD_KEYS) {
    if (value[key] !== undefined && value[key] !== null) {
      output[key] = safeString(value[key]).trim();
    }
  }

  return output;
}

function mergeUniqueStrings(target, values) {
  if (!Array.isArray(values)) return;

  for (const item of values) {
    const text = safeString(item).trim();

    if (text && !target.includes(text)) {
      target.push(text);
    }
  }
}

function stripUnsafeHtml(html) {
  return safeString(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function buildDetailedWsaHtml(detailedFields) {
  const sections = WSA_FIELD_KEYS.map((key) => {
    const label = WSA_FIELD_LABELS[key] || key;
    const value = detailedFields[key] || '';

    if (value) {
      return [
        '<section>',
        '<h2>' + escapeHtml(label) + '</h2>',
        '<p>' + escapeHtml(value).replace(/\n/g, '<br />') + '</p>',
        '</section>',
      ].join('\n');
    }

    return [
      '<section>',
      '<h2>' + escapeHtml(label) + '</h2>',
      '<p><em>No detailed information available for this field. Staff should verify if needed.</em></p>',
      '</section>',
    ].join('\n');
  }).join('\n');

  return [
    '<div class="detailed-wsa-fields">',
    '<h1>Full Detailed Work Strategy Assessment</h1>',
    '<p><em>This detailed WSA uses the same fields as the official WSA form, but is not limited by the PDF field character limits.</em></p>',
    sections,
    '</div>',
  ].join('\n');
}

function buildInterviewSkillObservationFromWsaInterview(interviewSessions) {
  const wsaSessions = Array.isArray(interviewSessions) ? interviewSessions : [];

  const answeredQuestions = wsaSessions.flatMap((session) =>
    Array.isArray(session.questions)
      ? session.questions.filter((q) => safeString(q.answer).trim())
      : []
  );

  if (answeredQuestions.length === 0) {
    return '';
  }

  const scores = answeredQuestions
    .map((q) => Number(q.score))
    .filter((score) => Number.isFinite(score));

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

  const lowScores = scores.filter((score) => score < 60).length;
  const completedCount = answeredQuestions.length;

  const scoreSentence =
    averageScore !== null
      ? ` Average interview response score was approximately ${averageScore}%.`
      : '';

  const supportSentence =
    lowScores > 0 || (averageScore !== null && averageScore < 70)
      ? 'The client would benefit from continued interview preparation, including mock interview practice, STAR-method training, support developing more specific examples, and coaching on how to describe work history, strengths, and areas for growth.'
      : 'The client demonstrates a developing foundation for interview participation and would benefit from continued practice to strengthen confidence, detail, and consistency.';

  return [
    `The client completed a WSA interview practice session with ${completedCount} answered interview question${completedCount === 1 ? '' : 's'}.`,
    scoreSentence,
    'Responses show the client can participate in structured interview questions and communicate basic job interests, but answers were often brief and would be stronger with more specific examples, clearer explanation of skills, and better connection to the target job.',
    supportSentence,
    'Recommended training includes mock interview practice, communication-skills coaching, customer-service interview preparation, STAR-method response practice, and guided preparation for common employer questions. Vocationally, the client may be able to participate in interviews with preparation, but should receive support before employer-facing interviews to improve confidence, clarity, and ability to explain relevant experience.'
  ]
    .filter(Boolean)
    .join(' ');
}

async function generateDetailedFields(base44, contextBlock) {
  const fieldLabelsText = WSA_FIELD_KEYS
    .map((key) => key + ': ' + (WSA_FIELD_LABELS[key] || key))
    .join('\n');

  const prompt = `You are a vocational rehabilitation specialist drafting a Full Detailed Work Strategy Assessment.

TASK:
Generate detailed_wsa_fields using the exact same field keys as the official WSA/PDF.

This is the FULL DETAILED WSA.
It must use the same fields as the official WSA.
It is NOT character limited.
It should provide complete detailed content for each WSA field when supported by evidence.

CLIENT, FACTS, ASSESSMENTS, DOCUMENTS, AND CURRENT WSA DATA:
${contextBlock}

EXACT WSA FIELD KEYS AND LABELS:
${fieldLabelsText}

RULES:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- The JSON must contain:
  {
    "detailed_wsa_fields": { ... },
    "staff_should_verify": ["..."],
    "evidence_summary": ["..."]
  }
- detailed_wsa_fields must only use the exact WSA field keys listed above.
- Do not create broad narrative sections inside detailed_wsa_fields.
- Do not invent facts.
- Use FACTS/VFP, assessments, documents, current WSA responses, uploaded WSA content, resume data, and staff/client notes when available.
- For every WSA field, review all relevant evidence across FACTS/VFP, assessments, documents, WSA interview sessions, resume/work history, staff/client notes, current WSA responses, and uploaded WSA content.
- Generate a current synthesized evaluation for each field. Do not simply reuse old WSA text when newer, stronger, or more specific evidence is available.
- Treat prior AI-generated WSA text as low-priority context only. It may be used if still accurate, but it must not override newer client evidence, assessment responses, interview responses, staff notes, documents, or FACTS/VFP details.
- If new evidence conflicts with older WSA text, prioritize the newer, more specific, more vocationally relevant evidence and mention staff should verify the conflict when appropriate.
- Do not say information is missing, unknown, or not completed if relevant evidence exists elsewhere in the provided client profile.
- Preserve concrete details, examples, scores, ratings, transportation barriers, support needs, training needs, behavior/self-regulation details, communication needs, family/natural supports, computer skills, ADL/life skills, criminal/background concerns, school/academic information, job goals, target occupations, job development supports, and ongoing supports when supported by evidence.
- WSA interview sessions are vocational assessment evidence, not just interview practice notes.
- Use completed WSA interview answers, feedback, scores, and overall feedback as evidence for interview_skill_observations, communication_needs, interpersonal_social_skills, current_work_skills, work_skill_development_needs, recommended_supports_on_job, and any other relevant field.
- For interview_skill_observations, synthesize all interview-related evidence into a brief professional vocational evaluation covering overall interview readiness, communication strengths, areas needing improvement, supports needed, recommended training, and vocational implications for employer interaction.
- Do not simply restate interview coaching feedback. Convert it into professional WSA assessment observations.
- CRITICAL interview session rule: If wsa_interview_sessions contains any session with answered_question_count > 0, the client HAS participated in structured interview practice. Do NOT state or imply that the client has not participated in mock interviews or interview practice. The completed WSA interview session IS the mock interview evidence.
- For interview_skill_observations specifically: describe the client's actual performance during the completed WSA interview session — what they did well, what they struggled with, scores if available, and what the responses indicate about their interview readiness. Do not mention absence of mock interview experience if a completed session exists.
- A self-reported confidence rating (e.g. "6 out of 10") is supplementary context only. It must not be the primary basis for interview_skill_observations when completed InterviewSession evidence is available.
- Each field should be written as a complete detailed WSA field response based on the best current evidence.
- If evidence is weak or unavailable for a field, write a staff-verification note rather than inventing information.
- Professional vocational rehabilitation tone.
- This content will become the long HTML WSA document and will later be compressed into the official WSA PDF fields.

CRITICAL — WORK ENVIRONMENT TOLERANCE INTEGRATION:
The context includes a "work_environment_tolerance_profile" block. This is structured evidence from the Work Environment Tolerance Assessment (WET). Follow these rules exactly:

FIELDS WHERE WET EVIDENCE IS ALLOWED:
- behavioral_self_regulation: Use overwhelm_triggers, overwhelm_signs, overwhelm_signs_detail, recovery_strategies, break_or_quiet_space_needed, past_stress_job_narrative as primary evidence.
- other_observations: Include WET findings — ideal vs. avoid environment synthesis, specific sensory triggers, stress recovery strategies, preferred supports, environmental red flags. Do NOT describe these as observed performance.
- recommended_supports_on_job: Use preferred_supports_at_work, break_quiet_detail, written_instructions_detail, sensory accommodation needs.
- work_skill_development_needs: Use pace tolerance, multitasking ability, interruptions tolerance, written instructions need, task switching tolerance as functional evidence.
- communication_needs: Use phone_communication, phone_difficulty_detail, conflict_tolerance.
- interpersonal_social_skills: Use customer_interaction_comfort, coworker_comfort, supervision_style_preference, and related narratives.
- assistive_technology_needs: Use any sensory accommodation or AT needs from WET.

CRITICAL — SOURCE MAPPING FOR WSA FIELDS:

SOURCE: Work Performance & Support Observation (assessment_type = "work_performance_support_observation")
Use this assessment's responses as the primary evidence for:
- worksite_simulation_location: Only populate from a specific employer name, facility, or site that is explicitly named in the Work Performance & Support Observation record. Do NOT infer or invent a location from any other source. If no explicit location is documented in this assessment, write: "[Staff entry required: enter the name and address of the worksite simulation or situational assessment location.]"
- work_assessment_observations: Summarize what was directly observed during the work performance assessment — tasks attempted, skills demonstrated, areas of difficulty, supervisor or staff observations, pace, accuracy, behavior, and vocational implications. Do NOT use WET data here. Do NOT invent a worksite name (e.g., Winegar's, cashier simulation, cash handling) unless the Work Performance & Support Observation record explicitly names it. If this assessment is absent or sparse, write: "[Staff entry required: describe observed client performance during the on-site worksite simulation, including skills demonstrated, areas of difficulty, and vocational implications.]"
- current_work_skills: Draw primarily from observed skills documented in the Work Performance & Support Observation.
- work_skill_development_needs: Draw primarily from skill gaps and development areas observed in the Work Performance & Support Observation. WET functional tolerance data (pace, multitasking, interruptions) may supplement but must be labeled as tolerance assessment findings, not observed worksite performance.
- recommended_supports_on_job: When support needs were directly observed during the work performance assessment, use that evidence as primary. WET preferred supports may supplement.

SOURCE: Work Environment Tolerance (assessment_type = "work_environment_tolerance")
Use WET responses as structured tolerance and functional capacity evidence for:
- behavioral_self_regulation: overwhelm_triggers, overwhelm_signs, overwhelm_signs_detail, recovery_strategies, break_or_quiet_space_needed, past_stress_job_narrative.
- other_observations: ideal vs. avoid environment synthesis, sensory triggers, stress recovery strategies, preferred supports, environmental red flags. Write these as documented tolerance findings, not observed worksite performance.
- recommended_supports_on_job: preferred_supports_at_work, break/quiet space needs, written instructions needs, sensory accommodation needs.
- communication_needs: phone_communication, phone_difficulty_detail, conflict_tolerance.
- interpersonal_social_skills: customer_interaction_comfort, coworker_comfort, supervision_style_preference.
- assistive_technology_needs: sensory or AT accommodation needs documented in WET.

STRICT PROHIBITION:
- NEVER use WET overwhelm_triggers, past_stress_job_narrative, or any WET narrative containing words like "check out," "line," "customers," or "cashier" as evidence for worksite_simulation_location or work_assessment_observations.
- WET narratives describe self-reported past experiences and tolerance assessments — they are NOT worksite simulation observations and must NEVER be interpreted as such.
- Do NOT infer a worksite name (Winegar's, a grocery store, a warehouse, a cashier station, etc.) from any WET field. A phrase like "a long line of people needing to check out" in overwhelm_triggers is a stress tolerance example, not a worksite simulation record.
- Do NOT describe cash handling, transaction processing, or cashier tasks as observed worksite performance unless the Work Performance & Support Observation explicitly documents those tasks.

If work_environment_tolerance_profile is null or sparse, rely on other available evidence for the WET-allowed fields and note that WET data was not available.
If no Work Performance & Support Observation exists for this client, use the staff-entry placeholder text for worksite_simulation_location and work_assessment_observations.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
  });

  const parsed = typeof result === 'string' ? JSON.parse(result) : result;
  const detailedFields = normalizeObject(parsed && parsed.detailed_wsa_fields);

    // These values cannot be finalized from AI-generated evidence alone.
  // They require verified staff entry, staff/client final selection, or VR completion.
  detailedFields.planned_job_search_hours_week =
    PLANNED_JOB_SEARCH_HOURS_STAFF_NOTE;

  detailedFields.recommended_target_occupations =
    RECOMMENDED_TARGET_OCCUPATIONS_STAFF_NOTE;

  detailedFields.job_development_supports =
    JOB_DEVELOPMENT_SUPPORTS_VR_NOTE;

  detailedFields.ongoing_supports =
    ONGOING_SUPPORTS_VR_NOTE;

  const staffShouldVerify = Array.isArray(parsed && parsed.staff_should_verify)
    ? parsed.staff_should_verify
    : [];

  if (!staffShouldVerify.includes(PLANNED_JOB_SEARCH_HOURS_STAFF_NOTE)) {
    staffShouldVerify.push(PLANNED_JOB_SEARCH_HOURS_STAFF_NOTE);
  }

  if (!staffShouldVerify.includes(RECOMMENDED_TARGET_OCCUPATIONS_STAFF_NOTE)) {
    staffShouldVerify.push(RECOMMENDED_TARGET_OCCUPATIONS_STAFF_NOTE);
  }

  if (!staffShouldVerify.includes(JOB_DEVELOPMENT_SUPPORTS_VR_NOTE)) {
    staffShouldVerify.push(JOB_DEVELOPMENT_SUPPORTS_VR_NOTE);
  }

  if (!staffShouldVerify.includes(ONGOING_SUPPORTS_VR_NOTE)) {
    staffShouldVerify.push(ONGOING_SUPPORTS_VR_NOTE);
  }

  return {
    detailed_wsa_fields: detailedFields,
    staff_should_verify: staffShouldVerify,
    evidence_summary: Array.isArray(parsed && parsed.evidence_summary)
      ? parsed.evidence_summary
      : [],
  };
}

// Staff/VR-only fields that must always be blanked regardless of detailed content.
const STAFF_VR_ONLY_KEYS = new Set([
  'planned_job_search_hours_week',
  'recommended_target_occupations',
  'job_development_supports',
  'ongoing_supports',
]);

async function generateOfficialFields(base44, detailedFields, contextBlock) {
  // Pass 1: copy every field that already fits within its character limit.
  // Only fields that are OVER the limit are sent to the LLM for compression.
  const officialFields = {};
  const overLimitFields = {};

  for (const key of WSA_FIELD_KEYS) {
    if (STAFF_VR_ONLY_KEYS.has(key)) {
      officialFields[key] = '';
      continue;
    }
    const limit = WSA_CHAR_LIMITS[key];
    const text = safeString(detailedFields[key]).replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
      // Fits — copy verbatim, no LLM needed.
      officialFields[key] = text;
    } else {
      // Over limit — needs compression.
      overLimitFields[key] = text;
    }
  }

  // Pass 2: if any fields are over-limit, compress only those via LLM.
  if (Object.keys(overLimitFields).length > 0) {
    const limitsText = Object.entries(overLimitFields)
      .map(([key]) => key + ': max ' + WSA_CHAR_LIMITS[key] + ' chars')
      .join('\n');

    const overLimitBlock = JSON.stringify(overLimitFields, null, 2);

    const prompt = `You are a vocational rehabilitation specialist completing the official Utah DWS Work Strategy Assessment PDF fields.

TASK:
The following WSA fields are too long for the official PDF character limits.
Condense ONLY these fields so they fit within their character limits.
Do not rewrite fields that are not listed here.

FIELDS TO CONDENSE:
${overLimitBlock}

STRICT CHARACTER LIMITS (these are the ONLY fields you must return):
${limitsText}

RULES:
- Return ONLY valid JSON.
- No markdown, no code fences.
- The JSON must contain: { "official_wsa_fields": { ... } }
- Only include the field keys listed above in official_wsa_fields.
- Condense only enough to fit within the character limit. Do not over-shorten.
- Preserve concrete details, examples, ratings, scores, barriers, supports, training needs, and vocational implications.
- Do not turn detailed content into vague generic summaries.
- Do not exceed the listed character limits.
- Do not invent facts.
- Plain professional text only.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    const compressed = normalizeObject(parsed && parsed.official_wsa_fields);

    for (const key of Object.keys(overLimitFields)) {
      const limit = WSA_CHAR_LIMITS[key];
      officialFields[key] = clampOfficialText(compressed[key] || overLimitFields[key], limit);
    }
  }

  console.log('DEBUG generateOfficialFields INPUT detailedFields.interview_skill_observations:', JSON.stringify(detailedFields.interview_skill_observations));
  console.log('DEBUG generateOfficialFields OUTPUT officialFields.interview_skill_observations:', JSON.stringify(officialFields.interview_skill_observations));

  return {
    official_wsa_fields: officialFields,
    staff_should_verify: [],
    evidence_summary: [],
  };
}

async function generateSupplementalReport(base44, contextBlock, detailedFields) {
  const prompt = `You are a vocational rehabilitation specialist writing a supplemental narrative Work Strategy Assessment report for a Utah DWS client file.

This supplemental report is an ADD-ON report.
It does not replace the Full Detailed WSA fields.
It may use broader narrative sections for staff review and analysis.

CLIENT, FACTS, ASSESSMENTS, DOCUMENTS, AND CURRENT WSA DATA:
${contextBlock}

FULL DETAILED WSA FIELDS:
${truncateForPrompt(detailedFields, 12000)}

REQUIREMENTS:
- Return ONLY clean HTML.
- No markdown.
- No script tags.
- No style tags.
- No external links.
- No unsafe HTML.
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags appropriately.
- Structure the report with these sections:
  1. Client Overview
  2. Evidence Reviewed
  3. Vocational Skills & Work History Analysis
  4. Functional Capabilities & Limitations
  5. Work Environment & Behavioral Observations
  6. Transportation & Community Access
  7. Support & Accommodation Needs
  8. Interpersonal & Communication Skills
  9. Job Development Recommendations
  10. Ongoing Support Recommendations
  11. Staff Verification Items
- Be thorough and analytical.
- Use complete sentences and professional language.
- Do not invent facts.
- Only reference information present in the provided data.
- Do not include a greeting or closing salutation.
- Do not include today's date or report generation metadata.

Return ONLY the HTML content starting with <h2> or <div>.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
  });

  return stripUnsafeHtml(result);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const client_id = body && body.client_id;
    const mode = body && body.mode;
    const current_wsa_responses = body && body.current_wsa_responses ? body.current_wsa_responses : {};

    if (!client_id) {
      return Response.json({ success: false, error: 'client_id is required' }, { status: 400 });
    }

    if (!mode || !['field_draft', 'detailed_report', 'both'].includes(mode)) {
      return Response.json(
        { success: false, error: 'mode must be field_draft, detailed_report, or both' },
        { status: 400 }
      );
    }

    const client = await base44.asServiceRole.entities.Client.get(client_id);

    if (!client) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

       const results = await Promise.all([
      base44.asServiceRole.entities.Assessment.filter({ client_id }),
      base44.asServiceRole.entities.Document.filter({ client_id }),
      base44.asServiceRole.entities.InterviewSession.filter({ client_id }),
    ]);

    const assessments = results[0] || [];
    const documents = results[1] || [];
    const interviewSessions = results[2] || [];

    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');

    // Strip large AI-generated HTML blobs and internal metadata keys from assessment responses
    // before including them in the LLM context block. These blobs can be 50-100KB each and
    // will cause the InvokeLLM call to fail with a payload-too-large / timeout error.
    const ASSESSMENT_CONTEXT_STRIP_KEYS = new Set([
      '_full_detailed_wsa_html',
      '_supplemental_wsa_report_html',
      '_detailed_wsa_report_html',
      '_detailed_wsa_fields',
      '_wsa_ai_evidence_summary',
      '_wsa_ai_staff_should_verify',
      '_wsa_ai_fields_generated_at',
      '_wsa_report_evidence_summary',
      '_wsa_report_staff_should_verify',
      '_wsa_report_generated_at',
    ]);

    const assessmentSummaries = assessments.map((assessment) => {
      const responses = assessment.responses
        ? Object.fromEntries(
            Object.entries(assessment.responses).filter(([k]) => !ASSESSMENT_CONTEXT_STRIP_KEYS.has(k))
          )
        : {};
      return {
        type: assessment.assessment_type,
        status: assessment.status,
        responses,
        notes: assessment.notes,
        completed_by: assessment.completed_by,
        date: assessment.updated_date || assessment.created_date,
      };
    });

       const documentSummaries = documents
      .filter((document) => document.ai_summary || document.extracted_text || document.title)
      .map((document) => ({
        title: document.title,
        category: document.category || document.document_type || document.type,
        summary: document.ai_summary || document.summary || '',
        extracted_text: document.extracted_text ? document.extracted_text.slice(0, 1500) : '',
        skills: document.resume_skills || [],
        job_titles: document.job_titles || [],
        work_history: document.work_history || [],
        education_history: document.education_history || [],
        certifications: document.certifications || [],
      }));

    const interviewSessionSummaries = interviewSessions
      .filter((session) => safeString(session.session_type).toLowerCase() === 'wsa')
      .map((session) => {
        const questions = Array.isArray(session.questions)
          ? session.questions.map((q) => ({
              question: q.question || '',
              category: q.category || '',
              answer: q.answer || '',
              feedback: q.feedback || '',
              score: q.score || null,
            }))
          : [];

        const answeredQuestions = questions.filter((q) => safeString(q.answer).trim());

        return {
          session_type: session.session_type,
          target_role: session.target_role || '',
          session_date: session.session_date || session.updated_date || session.created_date || '',
          completed: answeredQuestions.length > 0,
          answered_question_count: answeredQuestions.length,
          overall_feedback: session.overall_feedback || '',
          notes: session.notes || '',
          questions,
        };
      });
    // Also strip large blobs from the current WSA responses passed by the frontend.
    const sourceWsaResponses = Object.fromEntries(
      Object.entries(current_wsa_responses).filter(([k]) => !ASSESSMENT_CONTEXT_STRIP_KEYS.has(k))
    );
          // These fields must not be inferred from prior AI output.
    // They are completed only through verified staff entry,
    // final staff/client selection, or VR close-out completion.
    delete sourceWsaResponses.planned_job_search_hours_week;
    delete sourceWsaResponses.recommended_target_occupations;
    delete sourceWsaResponses.job_development_supports;
    delete sourceWsaResponses.ongoing_supports;

    delete sourceWsaResponses.interview_skill_observations;

    if (sourceWsaResponses._detailed_wsa_fields) {
      sourceWsaResponses._detailed_wsa_fields = {
        ...sourceWsaResponses._detailed_wsa_fields,
      };

      delete sourceWsaResponses._detailed_wsa_fields.planned_job_search_hours_week;
      delete sourceWsaResponses._detailed_wsa_fields.recommended_target_occupations;
      delete sourceWsaResponses._detailed_wsa_fields.job_development_supports;
      delete sourceWsaResponses._detailed_wsa_fields.ongoing_supports;

      delete sourceWsaResponses._detailed_wsa_fields.interview_skill_observations;
    }


    // Extract Work Environment Tolerance Assessment (WET) data as a dedicated block
    // so the LLM can synthesize it into work_assessment_observations, other_observations,
    // worksite_simulation_location, and vocational implications fields.
    const wetAssessment = assessments.find(a => a.assessment_type === 'work_environment_tolerance');
    const wetResponses = wetAssessment && wetAssessment.responses
      ? Object.fromEntries(
          Object.entries(wetAssessment.responses).filter(([k]) => !ASSESSMENT_CONTEXT_STRIP_KEYS.has(k))
        )
      : null;

    const workEnvironmentToleranceProfile = wetResponses ? {
      // Section 1: General Work Environment Preference
      setting_preference: wetResponses.setting_preference || null,
      environment_noise_level: wetResponses.environment_noise_level || null,
      routine_vs_variety: wetResponses.routine_vs_variety || null,
      routine_importance_narrative: wetResponses.routine_importance_narrative || null,
      independent_vs_team: wetResponses.independent_vs_team || null,
      // Section 2: Sensory Tolerance
      noise_tolerance_scale: wetResponses.noise_tolerance_scale || null,
      noise_sensitivity_detail: wetResponses.noise_sensitivity_detail || null,
      lighting_tolerance: wetResponses.lighting_tolerance || null,
      lighting_detail: wetResponses.lighting_detail || null,
      sensory_triggers_select: wetResponses.sensory_triggers_select || null,
      sensory_triggers_narrative: wetResponses.sensory_triggers_narrative || null,
      sensory_examples_history: wetResponses.sensory_examples_history || null,
      // Section 3: Social & Customer Interaction
      customer_interaction_comfort: wetResponses.customer_interaction_comfort || null,
      customer_avoidance_detail: wetResponses.customer_avoidance_detail || null,
      coworker_comfort: wetResponses.coworker_comfort || null,
      coworker_conflict_narrative: wetResponses.coworker_conflict_narrative || null,
      supervision_style_preference: wetResponses.supervision_style_preference || null,
      supervision_issues_narrative: wetResponses.supervision_issues_narrative || null,
      phone_communication: wetResponses.phone_communication || null,
      phone_difficulty_detail: wetResponses.phone_difficulty_detail || null,
      conflict_tolerance: wetResponses.conflict_tolerance || null,
      // Section 4: Pace, Multitasking & Routine
      fast_pace_tolerance: wetResponses.fast_pace_tolerance || null,
      pace_struggle_narrative: wetResponses.pace_struggle_narrative || null,
      multitasking_ability: wetResponses.multitasking_ability || null,
      interruptions_tolerance: wetResponses.interruptions_tolerance || null,
      interruption_impact_narrative: wetResponses.interruption_impact_narrative || null,
      written_instructions_need: wetResponses.written_instructions_need || null,
      written_instructions_detail: wetResponses.written_instructions_detail || null,
      task_switching_tolerance: wetResponses.task_switching_tolerance || null,
      // Section 5: Stress & Overstimulation Recovery
      overwhelm_triggers: wetResponses.overwhelm_triggers || null,
      overwhelm_signs: wetResponses.overwhelm_signs || null,
      overwhelm_signs_detail: wetResponses.overwhelm_signs_detail || null,
      recovery_strategies: wetResponses.recovery_strategies || null,
      break_or_quiet_space_needed: wetResponses.break_or_quiet_space_needed || null,
      break_quiet_detail: wetResponses.break_quiet_detail || null,
      past_stress_job_impact: wetResponses.past_stress_job_impact || null,
      past_stress_job_narrative: wetResponses.past_stress_job_narrative || null,
      // Section 6: Best-Fit Work Conditions
      ideal_environment_narrative: wetResponses.ideal_environment_narrative || null,
      environments_to_avoid: wetResponses.environments_to_avoid || null,
      preferred_supports_at_work: wetResponses.preferred_supports_at_work || null,
      staff_followup_flags: wetResponses.staff_followup_flags || null,
    } : null;

    const contextPayload = {
      client: {
        name: clientName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        client_type: client.client_type,
        target_role: client.target_role,
        job_goal: client.job_goal || client.employment_goal,
        industry: client.industry,
        school: client.school,
        graduation_year: client.graduation_year,
        case_number: client.case_number,
        notes: client.notes,
        employer_name: client.employer_name,
        workplace_name: client.workplace_name,
      },
      work_environment_tolerance_profile: workEnvironmentToleranceProfile,
      vocational_facts_profile:
        client.vocational_facts_profile ||
        client.vocational_profile ||
        client.facts_profile ||
        null,
      vocational_facts_metadata:
        client.vocational_facts_metadata ||
        client.facts_metadata ||
        null,
      assessments: assessmentSummaries,
      documents: documentSummaries,
      wsa_interview_sessions: interviewSessionSummaries,
      current_wsa_responses: sourceWsaResponses,
    };

    console.log(
      'WSA DEBUG context wsa_interview_sessions:',
      JSON.stringify(contextPayload.wsa_interview_sessions, null, 2)
    );

    const contextBlock = JSON.stringify(contextPayload, null, 2);
    let detailed_wsa_fields = null;
    let official_wsa_fields = null;
    let full_detailed_wsa_html = null;
    let supplemental_wsa_report_html = null;

    const staff_should_verify = [];
    const evidence_summary = [];

    if (mode === 'detailed_report' || mode === 'both') {
      console.log('Generating full detailed WSA fields...');
      const detailedResult = await generateDetailedFields(base44, contextBlock);

      detailed_wsa_fields = detailedResult.detailed_wsa_fields;

      mergeUniqueStrings(staff_should_verify, detailedResult.staff_should_verify);
      mergeUniqueStrings(evidence_summary, detailedResult.evidence_summary);

      full_detailed_wsa_html = buildDetailedWsaHtml(detailed_wsa_fields);

      console.log('Generating supplemental WSA narrative report...');
      supplemental_wsa_report_html = await generateSupplementalReport(
        base44,
        contextBlock,
        detailed_wsa_fields
      );
    }

    if (mode === 'field_draft') {
      console.log('Generating fresh detailed WSA fields before compression so new evidence is included...');
      console.log('DEBUG interview_sessions_in_context count:', interviewSessionSummaries.length);
      const detailedResult = await generateDetailedFields(base44, contextBlock);

       detailed_wsa_fields = detailedResult.detailed_wsa_fields;

      console.log('DEBUG detailedResult.detailed_wsa_fields.interview_skill_observations:', detailed_wsa_fields && detailed_wsa_fields.interview_skill_observations);

      full_detailed_wsa_html = buildDetailedWsaHtml(detailed_wsa_fields);
      mergeUniqueStrings(staff_should_verify, detailedResult.staff_should_verify);
      mergeUniqueStrings(evidence_summary, detailedResult.evidence_summary);
    }
    
    if ((mode === 'field_draft' || mode === 'both') && detailed_wsa_fields) {
      console.log('Compressing detailed WSA fields into official WSA fields...');
      const officialResult = await generateOfficialFields(base44, detailed_wsa_fields, contextBlock);

      official_wsa_fields = officialResult.official_wsa_fields;
      console.log('DEBUG officialResult.official_wsa_fields.interview_skill_observations:', official_wsa_fields && official_wsa_fields.interview_skill_observations);
      mergeUniqueStrings(staff_should_verify, officialResult.staff_should_verify);
      mergeUniqueStrings(evidence_summary, officialResult.evidence_summary);
    }

    console.log('generateWSAAIOutputs complete. mode=' + mode);

    return Response.json({
      success: true,
      mode: mode,
      detailed_wsa_fields: detailed_wsa_fields || null,
      full_detailed_wsa_html: full_detailed_wsa_html || null,
      official_wsa_fields: official_wsa_fields || null,
      supplemental_wsa_report_html: supplemental_wsa_report_html || null,

      // Backward compatibility for the current frontend until it is updated.
      detailed_wsa_report_html: supplemental_wsa_report_html || full_detailed_wsa_html || null,

      staff_should_verify: staff_should_verify,
      evidence_summary: evidence_summary,
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Failed to generate WSA AI outputs';
    const stack = error && error.stack ? error.stack : '';

    console.error('generateWSAAIOutputs error:', message, stack);

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
});