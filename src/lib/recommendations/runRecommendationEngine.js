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

  return {
    batch: result.batch,
    payload: result.payload,
    reused: false,
  };
}
