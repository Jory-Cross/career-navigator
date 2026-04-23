// O*NET Adapter (Phase 1 — placeholder structure)

export async function getOnetRecommendations({
  interests = null,        // future: RIASEC from O*NET
  profile = null,          // future: unified client profile
}) {
  // TEMP: return empty structure
  // This keeps UI working while we wire real O*NET later

  return {
    source: "onet",
    careers: [],
    summary: "",
  };
}

/**
 * Normalize O*NET careers into your app format
 */
export function mapOnetCareersToRecommendations(careers = []) {
  return careers.map((career) => ({
    title: career.title || "Unknown",
    score: career.score || 0,
    reasoning: career.description || "",
    matched_keywords: career.skills || [],
    source: "onet",
  }));
}
