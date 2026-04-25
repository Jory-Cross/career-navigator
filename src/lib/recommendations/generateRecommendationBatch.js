import { getOnetRecommendations } from "@/lib/recommendations/getOnetRecommendations";

export async function generateRecommendationBatch({
  client,
  resumes = [],
  wsa = null,
  otherAssessments = [],
} = {}) {

  // Build profile for scoring engine
  const profile = {
    resume_skills: resumes.flatMap(r => r.skills || []),

    wsa_strengths: wsa?.strengths || [],

    assessment_keywords: otherAssessments.flatMap(a => a.keywords || []),

    job_titles: resumes.flatMap(r => r.job_titles || []),

    vocational_themes: wsa?.themes || [],

    riasec_scores: otherAssessments.find(a => a.riasec_scores)?.riasec_scores || {},
  };

  console.log("RECOMMENDATION PROFILE:", profile);
  const result = await getOnetRecommendations(profile);

  return {
    batch: {
      recommendations: result?.items || [],
      summary: result?.onet_summary || {},
      source: result?.source || "scored-fallback",
    },
    payload: result,
  };
}

export default generateRecommendationBatch;
