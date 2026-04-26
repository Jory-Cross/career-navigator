function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function joinList(items = []) {
  return toArray(items).filter(Boolean).join(", ");
}

export async function generateJobCoachResponse({
  recommendations = [],
  profile = {},
}) {
  if (!recommendations.length) {
    return "No strong job matches were found based on the available data.";
  }

  const strongMatches = recommendations.filter((job) => job.fit_level !== "caution").slice(0, 5);
  const cautionRoles = recommendations.filter((job) => job.fit_level === "caution");

  const strengths = joinList(profile.wsa_strengths);
  const themes = joinList(profile.vocational_themes);

  return `
Based on the available resume, WSA, and assessment data, here’s the current job-fit guidance:

Strong Matches:
${strongMatches
  .map((job) => {
    const reasons = job.fit_strengths?.length
      ? job.fit_strengths.join("; ")
      : job.match_reason || "Aligns with available skills and preferences.";

    return `- ${job.title}: ${reasons}`;
  })
  .join("\n")}

${
  cautionRoles.length > 0
    ? `
Roles to Approach with Caution:
${cautionRoles
  .map((job) => {
    const concerns = job.fit_concerns?.length
      ? job.fit_concerns.join("; ")
      : "May conflict with work preferences or support needs.";

    return `- ${job.title}: ${concerns}`;
  })
  .join("\n")}
`
    : ""
}

Assessment Themes Noted:
${strengths ? `- Strengths: ${strengths}` : "- Strengths: Not enough structured data yet."}
${themes ? `- Work themes/preferences: ${themes}` : "- Work themes/preferences: Not enough structured data yet."}

Key Insight:
Some roles may match skills on paper but still need review if the work environment, social demands, pace, or support needs do not fit the client.

Recommended Focus:
Prioritize roles with strong skill alignment, predictable expectations, and work environments that match the client’s documented preferences and supports.
`;
}
