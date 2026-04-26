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

  console.log("FULL ASSESSMENT OBJECT:", assessment);
  
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

  const strengths = uniqueStrings([
    ...toArray(responses.current_work_skills),
    ...toArray(responses.work_skill_observations),
    ...toArray(responses.interpersonal_social_skills),
  ]);

  const preferences = uniqueStrings([
    ...toArray(responses.jobs_of_interest),
    ...toArray(responses.recommended_target_occupations),
  ]);

  const environmentNeeds = uniqueStrings([
    ...toArray(responses.recommended_supports_on_job),
    ...toArray(responses.assistive_technology_needs),
    ...toArray(responses.communication_needs),
  ]);

  const barriers = uniqueStrings([
    ...toArray(responses.work_skill_development_needs),
    ...toArray(responses.life_skills_needed),
    ...toArray(responses.family_issues_supports),
    ...toArray(responses.criminal_background),
  ]);

  const scheduleConstraints = uniqueStrings([
    ...toArray(responses.hours_available_to_work),
    ...toArray(responses.planned_job_search_hours_week),
  ]);

  const transportation = uniqueStrings([
    ...toArray(responses.transportation_public),
    ...toArray(responses.transportation_private),
  ]);

  return {
    assessment_id: wsa.id || "",
    assessment_type: "wsa",

    strengths,
    preferences,
    environment_needs: environmentNeeds,
    barriers,
    schedule_constraints: scheduleConstraints,
    transportation,

    summary_text: [
      ...strengths,
      ...preferences,
      ...environmentNeeds,
      ...barriers,
    ].join(" | "),

    raw: responses,
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
  const responses = interestAssessment.responses || {};

  const answers =
    interestAssessment.answers ||
    responses.answers ||
    [];

  const scores =
    interestAssessment.riasec_scores ||
    responses.riasec_scores ||
    {};

  interestProfile = buildRiasecProfile({
    scores,
    answers,
  });

  onetAnswerString = buildInterestProfilerAnswerString(answers);
}

  console.log("RIASEC PROFILE:", interestProfile);
console.log("ONET ANSWER STRING:", onetAnswerString);
  
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
