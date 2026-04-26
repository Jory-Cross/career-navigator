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

function getVfpField(vfp = null, keys = []) {
  if (!vfp) return [];

  return uniqueStrings(
    keys.flatMap((key) => toArray(vfp?.[key]))
  );
}

function summarizeVfp(vfp = null) {
  if (!vfp) return null;

  return {
    profile_id: vfp.id || "",
    strengths: getVfpField(vfp, [
      "strengths",
      "work_strengths",
      "skills",
      "resume_skills",
    ]),
    preferences: getVfpField(vfp, [
      "preferences",
      "work_preferences",
      "job_preferences",
      "career_interests",
      "jobs_of_interest",
      "target_occupations",
    ]),
    environment_needs: getVfpField(vfp, [
      "environment_needs",
      "work_environment_needs",
      "support_needs",
      "accommodations",
    ]),
    barriers: getVfpField(vfp, [
      "barriers",
      "work_barriers",
      "limitations",
      "support_barriers",
    ]),
    schedule_constraints: getVfpField(vfp, [
      "schedule_constraints",
      "availability",
      "preferred_schedule",
      "hours_available",
    ]),
    transportation: getVfpField(vfp, [
      "transportation",
      "transportation_needs",
      "commute_limitations",
    ]),
    job_titles: getVfpField(vfp, [
      "job_titles",
      "preferred_job_titles",
      "recommended_jobs",
      "target_jobs",
    ]),
    raw: vfp,
  };
}

export function buildRecommendationInputs({
  documents = [],
  assessments = [],
  vocationalProfile = null, // ✅ NEW (VFP)
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
const summarizedVfp = summarizeVfp(vocationalProfile);

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
  resume_skills: summarizedVfp?.strengths?.length
    ? summarizedVfp.strengths
    : resumeSkills,

  wsa_strengths: summarizedVfp?.strengths?.length
    ? summarizedVfp.strengths
    : summarizedWsa?.strengths || [],

  wsa_preferences: summarizedVfp?.preferences?.length
    ? summarizedVfp.preferences
    : summarizedWsa?.preferences || [],

  wsa_environment_needs: summarizedVfp?.environment_needs?.length
    ? summarizedVfp.environment_needs
    : summarizedWsa?.environment_needs || [],

  wsa_barriers: summarizedVfp?.barriers?.length
    ? summarizedVfp.barriers
    : summarizedWsa?.barriers || [],

  wsa_schedule_constraints: summarizedVfp?.schedule_constraints?.length
    ? summarizedVfp.schedule_constraints
    : summarizedWsa?.schedule_constraints || [],

  wsa_transportation: summarizedVfp?.transportation?.length
    ? summarizedVfp.transportation
    : summarizedWsa?.transportation || [],

  assessment_keywords: assessmentKeywords,

  job_titles: summarizedVfp?.job_titles?.length
    ? summarizedVfp.job_titles
    : uniqueStrings(resumes.flatMap((doc) => toArray(doc?.job_titles))),
};

  return {
  resumes: resumes.map((doc) => ({
    ...doc,
    skills: getDocumentSkills(doc),
  })),
    vocationalProfile: summarizedVfp,
  wsa: summarizedWsa,
  otherAssessments,
   assessments_summary: {
  wsa_strengths: summarizedWsa?.strengths || [],
  wsa_preferences: summarizedWsa?.preferences || [],
  wsa_environment_needs: summarizedWsa?.environment_needs || [],
  wsa_barriers: summarizedWsa?.barriers || [],
  wsa_schedule_constraints: summarizedWsa?.schedule_constraints || [],
  wsa_transportation: summarizedWsa?.transportation || [],

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
