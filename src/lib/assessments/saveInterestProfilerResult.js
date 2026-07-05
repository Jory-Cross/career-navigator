import { base44 } from "@/api/base44Client";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTimestamp(item) {
  const value =
    item?.updated_date ||
    item?.updated_at ||
    item?.created_date ||
    item?.created_at ||
    "";
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

async function invokeAuthorizedAssessment(payload) {
  const response = await base44.functions.invoke(
    "manageAuthorizedAssessment",
    payload
  );
  const data = response?.data ?? response ?? {};

  if (!data?.ok) {
    throw new Error(data?.error || "Interest Profiler results could not be saved.");
  }

  return data;
}

/**
 * Saves the O*NET Interest Profiler through the authorized assessment route.
 * Client, organization, caller, and assessment ownership are resolved on the
 * server. This helper intentionally does not archive older records directly;
 * duplicate cleanup requires a separately reviewed server-side workflow.
 */
export async function saveInterestProfilerResult({
  clientId,
  assessmentId = null,
  answers = [],
  answerString = "",
  scores = {},
  riasec_scores = {},
  topCodes = [],
  riasec_code = "",
  status = "completed",
  completed = true,
  completed_at = null,
  onetResult = null,
}) {
  const normalizedScores = {
    Realistic:
      riasec_scores.Realistic ??
      riasec_scores.realistic ??
      riasec_scores.R ??
      scores.Realistic ??
      scores.realistic ??
      scores.R ??
      0,
    Investigative:
      riasec_scores.Investigative ??
      riasec_scores.investigative ??
      riasec_scores.I ??
      scores.Investigative ??
      scores.investigative ??
      scores.I ??
      0,
    Artistic:
      riasec_scores.Artistic ??
      riasec_scores.artistic ??
      riasec_scores.A ??
      scores.Artistic ??
      scores.artistic ??
      scores.A ??
      0,
    Social:
      riasec_scores.Social ??
      riasec_scores.social ??
      riasec_scores.S ??
      scores.Social ??
      scores.social ??
      scores.S ??
      0,
    Enterprising:
      riasec_scores.Enterprising ??
      riasec_scores.enterprising ??
      riasec_scores.E ??
      scores.Enterprising ??
      scores.enterprising ??
      scores.E ??
      0,
    Conventional:
      riasec_scores.Conventional ??
      riasec_scores.conventional ??
      riasec_scores.C ??
      scores.Conventional ??
      scores.conventional ??
      scores.C ??
      0,
  };

  const normalizedCode =
    riasec_code ||
    (Array.isArray(topCodes) ? topCodes.join("") : String(topCodes || ""));
  const normalizedStatus = status === "in_progress" ? "in_progress" : "completed";
  const completedAt = completed_at || new Date().toISOString();

  let targetAssessmentId = assessmentId || null;

  if (!targetAssessmentId) {
    const listResult = await invokeAuthorizedAssessment({
      action: "list",
      client_id: clientId,
    });

    const existingInterestProfilers = safeArray(listResult?.assessments)
      .filter((assessment) => assessment?.assessment_type === "interest_profiler")
      .sort((left, right) => getTimestamp(right) - getTimestamp(left));

    targetAssessmentId = existingInterestProfilers[0]?.id || null;
  }

  const saved = await invokeAuthorizedAssessment({
    action: "upsert",
    assessment_id: targetAssessmentId || "",
    client_id: clientId,
    assessment_type: "interest_profiler",
    status: normalizedStatus,
    responses: {
      answers,
      answerString,
      answer_string: answerString,
      onet_answer_string: answerString,
      scores: normalizedScores,
      riasec_scores: normalizedScores,
      topCodes,
      riasec_code: normalizedCode,
      completed: completed === true || normalizedStatus === "completed",
      completed_at: completedAt,
      completed_date: completedAt,
      source: "O*NET Interest Profiler",
      onetResult,
    },
    structured_evidence: [],
    source_metadata: {
      source: "O*NET Interest Profiler",
      completed_at: completedAt,
    },
    staff_review_flags: [],
  });

  return saved.assessment;
}
