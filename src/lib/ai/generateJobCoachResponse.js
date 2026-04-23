export async function generateJobCoachResponse({
  resumeText = "",
  wsaText = "",
  riasecScores = {},
  recommendations = [],
}) {
  return `
Based on your assessments, here are recommended job fields:

${recommendations
  .map((job) => `- ${job.title}: ${job.reasoning}`)
  .join("\n")}

This recommendation is based on your RIASEC profile and assessment data.
`;
}
