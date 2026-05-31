/**
 * buildRecommendationPriority.js
 *
 * Assigns a priority level to each recommendation based on a weighted evidence
 * model that combines:
 *   - Environmental/constraint fit severity (hard blockers, moderate conflicts)
 *   - Barriers-to-employment evidence (sensory, physical, social, emotional)
 *   - Evidence richness and corroboration across sources
 *   - Match score (post-penalty, after constraint scoring)
 *   - Confidence level
 *   - Interest/goal alignment — weighted but NOT dominant
 *   - Transportation, schedule, support burden
 *   - Licensing/training overhead
 *
 * Priority Levels (ordered):
 *   strong_target → explore_further → stretch → caution → low_priority
 *
 * KEY DESIGN PRINCIPLES:
 *   - Environmental conflicts REDUCE priority, even for high O*NET interest matches
 *   - Strong corroborated evidence RAISES priority
 *   - Stretch careers remain visible but appear lower
 *   - Jobs with severe conflicts surface as "Caution / Verify First"
 *   - Interest Profiler alone is NOT enough for "Strong Target"
 */

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function matchesAny(text = "", keywords = []) {
  const t = safeLower(text);
  return keywords.some((k) => t.includes(safeLower(k)));
}

// ── CONFLICT SIGNAL EXTRACTION ─────────────────────────────────────────────

/**
 * Detect barriers-driven environmental conflicts from grounding + constraint_fit.
 * Returns a severity score: 0 = none, 1-2 = mild, 3-4 = moderate, 5+ = severe
 */
function computeEnvironmentalConflictScore(job = {}, context = {}) {
  const grounding = job.grounding || {};
  const constraintFit = job.constraint_fit || {};
  const barriers = context.barriers || {};
  const wsa = context.wsa || {};

  const jobText = safeLower(`${job.title || ""} ${job.description || ""} ${job.match_reason || ""}`);
  const insights = [
    ...(wsa?.insights || []),
    ...(barriers?.insights || []),
  ];

  let conflictScore = 0;
  const conflictReasons = [];

  // ── Hard constraints from constraint_fit layer ─────────────────────────
  const hardConstraints = constraintFit.hard_constraints || [];
  if (hardConstraints.length >= 2) {
    conflictScore += 5;
    conflictReasons.push("Multiple hard constraints");
  } else if (hardConstraints.length === 1) {
    conflictScore += 3;
    conflictReasons.push("Hard constraint present");
  }

  // ── Moderate constraints ───────────────────────────────────────────────
  const moderateConstraints = constraintFit.moderate_constraints || [];
  if (moderateConstraints.length >= 3) {
    conflictScore += 3;
    conflictReasons.push("3+ moderate constraints");
  } else if (moderateConstraints.length >= 2) {
    conflictScore += 2;
    conflictReasons.push("Multiple moderate constraints");
  } else if (moderateConstraints.length === 1) {
    conflictScore += 1;
    conflictReasons.push("Moderate constraint present");
  }

  // ── Environment fit level from constraint_fit ──────────────────────────
  const envFitLevel = constraintFit.overall_fit_level || "unknown";
  if (envFitLevel === "poor_fit") {
    conflictScore += 4;
    conflictReasons.push("Poor environmental fit");
  } else if (envFitLevel === "caution") {
    conflictScore += 2;
    conflictReasons.push("Environmental caution flagged");
  }

  // ── Insight-based environment conflicts ────────────────────────────────
  // High-chaos / overstimulating environments
  const isHighStimulation = matchesAny(jobText, [
    "fast-paced", "high volume", "deadline", "pressure", "urgent", "unpredictable",
    "loud", "noisy", "crowded", "busy", "chaotic", "multi-tasking", "multitasking",
  ]);
  const isPublicFacing = matchesAny(jobText, [
    "customer", "client-facing", "public", "audience", "performance", "client relations",
    "sales calls", "cold call", "networking events",
  ]);
  const isPhysicallyDemanding = matchesAny(jobText, [
    "standing", "lifting", "physical", "labor", "warehouse", "construction", "manual",
    "outdoor", "field work", "active", "strenuous",
  ]);
  const isSociallyIntense = matchesAny(jobText, [
    "team-oriented", "highly collaborative", "constant communication", "public speaking",
    "large groups", "networking", "social media", "actor", "performer", "entertainer",
  ]);
  const isHighStress = matchesAny(jobText, [
    "high stress", "on-call", "emergency", "acute care", "trauma", "intensive care",
    "ICU", "ER", "first responder", "crisis",
  ]);

  if (insights.includes("requires sensory-controlled environment") && isHighStimulation) {
    conflictScore += 3;
    conflictReasons.push("Sensory needs conflict with stimulating environment");
  }

  if (insights.includes("avoid customer-facing roles") && isPublicFacing) {
    conflictScore += 3;
    conflictReasons.push("Public-facing role conflicts with social limitations");
  }

  if (insights.includes("seated work required") && isPhysicallyDemanding) {
    conflictScore += 3;
    conflictReasons.push("Physical demands conflict with seated work requirement");
  }

  if (insights.includes("limited tolerance for prolonged standing or physical work") && isPhysicallyDemanding) {
    conflictScore += 2;
    conflictReasons.push("Physical work conflicts with stamina limitations");
  }

  if (insights.includes("needs low-stress, low-pressure work") && isHighStress) {
    conflictScore += 3;
    conflictReasons.push("High-stress role conflicts with low-stress needs");
  }

  if (
    (insights.includes("needs low-stress, low-pressure work") || insights.includes("needs structured and predictable work")) &&
    isPublicFacing && isSociallyIntense
  ) {
    conflictScore += 2;
    conflictReasons.push("Socially intense role conflicts with support needs");
  }

  // ── Title-level red flags (job title alone indicates severe mismatch) ──
  const jobTitle = safeLower(job.title || "");
  const titleRedFlags = [
    "actor", "actress", "performer", "entertainer", "model",
    "advertising sales", "insurance sales", "real estate agent",
    "acute care nurse", "emergency", "trauma nurse", "icu nurse",
    "call center", "telemarketer",
    "flight attendant", "tour guide",
  ];
  if (titleRedFlags.some((f) => jobTitle.includes(f))) {
    conflictScore += 2;
    conflictReasons.push(`Title "${job.title}" carries high environmental conflict risk`);
  }

  return { conflictScore, conflictReasons };
}

