import { base44 } from "@/api/base44Client";

export async function saveInterestProfilerResult({
  clientId,
  answers = [],
  scores = {},
  topCodes = [],
}) {
  const user = await base44.auth.me();

  return base44.entities.Assessment.create({
    client_id: clientId,
    assessment_type: "interest_profiler",
    responses: {
      answers,
      riasec_scores: scores,
      riasec_code: Array.isArray(topCodes) ? topCodes.join("") : String(topCodes || ""),
      source: "O*NET Interest Profiler",
    },
    completed_by: user?.email || "",
    notes: `O*NET Interest Profiler / RIASEC assessment completed. RIASEC: ${
      Array.isArray(topCodes) ? topCodes.join("") : String(topCodes || "")
    }`,
  });
}
