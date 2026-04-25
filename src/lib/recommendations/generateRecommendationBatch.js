import { getRecommendations } from "@/lib/adapters/recommendationAdapter";

export async function generateRecommendationBatch({
  client,
  resumes = [],
  wsa = null,
  otherAssessments = [],
  interestProfile = null,
  combined_profile = null,
  active_sources = {},
  source_resume_ids = [],
  source_wsa_ids = [],
  source_other_assessment_ids = [],
  options = {},
} = {}) {
  const payload = await getRecommendations({
    client,
    resumes,
    wsa,
    otherAssessments,
    interestProfile,
    combined_profile,
    active_sources,
    source_resume_ids,
    source_wsa_ids,
    source_other_assessment_ids,
    options,
  });

  return {
    batch: {
      recommendations: payload?.recommendations || [],
      summary: payload?.onet_summary || {},
      source: payload?.source || payload?.onet_summary?.source || "fallback",
    },
    payload,
  };
}

export default generateRecommendationBatch;