// ── EVIDENCE CORROBORATION SCORE ───────────────────────────────────────────

/**
 * How many independent evidence sources support this job?
 * Returns a number 0–5 representing breadth of corroboration.
 */
function computeEvidenceCorroboration(job = {}, context = {}) {
  const grounding = job.grounding || {};
  const vfp = context.vfp || context.vocationalProfile || {};
  const wsa = context.wsa || {};
  const barriers = context.barriers || {};
  const resumes = context.resumes || [];
  const interestProfile = context.interestProfile || {};

  let score = 0;

  // Evidence tier from grounding
  const evidenceTier = grounding.evidence_richness?.tier || "weak";
  if (evidenceTier === "strong") score += 2;
  else if (evidenceTier === "moderate") score += 1;

  // VFP has job titles / preferences
  const vfpTitles = vfp.preferred_job_titles || vfp.job_titles || [];
  const vfpPrefs = vfp.preferred_industries || vfp.preferences || [];
  if (vfpTitles.length > 0 || vfpPrefs.length > 0) score += 1;

  // Resume / work history corroboration
  const hasResume = resumes.some((r) => (r.job_titles || []).length > 0 || (r.skills || []).length > 0);
  if (hasResume) score += 1;

  // WSA corroboration
  const hasWSA = (wsa?.strengths || []).length > 0 || (wsa?.themes || []).length > 0;
  if (hasWSA) score += 1;

  // Barriers corroboration (adds functional evidence richness)
  const hasBarriers = (barriers?.insights || []).length > 0;
  if (hasBarriers) score += 1;

  // Interest profiler (RIASEC) — present, but should not override conflicts
  const hasRiasec = Object.keys(interestProfile || {}).length > 0;
  if (hasRiasec) score += 1;

  return Math.min(score, 6); // cap at 6
}

// ── PRIORITY SCORING ──────────────────────────────────────────────────────────

/**
 * Analyze a single recommendation and context to assign priority.
 */
