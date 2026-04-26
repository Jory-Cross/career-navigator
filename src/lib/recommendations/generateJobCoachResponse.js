export async function generateJobCoachResponse({
  recommendations = [],
  profile = {},
}) {
  if (!recommendations.length) {
    return "No strong job matches were found based on the available data.";
  }

  const strongMatches = recommendations.slice(0, 5);

  const cautionRoles = recommendations.filter(
    (job) =>
      job.match_reason &&
      job.match_reason.toLowerCase().includes("concern")
  );

  return `
Based on your assessments, here’s a breakdown of job fit:

Strong Matches:
${strongMatches
  .map(
    (job) =>
      `- ${job.title}: ${job.match_reason || "Aligns with your strengths and preferences."}`
  )
  .join("\n")}

${
  cautionRoles.length > 0
    ? `
Roles to Approach with Caution:
${cautionRoles
  .map(
    (job) =>
      `- ${job.title}: may conflict with your assessment data or work preferences.`
  )
  .join("\n")}
`
    : ""
}

Key Insight:
Some roles may appear to match your skills but conflict with your work preferences or support needs. These should be carefully evaluated before pursuing.

Recommended Focus:
Prioritize roles that align with your strengths, independence level, and comfort in the work environment.
`;
}
