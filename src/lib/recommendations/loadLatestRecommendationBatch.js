import { base44 } from "@/api/base44Client";

function sortNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a?.created_date || a?.created_at || 0).getTime();
    const bTime = new Date(b?.created_date || b?.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export async function loadLatestRecommendationBatch(clientId) {
  if (!clientId) {
    throw new Error("loadLatestRecommendationBatch requires clientId");
  }

  const results = await base44.entities.JobRecommendationBatch.filter({
    client_id: clientId,
  });

  const ordered = sortNewestFirst(Array.isArray(results) ? results : []);
  return ordered[0] || null;
}