export function buildRecommendationPriority(job = {}, context = {}) {
  const grounding = job.grounding || {};
  const constraintFit = job.constraint_fit || {};

  const matchScore = job.match_score || 0;
  const confidenceLevel = job.confidence_level || "medium";
  const fitConcerns = job.fit_concerns || [];

  // Extract key signals
  const evidenceTier = grounding.evidence_richness?.tier || "weak";
  const envFitLevel = constraintFit.overall_fit_level || "unknown";
  const hardConstraints = constraintFit.hard_constraints || [];
  const moderateConstraints = constraintFit.moderate_constraints || [];
  const unknownFactors = constraintFit.unknowns || [];
  const softPreferences = constraintFit.soft_preferences || [];
  const groundingFlags = grounding.staff_review_flags || [];

  const supportNeeds = context.supportNeeds || [];
  const transportationUnknowns = context.transportationUnknowns || false;
  const scheduleConstraints = context.scheduleConstraints || [];
  const clientGoals = context.clientGoals || [];
   const workHistory = context.workHistory || [];
  const licensingBurden = context.licensingBurden || "none";
  const trainingBurden = context.trainingBurden || "none";

  // O*NET Job Zone / preparation-level safeguard.
  // A higher Job Zone may only be treated as a near-term target when verified
  // preparation evidence is deliberately supplied by FACTS/VFP logic.
  const parsedJobZone = Number(job.job_zone);
  const jobZone = Number.isFinite(parsedJobZone) ? parsedJobZone : null;
  const jobZoneTitle = job.job_zone_title || (jobZone ? `Job Zone ${jobZone}` : "");

  const hasVerifiedPreparationSupport =
    context.hasVerifiedPreparationSupport === true;

  const jobText = safeLower(`${job.title || ""} ${job.description || ""}`);

  // ── COMPUTE COMPOSITE SIGNALS ────────────────────────────────────────────

  // Environmental conflict severity (0 = none → 5+ = severe)
  const { conflictScore, conflictReasons } = computeEnvironmentalConflictScore(job, context);

  // Evidence corroboration breadth (0–6)
  const corroborationScore = computeEvidenceCorroboration(job, context);

  // Interest profile alignment — present but NOT dominant
  // Only "strong" if RIASEC AND additional corroboration (not RIASEC alone)
  const hasRiasec = Object.keys(context.interestProfile || {}).length > 0;
  const interestProfileMatch = hasRiasec && corroborationScore >= 3 ? "strong"
    : hasRiasec ? "moderate"
    : "weak";

  // Work history match
  const workHistoryMatch = workHistory.length > 0 && matchesAny(jobText, workHistory);

  // Goal alignment
  const goalMatch = clientGoals.some((g) => matchesAny(jobText, [g]));

  // Support burden
  const hasHighSupportBurden = supportNeeds.some((s) =>
    matchesAny(s, ["explicit", "coaching", "required", "intensive", "constant"])
  );

  // ── BUILD SIGNAL LISTS ────────────────────────────────────────────────────
  const positiveSignals = [];
  const negativeSignals = [];
  const concerns = [];

  // Evidence strength
  if (evidenceTier === "strong") positiveSignals.push("Strong evidence base");
  else if (evidenceTier === "moderate") positiveSignals.push("Moderate evidence base");
  else negativeSignals.push("Evidence is general or inferred");

  // Environmental fit
  if (envFitLevel === "strong_fit") positiveSignals.push("Strong environmental fit");
  else if (envFitLevel === "possible_fit") positiveSignals.push("Possible environmental fit");
  else if (envFitLevel === "caution") concerns.push("Environmental concerns present");
  else if (envFitLevel === "poor_fit") negativeSignals.push("Poor environmental fit");

  // Conflict severity
  if (conflictScore >= 5) negativeSignals.push("Severe environmental/functional conflicts");
  else if (conflictScore >= 3) concerns.push("Moderate environmental conflicts");
  else if (conflictScore >= 1) concerns.push("Minor environmental conflicts");

  // Hard constraints
  if (hardConstraints.length > 0) negativeSignals.push(`${hardConstraints.length} hard constraint(s)`);

  // Moderate constraints
  if (moderateConstraints.length >= 3) concerns.push("Multiple moderate constraints");
  else if (moderateConstraints.length >= 1) concerns.push("Moderate constraint(s) present");

  // Confidence
  if (confidenceLevel === "high") positiveSignals.push("High confidence match");
  else if (confidenceLevel === "low") negativeSignals.push("Low confidence match");

  // Match score
  if (matchScore >= 75) positiveSignals.push("Excellent match score");
  else if (matchScore >= 55) positiveSignals.push("Solid match score");
  else if (matchScore < 35) negativeSignals.push("Low match score");

  // Corroboration
  if (corroborationScore >= 4) positiveSignals.push("Well-corroborated across sources");
  else if (corroborationScore >= 2) positiveSignals.push("Corroborated by multiple sources");

  // Interest alignment
  if (interestProfileMatch === "strong") positiveSignals.push("Aligns with interests (corroborated)");
  else if (interestProfileMatch === "moderate") concerns.push("Interest match present but not corroborated");

  // Work history
  if (workHistoryMatch) positiveSignals.push("Matches past work experience");

  // Goals
  if (goalMatch) positiveSignals.push("Aligns with stated goals");

  // Soft preferences
  if (softPreferences.length > 0) positiveSignals.push(`${softPreferences.length} preference alignment(s)`);

  // Support burden
  if (hasHighSupportBurden) concerns.push("Requires explicit/intensive support");

  // Transportation
  if (transportationUnknowns) concerns.push("Transportation reliability unknown");

  // Schedule
  if (scheduleConstraints.length > 0 && matchesAny(jobText, ["night", "weekend", "rotating", "shift"])) {
    concerns.push("Schedule constraints may conflict");
  }

    // Licensing/training
  if (licensingBurden === "high") negativeSignals.push("High licensing/training burden");
  else if (licensingBurden === "moderate") concerns.push("Moderate licensing required");

  // O*NET Job Zone / preparation-level burden
  if (jobZone >= 4 && !hasVerifiedPreparationSupport) {
    negativeSignals.push(
      `${jobZoneTitle || `Job Zone ${jobZone}`} requires substantial preparation not verified in the client profile`
    );
  } else if (jobZone === 3 && !hasVerifiedPreparationSupport) {
    concerns.push(
      `${jobZoneTitle || "Job Zone 3"} requires preparation that should be verified before prioritizing`
    );
  }

  // Unknown factors
  if (unknownFactors.length >= 4) concerns.push("Multiple unknowns present");
  else if (unknownFactors.length >= 2) concerns.push("Some unknowns present");

  // Staff flags
  if (groundingFlags.length > 2) concerns.push("Multiple staff review items");

  // ── PRIORITY ASSIGNMENT ────────────────────────────────────────────────────

  const priorityFactors = [
    ...positiveSignals,
    ...concerns,
    ...negativeSignals,
    ...conflictReasons,
  ].filter(Boolean);

  let priority = "low_priority";
  let reason = "";
  let staffAction = "Do not prioritize right now";

   // ── HIGH-PREPARATION JOB ZONE SAFEGUARD ────────────────────────────────
  // Job Zone 4–5 occupations require substantial preparation. Unless verified
  // client evidence supports that level, they cannot be near-term targets.
  if (jobZone >= 4 && !hasVerifiedPreparationSupport) {
    const zoneLabel = jobZoneTitle || `Job Zone ${jobZone}`;

    if (
      conflictScore >= 3 ||
      hardConstraints.length > 0 ||
      envFitLevel === "poor_fit" ||
      envFitLevel === "caution"
    ) {
      priority = "low_priority";
      reason = `${zoneLabel} requires substantial preparation not verified in the client profile, and fit concerns are also present.`;
      staffAction = "Do not prioritize as a near-term target";
      return {
        priority_level: priority,
        priority_reason: reason,
        priority_factors: priorityFactors,
        staff_action: staffAction,
      };
    }

    priority = "stretch";
    reason = `${zoneLabel} requires substantial preparation not verified in the client profile. Keep as a longer-term exploration option only.`;
    staffAction = "Explore only as a long-term developmental goal";
    return {
      priority_level: priority,
      priority_reason: reason,
      priority_factors: priorityFactors,
      staff_action: staffAction,
    };
  }

  // ── CAUTION: severe conflicts override remaining options ───────────────
  // Severe conflict (5+) → caution, regardless of interest match
  if (conflictScore >= 5 || hardConstraints.length >= 2) {
    priority = "caution";
    reason = `Significant functional or environmental conflicts detected. ${conflictReasons.slice(0, 2).join("; ")}.`;
    staffAction = "Verify fit concerns before presenting to client";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── LOW PRIORITY: poor environmental fit ──────────────────────────────
  if (envFitLevel === "poor_fit" && conflictScore >= 3) {
    priority = "low_priority";
    reason = `Poor environmental fit combined with functional conflicts. ${conflictReasons[0] || ""}`;
    staffAction = "Do not prioritize; keep as exploratory only";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── SINGLE HARD CONSTRAINT → caution ─────────────────────────────────
  if (hardConstraints.length === 1) {
    priority = "caution";
    reason = "Hard constraint present — requires verification before proceeding.";
    staffAction = "Verify hard constraint before presenting";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── STRONG TARGET ─────────────────────────────────────────────────────
  // Requirements:
  //   - Moderate+ evidence tier
  //   - Strong/possible environmental fit
  //   - No severe conflicts (conflictScore < 3)
  //   - High/medium confidence
  //   - Match score >= 55
  //   - Strong corroboration (>= 3 sources)
  //   - At least one meaningful positive signal beyond interest profiler
  const hasPositiveCorroboration = workHistoryMatch || goalMatch || evidenceTier === "strong";
  if (
    (evidenceTier === "strong" || evidenceTier === "moderate") &&
    (envFitLevel === "strong_fit" || (envFitLevel === "possible_fit" && moderateConstraints.length <= 1)) &&
    (confidenceLevel === "high" || confidenceLevel === "medium") &&
    matchScore >= 55 &&
    conflictScore < 3 &&
    corroborationScore >= 3 &&
    hasPositiveCorroboration
  ) {
    priority = "strong_target";
    reason = `Strong candidate for job search. ${positiveSignals.slice(0, 2).join(", ")}.`;
    staffAction = "Use as primary job-search target";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── EXPLORE FURTHER ───────────────────────────────────────────────────
  // Requirements:
  //   - Reasonable evidence
  //   - Possible fit with manageable concerns
  //   - Match score >= 40
  //   - Conflict score < 4 (not severe)
  //   - No hard constraints
  //   - Not too many unknowns
  if (
    (evidenceTier === "moderate" || evidenceTier === "strong") &&
    (envFitLevel === "possible_fit" || envFitLevel === "strong_fit" || envFitLevel === "unknown") &&
    (confidenceLevel === "medium" || confidenceLevel === "high") &&
    matchScore >= 40 &&
    conflictScore < 4 &&
    moderateConstraints.length <= 2 &&
    hardConstraints.length === 0 &&
    concerns.length <= 3
  ) {
    priority = "explore_further";
    const clarifyOn = [...concerns, ...conflictReasons].slice(0, 2).join(", ");
    reason = `Potentially useful option. ${clarifyOn ? `Needs clarification on: ${clarifyOn}` : "Discuss career fit with client"}.`;
    staffAction = "Discuss with client and explore interest";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── STRETCH / DEVELOPMENTAL ───────────────────────────────────────────
  // Aligns with interests but has barriers: training, licensing, or moderate conflicts
  // Not an immediate placement candidate — developmental goal
  if (
    (licensingBurden === "moderate" || licensingBurden === "high" ||
     trainingBurden === "moderate" || trainingBurden === "high") &&
    interestProfileMatch !== "weak" &&
    envFitLevel !== "poor_fit" &&
    conflictScore < 5 &&
    hardConstraints.length === 0
  ) {
    priority = "stretch";
    reason = `Aligns with interests but requires ${licensingBurden === "high" ? "significant" : "moderate"} training/licensing. Consider as a longer-term development goal.`;
    staffAction = "Research training requirements; consider for long-term planning";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // Also treat moderate-conflict + interest-aligned jobs as stretch
  if (
    conflictScore >= 2 && conflictScore < 5 &&
    interestProfileMatch !== "weak" &&
    matchScore >= 30 &&
    hardConstraints.length === 0
  ) {
    priority = "stretch";
    reason = `Career interest exists but environmental/functional conflicts need to be addressed first. ${conflictReasons.slice(0, 1).join("")}`;
    staffAction = "Explore with client as aspirational; address barriers first";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── CAUTION / VERIFY FIRST ────────────────────────────────────────────
  if (
    conflictScore >= 3 ||
    envFitLevel === "caution" ||
    (moderateConstraints.length >= 2 && confidenceLevel === "low") ||
    (unknownFactors.length >= 3 && moderateConstraints.length >= 1) ||
    (transportationUnknowns && matchesAny(jobText, ["travel", "commute", "multiple sites", "mobile"]))
  ) {
    priority = "caution";
    const causeList = [...concerns, ...conflictReasons].slice(0, 2).join("; ");
    reason = `Has fit concerns or unknowns requiring verification. ${causeList}.`;
    staffAction = "Verify concerns before presenting to client";
    return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
  }

  // ── LOW PRIORITY (default) ────────────────────────────────────────────
  priority = "low_priority";
  reason = conflictReasons.length > 0
    ? `Conflicts or weak fit make this a low-priority option. ${conflictReasons[0]}.`
    : "Weak evidence, poor fit, or significant mismatch with client profile.";
  staffAction = "Do not prioritize right now";
  return { priority_level: priority, priority_reason: reason, priority_factors: priorityFactors, staff_action: staffAction };
}

// ── PRIORITY CONTEXT EXTRACTION ────────────────────────────────────────────

/**
 * Gather context signals from profile, VFP, assessment data, and barriers.
 */
export function extractPriorityContext(job = {}, context = {}) {
  const vfp = context.vfp || context.vocationalProfile || {};
  const wsa = context.wsa || {};
  const barriers = context.barriers || {};
  const profile = context.profile || {};
  const interestProfile = context.interestProfile || {};
  const resumes = context.resumes || [];

  // Support needs (merge VFP + WSA + Barriers)
  const supportNeeds = [
    ...(vfp.support_needs || []),
    ...(vfp.accommodation_needs || []),
    ...(wsa.support_needs || []),
    ...(barriers.support_needs || []),
  ];

  // Transportation
  const transportReliability = vfp.transportation_reliability || [];
  const transportLimitations = vfp.transportation_limitations || [];
  const hasTransportData = transportReliability.length > 0 || transportLimitations.length > 0;
  const transportationUnknowns = !hasTransportData;

  // Schedule constraints
  const scheduleConstraints = [
    ...(vfp.schedule_constraints || []),
    ...(wsa.schedule_constraints || []),
  ];

  // Client goals
  const clientGoals = [
    ...(vfp.preferred_job_titles || []),
    ...(vfp.preferred_industries || []),
  ].filter(Boolean);

  // Work history from resumes
  const workHistory = (resumes || [])
    .flatMap((r) => (r.job_titles || []).concat(r.work_history?.map((w) => w.title) || []))
    .filter(Boolean);

  // Licensing burden (title heuristic)
  const jobTitle = safeLower(job.title || "");
  const licensingKeywords = [
    "nurse", "therapist", "counselor", "psychologist", "dentist", "lawyer",
    "accountant", "electrician", "plumber", "real estate", "insurance agent",
    "architect", "veterinarian", "pilot", "cdl", "attorney", "pharmacist",
  ];
  const licensingBurden = licensingKeywords.some((k) => jobTitle.includes(k)) ? "moderate" : "none";

  // Training burden (title heuristic)
  const trainingKeywords = [
    "manager", "supervisor", "lead", "senior", "specialist", "technician",
    "engineer", "analyst", "developer", "designer",
  ];
  const trainingBurden = trainingKeywords.some((k) => jobTitle.includes(k)) ? "moderate" : "none";

  return {
    supportNeeds,
    transportationUnknowns,
    scheduleConstraints,
    clientGoals,
    workHistory,
    licensingBurden,
    trainingBurden,
    // Pass through for computeEvidenceCorroboration / computeEnvironmentalConflictScore
    vfp,
    wsa,
    barriers,
    interestProfile,
    resumes,
  };
}

export default buildRecommendationPriority;
