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

// ─── PDF-SAFE LIMITS ──────────────────────────────────────────────────────────
// Measured from actual Utah DWS WSA PDF field rectangle dimensions (usor94.pdf)
// using Helvetica 10pt character width constants and an 18% safety margin.
// Audit function: auditWSAPDFFieldCapacity — run to regenerate.
//
// These are the limits for official_wsa_fields (what gets written into the PDF).
// detailed_wsa_fields remains unrestricted — it is the evidence-rich working copy.
//
// Single-line short fields (worksite_simulation_location, transportation_public/private,
// computer_skills_other, planned_job_search_hours_week, industry_targeted_pay_range,
// hours_available_to_work): geometry shows ~47-68 chars. These fields hold addresses,
// names, or short numeric values — 100 chars is a practical safe cap.
//
// Field dimensions → safe limit derivation (537pt wide fields, Helvetica 10pt, 82% margin):
//   ~1 line  (~14pt tall): 47 chars  → capped at 100 (single-line practical max)
//   ~5 lines (~80pt tall): 364 chars
//   ~6 lines (~95pt tall): 437 chars
//   ~8 lines (~121pt tall): 583 chars
//   ~12 lines (150pt+): 729 chars
const WSA_PDF_SAFE_LIMITS = {
  // Single-line / short fields — practical cap applied
  worksite_simulation_location:  100,   // measured ~47pt; single-line, venue/address name
  transportation_public:         100,   // measured ~59pt; short description
  transportation_private:        100,   // measured ~47pt; short description
  computer_skills_other:         100,   // measured ~68pt; short label
  planned_job_search_hours_week: 80,    // measured ~47pt; numeric/short text
  industry_targeted_pay_range:   100,   // measured ~47pt; short value
  hours_available_to_work:       100,   // measured ~47pt; short value
  // Multi-line narrative fields — from measured geometry
  work_assessment_observations:  360,   // measured 537x81pt → 364 safe
  natural_support_observations:  360,   // measured 537x80pt → 364 safe
  life_skills_observations:      360,   // measured 537x80pt → 364 safe
  current_work_skills:           360,   // measured 537x80pt → 364 safe
  work_skill_development_needs:  360,   // measured 537x80pt → 364 safe
  family_issues_supports:        360,   // measured 537x80pt → 364 safe
  criminal_background:           360,   // measured 537x80pt → 364 safe
  school_academic:               360,   // measured 537x80pt → 364 safe
  communication_needs:           360,   // measured ~same height group
  assistive_technology_needs:    360,   // measured ~same height group
  interpersonal_social_skills:   360,   // measured ~same height group
  transportation_observations:   430,   // measured 537x95pt → 437 safe
  computer_skill_observations:   430,   // measured 537x95pt → 437 safe
  interview_skill_observations:  430,   // measured 537x95pt → 437 safe
  behavioral_self_regulation:    430,   // measured 537x95pt → 437 safe
  activities_of_daily_living:    430,   // measured 537x95pt → 437 safe
  referral_question:             430,   // measured 537x95pt → 437 safe
  other_observations:            575,   // measured 537x121pt → 583 safe
  recommended_supports_on_job:   575,   // measured 537x121pt → 583 safe
  job_development_supports:      720,   // measured larger field → 729 safe
  ongoing_supports:              720,   // measured larger field → 729 safe
  // Short structured fields
  jobs_of_interest:              140,   // measured ~145 safe
  life_skills_needed:            140,   // measured ~145 safe
  recommended_target_occupations: 210,  // measured ~218 safe
  job_goal:                      210,   // measured ~218 safe
  benefits_other:                210,   // measured ~218 safe
};

