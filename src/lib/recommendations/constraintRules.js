function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function includesAny(text, keywords = []) {
  const lower = safeLower(text);
  return keywords.some((keyword) => lower.includes(safeLower(keyword)));
}

export const WORK_ENVIRONMENT_TAGS = {
  LOW_SOCIAL: "low_social_demand",
  LOW_STIMULATION: "low_stimulation",
  INDEPENDENT_WORK: "independent_work",
  STRUCTURED_ROUTINE: "structured_routine",
  LIMITED_CUSTOMER_CONTACT: "limited_customer_contact",
  HANDS_ON: "hands_on_work",
  SITTING_ALLOWED: "sitting_allowed",
  CLEAR_TASKS: "clear_tasks",
};

export function buildClientConstraints(profile = {}) {
  const wsa = profile.wsa || {};
  const responses = wsa.responses || {};

  const rawText = [
    wsa.notes,
    wsa.summary,
    ...toArray(wsa.strengths),
    ...toArray(wsa.themes),
    ...toArray(wsa.preferences),
    ...toArray(wsa.environment_needs),
    ...toArray(wsa.barriers),
    ...toArray(wsa.schedule_constraints),
    ...toArray(wsa.transportation),
    ...toArray(responses.strengths),
    ...toArray(responses.work_strengths),
    ...toArray(responses.best_work_tasks),
    ...toArray(responses.themes),
    ...toArray(responses.work_preferences),
    ...toArray(responses.preferred_tasks),
    ...toArray(responses.barriers),
    ...toArray(responses.concerns),
    ...toArray(profile.assessment_notes),
  ].join(" ");

  const constraints = [];
  const preferredEnvironments = [];

  if (
    includesAny(rawText, [
      "low social",
      "social anxiety",
      "difficulty with people",
      "limited social",
      "does not like crowds",
           "avoid customers",
      "avoid customer",
      "limited customer contact",
      "minimal customer contact",
      "no customer service",
      "customer service is difficult",
      "prefers independent work",
      "independent work",
    ])
  ) {
    constraints.push({
      code: "LOW_SOCIAL_TOLERANCE",
      label: "Low social tolerance",
      severity: "moderate",
      concern:
        "This client may struggle in roles with frequent customer interaction or constant teamwork.",
      avoidKeywords: ["cashier", "customer service", "sales", "front desk", "reception"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.LIMITED_CUSTOMER_CONTACT,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.LIMITED_CUSTOMER_CONTACT);
    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.INDEPENDENT_WORK);
  }

  if (
    includesAny(rawText, [
      "overstimulated",
      "noise",
      "loud",
      "crowded",
      "sensory",
      "too busy",
      "high stimulation",
    ])
  ) {
    constraints.push({
      code: "LOW_STIMULATION_NEEDED",
      label: "Low stimulation environment needed",
      severity: "moderate",
      concern:
        "This client may perform better in calm, predictable environments with limited noise and crowding.",
      avoidKeywords: ["restaurant", "retail", "fast paced", "warehouse rush", "cashier"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.LOW_STIMULATION,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.LOW_STIMULATION);
    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE);
  }

  if (
    includesAny(rawText, [
      "needs routine",
      "structured",
      "predictable",
      "clear instructions",
      "step by step",
      "repetition",
    ])
  ) {
    constraints.push({
      code: "STRUCTURE_NEEDED",
      label: "Needs structure and routine",
      severity: "moderate",
      concern:
        "This client may need clearly defined tasks, predictable expectations, and consistent routines.",
      avoidKeywords: ["multi-task", "unpredictable", "fast paced", "manager", "supervisor"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE);
    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.CLEAR_TASKS);
  }

  if (
    includesAny(rawText, [
      "standing",
      "mobility",
      "pain",
      "fatigue",
      "cannot stand",
      "limited lifting",
      "physical limitation",
    ])
  ) {
    constraints.push({
      code: "PHYSICAL_LIMITATION",
      label: "Physical limitation",
      severity: "moderate",
      concern:
        "This client may need work that limits prolonged standing, heavy lifting, or physically demanding tasks.",
      avoidKeywords: ["laborer", "construction", "stocking", "warehouse", "dishwasher"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.SITTING_ALLOWED,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.SITTING_ALLOWED);
  }

  if (
    includesAny(rawText, [
      "transportation",
      "no transportation",
      "limited transportation",
      "paratransit",
      "bus",
      "public transportation",
      "cannot drive",
      "does not drive",
      "needs ride",
      "ride support",
    ])
  ) {
    constraints.push({
      code: "TRANSPORTATION_LIMITATION",
      label: "Transportation limitation",
      severity: "moderate",
      concern:
        "This client may need jobs with reliable transportation access, predictable commute expectations, or support getting to and from work.",
      avoidKeywords: ["remote location", "multiple sites", "travel required", "delivery", "driver"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE);
  }

  if (
    includesAny(rawText, [
      "schedule",
      "routine",
      "consistent schedule",
      "predictable schedule",
      "flexible schedule",
      "morning",
      "afternoon",
      "evening",
      "late start",
      "cannot work nights",
      "cannot work weekends",
      "school schedule",
      "appointment schedule",
    ])
  ) {
    constraints.push({
      code: "SCHEDULE_CONSTRAINT",
      label: "Schedule constraint",
      severity: "moderate",
      concern:
        "This client may need jobs with predictable scheduling, consistent hours, or scheduling flexibility.",
      avoidKeywords: ["rotating schedule", "on call", "night shift", "weekends required", "variable schedule"],
      recommendEnvironment: WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE,
    });

    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.STRUCTURED_ROUTINE);
    preferredEnvironments.push(WORK_ENVIRONMENT_TAGS.CLEAR_TASKS);
  }
  
  return {
    constraints,
    preferredEnvironments: Array.from(new Set(preferredEnvironments)),
  };
}

export function applyConstraintRules(job = {}, constraints = []) {
  const title = safeLower(job.title);
  const description = safeLower(job.description || job.match_reason || "");
  const combined = `${title} ${description}`;
  const titleOnly = title;

  const fitConcerns = [];
  const notFitReasons = [];
  const environmentRecommendations = [];

  constraints.forEach((constraint) => {
    const matchesAvoid =
      includesAny(combined, constraint.avoidKeywords) ||
      includesAny(titleOnly, constraint.avoidKeywords) ||
      constraint.avoidKeywords.some((kw) =>
        combined.includes(kw) || titleOnly.includes(kw)
      );

    if (matchesAvoid) {
      fitConcerns.push(constraint.concern);

      notFitReasons.push(
        `${job.title || "This role"} may not be a good fit: ${constraint.concern}`
      );
    } else {
      notFitReasons.push(
        `${job.title || "This role"} may present challenges: ${constraint.concern}`
      );
    }

    if (constraint.recommendEnvironment) {
      environmentRecommendations.push(constraint.recommendEnvironment);
    }
  });

  return {
    fit_concerns: Array.from(new Set(fitConcerns)),
    not_fit_reasons: Array.from(new Set(notFitReasons)),
    recommended_environments: Array.from(new Set(environmentRecommendations)),
  };
}
export function resolveFitLevel({ score = 0, fitConcerns = [] }) {
  if (fitConcerns.length >= 2) return "caution";
  if (fitConcerns.length === 1 && score < 70) return "caution";
  if (score >= 80 && fitConcerns.length === 0) return "strong";
  if (score >= 60) return "moderate";
  return "weak";
}
