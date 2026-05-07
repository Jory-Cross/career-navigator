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
  const user = await base44.auth.me();

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

  const completedAt = completed_at || new Date().toISOString();

  const existingAssessments = await base44.entities.Assessment.filter({
    client_id: clientId,
  });

  const existingInterestProfilers = safeArray(existingAssessments)
    .filter((assessment) => assessment?.assessment_type === "interest_profiler")
    .filter((assessment) => assessment?.is_archived !== true)
    .sort((a, b) => getTimestamp(b) - getTimestamp(a));

  const targetAssessmentId =
    assessmentId || existingInterestProfilers[0]?.id || null;

  const payload = {
    client_id: clientId,
    assessment_type: "interest_profiler",

    status,
    completed,
    completed_at: completedAt,
    completed_date: completedAt,
    is_archived: false,

    responses: {
      answers,
      answerString,
      answer_string: answerString,
      onet_answer_string: answerString,

      scores: normalizedScores,
      riasec_scores: normalizedScores,

      topCodes,
      riasec_code: normalizedCode,

      completed,
      completed_at: completedAt,
      completed_date: completedAt,

      source: "O*NET Interest Profiler",
      onetResult,
    },

    completed_by: user?.email || "",
    notes: `O*NET Interest Profiler / RIASEC assessment completed. RIASEC: ${normalizedCode}`,
  };

  let savedAssessment;

  if (targetAssessmentId) {
    savedAssessment = await base44.entities.Assessment.update(
      targetAssessmentId,
      payload
    );
  } else {
    savedAssessment = await base44.entities.Assessment.create(payload);
  }

  const savedId = savedAssessment?.id || targetAssessmentId;

  await Promise.all(
    existingInterestProfilers
      .filter((assessment) => assessment.id !== savedId)
      .map((assessment) =>
        base44.entities.Assessment.update(assessment.id, {
          is_archived: true,
          status: "archived",
          archived_at: completedAt,
          archive_reason:
            "Archived because a newer O*NET Interest Profiler was completed.",
        })
      )
  );

  return savedAssessment;
}
