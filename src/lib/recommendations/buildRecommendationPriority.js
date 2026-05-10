/**
 * buildRecommendationPriority.js
 *
 * Assigns a priority level (Strong Target, Explore Further, Stretch, Caution, Low Priority)
 * to each recommendation based on:
 * - Evidence strength and richness
 * - Environmental fit level
 * - Support needs burden
 * - Transportation / schedule unknowns
 * - Licensing/training burden
 * - Client interests / goals alignment
 * - Conflict count
 * - Missing data
 *
 * Returns:
 * {
 *   priority_level: "strong_target" | "explore_further" | "stretch" | "caution" | "low_priority",
 *   priority_reason: "...",
 *   priority_factors: ["factor1", "factor2", ...],
 *   staff_action: "Use as job-search target" | "Discuss with client" | ...
 * }
 */

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function matchesAny(text = "", keywords = []) {
  const t = safeLower(text);
  return keywords.some((k) => t.includes(safeLower(k)));
}

// ── PRIORITY SCORING ──────────────────────────────────────────────────────────

/**
 * Analyze a single recommendation and context to assign priority.
 */
export function buildRecommendationPriority(job = {}, context = {}) {
  const grounding = job.grounding || {};
  const constraintFit = job.constraint_fit || {};
  const profile = context.profile || {};
  const matchScore = job.match_score || 0;
  const confidenceLevel = job.confidence_level || "medium";
  const fitConcerns = job.fit_concerns || [];

  // Extract key signals
  const evidenceTier = grounding.evidence_richness?.tier || "weak";
  const groundingFlags = grounding.staff_review_flags || [];
  const envFitLevel = constraintFit.overall_fit_level || "unknown";
  const hardConstraints = constraintFit.hard_constraints || [];
  const moderateConstraints = constraintFit.moderate_constraints || [];
  const unknownFactors = constraintFit.unknowns || [];
  const softPreferences = constraintFit.soft_preferences || [];
  const occupationNotes = constraintFit.occupation_notes || [];
  const occupationLabel = constraintFit.occupation_profile_label || null;

  const supportNeeds = context.supportNeeds || [];
  const transportationUnknowns = context.transportationUnknowns || false;
  const scheduleConstraints = context.scheduleConstraints || [];
  const clientInterests = context.clientInterests || [];
  const clientGoals = context.clientGoals || [];
  const workHistory = context.workHistory || [];
  const interestProfileMatch = context.interestProfileMatch || "weak";
  const licensingBurden = context.licensingBurden || "none"; // none | moderate | high
  const trainingBurden = context.trainingBurden || "none"; // none | moderate | high

  const jobText = safeLower(`${job.title || ""} ${job.description || ""}`);

  // ── POSITIVE SIGNALS ──────────────────────────────────────────────────────

  const positiveSignals = [];
  const negativeSignals = [];
  const concerns = [];

  // 1. Evidence strength
  if (evidenceTier === "strong") {
    positiveSignals.push("Strong evidence base");
  } else if (evidenceTier === "weak") {
    negativeSignals.push("Evidence is general or inferred");
  }

  // 2. Environmental fit
  if (envFitLevel === "strong_fit") {
    positiveSignals.push("Strong environmental fit");
  } else if (envFitLevel === "possible_fit") {
    positiveSignals.push("Possible environmental fit");
  } else if (envFitLevel === "caution") {
    concerns.push("Environmental concerns present");
  } else if (envFitLevel === "poor_fit") {
    negativeSignals.push("Poor environmental fit");
  }

  // 3. Hard constraints (blocker)
  if (hardConstraints.length > 0) {
    negativeSignals.push(`${hardConstraints.length} hard constraint(s)`);
  }

  // 4. Moderate constraints
  if (moderateConstraints.length >= 3) {
    concerns.push("Multiple moderate constraints");
  } else if (moderateConstraints.length >= 1) {
    concerns.push("Moderate constraint(s) present");
  }

  // 5. Confidence level
  if (confidenceLevel === "high") {
    positiveSignals.push("High confidence match");
  } else if (confidenceLevel === "low") {
    negativeSignals.push("Low confidence match");
  }

  // 6. Match score
  if (matchScore >= 75) {
    positiveSignals.push("Excellent match score");
  } else if (matchScore >= 55) {
    positiveSignals.push("Solid match score");
  } else if (matchScore < 40) {
    negativeSignals.push("Low match score");
  }

  // 7. Interest profiler alignment
  if (interestProfileMatch === "strong") {
    positiveSignals.push("Aligns with interests");
  } else if (interestProfileMatch === "weak") {
    negativeSignals.push("Weak interest alignment");
  }

  // 8. Work history relevance
  if (workHistory.length > 0 && matchesAny(jobText, workHistory)) {
    positiveSignals.push("Matches past work experience");
  }

  // 9. Client goals/preferences
  if (clientGoals.length > 0) {
    const goalMatch = clientGoals.some((g) => matchesAny(jobText, [g]));
    if (goalMatch) {
      positiveSignals.push("Aligns with stated goals");
    }
  }

  // 10. Soft preferences
  if (softPreferences.length > 0) {
    positiveSignals.push(`${softPreferences.length} preference alignment(s)`);
  }

  // 11. Support burden
  if (supportNeeds.some((s) => matchesAny(s, ["explicit", "coaching", "required"]))) {
    concerns.push("Requires explicit support");
  }

  // 12. Transportation unknowns
  if (transportationUnknowns) {
    concerns.push("Transportation reliability unknown");
  }

  // 13. Schedule constraints vs job demands
  if (scheduleConstraints.length > 0 && matchesAny(jobText, ["night", "weekend", "rotating"])) {
    concerns.push("Schedule constraints may conflict");
  }

  // 14. Licensing/training burden
  if (licensingBurden === "high") {
    negativeSignals.push("High licensing/training burden");
  } else if (licensingBurden === "moderate") {
    concerns.push("Moderate licensing/training needed");
  }

  // 15. Missing data / unknowns
  if (unknownFactors.length >= 4) {
    concerns.push("Multiple unknowns present");
  } else if (unknownFactors.length >= 2) {
    concerns.push("Some unknowns present");
  }

  // 16. Occupational context
  if (occupationLabel || occupationNotes.length > 0) {
    positiveSignals.push("Occupational context available");
  }

  // 17. Staff review flags
  if (groundingFlags.length > 2) {
    concerns.push("Multiple staff review items");
  }

  // ── PRIORITY ASSIGNMENT ────────────────────────────────────────────────────

  const priorityFactors = [
    ...positiveSignals,
    ...concerns,
    ...negativeSignals,
  ].filter(Boolean);

  let priority = "low_priority";
  let reason = "";
  let staffAction = "Do not prioritize right now";

  // HARD STOP: hard constraints → poor fit or caution
  if (hardConstraints.length > 0) {
    priority = "caution";
    reason = "Hard constraint(s) present — requires verification before proceeding.";
    staffAction = "Verify fit concerns before presenting";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // STRONG TARGET
  // - Strong/moderate evidence
  // - Strong fit OR possible fit with no hard concerns
  // - High/medium confidence
  // - Match score >= 55
  // - No (or very few) moderate constraints
  // - Aligns with interests/goals
  if (
    (evidenceTier === "strong" || evidenceTier === "moderate") &&
    (envFitLevel === "strong_fit" || (envFitLevel === "possible_fit" && moderateConstraints.length <= 1)) &&
    (confidenceLevel === "high" || confidenceLevel === "medium") &&
    matchScore >= 55 &&
    !negativeSignals.includes("Hard constraint(s)") &&
    (interestProfileMatch === "strong" || clientGoals.length > 0)
  ) {
    priority = "strong_target";
    reason = `Strong candidate for job search. ${positiveSignals.slice(0, 2).join(", ")}.`;
    staffAction = "Use as job-search target";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // EXPLORE FURTHER
  // - Reasonable evidence (moderate)
  // - Possible fit with some concerns
  // - Medium confidence
  // - Match score 40–55
  // - Requires clarification on specific unknowns
  if (
    (evidenceTier === "moderate" || (evidenceTier === "strong" && matchScore >= 50)) &&
    (envFitLevel === "possible_fit" || envFitLevel === "unknown") &&
    confidenceLevel === "medium" &&
    matchScore >= 40 &&
    concerns.length <= 2 &&
    hardConstraints.length === 0
  ) {
    priority = "explore_further";
    reason = `Potentially useful option. Needs clarification on: ${concerns.slice(0, 2).join(", ")}.`;
    staffAction = "Discuss with client";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // STRETCH / DEVELOPMENTAL
  // - Aligns with interests but requires training/licensing
  // - Some evidence, possible fit
  // - Would benefit from support/development
  // - Not immediate placement candidate
  if (
    (licensingBurden === "moderate" || licensingBurden === "high" || trainingBurden === "moderate" || trainingBurden === "high") &&
    (interestProfileMatch === "strong" || clientGoals.some((g) => matchesAny(jobText, [g]))) &&
    envFitLevel !== "poor_fit" &&
    hardConstraints.length === 0
  ) {
    priority = "stretch";
    reason = `Aligns with interests but requires ${licensingBurden === "high" ? "significant" : "moderate"} training/licensing. Consider as longer-term development.`;
    staffAction = "Research training/licensing requirements";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // CAUTION / VERIFY FIRST
  // - Poor fit or caution level
  // - Significant unknowns
  // - Multiple moderate constraints
  // - Transportation/schedule unknowns with demanding job
  // - But not completely ruled out
  if (
    (envFitLevel === "caution" || envFitLevel === "poor_fit") ||
    (moderateConstraints.length >= 2 && confidenceLevel === "low") ||
    (unknownFactors.length >= 3 && moderateConstraints.length >= 1) ||
    (transportationUnknowns && matchesAny(jobText, ["travel", "commute", "multiple sites"]))
  ) {
    priority = "caution";
    reason = `Has fit concerns or unknowns. ${concerns.slice(0, 2).join(", ")}.`;
    staffAction = "Verify concerns before presenting";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // LOW PRIORITY (default)
  priority = "low_priority";
  reason = `Weak evidence, poor fit, or significant mismatch.`;
  staffAction = "Do not prioritize right now";
  return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
}

/**
 * Gather context signals from profile, VFP, and assessment data.
 */
export function extractPriorityContext(job = {}, context = {}) {
  const vfp = context.vfp || context.vocationalProfile || {};
  const wsa = context.wsa || {};
  const profile = context.profile || {};
  const interestProfile = context.interestProfile || {};
  const resumes = context.resumes || [];

  // Support needs
  const supportNeeds = [
    ...(vfp.support_needs || []),
    ...(vfp.accommodation_needs || []),
    ...(wsa.support_needs || []),
  ];

  // Transportation unknowns
  const transportReliability = vfp.transportation_reliability || [];
  const transportLimitations = vfp.transportation_limitations || [];
  const hasTransportData = transportReliability.length > 0 || transportLimitations.length > 0;
  const transportationUnknowns = !hasTransportData;

  // Schedule constraints
  const scheduleConstraints = [
    ...(vfp.schedule_constraints || []),
    ...(wsa.schedule_constraints || []),
  ];

  // Client interests/goals
  const clientInterests = [
    ...(vfp.interests || []),
    ...(vfp.career_interests || []),
    ...(wsa.themes || []),
    ...Object.keys(interestProfile || {}),
  ].filter(Boolean);

  const clientGoals = [
    ...(vfp.preferred_job_titles || []),
    ...(vfp.preferred_industries || []),
  ].filter(Boolean);

  // Work history
  const workHistory = (resumes || [])
    .flatMap((r) => (r.job_titles || []).concat(r.work_history?.map((w) => w.title) || []))
    .filter(Boolean);

  // Interest profiler match (RIASEC alignment)
  const hasRiasec = Object.keys(interestProfile || {}).length > 0;
  const interestProfileMatch = hasRiasec ? "strong" : "weak";

  // Licensing burden (heuristic from job title)
  const jobTitle = String(job.title || "").toLowerCase();
  const licensingKeywords = [
    "nurse", "therapist", "counselor", "psychologist", "dentist", "lawyer",
    "accountant", "electrician", "plumber", "real estate", "insurance",
    "architect", "veterinarian", "pilot", "cdl", "driver",
  ];
  const licensingBurden = licensingKeywords.some((k) => jobTitle.includes(k))
    ? "moderate"
    : "none";

  // Training burden (heuristic)
  const trainingKeywords = [
    "manager", "supervisor", "lead", "senior", "specialist", "technician",
    "engineer", "analyst", "developer", "designer",
  ];
  const trainingBurden = trainingKeywords.some((k) => jobTitle.includes(k))
    ? "moderate"
    : "none";

  return {
    supportNeeds,
    transportationUnknowns,
    scheduleConstraints,
    clientInterests,
    clientGoals,
    workHistory,
    interestProfileMatch,
    licensingBurden,
    trainingBurden,
  };
}

export default buildRecommendationPriority;