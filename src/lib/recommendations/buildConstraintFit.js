/**
 * buildConstraintFit.js
 *
 * Constraint Severity + Environmental Fit Layer.
 *
 * Produces a structured constraint_fit object for each recommendation:
 * {
 *   overall_fit_level: "strong_fit" | "possible_fit" | "caution" | "poor_fit" | "unknown",
 *   hard_constraints: [],
 *   moderate_constraints: [],
 *   soft_preferences: [],
 *   unknowns: [],
 *   environmental_fit_summary: "",
 *   staff_verification_needed: []
 * }
 *
 * Rules:
 * - Only use hard constraints for specific, vocationally significant evidence.
 * - Vague/generic evidence → moderate or unknown, never hard.
 * - Preserve detailed evidence; do not overwrite with weaker labels.
 * - Do not over-block. Do not assume inability from weak evidence.
 */

function safeLower(v) {
  return String(v || "").toLowerCase();
}

/** Extract a readable string from a constraint item (string or object). */
function readableItem(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item ?? "");
  return (
    item.label || item.summary || item.reason || item.detail ||
    item.evidence || item.source || item.text || item.description ||
    Object.values(item).find((v) => typeof v === "string") || ""
  );
}

function matchesAny(text, keywords = []) {
  const t = safeLower(text);
  return keywords.some((k) => t.includes(safeLower(k)));
}

function jobText(job) {
  return safeLower(
    [job.title, job.description, job.match_reason, job.category].join(" ")
  );
}

// ── PHYSICAL CONSTRAINTS ──────────────────────────────────────────────────────

function evalPhysical(vfp, job) {
  const hard = [];
  const moderate = [];
  const unknowns = [];
  const verify = [];

  const restrictions = vfp?.physical_restrictions || [];
  const text = jobText(job);

  const isPhysicallyDemanding = matchesAny(text, [
    "labor", "labourer", "laborer", "warehouse", "construction", "stocking",
    "loading", "unloading", "heavy lifting", "physical", "standing", "dishwasher",
    "manual", "outdoor work", "landscaping", "janitorial", "housekeeping",
  ]);

  if (restrictions.length > 0) {
    // Check for specific severe documented restrictions
    const severeRestrictions = restrictions.filter((r) =>
      matchesAny(r, [
        "cannot stand", "no standing", "wheelchair", "unable to lift",
        "cannot walk", "no walking", "paralyzed", "severe mobility",
        "cannot use hands", "limited dexterity",
      ])
    );

    if (severeRestrictions.length > 0 && isPhysicallyDemanding) {
      hard.push(`Documented restriction conflicts with physical job demands: ${severeRestrictions[0]}`);
      verify.push("Confirm physical demands are compatible with documented restrictions before pursuing.");
    } else if (isPhysicallyDemanding) {
      moderate.push(`Physical restrictions noted (${restrictions.slice(0, 2).join(", ")}) — verify job demands.`);
      verify.push("Confirm the physical requirements of this role against documented restrictions.");
    }
  } else if (isPhysicallyDemanding) {
    unknowns.push("Physical restrictions unknown — job may have demanding physical requirements.");
    verify.push("Clarify client's physical capabilities before presenting this role.");
  }

  return { hard, moderate, unknowns, verify };
}

// ── SENSORY / ENVIRONMENTAL CONSTRAINTS ───────────────────────────────────────

function evalSensory(vfp, job) {
  const hard = [];
  const moderate = [];
  const unknowns = [];
  const verify = [];

  const sensoryNeeds = [
    ...(vfp?.sensory_environmental_needs || []),
    ...(vfp?.sensory_limitations || []),
  ];
  const text = jobText(job);

  const isHighStimulation = matchesAny(text, [
    "restaurant", "fast food", "fast-paced", "busy", "retail", "cashier",
    "warehouse", "loud", "crowded", "kitchen", "food service", "call center",
    "open office", "manufacturing", "factory",
  ]);

  if (sensoryNeeds.length > 0) {
    // Check for severe/safety-relevant sensory flags
    const severeFlags = sensoryNeeds.filter((s) =>
      matchesAny(s, [
        "self-harm", "safety", "trigger", "coughing", "sneezing", "yawning",
        "severe", "cannot tolerate", "meltdown", "crisis",
      ])
    );

    if (severeFlags.length > 0 && isHighStimulation) {
      hard.push(`High-severity sensory trigger documented: "${severeFlags[0]}" — high-stimulation environment may pose safety risk.`);
      verify.push("Safety-level sensory trigger noted. Confirm environment is appropriate before proceeding.");
    } else if (isHighStimulation) {
      moderate.push(`Sensory/environmental needs documented — high-stimulation environment may be challenging.`);
      verify.push("Review sensory needs against the work environment for this role.");
    }
  } else if (isHighStimulation) {
    unknowns.push("Sensory/environmental needs unknown — this role may be high-stimulation.");
  }

  return { hard, moderate, unknowns, verify };
}

