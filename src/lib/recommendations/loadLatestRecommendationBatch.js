import { base44 } from "@/api/base44Client";

function sortNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a?.generated_at || 0).getTime();
    const bTime = new Date(b?.generated_at || 0).getTime();
    return bTime - aTime;
  });
}

function normalizeBatch(batch) {
  if (!batch) return null;

  return {
    ...batch,
   recommendations: Array.isArray(batch.recommendations)
  ? batch.recommendations
  : Array.isArray(batch.recommended_job_fields_json)
    ? batch.recommended_job_fields_json
    : [],
    summary: batch.summary || {},
    source: batch.source || "saved",
  };
}

export async function loadLatestRecommendationBatch(clientId) {
  if (!clientId) {
    throw new Error("loadLatestRecommendationBatch requires clientId");
  }

 const results = await base44.entities.JobRecommendationBatch.filter({
  client_id: clientId,
});

  console.log("LOADED RECOMMENDATION BATCHES:", results);
  
  const ordered = sortNewestFirst(Array.isArray(results) ? results : []);
  return normalizeBatch(ordered[0] || null);
}
