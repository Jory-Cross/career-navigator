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
- Preserve concrete details, examples, scores, ratings, transportation barriers, support needs, training needs, behavior/self-regulation details, communication needs, family/natural supports, computer skills, ADL/life skills, criminal/background concerns, school/academic information, job goals, target occupations, job development supports, and ongoing supports when supported by evidence.
- WSA interview sessions are vocational assessment evidence, not just interview practice notes.
- If wsa_interview_sessions contains completed answers, use those answers and feedback as evidence for interview_skill_observations.
- For interview_skill_observations, write a brief professional vocational evaluation covering:
  1. overall interview performance,
  2. communication strengths,
  3. areas needing improvement,
  4. supports needed,
  5. recommended training,
  6. vocational implications for employer interaction.
- Use interview answers and feedback to identify needs such as mock interview practice, STAR method training, confidence-building, help explaining work history, help describing strengths/weaknesses, employer-question preparation, and customer-service communication practice when supported by evidence.
- Do not say the client has not completed mock interview practice if WSA interview session data exists.
- Do not simply restate interview coaching feedback. Convert it into professional WSA assessment observations.
- Each field should be written as a complete detailed WSA field response.
- If evidence is weak or unavailable for a field, write a staff-verification note rather than inventing information.
- Professional vocational rehabilitation tone.
- This content will become the long HTML WSA document and will later be compressed into the official WSA PDF fields.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        detailed_wsa_fields: { type: 'object' },
        staff_should_verify: { type: 'array', items: { type: 'string' } },
        evidence_summary: { type: 'array', items: { type: 'string' } },
      },
    },
  });

    const detailedFields = normalizeObject(result && result.detailed_wsa_fields);

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

  const staffShouldVerify = Array.isArray(result && result.staff_should_verify)
    ? result.staff_should_verify
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
    evidence_summary: Array.isArray(result && result.evidence_summary)
      ? result.evidence_summary
      : [],
  };
}

