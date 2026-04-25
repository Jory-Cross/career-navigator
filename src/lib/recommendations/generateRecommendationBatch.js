import { base44 } from "@/api/base44Client";
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

  // Save batch to database
const savedBatch = await base44.entities.JobRecommendationBatch.create({
  client_id: client?.id,

  // REQUIRED FIELDS (fixing error)
  search_summary: result?.onet_summary?.narrative || "Generated recommendations",
  job_count: (result?.items || []).length,
  generated_at: new Date().toISOString(),
  generated_by: "ai",

  // YOUR DATA
  recommendations: result?.items || [],
  summary: result?.onet_summary || {},
  source: result?.source || "scored-fallback",
});

return {
  batch: savedBatch,
  payload: result,
};
}

export default generateRecommendationBatch;