// ── SOCIAL / COMMUNICATION CONSTRAINTS ───────────────────────────────────────

function evalSocial(vfp, job) {
  const moderate = [];
  const soft = [];
  const unknowns = [];
  const verify = [];

  const socialNeeds = [
    ...(vfp?.social_communication_needs || []),
    ...(vfp?.communication_style || []),
    ...(vfp?.social_tolerance || []),
  ];
  const text = jobText(job);

  const isCustomerFacing = matchesAny(text, [
    "customer", "cashier", "receptionist", "front desk", "sales", "retail",
    "client-facing", "public", "host", "server", "patient",
  ]);

  const prefersIndependent = vfp?.work_environment_preferences?.some((p) =>
    matchesAny(p, ["independent", "solo", "low_social", "limited_customer"])
  );

  if (socialNeeds.length > 0) {
    const lowToleranceFlags = socialNeeds.filter((s) =>
      matchesAny(s, [
        "low social", "limited tolerance", "social anxiety", "avoids interaction",
        "difficulty communicating", "non-verbal", "limited verbal",
      ])
    );

    if (lowToleranceFlags.length > 0 && isCustomerFacing) {
      moderate.push(`Low social tolerance documented — customer-facing role may be difficult.`);
      verify.push("Discuss social demands of this role with client before applying.");
    } else if (isCustomerFacing && prefersIndependent) {
      soft.push("Client prefers independent or low-contact work — customer-facing role may not align.");
    }
  } else if (isCustomerFacing) {
    unknowns.push("Social/communication tolerance unknown — this role requires customer interaction.");
  }

  if (prefersIndependent && !isCustomerFacing) {
    soft.push("Client prefers independent work — this role may align well with that preference.");
  }

  return { moderate, soft, unknowns, verify };
}

// ── SUPPORT NEEDS ────────────────────────────────────────────────────────────

function evalSupportNeeds(vfp, job) {
  const moderate = [];
  const verify = [];

  const supportNeeds = vfp?.support_needs || [];
  const text = jobText(job);

  const isHighPace = matchesAny(text, [
    "fast-paced", "fast paced", "high volume", "multitask", "multi-task",
    "urgent", "deadline", "pressure",
  ]);

  if (supportNeeds.length > 0) {
    const coachingNeeds = supportNeeds.filter((s) =>
      matchesAny(s, ["job coaching", "coaching", "on-the-job", "task prompting", "prompting"])
    );
    if (coachingNeeds.length > 0) {
      moderate.push("Client requires job coaching support — confirm employer is supportive of a job coach.");
      verify.push("Confirm employer will accommodate a job coach or support specialist on-site.");
    }

    if (isHighPace) {
      moderate.push("Client has documented support needs — high-pace role may increase demands.");
    }
  }

  return { moderate, verify };
}

// ── TRANSPORTATION ───────────────────────────────────────────────────────────

function evalTransportation(vfp, job) {
  const moderate = [];
  const unknowns = [];
  const verify = [];

  const transportReliability = vfp?.transportation_reliability || [];
  const transportLimitations = vfp?.transportation_limitations || [];
  const text = jobText(job);

  const requiresTravel = matchesAny(text, [
    "travel required", "multiple sites", "driver", "delivery", "commute",
    "field work", "mobile",
  ]);

  const hasReliableTransport = transportReliability.some((r) =>
    matchesAny(r, ["reliable_personal_vehicle", "bus", "public_transit"])
  );

  const hasNoTransport =
    transportLimitations.includes("no_personal_vehicle") ||
    transportLimitations.includes("no_driver_license");

  if (requiresTravel) {
    if (hasNoTransport) {
      moderate.push("Role requires travel but client has no personal vehicle or license.");
      verify.push("Confirm transportation plan for a role requiring travel.");
    } else if (!hasReliableTransport) {
      unknowns.push("Transportation reliability unknown — role requires travel or reliable commute.");
      verify.push("Clarify transportation reliability before presenting this role.");
    }
  } else if (!hasReliableTransport && transportLimitations.length === 0) {
    unknowns.push("Transportation availability unknown.");
  }

  return { moderate, unknowns, verify };
}

// ── SCHEDULE ────────────────────────────────────────────────────────────────

