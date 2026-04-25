function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function detectConcerns(wsaText = "") {
  const text = safeLower(wsaText);

  return {
    lowSocialTolerance:
      text.includes("overwhelmed") ||
      text.includes("anxiety") ||
      text.includes("prefers to work alone"),

    needsStructure:
      text.includes("routine") ||
      text.includes("structure") ||
      text.includes("predictable"),

    physicalLimitations:
      text.includes("knee") ||
      text.includes("pain") ||
      text.includes("fatigue"),

    sensorySensitivity:
      text.includes("overstimulated") ||
      text.includes("noise") ||
      text.includes("crowded"),
  };
}

function evaluateJobFit(job, concerns) {
  const title = safeLower(job.title);

  // HIGH SOCIAL JOBS
  if (title.includes("customer") || title.includes("cashier")) {
    if (concerns.lowSocialTolerance || concerns.sensorySensitivity) {
      return {
        type: "caution",
        reason:
          "This role requires constant social interaction and may lead to overstimulation based on assessment results.",
      };
    }
  }

  // INDEPENDENT JOBS
  if (
    title.includes("janitorial") ||
    title.includes("custodial") ||
    title.includes("warehouse")
  ) {
    return {
      type: "good",
      reason:
        "This role aligns well with preferences for independent work, routine, and lower social demand.",
    };
  }

  return {
    type: "neutral",
    reason: "This role may be a possible fit depending on environment and supports.",
  };
}

export async function generateJobCoachResponse({
  resumeText = "",
  wsaText = "",
  riasecScores = {},
  recommendations = [],
}) {
  const concerns = detectConcerns(wsaText);

  const goodFits = [];
  const cautions = [];

  recommendations.forEach((job) => {
    const result = evaluateJobFit(job, concerns);

    if (result.type === "good") {
      goodFits.push(`- ${job.title}: ${result.reason}`);
    } else if (result.type === "caution") {
      cautions.push(`- ${job.title}: ${result.reason}`);
    }
  });

  return `
Here are job fields that appear to be a strong fit based on your assessments:

${goodFits.length > 0 ? goodFits.join("\n") : "- No strong matches identified yet."}

${
  cautions.length > 0
    ? `
Areas to approach with caution:

${cautions.join("\n")}
`
    : ""
}

Key considerations based on your assessments:
- Roles with lower social demand may be a better fit
- Structured and predictable environments are recommended
- Managing overstimulation should be a priority when choosing work environments

Next step:
Focus your job search on roles that match your strengths and reduce known stressors.
`;
}
