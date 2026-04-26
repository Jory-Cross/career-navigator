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

  scores.forEach((item) => {
    const name = item?.title || item?.name || item?.interest || item?.code;
    const score = Number(item?.score || 0);

    if (RIASEC_ORDER.includes(name)) {
      normalized[name] = score;
    }
  });

  return normalized;
}

export function getTopRiasecCodes(scores = {}) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name[0])
    .join("");
}

export function buildInterestProfilerAnswerString(answers = []) {
  return answers
    .map((answer) => Number(answer))
    .filter((answer) => answer >= 1 && answer <= 5)
    .join("");
}

export function buildRiasecProfile({ scores = [], answers = [] } = {}) {
  const normalizedScores = normalizeRiasecScores(scores);
  const topCode = getTopRiasecCodes(normalizedScores);

  return {
    source: "O*NET Interest Profiler",
    version: ONET_INTEREST_PROFILER_VERSION,
    riasec_scores: normalizedScores,
    riasec_code: topCode,
    answers,
    completed_at: new Date().toISOString(),
  };
}