function evalSchedule(vfp, job) {
  const moderate = [];
  const unknowns = [];
  const verify = [];

  const scheduleConstraints = vfp?.schedule_constraints || [];
  const scheduleAvailability = vfp?.schedule_availability || vfp?.work_availability || [];
  const text = jobText(job);

  const requiresNonStandard = matchesAny(text, [
    "night shift", "overnight", "weekends required", "rotating", "on-call",
    "swing shift", "evening", "variable hours",
  ]);

  const hasNightRestriction = scheduleConstraints.some((s) =>
    matchesAny(s, ["no_overnight", "no_night", "mornings_only", "no_weekends"])
  );

  if (requiresNonStandard && hasNightRestriction) {
    moderate.push("Role may require non-standard hours that conflict with client's schedule constraints.");
    verify.push("Confirm schedule requirements with client before applying.");
  } else if (requiresNonStandard && scheduleAvailability.length === 0 && scheduleConstraints.length === 0) {
    unknowns.push("Schedule availability unknown — this role may require non-standard hours.");
    verify.push("Clarify client's scheduling availability.");
  }

  return { moderate, unknowns, verify };
}

// ── SOFT PREFERENCES ────────────────────────────────────────────────────────

function evalPreferences(vfp, job) {
  const soft = [];

  const text = jobText(job);
  const envPrefs = [
    ...(vfp?.work_environment_preferences || []),
    ...(vfp?.preferred_work_environment || []),
  ];
  const preferredTitles = vfp?.preferred_job_titles || [];
  const preferredIndustries = vfp?.preferred_industries || [];
  const avoidedTasks = vfp?.avoided_tasks || [];

  // Positive preference matches
  if (envPrefs.some((p) => matchesAny(p, ["structured", "routine"])) &&
      matchesAny(text, ["structured", "routine", "consistent", "predictable"])) {
    soft.push("Client prefers structured/routine work — this role may align.");
  }

  if (envPrefs.some((p) => matchesAny(p, ["independent", "solo"])) &&
      matchesAny(text, ["independent", "solo", "self-directed"])) {
    soft.push("Client prefers independent work — this role may align.");
  }

  // Industry/title match
  const titleMatch = preferredTitles.find((t) =>
    matchesAny(text, [t]) || matchesAny(job.title, [t])
  );
  if (titleMatch) {
    soft.push(`Matches client's stated preferred job title: "${titleMatch}".`);
  }

  const industryMatch = preferredIndustries.find((i) => matchesAny(text, [i]));
  if (industryMatch) {
    soft.push(`Aligns with client's preferred industry: ${industryMatch}.`);
  }

  // Avoided task warnings (soft only)
  const avoidedMatch = avoidedTasks.find((t) => matchesAny(text, [t]));
  if (avoidedMatch) {
    soft.push(`Client has noted preference to avoid: "${avoidedMatch}" — verify fit.`);
  }

  return { soft };
}

// ── JOB READINESS ────────────────────────────────────────────────────────────

function evalReadiness(vfp) {
  const moderate = [];
  const unknowns = [];

  const readiness = vfp?.job_readiness_level || [];
  const onboarding = vfp?.onboarding_readiness || [];

  const isExploring = readiness.some((r) => matchesAny(r, ["exploring", "early"]));
  const docsMissing = onboarding.some((r) => matchesAny(r, ["missing", "minimal"]));

  if (isExploring) {
    moderate.push("Client is in an exploratory stage — direct placement may be premature.");
  }
  if (docsMissing) {
    unknowns.push("Required employment documentation is missing or incomplete.");
  }

  return { moderate, unknowns };
}

// ── BARRIERS ─────────────────────────────────────────────────────────────────

function evalBarriers(vfp) {
  const moderate = [];
  const verify = [];

  const barriers = vfp?.barriers || [];

  if (barriers.length > 0) {
    moderate.push(`Documented barriers: ${barriers.slice(0, 2).map(readableItem).join(", ")}.`);
    if (barriers.some((b) => matchesAny(b, ["mental_health", "psychiatric", "ptsd", "anxiety", "depression"]))) {
      verify.push("Mental health barriers documented — discuss workplace support options with client.");
    }
  }

  return { moderate, verify };
}

// ── OVERALL FIT LEVEL ────────────────────────────────────────────────────────

function resolveOverallFitLevel(hard, moderate, unknowns, soft) {
  if (hard.length >= 1) return "poor_fit";
  if (moderate.length >= 3) return "caution";
  if (moderate.length >= 1 && unknowns.length >= 2) return "caution";
  if (moderate.length === 0 && unknowns.length === 0 && soft.length > 0) return "strong_fit";
  if (moderate.length <= 1 && unknowns.length <= 1) return "possible_fit";
  if (unknowns.length >= 3) return "unknown";
  return "possible_fit";
}

// ── ENVIRONMENTAL FIT SUMMARY ────────────────────────────────────────────────

