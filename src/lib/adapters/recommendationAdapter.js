import { buildJobRecommendations } from "@/lib/buildJobRecommendations";

export async function getRecommendations({
  resumeText,
  wsaText,
  assessmentText,
  riasecScores,
}) {
  // TEMP: use local engine
  const local = buildJobRecommendations({
    resumeText,
    wsaText,
    assessmentText,
    riasecScores,
  });

  return {
    source: "local",
    ...local,
  };
}
