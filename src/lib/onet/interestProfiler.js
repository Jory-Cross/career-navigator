export const ONET_INTEREST_PROFILER_VERSION = "onet-web-services-v2";

export const RIASEC_ORDER = [
  "Realistic",
  "Investigative",
  "Artistic",
  "Social",
  "Enterprising",
  "Conventional",
];

export function normalizeRiasecScores(scores = []) {
  const normalized = {};

  RIASEC_ORDER.forEach((name) => {
    normalized[name] = 0;
  });

  if (Array.isArray(scores)) {
    scores.forEach((item) => {
      const name = item?.title || item?.name || item?.interest || item?.area;
      const score = Number(item?.score || 0);

      if (RIASEC_ORDER.includes(name)) {
        normalized[name] = score;
      }
    });
  }

  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    RIASEC_ORDER.forEach((name) => {
      const value = scores[name] ?? scores[name[0]] ?? 0;
      normalized[name] = Number(value || 0);
    });
  }

  return normalized;
}

export function buildRiasecScoreString(scores = {}) {
  const normalized = normalizeRiasecScores(scores);
  return RIASEC_ORDER.map((name) => normalized[name]).join("-");
}

export function getTopRiasecCodes(scores = {}) {
  const normalized = normalizeRiasecScores(scores);

  return Object.entries(normalized)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name[0])
    .join("");
}

export function buildInterestProfilerAnswerString(answers = []) {
  return answers
    .map((answer) => {
      if (typeof answer === "object" && answer !== null) {
        return Number(answer.value ?? answer.answer ?? answer.score);
      }

      return Number(answer);
    })
    .filter((answer) => answer >= 1 && answer <= 5)
    .join("");
}

export function buildRiasecProfile({ scores = [], answers = [] } = {}) {
  const normalizedScores = normalizeRiasecScores(scores);
  const riasecCode = getTopRiasecCodes(normalizedScores);
  const scoreString = buildRiasecScoreString(normalizedScores);

  return {
    source: "O*NET Interest Profiler",
    version: ONET_INTEREST_PROFILER_VERSION,
    riasec_scores: normalizedScores,
    riasec_score_string: scoreString,
    riasec_code: riasecCode,
    answers,
    completed_at: new Date().toISOString(),
  };
}
export function buildOnetRecommendationProfile({
  riasecProfile = null,
  onetAnswerString = null,
} = {}) {
  if (onetAnswerString) {
    return {
      type: "answers",
      answers: onetAnswerString,
    };
  }

  if (riasecProfile?.riasec_score_string) {
    return {
      type: "scores",
      scores: riasecProfile.riasec_score_string,
    };
  }

  return null;
}
