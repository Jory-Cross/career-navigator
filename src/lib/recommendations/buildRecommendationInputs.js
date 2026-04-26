import {
  buildInterestProfilerAnswerString,
  buildRiasecProfile,
} from "@/lib/onet/interestProfiler";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function cleanString(value) {
  return String(value || "").trim();
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map(cleanString).filter(Boolean)));
}

function isResume(doc) {
  return cleanString(doc?.category).toLowerCase() === "resume";
}

function getDocumentSkills(doc) {
  return uniqueStrings([
    ...toArray(doc?.ai_tags),
    ...toArray(doc?.tags),
    ...toArray(doc?.skills),
  ]);
}

function isWsaAssessment(assessment) {
  const rawType =
    assessment?.assessment_type ||
    assessment?.title ||
    assessment?.name ||
    assessment?.type ||
    "";

  const type = String(rawType)
  .toLowerCase()
  .trim()
  .replace(/_/g, " ");

  console.log("CHECKING ASSESSMENT TYPE:", rawType, "→", type);

  return (
    type.includes("work strategy") ||
    type.includes("strategy assessment") ||
    type.includes("wsa")
  );
}

function getAssessmentText(assessment) {
  const responses = assessment?.responses || {};
  return uniqueStrings([
    assessment?.assessment_type,
    assessment?.title,
    assessment?.name,
    assessment?.summary,
    assessment?.notes,
    ...Object.values(responses),
  ]);
}

function summarizeWsa(wsa = null) {
  if (!wsa) return null;

  const responses = wsa.responses || {};

  return {
    assessment_id: wsa.id || "",
    assessment_type: wsa.assessment_type || wsa.type || "wsa",
    notes: wsa.notes || "",
    summary: wsa.summary || responses.summary || "",

    strengths: uniqueStrings([
      ...toArray(wsa.strengths),
      ...toArray(responses.strengths),
      ...toArray(responses.current_work_skills),
      ...toArray(responses.work_skill_observations),
      ...toArray(responses.interpersonal_social_skills),
      ...toArray(responses.assistive_technology_needs),
      ...toArray(responses.communication_needs),
      ...toArray(responses.activities_of_daily_living),
      ...toArray(responses.life_skills_observations),
      ...toArray(responses.computer_skills_other),
      ...toArray(responses.computer_skill_observations),
      ...toArray(responses.other_observations),
    ]),

    themes: uniqueStrings([
      ...toArray(wsa.themes),
      ...toArray(responses.themes),
      ...toArray(responses.jobs_of_interest),
      ...toArray(responses.recommended_target_occupations),
      ...toArray(responses.recommended_supports_on_job),
      ...toArray(responses.transportation_public),
      ...toArray(responses.transportation_private),
      ...toArray(responses.planned_job_search_hours_week),
      ...toArray(responses.hours_available_to_work),
    ]),

    barriers: uniqueStrings([
      ...toArray(wsa.barriers),
      ...toArray(responses.barriers),
      ...toArray(responses.work_skill_development_needs),
      ...toArray(responses.health_insurance),
      ...toArray(responses.benefits_planning),
      ...toArray(responses.school_academic),
      ...toArray(responses.criminal_background),
      ...toArray(responses.family_issues_supports),
      ...toArray(responses.life_skills_needed),
      ...toArray(responses.life_skills_hours_requested),
    ]),

    job_goals: uniqueStrings([
      ...toArray(wsa.job_goals),
      ...toArray(responses.job_goals),
      ...toArray(responses.jobs_of_interest),
      ...toArray(responses.recommended_target_occupations),
    ]),

    responses,
    pdf_url: wsa.pdf_url || responses._uploaded_pdf_url || "",
  };
}

function extractRiasecAssessment(assessments = []) {
  return assessments.find((assessment) => {
    const type = String(
      assessment?.assessment_type ||
        assessment?.type ||
        assessment?.title ||
        assessment?.name ||
        ""
    )
      .toLowerCase()
      .trim()
      .replace(/_/g, " ");

    return type.includes("interest") || type.includes("riasec");
  }) || null;
}

export function buildRecommendationInputs({
  documents = [],
  assessments = [],
} = {}) {
  const resumes = documents.filter(isResume);
  const wsaAssessments = assessments.filter(isWsaAssessment);
  console.log("WSA ASSESSMENTS FOUND:", wsaAssessments);
  const otherAssessments = assessments.filter((assessment) => !isWsaAssessment(assessment));

  const resumeSkills = uniqueStrings(
    resumes.flatMap((doc) => getDocumentSkills(doc))
  );

  const wsa = wsaAssessments[0] || null;
  console.log("FULL WSA OBJECT:", wsa);
  console.log("FULL WSA RESPONSES:", wsa?.responses);
console.log("FULL WSA RESPONSE KEYS:", Object.keys(wsa?.responses || {}));

  const assessmentKeywords = uniqueStrings(
    otherAssessments.flatMap(getAssessmentText)
  );

  const summarizedWsa = summarizeWsa(wsa);

const interestAssessment = extractRiasecAssessment(assessments);

let interestProfile = null;
let onetAnswerString = null;

if (interestAssessment) {
  interestProfile = buildRiasecProfile({
    scores: interestAssessment.riasec_scores || {},
    answers: interestAssessment.answers || [],
  });

  onetAnswerString = buildInterestProfilerAnswerString(
    interestAssessment.answers || []
  );
}
  
    const combined_profile = {
    resume_skills: resumeSkills,
    wsa_strengths: summarizedWsa?.strengths || [],
    wsa_themes: summarizedWsa?.themes || [],
    wsa_barriers: summarizedWsa?.barriers || [],
    wsa_job_goals: summarizedWsa?.job_goals || [],
    assessment_keywords: assessmentKeywords,
    job_titles: uniqueStrings(resumes.flatMap((doc) => toArray(doc?.job_titles))),
    vocational_themes: summarizedWsa?.themes || [],
  };

  return {
    resumes: resumes.map((doc) => ({
      ...doc,
      skills: getDocumentSkills(doc),
    })),
       wsa: summarizedWsa,
    otherAssessments,
    assessments_summary: {
      wsa_strengths: summarizedWsa?.strengths || [],
      wsa_themes: summarizedWsa?.themes || [],
      wsa_barriers: summarizedWsa?.barriers || [],
      wsa_job_goals: summarizedWsa?.job_goals || [],
      other_assessment_keywords: assessmentKeywords,
    },
    interestProfile,
onet_answer_string: onetAnswerString,
    combined_profile,
    active_sources: {
      resumes: resumes.length,
      wsa: wsaAssessments.length,
      other_assessments: otherAssessments.length,
    },
    source_resume_ids: resumes.map((doc) => doc.id).filter(Boolean),
    source_wsa_ids: wsaAssessments.map((assessment) => assessment.id).filter(Boolean),
    source_other_assessment_ids: otherAssessments.map((assessment) => assessment.id).filter(Boolean),
  };
}
