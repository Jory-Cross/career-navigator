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
  const type = cleanString(
    assessment?.assessment_type ||
    assessment?.title ||
    assessment?.name ||
    assessment?.type
  ).toLowerCase();

  return (
    type.includes("work strategy assessment") ||
    type.includes("work strategy") ||
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
    notes: wsa.notes || "",
    summary: wsa.summary || "",
    strengths: uniqueStrings([
      ...toArray(wsa.strengths),
      ...toArray(responses.strengths),
      ...toArray(responses.work_strengths),
      ...toArray(responses.best_work_tasks),
    ]),
    themes: uniqueStrings([
      ...toArray(wsa.themes),
      ...toArray(responses.themes),
      ...toArray(responses.work_preferences),
      ...toArray(responses.preferred_tasks),
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
  const otherAssessments = assessments.filter((assessment) => !isWsaAssessment(assessment));

  const resumeSkills = uniqueStrings(
    resumes.flatMap((doc) => getDocumentSkills(doc))
  );

  const wsa = wsaAssessments[0] || null;

  const assessmentKeywords = uniqueStrings(
    otherAssessments.flatMap(getAssessmentText)
  );

  const summarizedWsa = summarizeWsa(wsa);

  const combined_profile = {
    resume_skills: resumeSkills,
    wsa_strengths: summarizedWsa?.strengths || [],
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
