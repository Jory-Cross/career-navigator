import { generateRecommendationBatch } from "@/lib/recommendations/generateRecommendationBatch";
import { loadLatestRecommendationBatch } from "@/lib/recommendations/loadLatestRecommendationBatch";
import { buildRecommendationInputs } from "./buildRecommendationInputs";

export async function runRecommendationEngine({
  client,
  documents = [],
  assessments = [],
  forceRegenerate = true,
}) {
  if (!client?.id) {
    throw new Error("runRecommendationEngine requires client.id");
  }

  if (!forceRegenerate) {
    const existing = await loadLatestRecommendationBatch(client.id);
    if (existing) {
      return {
        batch: existing,
        reused: true,
      };
    }
  }

  const inputs = buildRecommendationInputs({
  documents,
  assessments,
});

const result = await generateRecommendationBatch({
  client,
  ...inputs,
});

  console.log("RUN ENGINE RESULT:", result);

return {
  batch: result?.batch || {
    recommendations: result?.recommendations || result?.items || [],
    summary: result?.onet_summary || {},
    source: result?.source || "fallback",
  },
  payload: result?.payload || result,
  reused: false,
};
}
