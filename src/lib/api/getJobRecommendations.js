export async function getJobRecommendations(clientProfile) {
  try {
    const response = await fetch("/api/get-job-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientProfile }),
    });

    const data = await response.json();

    return data || [];
  } catch (err) {
    console.error("AI job fetch error:", err);
    return [];
  }
}
