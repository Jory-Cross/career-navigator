import { createDocument } from "@/lib/api/clientPortalApi";

export async function saveInterestProfilerResult({
  clientId,
  answers,
  scores,
  topCodes,
}) {
  return createDocument({
    client_id: clientId,
    title: "O*NET Interest Profiler",
    category: "assessment",
    document_subtype: "interest_profiler",
    source: "assessment",
    visibility: "staff",
    notes: JSON.stringify({
      answers,
      scores,
      topCodes,
    }),
    ai_summary: `RIASEC: ${topCodes.join(", ")} | Scores: ${Object.entries(scores)
      .map(([key, value]) => `${key}:${value}`)
      .join(", ")}`,
    ai_tags: ["interest profiler", ...topCodes],
  });
}
