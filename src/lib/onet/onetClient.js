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

export async function getInterestProfilerQuestions({ start = 1, end = 60 } = {}) {
  return onetRequest("/ip/questions", { start, end });
}

export async function getInterestProfilerResults(answers) {
  return onetRequest("/ip/results", { answers });
}

export async function getInterestProfilerCareers({ answers, scores, jobZone } = {}) {
  const params = {};

  if (answers) params.answers = answers;
  if (scores) params.scores = scores;
  if (jobZone) params.job_zone = jobZone;

  return onetRequest("/ip/careers", params);
}

export async function getOnetOccupationDetails(code) {
  if (!code) return null;

  return onetRequest(`/careers/${code}/report`);
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
