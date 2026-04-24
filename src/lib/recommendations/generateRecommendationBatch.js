import { getRecommendations } from "@/lib/adapters/recommendationAdapter";

export async function generateRecommendationBatch({
  client,
  resumes = [],
  wsa = null,
  otherAssessments = [],
  interestProfile = null,
  options = {}
} = {}) {
  return getRecommendations({
    client,
    resumes,
    wsa,
    otherAssessments,
    interestProfile,
    options
  });
}

export default generateRecommendationBatch;
