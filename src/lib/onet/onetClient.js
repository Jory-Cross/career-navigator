import { base44 } from "@/api/base44Client";

async function onetRequest(path, params = {}) {
  const response = await base44.functions.invoke("onetProxy", {
    path,
    params,
  });

  if (!response?.data?.success) {
    const errorMessage =
      response?.data?.error ||
      response?.error ||
      "O*NET request failed";

    console.error("O*NET proxy request failed:", {
      path,
      params,
      response,
    });

    throw new Error(errorMessage);
  }

  return response.data.data;
}

// ── O*NET Interest Profiler ───────────────────────────────────────────────────

export async function getInterestProfilerQuestions({ start = 1, end = 60 } = {}) {
  return onetRequest("/mnm/interestprofiler/questions", { start, end });
}

export async function getInterestProfilerResults(answers) {
  return onetRequest("/mnm/interestprofiler/results", { answers });
}

export async function getInterestProfilerJobZones() {
  return onetRequest("/mnm/interestprofiler/job_zones");
}

export async function getInterestProfilerCareers({ answers, scores, jobZone } = {}) {
  const params = {};

  if (answers) params.answers = answers;
  if (scores) params.scores = scores;

  // O*NET Web Services v2 expects the Job Zone filter as "zone".
  if (jobZone) params.job_zone = jobZone;

  return onetRequest("/mnm/interestprofiler/careers", params);
}

// Search for an occupation explicitly identified in verified work history
// or current career goals. These candidates are later merged with Interest
// Profiler suggestions so validated work success is not lost.
export async function searchOnetCareersByKeyword(keyword, { start = 1, end = 5 } = {}) {
  if (!keyword) return null;

  return onetRequest("/mnm/search", {
    keyword,
    start,
    end,
  });
}

// ── O*NET Occupation Details ──────────────────────────────────────────────────
// These functions support later recommendation review and the career-targeted
// Skills Audit. They do not yet change recommendation ranking on their own.

export async function getOnetOccupationOverview(code) {
  if (!code) return null;

  return onetRequest(`/mnm/careers/${code}`);
}

export async function getOnetOccupationSkills(code) {
  if (!code) return null;

  return onetRequest(`/mnm/careers/${code}/skills`);
}

export async function getOnetOccupationEducation(code) {
  if (!code) return null;

  return onetRequest(`/mnm/careers/${code}/education`);
}

export async function getOnetOccupationTechnology(code) {
  if (!code) return null;

  return onetRequest(`/mnm/careers/${code}/technology`);
}

export async function getOnetOccupationJobZone(code) {
  if (!code) return null;

  return onetRequest(`/online/occupations/${code}/details/job_zone`);
}

export async function getOnetOccupationTasks(code) {
  if (!code) return null;

  return onetRequest(`/online/occupations/${code}/details/tasks`);
}

export async function getOnetOccupationDetailedSkills(code) {
  if (!code) return null;

  return onetRequest(`/online/occupations/${code}/details/skills`);
}

export async function getOnetOccupationTechnologySkills(code) {
  if (!code) return null;

  return onetRequest(`/online/occupations/${code}/details/technology_skills`);
}

// Temporary compatibility function for future callers that need a career
// overview. No existing app file currently calls this function.
export async function getOnetOccupationDetails(code) {
  return getOnetOccupationOverview(code);
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

export async function testOnetConnection() {
  try {
    const res = await getInterestProfilerQuestions({ start: 1, end: 1 });

    if (!res) {
      console.error("O*NET TEST FAILED: Empty response.");
      return false;
    }

    console.log("O*NET TEST SUCCESS:", res);
    return true;
  } catch (err) {
    console.error("O*NET TEST FAILED:", err);
    return false;
  }
}
