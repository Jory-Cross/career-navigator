import { buildJobRecommendations } from "@/lib/buildJobRecommendations";
import {
  getOnetRecommendations,
  mapOnetCareersToRecommendations,
} from "@/lib/adapters/onetAdapter";

export async function getRecommendations({
  resumeText = "",
  wsaText = "",
  assessmentText = "",
  profile = null,
  interests = null,
}) {
  const onetResult = await getOnetRecommendations({
    interests,
    profile,
  });

  if (onetResult?.careers?.length) {
    return {
      source: "onet",
      riasec_summary: "",
      wsa_summary: wsaText ? "WSA content included in recommendation run." : "",
      combined_profile: [resumeText, wsaText, assessmentText].filter(Boolean).join(" "),
      recommendations: mapOnetCareersToRecommendations(onetResult.careers),
      onet_summary: onetResult.summary || "",
    };
  }

  const local = buildJobRecommendations({
    resumeText,
    wsaText,
    assessmentText,
  });

  return {
    source: "local",
    ...local,
    onet_summary: "",
  };
}
