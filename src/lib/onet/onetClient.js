/**
 * O*NET adapter layer.
 *
 * This file is the ONLY place future frontend recommendation logic should call
 * for O*NET / My Next Move career-intelligence data.
 *
 * Official O*NET services include Interest Profiler scoring, My Next Move
 * career matching, occupation data, and career reports.
 */

export const ONET_FEATURES = {
  INTEREST_PROFILER: "interest_profiler",
  MY_NEXT_MOVE: "my_next_move",
  OCCUPATION_REPORTS: "occupation_reports",
  CAREER_MATCHES: "career_matches",
  JOB_ZONES: "job_zones",
};

export function normalizeRiasecScores(scores = {}) {
  return {
    realistic: Number(scores.realistic || scores.R || 0),
    investigative: Number(scores.investigative || scores.I || 0),
    artistic: Number(scores.artistic || scores.A || 0),
    social: Number(scores.social || scores.S || 0),
    enterprising: Number(scores.enterprising || scores.E || 0),
    conventional: Number(scores.conventional || scores.C || 0),
  };
}

export function getTopRiasecCodes(scores = {}, limit = 3) {
  const normalized = normalizeRiasecScores(scores);

  return Object.entries(normalized)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => {
      if (key === "realistic") return "R";
      if (key === "investigative") return "I";
      if (key === "artistic") return "A";
      if (key === "social") return "S";
      if (key === "enterprising") return "E";
      if (key === "conventional") return "C";
      return "";
    })
    .filter(Boolean);
}

export function buildOnetRecommendationProfile({
  riasec_scores = {},
  job_zone = null,
  resume_skills = [],
  wsa_constraints = [],
  support_needs = [],
} = {}) {
  const normalizedRiasec = normalizeRiasecScores(riasec_scores);

  return {
    source: "onet",
    riasec_scores: normalizedRiasec,
    top_riasec_codes: getTopRiasecCodes(normalizedRiasec),
    job_zone,
    resume_skills,
    wsa_constraints,
    support_needs,
  };
}

export async function getOnetInterestProfilerQuestions() {
  throw new Error(
    "O*NET Interest Profiler questions must be loaded through the official O*NET Web Services adapter."
  );
}

export async function getOnetCareerMatches() {
  throw new Error(
    "O*NET career matches must be loaded through the official O*NET / My Next Move adapter."
  );
}

export async function getOnetOccupationReport() {
  throw new Error(
    "O*NET occupation reports must be loaded through the official O*NET Web Services adapter."
  );
}
