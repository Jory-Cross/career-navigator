import { generateRecommendationBatch } from "@/lib/recommendations/generateRecommendationBatch";
import { loadLatestRecommendationBatch } from "@/lib/recommendations/loadLatestRecommendationBatch";
import { buildRecommendationInputs } from "./buildRecommendationInputs";

export async function runRecommendationEngine({
  client,
  documents = [],
  assessments = [],
  vocationalProfile = null,
  forceRegenerate = true,
}) {
  if (!client?.id) {
    throw new Error("runRecommendationEngine requires client.id");
  }

  const existing = await loadLatestRecommendationBatch(client.id);

  if (existing && !forceRegenerate) {
    return {
      batch: existing,
      reused: true,
    };
  }

  const inputs = buildRecommendationInputs({
    documents,
    assessments,
    vocationalProfile,
  });

  const result = await generateRecommendationBatch({
    client,
    ...inputs,
  });

  console.log("RUN ENGINE RESULT:", result);

  const batch = result?.batch || {
    recommendations: result?.recommendations || result?.items || [],
    summary: result?.onet_summary || {},
    source: result?.source || "unknown",
    error: result?.error || null,
  };

  return {
    batch: {
      ...batch,
      error: batch?.error || result?.error || null,
      recommendations: batch?.recommendations || result?.recommendations || result?.items || [],
    },
    payload: result?.payload || result,
    reused: false,
  };
}
