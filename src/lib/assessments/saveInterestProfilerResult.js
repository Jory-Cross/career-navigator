import { base44 } from "@/api/base44Client";

export async function saveInterestProfilerResult({
  clientId,
  answers = [],
  scores = {},
  topCodes = [],
}) {
  const user = await base44.auth.me();

  const riasecCode = Array.isArray(topCodes)
    ? topCodes.join("")
    : String(topCodes || "");

  return base44.entities.Assessment.create({
    client_id: clientId,
    assessment_type: "interest_profiler",
    responses: {
      answers,
     riasec_scores: {
  Realistic: scores.Realistic ?? scores.realistic ?? 0,
  Investigative: scores.Investigative ?? scores.investigative ?? 0,
  Artistic: scores.Artistic ?? scores.artistic ?? 0,
  Social: scores.Social ?? scores.social ?? 0,
  Enterprising: scores.Enterprising ?? scores.enterprising ?? 0,
  Conventional: scores.Conventional ?? scores.conventional ?? 0,
},
      riasec_code: riasecCode,
      source: "O*NET Interest Profiler",
    },
    completed_by: user?.email || "",
    notes: `O*NET Interest Profiler / RIASEC assessment completed. RIASEC: ${riasecCode}`,
  });
}