async function generateOfficialFields(base44, detailedFields, contextBlock) {
  const limitsText = Object.entries(WSA_CHAR_LIMITS)
    .map(([key, value]) => key + ': max ' + value + ' chars')
    .join('\n');

  const detailedFieldsBlock = JSON.stringify(detailedFields, null, 2);

  const prompt = `You are a vocational rehabilitation specialist completing the official Utah DWS Work Strategy Assessment PDF fields.

TASK:
Compress detailed_wsa_fields into official_wsa_fields.

The official_wsa_fields must use the same exact field keys as detailed_wsa_fields.
The official_wsa_fields must fit the official WSA PDF character limits.

DETAILED WSA FIELDS TO COMPRESS PRIMARY SOURCE:
${detailedFieldsBlock}

BACKUP CONTEXT:
${contextBlock}

STRICT CHARACTER LIMITS:
${limitsText}

RULES:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- The JSON must contain:
  {
    "official_wsa_fields": { ... },
    "staff_should_verify": ["..."],
    "evidence_summary": ["..."]
  }
- official_wsa_fields must only use the exact WSA field keys.
- official_wsa_fields must be created from detailed_wsa_fields whenever detailed_wsa_fields has content.
- Do not create a new short summary if the detailed field text already fits the character limit.
- If the detailed field text fits within the listed character limit, copy the detailed field text into official_wsa_fields with only minor cleanup.
- Only condense a field when the detailed field text is too long for that field's character limit.
- When condensing, condense only enough to fit the character limit. Do not over-shorten.
- For fields with 700+ character limits, preserve as much of the detailed field as possible and aim to use most of the available space when the detailed content is long enough.
- For fields under 300 characters, preserve the clearest concrete facts and remove only extra wording needed to fit.
- Do not turn detailed content into vague generic summaries.
- Preserve concrete details, examples, ratings, scores, barriers, supports, transportation limits, training needs, support needs, and vocational implications.

FIELD RELATIONSHIP RULES:
- Some WSA fields are short label/detail fields paired with a larger observation field.
- For short option/detail fields, keep the answer brief and factual.
- Put the deeper explanation, impact, barriers, examples, and vocational implications into the matching observation field.

Transportation-specific rules:
- transportation_public should be a brief option description only, such as "Paratransit; requires advance scheduling."
- transportation_private should be a brief option description only, such as "Family backup transportation when available."
- transportation_observations should contain the detailed transportation analysis, including reliability, schedule limits, early morning/overnight availability, mid-shift travel limits, attendance concerns, commute/geography limits, and placement implications when supported by evidence.

Computer skills rules:
- computer_skills_other should briefly list the specific skill/test result, such as typing speed, 10-key, or other skill.
- computer_skill_observations should contain the detailed analysis of computer ability, online application needs, typing limitations, training needs, and job implications.

Life skills rules:
- life_skills_needed should briefly list the life skill area(s) needed.
- life_skills_observations should contain the detailed explanation, functional impact, and support/training implications.

Job development hours rule:
- planned_job_search_hours_week means the number of hours per week the CRP, job coach, or employment specialist plans to provide job-development/job-search support.
- It does NOT mean the number of hours the client is available to work.
- It does NOT mean the number of hours the client personally plans to job search.
- Do not calculate, recommend, estimate, or invent a number for this field.
- This value requires verified staff/program entry and will be left blank in the official AI draft.

Recommended target occupations rule:
- recommended_target_occupations means the finalized top 3 occupational targets selected after realistic job exploration and staff/client review.
- AI recommendations may support future job exploration, but AI must not finalize this WSA field independently.
- Do not invent, recommend, summarize, or carry forward target occupations into the official WSA field.
- This value will remain blank in the official AI draft until staff/client finalize the top 3 occupational targets.

Joint VR/CRP recommendations rules:
- job_development_supports means Joint VR/CRP Recommendations for Job Development Supports.
- ongoing_supports means Joint VR/CRP Recommendations for Ongoing Supports.
- Both fields are completed by Vocational Rehabilitation during the close-out meeting.
- Do not draft, summarize, recommend, estimate, or carry forward text into either official WSA field.
- Both fields will remain blank in the official AI draft for VR completion.

- Do not exceed the listed character limits.
- Do not invent facts.
- No greetings.
- Plain professional text only.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        official_wsa_fields: { type: 'object' },
        staff_should_verify: { type: 'array', items: { type: 'string' } },
        evidence_summary: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  const rawOfficialFields = normalizeObject(result && result.official_wsa_fields);
  const officialFields = {};

   for (const key of WSA_FIELD_KEYS) {
    const limit = WSA_CHAR_LIMITS[key];
    officialFields[key] = clampOfficialText(rawOfficialFields[key] || '', limit);
  }

      // Do not allow AI to create or carry forward official planning values
  // that must be completed by staff, the client/staff team, or VR.
  officialFields.planned_job_search_hours_week = '';
  officialFields.recommended_target_occupations = '';
  officialFields.job_development_supports = '';
  officialFields.ongoing_supports = '';

  return {
    official_wsa_fields: officialFields,
    staff_should_verify: Array.isArray(result && result.staff_should_verify)
      ? result.staff_should_verify
      : [],
    evidence_summary: Array.isArray(result && result.evidence_summary)
      ? result.evidence_summary
      : [],
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

    const assessmentSummaries = assessments.map((assessment) => ({
      type: assessment.assessment_type,
      status: assessment.status,
      responses: assessment.responses,
      notes: assessment.notes,
      completed_by: assessment.completed_by,
      date: assessment.updated_date || assessment.created_date,
    }));

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
           const interviewSkillObservationOverride =
      buildInterviewSkillObservationFromWsaInterview(interviewSessionSummaries);

    const sourceWsaResponses = {
      ...current_wsa_responses,
    };

          // These fields must not be inferred from prior AI output.
    // They are completed only through verified staff entry,
    // final staff/client selection, or VR close-out completion.
    delete sourceWsaResponses.planned_job_search_hours_week;
    delete sourceWsaResponses.recommended_target_occupations;
    delete sourceWsaResponses.job_development_supports;
    delete sourceWsaResponses.ongoing_supports;

    if (interviewSessionSummaries.length > 0) {
      delete sourceWsaResponses.interview_skill_observations;
    }

    if (sourceWsaResponses._detailed_wsa_fields) {
      sourceWsaResponses._detailed_wsa_fields = {
        ...sourceWsaResponses._detailed_wsa_fields,
      };

      delete sourceWsaResponses._detailed_wsa_fields.planned_job_search_hours_week;
      delete sourceWsaResponses._detailed_wsa_fields.recommended_target_occupations;
      delete sourceWsaResponses._detailed_wsa_fields.job_development_supports;
      delete sourceWsaResponses._detailed_wsa_fields.ongoing_supports;

      if (interviewSessionSummaries.length > 0) {
        delete sourceWsaResponses._detailed_wsa_fields.interview_skill_observations;
      }

    }


    const contextBlock = JSON.stringify(
      {
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
      },
      null,
      2
    );
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

      if (interviewSkillObservationOverride) {
        detailed_wsa_fields.interview_skill_observations =
          interviewSkillObservationOverride;
      }

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
      const detailedResult = await generateDetailedFields(base44, contextBlock);

            detailed_wsa_fields = detailedResult.detailed_wsa_fields;

      if (interviewSkillObservationOverride) {
        detailed_wsa_fields.interview_skill_observations =
          interviewSkillObservationOverride;
      }

      full_detailed_wsa_html = buildDetailedWsaHtml(detailed_wsa_fields);

      mergeUniqueStrings(staff_should_verify, detailedResult.staff_should_verify);
      mergeUniqueStrings(evidence_summary, detailedResult.evidence_summary);
    }
    
    if ((mode === 'field_draft' || mode === 'both') && detailed_wsa_fields) {
      console.log('Compressing detailed WSA fields into official WSA fields...');
      const officialResult = await generateOfficialFields(base44, detailed_wsa_fields, contextBlock);

      official_wsa_fields = officialResult.official_wsa_fields;
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
