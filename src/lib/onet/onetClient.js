const ONET_BASE_URL = "https://services.onetcenter.org/ws/mnm";

function getOnetAuthHeader() {
  const username = import.meta.env.VITE_ONET_USERNAME;
  const password = import.meta.env.VITE_ONET_PASSWORD;

  if (!username || !password) {
    console.warn("Missing O*NET credentials.");
    return null;
  }

  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function onetRequest(path, params = {}) {
  const authHeader = getOnetAuthHeader();

  if (!authHeader) {
    return null;
  }

  const url = new URL(`${ONET_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`O*NET request failed: ${response.status}`);
  }

  return response.json();
}

export async function getInterestProfilerQuestions({ start = 1, end = 60 } = {}) {
  return onetRequest("/ip/questions", { start, end });
}

export async function getInterestProfilerResults(answers) {
  return onetRequest("/ip/results", { answers });
}

export async function getInterestProfilerCareers({ answers, scores, jobZone } = {}) {
  const params = {};

  if (answers) {
    params.answers = answers;
  }

  if (scores) {
    params.scores = scores;
  }

  if (jobZone) {
    params.job_zone = jobZone;
  }

  return onetRequest("/ip/careers", params);
}
