function hasConflict(job, profile = {}) {
  const text = [
    ...(profile.wsa_strengths || []),
    ...(profile.vocational_themes || []),
  ].join(" ").toLowerCase();

  if (
    job.title.toLowerCase().includes("customer") &&
    (text.includes("overwhelm") ||
      text.includes("overstimulated") ||
      text.includes("work alone"))
  ) {
    return true;
  }

  return false;
}

export async function generateJobCoachResponse({
  resumeText = "",
  wsaText = "",
  riasecScores = {},
  recommendations = [],
  profile = {},
}) {
  const strongFits = [];
  const cautionFits = [];

  recommendations.forEach((job) => {
    if (hasConflict(job, profile)) {
      cautionFits.push(job);
    } else {
      strongFits.push(job);
    }
  });

  return `
Based on your assessments, here’s a breakdown of job fit:

Strong Matches:
${strongFits
  .map(
    (job) =>
      `- ${job.title}: aligns with your strengths and preferred work style.`
  )
  .join("\n")}

${
  cautionFits.length > 0
    ? `
Roles to Approach with Caution:
${cautionFits
  .map(
    (job) =>
      `- ${job.title}: may conflict with your assessment data (for example, social demands or overstimulation).`
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
