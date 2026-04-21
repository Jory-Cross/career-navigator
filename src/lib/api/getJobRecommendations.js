export async function getJobRecommendations(clientProfile) {
  try {
    const result = await analyzeDocumentContent({
      file_name: "job_recommendation",
      current_category: "assessment",
      client_profile: clientProfile
    });

    const payload =
      result?.data?.data ||
      result?.data ||
      result ||
      [];

    if (Array.isArray(payload)) return payload;

    return [];

  } catch (err) {
    console.error("AI job fetch error:", err);
    return [];
  }
}
