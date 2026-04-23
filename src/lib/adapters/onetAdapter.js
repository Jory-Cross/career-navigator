const ONET_BASE_URL = "https://services.onetcenter.org/ws/";

const ONET_USERNAME = "test";
const ONET_PASSWORD = "test";

function getAuthHeader() {
  return "Basic " + btoa(`${ONET_USERNAME}:${ONET_PASSWORD}`);
}

export async function getOnetRecommendations({
  interests = null,
  profile = null,
}) {
  try {
    // TEMP: using keyword-based search until we wire full Interest Profiler
    const query = profile?.skills?.[0] || "general";

    const res = await fetch(
      `${ONET_BASE_URL}online/search?keyword=${encodeURIComponent(query)}`,
      console.log("O*NET QUERY:", query);
      {
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );

    const data = await res.json();

    console.log("O*NET RAW RESPONSE:", data);
    
    const careers = (data?.occupation || []).slice(0, 10).map((job) => ({
      title: job.title,
      code: job.code,
      description: job.description,
      score: Math.floor(Math.random() * 40) + 60, // TEMP scoring
    }));

    console.log("O*NET CAREERS:", careers);

return {
  source: "onet",
  careers,
  summary: `Top matches based on current profile and O*NET data.`,
};

  } catch (err) {
    console.error("O*NET fetch failed:", err);

    return {
      source: "onet",
      careers: [],
      summary: "",
    };
  }
}

export function mapOnetCareersToRecommendations(careers = []) {
  return careers.map((career) => ({
    title: career.title || "Unknown",
    score: career.score || 0,
    reasoning: career.description || "",
    matched_keywords: [],
    source: "onet",
  }));
}
