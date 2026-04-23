export async function generateJobCoachResponse({
  resumeText = "",
  wsaText = "",
  riasecScores = {},
  recommendations = [],
}) {
  try {
    const response = await fetch("/api/job-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resumeText,
        wsaText,
        riasecScores,
        recommendations,
      }),
    });

    const data = await response.json();

    return data?.text || "No AI response generated.";
  } catch (error) {
    console.error("AI Job Coach error:", error);
    return "Failed to generate AI job coach summary.";
  }
}
