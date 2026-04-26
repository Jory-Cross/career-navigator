import { base44 } from "@/api/base44Client";

export async function saveInterestProfilerResult({
  clientId,
  assessmentId = null, // <-- NEW
  answers = [],
  scores = {},
  topCodes = [],
}) {
  const user = await base44.auth.me();

  const riasecCode = Array.isArray(topCodes)
    ? topCodes.join("")
    : String(topCodes || "");

  const payload = {
    client_id: clientId,
    assessment_type: "interest_profiler",
    responses: {
      answers,
      riasec_scores: {
        Realistic: scores.Realistic ?? scores.realistic ?? scores.R ?? 0,
        Investigative: scores.Investigative ?? scores.investigative ?? scores.I ?? 0,
        Artistic: scores.Artistic ?? scores.artistic ?? scores.A ?? 0,
        Social: scores.Social ?? scores.social ?? scores.S ?? 0,
        Enterprising: scores.Enterprising ?? scores.enterprising ?? scores.E ?? 0,
        Conventional: scores.Conventional ?? scores.conventional ?? scores.C ?? 0,
      },
      riasec_code: riasecCode,
      source: "O*NET Interest Profiler",
    },
    completed_by: user?.email || "",
    notes: `O*NET Interest Profiler / RIASEC assessment completed. RIASEC: ${riasecCode}`,
  };

  // 🔥 THIS IS THE FIX
  if (assessmentId) {
    return await base44.entities.Assessment.update(assessmentId, payload);
  }

  return await base44.entities.Assessment.create(payload);
}