// ─── VR-AUTHORED FIELDS — BOUNDARY PROTECTION ─────────────────────────────────
// Everything above "COMMUNITY REHABILITATION PROGRAM Observation and Report"
// is VR-authored content from the uploaded WSA. These fields must NEVER be
// generated, overwritten, or modified by any AI process.
//
// AI generation scope begins ONLY at the CRP section:
//   worksite_simulation_location, work_assessment_observations, and below.
//
// These keys are excluded from generateDetailedFields, generateOfficialFields,
// AI Fill WSA Fields, and AI Detailed Report updates.
const VR_AUTHORED_KEYS = new Set([
  // ── COUNSELOR REFERRAL PAGE ──
  'crp_referring_to',
  'guardianship',
  'guardian_name_phone',
  'referral_question',
  'extended_services_provider',
  'health_insurance',
  'social_security_benefits',
  'benefits_planning',
  'benefits_planning_date',
  'benefits_summary_info',
  'other_services_benefits',
  // ── DESCRIBE THE FOLLOWING AS IT APPLIES TO CLIENT ──
  'current_work_skills',
  'work_skill_development_needs',
  'jobs_of_interest',
  'interpersonal_social_skills',
  'assistive_technology_needs',
  'communication_needs',
  'behavioral_self_regulation',
  'activities_of_daily_living',
  'family_issues_supports',
  'criminal_background',
  'school_academic',
]);

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

  // Hard truncate at a word boundary — no referral suffix.
  // Fields that arrive here via the hard-guard path bypassed LLM compression,
  // so we truncate cleanly rather than appending any "see elsewhere" language.
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.8 ? sliced.slice(0, lastSpace) : sliced).trimEnd();
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
  // Only include CRP section and below — VR-authored fields above are excluded.
  const sections = WSA_FIELD_KEYS.filter((key) => !VR_AUTHORED_KEYS.has(key)).map((key) => {
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

async function synthesizeWorkAssessmentObservations(base44, wpsoLabeledText) {
  const prompt = `You are a vocational rehabilitation evaluator writing the Work Assessment Observations field for an official Utah DWS Work Strategy Assessment (WSA).

TASK:
Using ONLY the Work Performance & Support Observation evidence provided below, write a professional vocational assessment narrative for the "Work Assessment Observations" WSA field.

WORK PERFORMANCE & SUPPORT OBSERVATION EVIDENCE:
${wpsoLabeledText}

REQUIREMENTS:
- Write as a professional vocational evaluator summarizing what was directly observed.
- Cover in a single cohesive narrative: the task(s) evaluated, observation duration (if documented), level of prompting and support required, work performance observed, strengths demonstrated, barriers or concerns observed, and vocational implications.
- Use past tense and professional assessment language (e.g., "The client demonstrated...", "During the observation...", "Support was required for...").
- Do NOT copy field labels or question text verbatim — synthesize into natural prose.
- Do NOT invent any fact not present in the evidence above.
- Do NOT describe any physical activity (standing, walking, carrying, lifting, etc.) unless it is explicitly stated in the evidence above.
- Do NOT name any employer, worksite, or location unless explicitly stated in the evidence above.
- Do NOT use Work Environment Tolerance, interview sessions, resume, documents, or any other source.
- If a category (e.g., strengths, barriers) has no documented evidence, omit it rather than speculating.
- Maximum 900 characters for the final narrative.
- Return ONLY the plain text narrative. No JSON. No markdown. No labels. No headings.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return safeString(result).replace(/\s+/g, ' ').trim().slice(0, 900);
}

async function synthesizeNaturalSupportObservations(base44, evidenceBlock) {
  const prompt = `You are a vocational rehabilitation evaluator writing the "Natural Support Assessment Observations" field for an official Utah DWS Work Strategy Assessment (WSA).

TASK:
Using ONLY the documented support evidence provided below, write a professional narrative for the "Natural Support Assessment Observations" WSA field.

DOCUMENTED SUPPORT EVIDENCE:
${evidenceBlock}

REQUIREMENTS:
- Describe only documented support systems, support availability, family/caregiver involvement, coworker/supervisor natural supports, and support needs that are explicitly recorded in the evidence above.
- Do NOT invent support people, relationships, or availability.
- Do NOT assume natural supports exist unless explicitly documented in the evidence above.
- Do NOT use work environment tolerance data, interview session answers, resume content, document text, client notes, or VFP inferences.
- Do NOT use family_issues_supports or any VR-authored field content.
- If natural workplace supports (supervisor, coworker) were observed, describe their availability and observed effectiveness.
- If family or caregiver supports are documented, describe only what is explicitly recorded — name, role, and documented involvement.
- If support gaps or absence of natural supports are documented, describe those clearly.
- Write in past tense for observed evidence and present tense for documented availability.
- Professional vocational rehabilitation language. No labels, no headings, no markdown.
- Maximum 850 characters.
- Return ONLY the plain text narrative.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return safeString(result).replace(/\s+/g, ' ').trim().slice(0, 850);
}

async function synthesizeLifeSkillsObservations(base44, evidenceBlock) {
  const prompt = `You are a vocational rehabilitation evaluator writing the "Life Skills Observations" field for an official Utah DWS Work Strategy Assessment (WSA).

PURPOSE OF THIS FIELD:
Identify documented life skills deficits, gaps, or training needs discovered through the assessment process that may justify additional CRP Life Skills service authorization.

This field documents WHAT WAS IDENTIFIED — not recommendations.
Do NOT write a recommendation list.
Do NOT prescribe training programs.
Do NOT suggest services.
The companion field "Life Skills Needed" handles recommendations separately.

TASK:
Using ONLY the documented assessment evidence below, write a professional narrative identifying specific life skills deficits or gaps that were observed or reported across the assessment process.

DOCUMENTED ASSESSMENT EVIDENCE (organized by life skills domain):
${evidenceBlock}

REQUIREMENTS:
- Identify specific life skills areas where deficits, gaps, or training needs are documented in the evidence.
- For each identified area, explain what the assessment evidence shows (what was observed, reported, or documented).
- Tie every identified deficit to a specific assessment finding — do NOT make general statements without evidence.
- Life skills domains to consider (only when evidence supports them): financial literacy/budgeting, professional attire/workplace hygiene, time management/organization, self-advocacy, communication skills, transportation independence, community integration, independent living skills, workplace etiquette, technology skills for employment.
- Do NOT generate generic life skills deficits not supported by the evidence.
- Do NOT invent any fact not present in the evidence above.
- Do NOT use resume data, work history documents, client notes, or VR-authored field content.
- Do NOT write recommendations — only document what was identified through assessment.
- Use past tense for observed/documented findings ("Assessment findings indicated...", "The client reported difficulty with...", "Observation noted...").
- Professional vocational rehabilitation language. No labels, no headings, no markdown, no bullet points.
- Maximum 850 characters.
- Return ONLY the plain text narrative.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return safeString(result).replace(/\s+/g, ' ').trim().slice(0, 850);
}

async function synthesizeRecommendedSupportsOnJob(base44, wpsoText, wetProfile, supportAssessmentText, barriersText, wsaInterviewText) {
  const sourceBlocks = [];

  if (wpsoText) {
    sourceBlocks.push(`== SOURCE 1: Work Performance & Support Observation (PRIMARY) ==\n${wpsoText}`);
  }
  if (wetProfile) {
    const wetLines = Object.entries(wetProfile)
      .filter(([, v]) => v && safeString(v).trim().length > 2)
      .map(([k, v]) => `${k}: ${safeString(v).trim()}`)
      .join('\n');
    if (wetLines) sourceBlocks.push(`== SOURCE 2: Work Environment Tolerance Assessment ==\n${wetLines}`);
  }
  if (supportAssessmentText) {
    sourceBlocks.push(`== SOURCE 3: Support & Accommodation Assessment ==\n${supportAssessmentText}`);
  }
  if (barriersText) {
    sourceBlocks.push(`== SOURCE 4: Barriers to Employment Assessment ==\n${barriersText}`);
  }
  if (wsaInterviewText) {
    sourceBlocks.push(`== SOURCE 5: WSA Interview Assessment ==\n${wsaInterviewText}`);
  }

  if (sourceBlocks.length === 0) {
    return 'Insufficient assessment evidence to generate recommended supports. Complete the Work Performance & Support Observation and related assessments before generating this field.';
  }

  const prompt = `You are a vocational rehabilitation evaluator writing the "Recommended Supports on the Job" field for an official Utah DWS Work Strategy Assessment (WSA).

TASK:
Using ONLY the documented assessment evidence provided below, write a professional narrative for the "Recommended Supports on the Job" WSA field.

EVIDENCE SOURCES (in priority order — use higher-priority sources first):
${sourceBlocks.join('\n\n')}

REQUIREMENTS:
- Base every recommended support on specific documented evidence from the sources above.
- Prioritize observed support needs from the Work Performance & Support Observation (Source 1).
- Supports must directly address documented barriers and observed performance needs.
- Do NOT recommend supports that are not grounded in the evidence above.
- Do NOT use generic disability accommodations not tied to specific documented needs.
- Do NOT recommend accommodations solely because a diagnosis exists.
- For each support recommended, explain: (1) what the support is, (2) why it is recommended, (3) what assessment evidence supports it.
- Write in professional vocational rehabilitation language using past tense for observations and present/future tense for recommendations.
- Examples of evidence-grounded supports: if WP&SO documents difficulty learning unfamiliar tasks, need for prompts, and need for repetition → recommend step-by-step task instruction, initial job coaching, structured training, natural support development.
- Do NOT copy field labels, question text, or source headings verbatim — synthesize into natural professional prose.
- Do NOT invent any fact not present in the evidence above.
- Maximum 950 characters for the final narrative.
- Return ONLY the plain text narrative. No JSON. No markdown. No labels. No headings.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return safeString(result).replace(/\s+/g, ' ').trim().slice(0, 950);
}

async function generateDetailedFields(base44, contextBlock, wpsoExplicitLocation) {
  // Only generate fields that are NOT VR-authored. VR-authored fields above the CRP
  // section boundary must be preserved exactly as uploaded and never AI-generated.
  const aiGeneratedKeys = WSA_FIELD_KEYS.filter((key) => !VR_AUTHORED_KEYS.has(key));

  const fieldLabelsText = aiGeneratedKeys
    .map((key) => key + ': ' + (WSA_FIELD_LABELS[key] || key))
    .join('\n');

  const prompt = `You are a vocational rehabilitation specialist drafting a Full Detailed Work Strategy Assessment.

TASK:
Generate detailed_wsa_fields for the CRP Observation and Report section and subsequent sections ONLY.

CRITICAL BOUNDARY RULE — VR-AUTHORED FIELDS:
The following fields are completed by the VR counselor from the uploaded WSA document. You must NOT generate, include, or modify any of these fields. They are excluded from this task entirely:
  crp_referring_to, guardianship, guardian_name_phone, referral_question,
  extended_services_provider, health_insurance, social_security_benefits,
  benefits_planning, benefits_planning_date, benefits_summary_info,
  other_services_benefits, current_work_skills, work_skill_development_needs,
  jobs_of_interest, interpersonal_social_skills, assistive_technology_needs,
  communication_needs, behavioral_self_regulation, activities_of_daily_living,
  family_issues_supports, criminal_background, school_academic.
AI generation scope begins ONLY at the CRP section: worksite_simulation_location and all fields that follow it.

This is the FULL DETAILED WSA (CRP section and below only).
It must use the exact field keys listed below.
It is NOT character limited.
It should provide complete detailed content for each listed field when supported by evidence.

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
- recommended_supports_on_job: SKIP — this field is handled by a dedicated server-side synthesis step and must not be generated here.
- work_skill_development_needs: Use pace tolerance, multitasking ability, interruptions tolerance, written instructions need, task switching tolerance as functional evidence.
- communication_needs: Use phone_communication, phone_difficulty_detail, conflict_tolerance.
- interpersonal_social_skills: Use customer_interaction_comfort, coworker_comfort, supervision_style_preference, and related narratives.
- assistive_technology_needs: Use any sensory accommodation or AT needs from WET.

CRITICAL — SOURCE MAPPING FOR WSA FIELDS:

SOURCE: Work Performance & Support Observation (assessment_type = "work_performance_support_observation")
Use this assessment's responses as the primary evidence for:
- worksite_simulation_location: STRICT RULE — Use the value from the context field "worksite_simulation_location_resolved" verbatim. Do not modify it, supplement it, or replace it. Do NOT infer, derive, or construct a location from any other source. This field has already been resolved by the server.
- work_assessment_observations: STRICT RULE — Do NOT generate this field. Leave it empty or null. It is always overwritten by a dedicated server-side synthesis step after your response.
- current_work_skills: Draw primarily from observed skills documented in the Work Performance & Support Observation.
- work_skill_development_needs: Draw primarily from skill gaps and development areas observed in the Work Performance & Support Observation. WET functional tolerance data (pace, multitasking, interruptions) may supplement but must be labeled as tolerance assessment findings, not observed worksite performance.
- recommended_supports_on_job: STRICT RULE — Do NOT generate this field. Leave it empty or null. It is always overwritten by a dedicated server-side synthesis step after your response.
- life_skills_observations: STRICT RULE — Do NOT generate this field. Leave it empty or null. It is always overwritten by a dedicated server-side synthesis step that identifies documented life skills deficits from approved assessment sources only.

SOURCE: Work Environment Tolerance (assessment_type = "work_environment_tolerance")
Use WET responses as structured tolerance and functional capacity evidence for:
- behavioral_self_regulation: overwhelm_triggers, overwhelm_signs, overwhelm_signs_detail, recovery_strategies, break_or_quiet_space_needed, past_stress_job_narrative.
- other_observations: ideal vs. avoid environment synthesis, sensory triggers, stress recovery strategies, preferred supports, environmental red flags. Write these as documented tolerance findings, not observed worksite performance.
- recommended_supports_on_job: SKIP — handled by dedicated server-side synthesis.
- communication_needs: phone_communication, phone_difficulty_detail, conflict_tolerance.
- interpersonal_social_skills: customer_interaction_comfort, coworker_comfort, supervision_style_preference.
- assistive_technology_needs: sensory or AT accommodation needs documented in WET.

STRICT PROHIBITION:
- NEVER use WET overwhelm_triggers, past_stress_job_narrative, or any WET narrative containing words like "check out," "line," "customers," or "cashier" as evidence for worksite_simulation_location or work_assessment_observations.
- WET narratives describe self-reported past experiences and tolerance assessments — they are NOT worksite simulation observations and must NEVER be interpreted as such.
- Do NOT infer a worksite name (Winegar's, a grocery store, a warehouse, a cashier station, etc.) from any WET field. A phrase like "a long line of people needing to check out" in overwhelm_triggers is a stress tolerance example, not a worksite simulation record.
- Do NOT describe cash handling, transaction processing, or cashier tasks as observed worksite performance unless the Work Performance & Support Observation explicitly documents those tasks.
- WET data has ZERO permitted contribution to worksite_simulation_location. Even if a WET field appears to describe a physical location or employer, it must be completely ignored for this field.

If work_environment_tolerance_profile is null or sparse, rely on other available evidence for the WET-allowed fields and note that WET data was not available.
For worksite_simulation_location specifically: always use the pre-resolved "worksite_simulation_location_resolved" value from the context — never generate your own value for this field.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
  });

  const parsed = typeof result === 'string' ? JSON.parse(result) : result;
  const rawDetailedFields = normalizeObject(parsed && parsed.detailed_wsa_fields);

  // Strip any VR-authored keys the LLM may have returned despite the prompt restrictions.
  const detailedFields = Object.fromEntries(
    Object.entries(rawDetailedFields).filter(([k]) => !VR_AUTHORED_KEYS.has(k))
  );

  // worksite_simulation_location + work_assessment_observations: always hard-override.
  // The LLM main generation must NEVER determine these fields.
  let resolvedWorksiteLocation = wpsoExplicitLocation;
  let resolvedWorkAssessmentObservations = null;
  try {
    const ctx = JSON.parse(contextBlock);
    if (ctx && ctx.worksite_simulation_location_resolved) {
      resolvedWorksiteLocation = ctx.worksite_simulation_location_resolved;
    }
    if (ctx && ctx.work_assessment_observations_resolved) {
      if (ctx.work_assessment_observations_resolved !== '__WPSO_CONTENT_PRESENT__') {
        // Placeholder case — use verbatim
        resolvedWorkAssessmentObservations = ctx.work_assessment_observations_resolved;
      } else if (ctx.wpso_observation_text) {
        // Content is present — synthesize a professional narrative from labeled WP&SO evidence only.
        // This is a dedicated call, completely isolated from WET, documents, and other sources.
        resolvedWorkAssessmentObservations = await synthesizeWorkAssessmentObservations(base44, ctx.wpso_observation_text);
      }
    }
  } catch (_e) { /* leave as defaults */ }

  detailedFields.worksite_simulation_location = resolvedWorksiteLocation || 'Work Performance & Support Observation assessment has not been completed. Complete the Work Performance & Support Observation assessment before generating this section of the WSA.';

  // Always overwrite — either with the synthesized professional narrative or a placeholder.
  detailedFields.work_assessment_observations = resolvedWorkAssessmentObservations || 'Work Performance & Support Observation assessment has not been completed. Complete the Work Performance & Support Observation assessment before generating this section of the WSA.';

  // ── recommended_supports_on_job: hard-override via dedicated synthesis ────────
  // Extract evidence texts for each priority source.
  let supportsWpsoText = null;
  let supportsWetProfile = null;
  let supportsSupportAssessmentText = null;
  let supportsBarriersText = null;
  let supportsWsaInterviewText = null;

  try {
  const ctx = JSON.parse(contextBlock);

  // Source 1: WP&SO — reuse wpso_observation_text (already labeled)
  if (ctx.wpso_observation_text) {
    supportsWpsoText = ctx.wpso_observation_text;
  }

  // Source 2: WET profile
  if (ctx.work_environment_tolerance_profile) {
    supportsWetProfile = ctx.work_environment_tolerance_profile;
  }

  // Source 3: Support & Accommodation Assessment
  const supportAccAssessment = (ctx.assessments || []).find(a => a.type === 'support_and_accommodation');
  if (supportAccAssessment && supportAccAssessment.responses) {
    supportsSupportAssessmentText = Object.entries(supportAccAssessment.responses)
      .filter(([, v]) => safeString(v).trim().length > 2)
      .map(([k, v]) => `${k}: ${safeString(v).trim()}`)
      .join('\n');
  }

  // Source 4: Barriers Assessment
  const barriersAssessment = (ctx.assessments || []).find(a => a.type === 'barriers_to_employment');
  if (barriersAssessment && barriersAssessment.responses) {
    supportsBarriersText = Object.entries(barriersAssessment.responses)
      .filter(([, v]) => safeString(v).trim().length > 2)
      .map(([k, v]) => `${k}: ${safeString(v).trim()}`)
      .join('\n');
  }

  // Source 5: WSA Interview sessions — summarize answered questions
  if (ctx.wsa_interview_sessions && ctx.wsa_interview_sessions.length > 0) {
    const sessionLines = ctx.wsa_interview_sessions.flatMap(s =>
      (s.questions || [])
        .filter(q => safeString(q.answer).trim())
        .map(q => `Q: ${q.question} | Answer: ${q.answer}${q.feedback ? ` | Feedback: ${q.feedback}` : ''}`)
    );
    if (sessionLines.length > 0) {
      supportsWsaInterviewText = sessionLines.join('\n');
    }
  }
  } catch (_e) { /* leave as null — synthesis will use only available sources */ }

  detailedFields.recommended_supports_on_job = await synthesizeRecommendedSupportsOnJob(
  base44,
  supportsWpsoText,
  supportsWetProfile,
  supportsSupportAssessmentText,
  supportsBarriersText,
  supportsWsaInterviewText
  );

  // ── natural_support_observations: hard-override via dedicated synthesis ──────
  // Permitted sources only: WP&SO natural support fields, support/accommodation
  // assessment, barriers assessment, client contact fields.
  // Prohibited: client.notes, documents, resumes, interview sessions, WET,
  //             family_issues_supports, VFP (unless explicit support documentation).
  let naturalSupportEvidenceBlock = null;
  try {
    const ctx = JSON.parse(contextBlock);
    const lines = [];

    // Source 1: Work Performance & Support Observation — natural support fields only
    const wpsoNatural = (ctx.assessments || []).find(a => a.type === 'work_performance_support_observation');
    if (wpsoNatural && wpsoNatural.responses) {
      const wr = wpsoNatural.responses;
      const wpsoSupportFields = [
        ['Natural supports available during observation', wr.natural_supports_available_observed],
        ['Natural support effectiveness observed', wr.natural_support_effectiveness_observed],
        ['Natural support examples and notes', wr.natural_support_examples_notes],
        ['Current support provider', wr.current_support_provider],
        ['Supervisor or coworker input obtained', wr.supervisor_or_coworker_input_obtained],
        ['Employer/supervisor input on supports', wr.employer_supervisor_input_on_supports],
      ];
      for (const [label, val] of wpsoSupportFields) {
        const s = safeString(val).trim();
        if (s && s.length > 2 && !s.startsWith('[')) {
          lines.push(`[Work Performance Observation] ${label}: ${s}`);
        }
      }
    }

    // Source 2: Support & Accommodation Assessment — family/caregiver/support availability fields only
    const supportAccAssessment = (ctx.assessments || []).find(a => a.type === 'support_and_accommodation');
    if (supportAccAssessment && supportAccAssessment.responses) {
      const sr = supportAccAssessment.responses;
      // Only include fields whose keys or values explicitly reference support availability,
      // family/caregiver involvement, or support gaps.
      const supportKeywords = ['support', 'caregiver', 'family', 'natural', 'guardian', 'provider', 'helper', 'assist'];
      for (const [k, v] of Object.entries(sr)) {
        const s = safeString(v).trim();
        if (!s || s.length < 3 || s.startsWith('[')) continue;
        const kLower = k.toLowerCase();
        if (supportKeywords.some(kw => kLower.includes(kw))) {
          lines.push(`[Support & Accommodation Assessment] ${k}: ${s}`);
        }
      }
    }

    // Source 3: Barriers to Employment — support-system barrier fields only
    const barriersAssessment = (ctx.assessments || []).find(a => a.type === 'barriers_to_employment');
    if (barriersAssessment && barriersAssessment.responses) {
      const br = barriersAssessment.responses;
      const supportBarrierKeywords = ['support', 'caregiver', 'family', 'natural', 'guardian', 'provider', 'isolated', 'lack_of_support', 'no_support'];
      for (const [k, v] of Object.entries(br)) {
        const s = safeString(v).trim();
        if (!s || s.length < 3 || s.startsWith('[')) continue;
        const kLower = k.toLowerCase();
        if (supportBarrierKeywords.some(kw => kLower.includes(kw))) {
          lines.push(`[Barriers to Employment Assessment] ${k}: ${s}`);
        }
      }
    }

    // Source 4: Client contact fields — only if explicitly populated
    const clientData = ctx.client || {};
    if (safeString(clientData.guardian_name).trim()) {
      lines.push(`[Client Record] Guardian name: ${safeString(clientData.guardian_name).trim()}`);
    }
    if (safeString(clientData.support_staff_name).trim()) {
      lines.push(`[Client Record] Support staff name: ${safeString(clientData.support_staff_name).trim()}`);
    }
    if (Array.isArray(clientData.contacts)) {
      for (const contact of clientData.contacts) {
        const name = safeString(contact.name).trim();
        const type = safeString(contact.type || contact.label).trim();
        if (name) {
          lines.push(`[Client Record] Contact — ${type || 'type not specified'}: ${name}`);
        }
      }
    }

    if (lines.length > 0) {
      naturalSupportEvidenceBlock = lines.join('\n');
    }
  } catch (_e) { /* leave as null */ }

  // Hard-guard: natural_support_observations is always set from permitted sources only.
  // The detailed field may be up to 850 chars (its WSA_CHAR_LIMITS value).
  // generateOfficialFields will copy it verbatim if ≤ limit, or compress if over.
  const naturalSupportRaw = naturalSupportEvidenceBlock
    ? await synthesizeNaturalSupportObservations(base44, naturalSupportEvidenceBlock)
    : 'Natural support information has not been documented in the approved assessment sources. Staff must complete the natural support section or document available supports before generating this portion of the WSA.';
  // Clamp to the app-level limit for detailed fields (850 chars).
  // generateOfficialFields will further compress to WSA_PDF_SAFE_LIMITS (360 chars) for the PDF.
  detailedFields.natural_support_observations = clampOfficialText(naturalSupportRaw, WSA_CHAR_LIMITS.natural_support_observations);

  // ── life_skills_observations: hard-override via dedicated synthesis ──────────
  // Purpose: identify documented life skills deficits/gaps through assessment findings.
  // This is NOT a recommendation field — life_skills_needed handles recommendations.
  // Approved sources: WP&SO, Barriers, WET, Support/Accommodation, WSA Interview.
  // Prohibited: resume, documents, client.notes, VR-authored fields as sole source.
  let lifeSkillsEvidenceBlock = null;
  try {
    const ctx = JSON.parse(contextBlock);
    const lines = [];

    // Source 1: Work Performance & Support Observation — observed functional/skill gaps
    const wpsoAssmt = (ctx.assessments || []).find(a => a.type === 'work_performance_support_observation');
    if (wpsoAssmt && wpsoAssmt.responses) {
      const wr = wpsoAssmt.responses;
      // Any field whose key or value touches life-skills-adjacent domains
      const lifeSkillsWpsoFields = [
        ['Observed task initiation difficulty', wr.task_initiation],
        ['Prompt level required during observation', wr.overall_prompt_level_for_observed_tasks],
        ['Where prompting was needed', wr.prompt_level_examples],
        ['Observed performance concerns', wr.task_performance_concerns_observed],
        ['Support or training needed from observation', wr.support_or_training_needed_from_observation],
        ['Vocational implications of task performance', wr.task_performance_vocational_implications],
        ['Verified support needs', wr.verified_support_needs_from_observation],
        ['Verified barriers or concerns', wr.verified_barriers_or_concerns_from_observation],
        ['Communication observed during worksite', wr.communication_observed],
        ['Self-advocacy observed', wr.self_advocacy_observed],
        ['Technology use observed', wr.technology_use_observed],
        ['Professional presentation observed', wr.professional_presentation_observed],
        ['Time management or punctuality observed', wr.time_management_observed],
        ['Work habits observed', wr.work_habits_observed],
      ];
      for (const [label, val] of lifeSkillsWpsoFields) {
        const s = safeString(val).trim();
        if (s && s.length > 2 && !s.startsWith('[')) {
          lines.push(`[Work Performance Observation] ${label}: ${s}`);
        }
      }
    }

    // Source 2: Barriers to Employment — named barrier categories map directly to life skills domains
    const barriersAssmt = (ctx.assessments || []).find(a => a.type === 'barriers_to_employment');
    if (barriersAssmt && barriersAssmt.responses) {
      const lifeSkillsBarrierKeywords = [
        'transportation', 'financial', 'budget', 'money', 'communication', 'organization',
        'independent', 'living', 'community', 'hygiene', 'attire', 'clothing', 'appearance',
        'time', 'schedule', 'technology', 'computer', 'phone', 'self_care', 'advocacy',
        'etiquette', 'social', 'interpersonal', 'literacy', 'reading', 'math',
      ];
      for (const [k, v] of Object.entries(barriersAssmt.responses)) {
        const s = safeString(v).trim();
        if (!s || s.length < 3 || s.startsWith('[')) continue;
        const kLower = k.toLowerCase();
        if (lifeSkillsBarrierKeywords.some(kw => kLower.includes(kw))) {
          lines.push(`[Barriers to Employment] ${k}: ${s}`);
        }
      }
    }

    // Source 3: Work Environment Tolerance — functional gaps that indicate trainable life skills deficits
    if (ctx.work_environment_tolerance_profile) {
      const wet = ctx.work_environment_tolerance_profile;
      const wetLifeSkillsFields = [
        ['Phone communication difficulty', wet.phone_difficulty_detail],
        ['Phone communication comfort', wet.phone_communication],
        ['Written instructions needed', wet.written_instructions_detail],
        ['Written instructions need level', wet.written_instructions_need],
        ['Multitasking ability', wet.multitasking_ability],
        ['Interruption impact', wet.interruption_impact_narrative],
        ['Task switching difficulty', wet.task_switching_tolerance],
        ['Fast pace struggle', wet.pace_struggle_narrative],
        ['Overwhelm triggers', wet.overwhelm_triggers],
        ['Stress recovery strategies needed', wet.recovery_strategies],
        ['Self-regulation needs', wet.overwhelm_signs_detail],
        ['Conflict tolerance', wet.conflict_tolerance],
        ['Community/customer interaction difficulty', wet.customer_avoidance_detail],
      ];
      for (const [label, val] of wetLifeSkillsFields) {
        const s = safeString(val).trim();
        if (s && s.length > 2 && !s.startsWith('[')) {
          lines.push(`[Work Environment Tolerance] ${label}: ${s}`);
        }
      }
    }

    // Source 4: Support & Accommodation Assessment — independence gaps imply training needs
    const supportAssmt = (ctx.assessments || []).find(a => a.type === 'support_and_accommodation');
    if (supportAssmt && supportAssmt.responses) {
      const lifeSkillsSupportKeywords = [
        'independent', 'self', 'daily', 'living', 'communication', 'transportation',
        'financial', 'budget', 'technology', 'organization', 'time', 'hygiene', 'community',
      ];
      for (const [k, v] of Object.entries(supportAssmt.responses)) {
        const s = safeString(v).trim();
        if (!s || s.length < 3 || s.startsWith('[')) continue;
        const kLower = k.toLowerCase();
        if (lifeSkillsSupportKeywords.some(kw => kLower.includes(kw))) {
          lines.push(`[Support & Accommodation Assessment] ${k}: ${s}`);
        }
      }
    }

    // Source 5: WSA Interview Assessment — communication, self-advocacy, professional presentation gaps
    if (ctx.wsa_interview_sessions && ctx.wsa_interview_sessions.length > 0) {
      const answeredQuestions = ctx.wsa_interview_sessions.flatMap(s =>
        (s.questions || []).filter(q => safeString(q.answer).trim())
      );
      // Include overall feedback and low-scoring answers as life skills evidence
      for (const session of ctx.wsa_interview_sessions) {
        if (session.overall_feedback) {
          lines.push(`[WSA Interview Session] Overall feedback: ${safeString(session.overall_feedback).trim()}`);
        }
      }
      const lowScoreQuestions = answeredQuestions.filter(q => q.score !== null && Number(q.score) < 60);
      for (const q of lowScoreQuestions.slice(0, 5)) {
        lines.push(`[WSA Interview Session] Low-score response (${q.score}%) — Question: ${safeString(q.question).trim()} | Answer: ${safeString(q.answer).trim().slice(0, 200)}`);
      }
    }

    if (lines.length > 0) {
      lifeSkillsEvidenceBlock = lines.join('\n');
    }
  } catch (_e) { /* leave as null */ }

  detailedFields.life_skills_observations = lifeSkillsEvidenceBlock
    ? await synthesizeLifeSkillsObservations(base44, lifeSkillsEvidenceBlock)
    : 'Life skills deficits or training needs have not been identified through the current assessment data. Complete the Work Performance & Support Observation, Barriers to Employment, and Work Environment Tolerance assessments before generating this section of the WSA.';

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
  // Pass 1: copy every field that already fits within its PDF-safe character limit.
  // Only fields that are OVER the PDF-safe limit are sent to the LLM for compression.
  // NOTE: We use WSA_PDF_SAFE_LIMITS here (measured from actual PDF field geometry),
  // NOT WSA_CHAR_LIMITS (which are database/app limits and are too large for the PDF).
  // detailed_wsa_fields uses WSA_CHAR_LIMITS (unrestricted working copy).
  // official_wsa_fields uses WSA_PDF_SAFE_LIMITS (what actually fits in the PDF).
  const officialFields = {};
  const overLimitFields = {};

  for (const key of WSA_FIELD_KEYS) {
    // VR-authored fields are never generated or modified — skip entirely.
    if (VR_AUTHORED_KEYS.has(key)) continue;

    if (STAFF_VR_ONLY_KEYS.has(key)) {
      officialFields[key] = '';
      continue;
    }
    const limit = WSA_PDF_SAFE_LIMITS[key] || WSA_CHAR_LIMITS[key];
    const text = safeString(detailedFields[key]).replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
      // Fits within PDF-safe limit — copy verbatim, no LLM needed.
      officialFields[key] = text;
    } else {
      // Over PDF-safe limit — needs compression.
      overLimitFields[key] = text;
    }
  }

  // Pass 2: if any fields are over-limit, compress only those via LLM.
  if (Object.keys(overLimitFields).length > 0) {
    const limitsText = Object.entries(overLimitFields)
      .map(([key]) => key + ': max ' + (WSA_PDF_SAFE_LIMITS[key] || WSA_CHAR_LIMITS[key]) + ' chars')
      .join('\n');

    const overLimitBlock = JSON.stringify(overLimitFields, null, 2);

    const prompt = `You are a vocational rehabilitation specialist completing the official Utah DWS Work Strategy Assessment PDF fields.

CRITICAL BOUNDARY RULE — VR-AUTHORED FIELDS:
The following fields are VR-authored content from the uploaded WSA. They must NEVER be included in or modified by this task:
  crp_referring_to, guardianship, guardian_name_phone, referral_question,
  extended_services_provider, health_insurance, social_security_benefits,
  benefits_planning, benefits_planning_date, benefits_summary_info,
  other_services_benefits, current_work_skills, work_skill_development_needs,
  jobs_of_interest, interpersonal_social_skills, assistive_technology_needs,
  communication_needs, behavioral_self_regulation, activities_of_daily_living,
  family_issues_supports, criminal_background, school_academic.

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
- Preserve the most important evidence, findings, and conclusions from the detailed content.
- Each condensed field must be a complete, self-contained paragraph that stands alone.
- Do NOT use phrases like "see detailed WSA", "see detailed report", "refer to supplemental report", "details available elsewhere", or any language that directs the reader to another document.
- Do NOT use ellipsis (...) at the end of a field to imply continuation elsewhere.
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

  // Final safety pass: hard-clamp every official field to its WSA_PDF_SAFE_LIMITS value.
  // This catches any field set by hard-override logic (natural_support_observations,
  // work_assessment_observations, recommended_supports_on_job, etc.) that bypassed
  // the LLM compression path above, ensuring NO official field ever exceeds the
  // actual visible PDF field capacity.
  for (const key of Object.keys(officialFields)) {
    const limit = WSA_PDF_SAFE_LIMITS[key] || WSA_CHAR_LIMITS[key];
    if (limit && typeof officialFields[key] === 'string') {
      officialFields[key] = clampOfficialText(officialFields[key], limit);
    }
  }

  console.log('DEBUG generateOfficialFields INPUT detailedFields.interview_skill_observations:', JSON.stringify(detailedFields.interview_skill_observations));
  console.log('DEBUG generateOfficialFields OUTPUT officialFields.interview_skill_observations:', JSON.stringify(officialFields.interview_skill_observations));
  console.log('DEBUG generateOfficialFields OUTPUT natural_support_observations length:', (officialFields.natural_support_observations || '').length, '/ limit:', WSA_CHAR_LIMITS.natural_support_observations);

  return {
    official_wsa_fields: officialFields,
    staff_should_verify: [],
    evidence_summary: [],
  };
}

async function generateSupplementalReport(base44, contextBlock, detailedFields) {
  // Extract referral_question from context to use as the report's primary framework.
  let referralQuestion = '';
  try {
    const ctx = JSON.parse(contextBlock);
    referralQuestion = safeString(
      (ctx.current_wsa_responses && ctx.current_wsa_responses.referral_question) || ''
    ).trim();
  } catch (_e) { /* leave empty */ }

  const referralQuestionSection = referralQuestion
    ? `COUNSELOR REFERRAL QUESTION (VR-authored — do NOT reprint verbatim):
"${referralQuestion}"

PRIMARY FRAMEWORK RULE:
The Referral Question above is the counselor's primary guidance for what to assess and report.
Extract each distinct question or area of concern embedded in the Referral Question.
Structure the Supplemental Report so each of those questions is clearly answered using documented assessment evidence.
The report must demonstrate that the assessment process gathered evidence to answer every question the counselor asked.
Do NOT repeat or reprint the Referral Question text in the report.
Instead, answer each embedded question with evidence-based narrative.
Example format:
  The counselor asked about [topic]. Assessment findings indicate [evidence-based answer].

REFERRAL QUESTION TOPICS TO ADDRESS (derived from the Referral Question above):
Identify and answer all topics the counselor raised. Common topics include support needs, peer/coworker interaction, task strengths, areas of struggle, response to new/unusual situations, response to instructions and feedback. Address every topic found in the Referral Question.`
    : `NOTE: No Referral Question was found in the WSA responses. Structure the report using standard supplemental WSA sections.`;

  const prompt = `You are a vocational rehabilitation specialist writing a supplemental narrative Work Strategy Assessment report for a Utah DWS client file.

This supplemental report is an ADD-ON report.
It does not replace the Full Detailed WSA fields.
It uses broader narrative sections for staff review and analysis.

${referralQuestionSection}

CLIENT, FACTS, ASSESSMENTS, DOCUMENTS, AND CURRENT WSA DATA:
${contextBlock}

FULL DETAILED WSA FIELDS:
${truncateForPrompt(detailedFields, 12000)}

EVIDENCE SOURCES (use ONLY these to answer the Referral Question and build the report):
- Work Performance & Support Observation
- Work Environment Tolerance Assessment
- Barriers to Employment Assessment
- Interview Assessment / WSA Interview Sessions
- FACTS / Vocational Facts Profile (VFP)
- Documents (resume, uploaded assessments, etc.)
- Other completed assessments

REQUIREMENTS:
- Return ONLY clean HTML.
- No markdown.
- No script tags.
- No style tags.
- No external links.
- No unsafe HTML.
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags appropriately.
- Structure the report with these sections:
  1. Counselor Referral Question Response (REQUIRED — present ONLY when a Referral Question exists; answer each embedded counselor question with evidence-based narrative; do NOT reprint the question text)
  2. Client Overview
  3. Evidence Reviewed
  4. Vocational Skills & Work History Analysis
  5. Functional Capabilities & Limitations
  6. Work Environment & Behavioral Observations
  7. Transportation & Community Access
  8. Support & Accommodation Needs
  9. Interpersonal & Communication Skills
  10. Job Development Recommendations
  11. Ongoing Support Recommendations
  12. Staff Verification Items
- The "Counselor Referral Question Response" section must be the FIRST section and must directly address each topic raised by the counselor using evidence from assessments. Do not simply describe evidence generically — connect evidence explicitly to the counselor's areas of concern.
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

    // VR-authored fields above the CRP section boundary are kept in sourceWsaResponses
    // as read-only context only — they must never be regenerated or overwritten by AI.

    if (sourceWsaResponses._detailed_wsa_fields) {
      sourceWsaResponses._detailed_wsa_fields = {
        ...sourceWsaResponses._detailed_wsa_fields,
      };

      delete sourceWsaResponses._detailed_wsa_fields.planned_job_search_hours_week;
      delete sourceWsaResponses._detailed_wsa_fields.recommended_target_occupations;
      delete sourceWsaResponses._detailed_wsa_fields.job_development_supports;
      delete sourceWsaResponses._detailed_wsa_fields.ongoing_supports;
      delete sourceWsaResponses._detailed_wsa_fields.interview_skill_observations;

      // Strip VR-authored keys from cached _detailed_wsa_fields to prevent stale AI values.
      for (const k of VR_AUTHORED_KEYS) {
        delete sourceWsaResponses._detailed_wsa_fields[k];
      }
    }


    // Determine worksite_simulation_location value using strict three-case logic:
    // Case 1: No WP&SO assessment exists → assessment-not-completed message.
    // Case 2: WP&SO exists but has no documented location field → location-missing message.
    // Case 3: WP&SO exists and has a documented location → use that exact value.
    const wpsoAssessment = assessments.find(a => a.assessment_type === 'work_performance_support_observation');
    let wpsoExplicitLocation = null;
    let worksiteSimulationLocation;

    if (!wpsoAssessment) {
      // Case 1: assessment does not exist
      worksiteSimulationLocation = 'Work Performance & Support Observation assessment has not been completed. Complete the Work Performance & Support Observation assessment before generating this section of the WSA.';
    } else {
      // Assessment exists — look for an explicit location field
      if (wpsoAssessment.responses) {
        const wpsoResponses = wpsoAssessment.responses;
        const locationKeys = Object.keys(wpsoResponses).filter(k => {
          const kl = k.toLowerCase();
          return kl.includes('location') || kl.includes('worksite') || kl.includes('site_name') ||
                 kl.includes('facility') || kl.includes('address');
        });
        for (const k of locationKeys) {
          const val = safeString(wpsoResponses[k]).trim();
          if (val && val.length > 2 && !val.startsWith('[')) {
            wpsoExplicitLocation = val;
            break;
          }
        }
      }

      if (wpsoExplicitLocation) {
        // Case 3: assessment exists and has a documented location
        worksiteSimulationLocation = wpsoExplicitLocation;
      } else {
        // Case 2: assessment exists but location field is absent/empty
        worksiteSimulationLocation = 'Work Performance & Support Observation assessment does not contain a documented worksite or situational assessment location. Staff must complete the location section before generating this portion of the WSA.';
      }
    }

    // ─── work_assessment_observations: pre-resolve from WP&SO only ────────────
    // Same hard-guard pattern as worksite_simulation_location.
    // The LLM must NEVER generate this field — it is resolved here from WP&SO fields only.
    // Sources: overall_observation_summary, tasks_attempted, task_context_notes,
    //          primary_task_evaluated, task_performance_strengths_observed,
    //          task_performance_concerns_observed, task_performance_vocational_implications,
    //          overall_prompt_level_for_observed_tasks, prompt_level_examples,
    //          observation_duration_minutes, job_role_observed.
    // Prohibited sources: WET, client profile, documents, interview sessions, work history.
    let workAssessmentObservationsResolved;
    if (!wpsoAssessment) {
      workAssessmentObservationsResolved = 'Work Performance & Support Observation assessment has not been completed. Complete the Work Performance & Support Observation assessment before generating this section of the WSA.';
    } else {
      const wr = wpsoAssessment.responses || {};

      // Collect only literal WP&SO observation fields — no inference, no fabrication.
      const wpsoObservationFields = [
        wr.overall_observation_summary,
        wr.tasks_attempted,
        wr.task_context_notes,
        wr.primary_task_evaluated,
        wr.task_performance_strengths_observed,
        wr.task_performance_concerns_observed,
        wr.task_performance_vocational_implications,
        wr.prompt_level_examples,
        wr.support_or_training_needed_from_observation,
        wr.overall_observation_summary,
        wr.verified_strengths_from_observation,
        wr.verified_support_needs_from_observation,
        wr.verified_barriers_or_concerns_from_observation,
      ]
        .map(v => safeString(v).trim())
        .filter(v => v && v.length > 2 && !v.startsWith('['));

      // Also include select/multiple-choice fields as readable labels
      const wpsoLabelFields = [
        wr.observation_purpose,
        wr.observation_type,
        wr.job_role_observed,
        wr.overall_prompt_level_for_observed_tasks,
        wr.task_initiation,
        wr.task_completion_level,
        wr.work_pace_observed,
        wr.accuracy_quality_observed,
        wr.fatigue_or_endurance_observed,
        wr.observation_duration_minutes ? `Observation duration: ${wr.observation_duration_minutes} minutes` : null,
      ]
        .map(v => safeString(v).trim())
        .filter(v => v && v.length > 1 && !v.startsWith('['));

      const allWpsoText = [...wpsoLabelFields, ...wpsoObservationFields].join('\n\n').trim();

      if (!allWpsoText) {
        workAssessmentObservationsResolved = 'Work Performance & Support Observation assessment does not contain sufficient observed work performance information. Staff must complete the observation section before generating this portion of the WSA.';
      } else {
        // Has content — mark for LLM synthesis using ONLY this pre-extracted text.
        workAssessmentObservationsResolved = '__WPSO_CONTENT_PRESENT__';
      }
    }

    // Build a labeled key:value block of WP&SO evidence for the narrative synthesis call.
    // Using labeled pairs so the LLM knows what each value means without seeing raw field keys.
    const wpsoObservationTextForLLM = workAssessmentObservationsResolved === '__WPSO_CONTENT_PRESENT__'
      ? (() => {
          const wr = wpsoAssessment.responses || {};
          const labeled = [
            ['Observation purpose', wr.observation_purpose],
            ['Observation type', wr.observation_type],
            ['Job role observed', wr.job_role_observed],
            ['Observation duration', wr.observation_duration_minutes ? `${wr.observation_duration_minutes} minutes` : null],
            ['Tasks attempted', wr.tasks_attempted],
            ['Task context / assignment description', wr.task_context_notes],
            ['Primary task evaluated', wr.primary_task_evaluated],
            ['Task initiation', wr.task_initiation],
            ['Highest prompt level required', wr.overall_prompt_level_for_observed_tasks],
            ['Where prompting was needed', wr.prompt_level_examples],
            ['Task sequence completion', wr.task_sequence_completion],
            ['Task completion level', wr.task_completion_level],
            ['Work pace observed', wr.work_pace_observed],
            ['Accuracy and quality observed', wr.accuracy_quality_observed],
            ['Error awareness and correction', wr.error_awareness_and_correction],
            ['Persistence and follow-through', wr.persistence_and_follow_through],
            ['Fatigue or endurance observed', wr.fatigue_or_endurance_observed],
            ['Observed performance strengths', wr.task_performance_strengths_observed],
            ['Observed performance concerns', wr.task_performance_concerns_observed],
            ['Vocational implications of task performance', wr.task_performance_vocational_implications],
            ['Support or training needed', wr.support_or_training_needed_from_observation],
            ['Overall observation summary', wr.overall_observation_summary],
            ['Verified vocational strengths', wr.verified_strengths_from_observation],
            ['Verified support needs', wr.verified_support_needs_from_observation],
            ['Verified barriers or concerns', wr.verified_barriers_or_concerns_from_observation],
          ]
            .filter(([, v]) => {
              const s = safeString(v).trim();
              return s && s.length > 2 && !s.startsWith('[');
            })
            .map(([label, v]) => `${label}: ${safeString(v).trim()}`)
            .join('\n');
          return labeled;
        })()
      : null;

    console.log('DEBUG worksiteSimulationLocation:', worksiteSimulationLocation);

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
      // Pre-resolved value for worksite_simulation_location — the LLM must use this verbatim.
      wpso_explicit_location: wpsoExplicitLocation || null,
      worksite_simulation_location_resolved: worksiteSimulationLocation,
      // Pre-resolved work_assessment_observations evidence.
      // When work_assessment_observations_resolved is '__WPSO_CONTENT_PRESENT__', the LLM
      // must synthesize ONLY from wpso_observation_text. Any other value is a hard-guard
      // placeholder and must be used verbatim.
      work_assessment_observations_resolved: workAssessmentObservationsResolved,
      wpso_observation_text: wpsoObservationTextForLLM,
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
        // Support contact fields — used exclusively for natural_support_observations pre-extraction
        guardian_name: client.guardian_name || null,
        support_staff_name: client.support_staff_name || null,
        contacts: Array.isArray(client.contacts) ? client.contacts : [],
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
      const detailedResult = await generateDetailedFields(base44, contextBlock, wpsoExplicitLocation);

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
      console.log('DEBUG wpsoExplicitLocation:', wpsoExplicitLocation);
      const detailedResult = await generateDetailedFields(base44, contextBlock, wpsoExplicitLocation);

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