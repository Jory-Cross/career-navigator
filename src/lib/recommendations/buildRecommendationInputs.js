function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function cleanString(value) {
  return String(value || "").trim();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map(cleanString)
        .filter(Boolean)
    )
  );
}

function isResume(doc) {
  return cleanString(doc?.category).toLowerCase() === "resume";
}

function getDocumentSkills(doc) {
  return uniqueStrings([
    ...toArray(doc?.ai_tags),
    ...toArray(doc?.tags),
  ]);
}

function isWsaAssessment(assessment) {
  const type = cleanString(assessment?.assessment_type).toLowerCase();
  return type === "wsa" || type.includes("work strategy");
}

function summarizeWsa(wsa = null) {
  if (!wsa) return null;

  const responses = wsa.responses || {};

  return {
    assessment_id: wsa.id || "",
    notes: wsa.notes || "",
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
    otherAssessments.flatMap((assessment) => {
      const responses = assessment.responses || {};
      return [
        assessment.assessment_type,
        assessment.notes,
        ...Object.values(responses),
      ];
    })
  );

  const combined_profile = {
    resume_skills: resumeSkills,
    wsa_strengths: [],
    assessment_keywords: assessmentKeywords,
    job_titles: [],
    vocational_themes: [],
  };

  return {
    resumes,
    wsa: summarizeWsa(wsa),
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
