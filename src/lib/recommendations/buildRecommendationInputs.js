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
      ...toArray(responses.work_strengths),
      ...toArray(responses.best_work_tasks),
      ...toArray(responses.skills),
      ...toArray(responses.abilities),
      ...toArray(responses.what_i_do_well),
    ]),
    themes: uniqueStrings([
      ...toArray(wsa.themes),
      ...toArray(responses.themes),
      ...toArray(responses.work_preferences),
      ...toArray(responses.preferred_tasks),
      ...toArray(responses.interests),
      ...toArray(responses.preferred_work_environment),
      ...toArray(responses.work_values),
    ]),
    barriers: uniqueStrings([
      ...toArray(wsa.barriers),
      ...toArray(responses.barriers),
      ...toArray(responses.support_needs),
      ...toArray(responses.challenges),
      ...toArray(responses.accommodations),
    ]),
    job_goals: uniqueStrings([
      ...toArray(wsa.job_goals),
      ...toArray(responses.job_goals),
      ...toArray(responses.career_goals),
      ...toArray(responses.desired_jobs),
      ...toArray(responses.preferred_jobs),
    ]),
    responses,
    pdf_url: wsa.pdf_url || responses._uploaded_pdf_url || "",
  };
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
    interestProfile: null,
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
