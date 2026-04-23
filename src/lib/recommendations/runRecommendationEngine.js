import { generateRecommendationBatch } from "@/lib/recommendations/generateRecommendationBatch";
import { loadLatestRecommendationBatch } from "@/lib/recommendations/loadLatestRecommendationBatch";

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

  const result = await generateRecommendationBatch({
    client,
    documents,
    assessments,
  });

  return {
    batch: result.batch,
    payload: result.payload,
    reused: false,
  };
}