function buildEnvSummary(fitLevel, job, hard, moderate, unknowns, soft) {
  const title = job?.title || "This role";

  if (fitLevel === "strong_fit") {
    return `${title} appears to be a strong environmental fit based on available client data.`;
  }
  if (fitLevel === "poor_fit") {
    return `${title} has hard constraints that may make it incompatible — staff review required before presenting.`;
  }
  if (fitLevel === "caution") {
    const topConcern = readableItem(moderate[0] || hard[0]) || "Multiple concerns present";
    return `${title} warrants caution. ${topConcern}`;
  }
  if (fitLevel === "unknown") {
    return `${title} cannot be fully evaluated — key vocational data is missing.`;
  }
  // possible_fit
  const notes = [];
  if (moderate.length > 0) notes.push(`${moderate.length} moderate concern(s)`);
  if (unknowns.length > 0) notes.push(`${unknowns.length} unknown factor(s)`);
  if (soft.length > 0) notes.push(`${soft.length} preference alignment(s)`);
  return `${title} is a possible fit. ${notes.join(", ")}.`;
}

/**
 * Normalize a VFP array field so every item is a plain string.
 * Handles: strings, { fact, source }, { label }, { value }, etc.
 */
function normalizeVfpArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return String(item ?? "");
    if (item.fact && item.source) return `${item.fact} [${item.source}]`;
    return (
      item.fact || item.label || item.value || item.summary ||
      item.detail || item.text || item.description ||
      Object.values(item).find((v) => typeof v === "string") || ""
    );
  }).filter(Boolean);
}

/**
 * Normalize all array fields in a VFP object so they contain plain strings.
 * Does not mutate the original; returns a shallow copy with normalized arrays.
 */
function normalizeVfp(vfp) {
  if (!vfp || typeof vfp !== "object") return vfp;
  const arrayFields = [
    "physical_restrictions", "sensory_environmental_needs", "sensory_limitations",
    "social_communication_needs", "communication_style", "social_tolerance",
    "support_needs", "accommodation_needs", "accommodations",
    "transportation_reliability", "transportation_limitations", "transportation",
    "schedule_constraints", "schedule_availability", "work_availability",
    "work_environment_preferences", "preferred_work_environment",
    "preferred_job_titles", "preferred_industries", "avoided_tasks",
    "barriers", "employment_barriers",
    "job_readiness_level", "onboarding_readiness",
    "interests", "career_interests", "strengths", "skills",
  ];
  const normalized = { ...vfp };
  for (const field of arrayFields) {
    if (Array.isArray(vfp[field])) {
      normalized[field] = normalizeVfpArray(vfp[field]);
    }
  }
  return normalized;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function buildConstraintFit(job = {}, context = {}) {
  // Fallback chain: vfp → vocationalProfile → profile.vocational_profile → client VFP
  const rawVfp =
    context?.vfp ||
    context?.vocationalProfile ||
    context?.profile?.vocational_profile ||
    null;

  console.log("CONSTRAINT FIT HAS VFP:", !!rawVfp);
  if (rawVfp) {
    console.log("VFP KEYS:", Object.keys(rawVfp));
  }

  if (!rawVfp) {
    return {
      overall_fit_level: "unknown",
      hard_constraints: [],
      moderate_constraints: [],
      soft_preferences: [],
      unknowns: [
        "Vocational Facts Profile is not available — constraint analysis cannot be performed.",
      ],
      environmental_fit_summary:
        "Insufficient vocational data to evaluate environmental fit.",
      staff_verification_needed: [
        "Complete VFP extraction before acting on this recommendation.",
      ],
    };
  }

  // Normalize all VFP array fields to plain strings before evaluation
  const vfp = normalizeVfp(rawVfp);

  const hard = [];
  const moderate = [];
  const soft = [];
  const unknowns = [];
  const verify = [];

  const merge = (result) => {
    if (result.hard) hard.push(...result.hard);
    if (result.moderate) moderate.push(...result.moderate);
    if (result.soft) soft.push(...result.soft);
    if (result.unknowns) unknowns.push(...result.unknowns);
    if (result.verify) verify.push(...result.verify);
  };

  merge(evalPhysical(vfp, job));
  merge(evalSensory(vfp, job));
  merge(evalSocial(vfp, job));
  merge(evalSupportNeeds(vfp, job));
  merge(evalTransportation(vfp, job));
  merge(evalSchedule(vfp, job));
  merge(evalPreferences(vfp, job));
  merge(evalReadiness(vfp));
  merge(evalBarriers(vfp));

  const fitLevel = resolveOverallFitLevel(hard, moderate, unknowns, soft);
  const envSummary = buildEnvSummary(fitLevel, job, hard, moderate, unknowns, soft);

  return {
    overall_fit_level: fitLevel,
    hard_constraints: hard,
    moderate_constraints: moderate,
    soft_preferences: soft,
    unknowns,
    environmental_fit_summary: envSummary,
    staff_verification_needed: verify,
  };
}

export default buildConstraintFit;