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
 *   staff_verification_needed: [],
 *   evidence_tier: "strong" | "moderate" | "weak"
 * }
 *
 * Rules:
 * - Only use hard constraints for specific, vocationally significant evidence.
 * - Vague/generic evidence → moderate or unknown, never hard.
 * - Evidence quality (strong/moderate/weak) gates how aggressively concerns are raised.
 * - Preserve detailed evidence; do not overwrite with weaker labels.
 * - Do not over-block. Do not assume inability from weak evidence.
 */

import { scoreEvidenceItem, scoreEvidenceList } from "@/lib/recommendations/evidenceWeighting.js";
import { evalJobEnvironmentOverlay } from "@/lib/recommendations/jobEnvironmentProfiles.js";

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
    const { best: evidenceTier } = scoreEvidenceList(restrictions);

    const severeRestrictions = restrictions.filter((r) =>
      matchesAny(r, [
        "cannot stand", "no standing", "wheelchair", "unable to lift",
        "cannot walk", "no walking", "paralyzed", "severe mobility",
        "cannot use hands", "limited dexterity",
      ])
    );

    if (severeRestrictions.length > 0 && isPhysicallyDemanding) {
      // Only escalate to hard if evidence is strong/moderate (not a vague generic label)
      if (evidenceTier === "strong" || evidenceTier === "moderate") {
        hard.push(`Documented restriction conflicts with physical job demands: ${severeRestrictions[0]}`);
        verify.push("Confirm physical demands are compatible with documented restrictions before pursuing.");
      } else {
        moderate.push(`Physical restriction noted (${severeRestrictions[0]}) — evidence is general; verify job demands before ruling out.`);
        verify.push("Confirm the physical requirements of this role against documented restrictions.");
      }
    } else if (isPhysicallyDemanding) {
      if (evidenceTier === "weak") {
        unknowns.push(`Physical considerations noted (${restrictions.slice(0, 2).join(", ")}) — evidence is general; clarify functional capacity.`);
      } else {
        moderate.push(`Physical restrictions noted (${restrictions.slice(0, 2).join(", ")}) — verify job demands.`);
      }
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
    const { best: evidenceTier } = scoreEvidenceList(sensoryNeeds);

    const severeFlags = sensoryNeeds.filter((s) =>
      matchesAny(s, [
        "self-harm", "safety", "trigger", "coughing", "sneezing", "yawning",
        "severe", "cannot tolerate", "meltdown", "crisis",
      ])
    );

    if (severeFlags.length > 0 && isHighStimulation) {
      if (evidenceTier === "strong") {
        // Specific named triggers with safety implications → hard constraint
        hard.push(`High-severity sensory trigger documented: "${severeFlags[0]}" — high-stimulation environment may pose safety risk.`);
        verify.push("Safety-level sensory trigger noted. Confirm environment is appropriate before proceeding.");
      } else {
        // Severe-sounding keyword but vague evidence → moderate, not hard
        moderate.push(`Sensory concern noted ("${severeFlags[0]}") — high-stimulation environment may be challenging; verify specifics.`);
        verify.push("Clarify the nature and severity of this sensory need before placing in a high-stimulation environment.");
      }
    } else if (isHighStimulation) {
      if (evidenceTier === "weak") {
        unknowns.push("General sensory preferences noted — high-stimulation environment may not suit client; clarify tolerance.");
      } else {
        moderate.push(`Sensory/environmental needs documented — high-stimulation environment may be challenging.`);
      }
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
  const unknowns = [];
  const soft = [];
  const verify = [];

  const supportNeeds = vfp?.support_needs || [];
  const text = jobText(job);

  const isHighPace = matchesAny(text, [
    "fast-paced", "fast paced", "high volume", "multitask", "multi-task",
    "urgent", "deadline", "pressure",
  ]);

  // Explicit job coaching keywords — only these warrant a moderate concern
  const EXPLICIT_COACHING_KEYWORDS = [
    "job coaching required", "job coaching needed", "needs job coach",
    "requires job coach", "requires on-site support", "on-site job coach",
    "job coach on site", "task prompting required", "task prompting needed",
  ];

  // Inferred / weak support language — softer treatment
  const INFERRED_SUPPORT_KEYWORDS = [
    "coaching", "on-the-job", "task prompting", "prompting",
    "may need support", "limited support", "some support", "inferred",
    "not formally assessed", "possible support",
  ];

  if (supportNeeds.length > 0) {
    const hasExplicitCoaching = supportNeeds.some((s) =>
      EXPLICIT_COACHING_KEYWORDS.some((kw) => safeLower(s).includes(kw))
    );

    const hasInferredSupport = !hasExplicitCoaching && supportNeeds.some((s) =>
      INFERRED_SUPPORT_KEYWORDS.some((kw) => safeLower(s).includes(kw))
    );

    if (hasExplicitCoaching) {
      // Only here do we escalate to a moderate concern
      moderate.push("Documented job coaching or on-site support need — confirm employer can accommodate a support specialist.");
      verify.push("Confirm employer will accommodate a job coach or support specialist on-site.");
    } else if (hasInferredSupport) {
      // Inferred / weakly evidenced — goes to unknowns + verify, not moderate
      unknowns.push("Support needs are not fully assessed; may need onboarding or job coaching support.");
      verify.push("Confirm whether onboarding, accommodations, or job coaching support is needed before placement.");
    } else {
      // Support needs listed but no coaching language — just flag for verification
      verify.push("Confirm whether any onboarding or workplace support accommodations are needed.");
    }

    if (isHighPace && (hasExplicitCoaching || hasInferredSupport)) {
      soft.push("High-pace role may increase support demands — discuss with client before applying.");
    }
  } else {
    // No support needs documented — unknown, not a concern
    unknowns.push("Support needs are not documented — confirm whether any onboarding or job coaching support would be beneficial.");
    verify.push("Confirm whether onboarding, accommodations, or job coaching support is needed.");
  }

  return { moderate, unknowns, soft, verify };
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
  const unknowns = [];
  const verify = [];

  const barriers = vfp?.barriers || [];

  if (barriers.length > 0) {
    const { best: evidenceTier } = scoreEvidenceList(barriers);

    if (evidenceTier === "strong") {
      moderate.push(`Documented barriers with functional impact: ${barriers.slice(0, 2).map(readableItem).join(", ")}.`);
    } else if (evidenceTier === "moderate") {
      moderate.push(`Barriers noted: ${barriers.slice(0, 2).map(readableItem).join(", ")}.`);
    } else {
      // Weak evidence (generic labels) → unknown, not a moderate concern
      unknowns.push(`General barriers noted (${barriers.slice(0, 2).map(readableItem).join(", ")}) — functional impact not fully described.`);
    }

    if (barriers.some((b) => matchesAny(b, ["mental_health", "psychiatric", "ptsd", "anxiety", "depression"]))) {
      // Only escalate if not purely a generic diagnostic label
      if (evidenceTier !== "weak") {
        verify.push("Mental health barriers documented — discuss workplace support options with client.");
      } else {
        verify.push("Mental health considerations noted (general) — confirm functional impact with client.");
      }
    }
  }

  return { moderate, unknowns, verify };
}

// ── OVERALL FIT LEVEL ────────────────────────────────────────────────────────

/**
 * evidenceTier ("strong"|"moderate"|"weak") gates how aggressively we score.
 * Weak evidence → unknowns don't count as heavily toward caution/poor_fit.
 */
function resolveOverallFitLevel(hard, moderate, unknowns, soft, evidenceTier = "moderate") {
  if (hard.length >= 1) return "poor_fit";

  // With weak overall evidence, be less aggressive about escalating to caution
  const unknownWeight = evidenceTier === "weak" ? 3 : 2; // need more unknowns to trigger caution
  const moderateThreshold = evidenceTier === "strong" ? 2 : 3; // strong evidence: caution sooner

  if (moderate.length >= moderateThreshold) return "caution";
  if (moderate.length >= 1 && unknowns.length >= unknownWeight) return "caution";
  if (moderate.length === 0 && unknowns.length === 0 && soft.length > 0) return "strong_fit";
  if (moderate.length <= 1 && unknowns.length <= 1) return "possible_fit";
  if (unknowns.length >= 4) return "unknown";
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

/**
 * Merge barriers assessment evidence into a VFP snapshot for constraint evaluation.
 * Does NOT mutate either input. Barriers evidence fills in fields the VFP may lack,
 * but will not overwrite stronger VFP evidence (non-empty arrays win).
 */
function mergeBarriersIntoVfp(vfp, barriers) {
  if (!barriers) return vfp;
  const base = vfp ? { ...vfp } : {};

  const mergeArr = (existing, incoming) => {
    const e = Array.isArray(existing) ? existing : [];
    const i = Array.isArray(incoming) ? incoming : [];
    return e.length > 0 ? e : i.length > 0 ? [...new Set([...e, ...i])] : e;
  };

  // Physical restrictions
  if (!base.physical_restrictions?.length && barriers.physical_limitations?.length) {
    base.physical_restrictions = barriers.physical_limitations;
  }

  // Sensory/environmental needs
  if (!base.sensory_environmental_needs?.length && barriers.environment_needs?.length) {
    base.sensory_environmental_needs = barriers.environment_needs;
  }

  // Barriers
  base.barriers = mergeArr(base.barriers, barriers.barriers);

  // Support needs
  base.support_needs = mergeArr(base.support_needs, barriers.support_needs);

  // Social tolerance
  if (!base.social_tolerance?.length && barriers.social_tolerance?.length) {
    base.social_tolerance = barriers.social_tolerance;
  }

  // Transportation
  if (!base.transportation_reliability?.length && barriers.transportation?.length) {
    const reliable = barriers.transportation.filter(t =>
      t.toLowerCase().includes("drives own vehicle") || t.toLowerCase().includes("public transit")
    );
    const unreliable = barriers.transportation.some(t => t.toLowerCase().includes("unreliable"));
    if (unreliable) base.transportation_limitations = [...(base.transportation_limitations || []), "unreliable_transportation"];
    if (reliable.length) base.transportation_reliability = reliable;
  }

  // Schedule constraints (shift_constraints)
  if (!base.schedule_constraints?.length && barriers.raw?.shift_constraints === "yes") {
    const detail = barriers.raw?.shift_constraints_detail || "";
    if (detail) base.schedule_constraints = [detail];
  }

  return base;
}

export function buildConstraintFit(job = {}, context = {}) {
  // Fallback chain: vfp → vocationalProfile → profile.vocational_profile → client VFP
  const rawVfp =
    context?.vfp ||
    context?.vocationalProfile ||
    context?.profile?.vocational_profile ||
    null;

  // Merge barriers assessment evidence to enrich VFP for constraint evaluation
  const barriersData = context?.barriers || null;

  console.log("CONSTRAINT FIT HAS VFP:", !!rawVfp, "HAS BARRIERS:", !!barriersData);

  // If no VFP but we have barriers data, use barriers as the base
  const effectiveRawVfp = rawVfp || (barriersData ? {} : null);

  if (!effectiveRawVfp) {
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

  // Merge barriers evidence into VFP snapshot (non-destructive)
  const mergedRawVfp = mergeBarriersIntoVfp(effectiveRawVfp, barriersData);
  console.log("VFP KEYS (merged):", Object.keys(mergedRawVfp || {}));

  // Normalize all VFP array fields to plain strings before evaluation
  const vfp = normalizeVfp(mergedRawVfp);

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

  // ── OCCUPATIONAL ENVIRONMENT OVERLAY ──────────────────────────────────────
  // Compares O*NET-style job environment profile against VFP evidence.
  const envOverlay = evalJobEnvironmentOverlay(job, vfp, scoreEvidenceList, matchesAny);
   merge({
    soft: envOverlay.soft,
    moderate: envOverlay.moderate,
    unknowns: envOverlay.unknowns,
    verify: envOverlay.verify,
  });

  // Verified prior success in the same occupation is stronger evidence than
  // broad inferred preference or support-planning concerns.
  //
  // For an occupation the client has already performed successfully, preserve
  // setting-specific sensory or any hard/safety-level concerns, but do not
  // classify ordinary support, readiness, or accommodation-planning needs as
  // evidence that the occupation itself is a poor recommendation.
  const hasVerifiedWorkHistoryMatch =
    job?.verified_work_history_match === true;

  if (hasVerifiedWorkHistoryMatch && hard.length === 0) {
    const supportPlanningModerateConcerns = moderate.filter((concern) =>
      matchesAny(concern, [
        "documented job coaching or on-site support need",
        "client is in an exploratory stage",
        "documented barriers with functional impact",
      ])
    );

    for (let index = moderate.length - 1; index >= 0; index -= 1) {
      if (
        matchesAny(moderate[index], [
          "documented job coaching or on-site support need",
          "client is in an exploratory stage",
          "documented barriers with functional impact",
        ])
      ) {
        moderate.splice(index, 1);
      }
    }

    if (supportPlanningModerateConcerns.length > 0) {
      verify.push(
        "This occupation is supported by documented prior work history. Confirm current accessibility, job-coaching, time-management, and workplace support needs for a similar placement."
      );
    }

    soft.push(
      "Documented successful work history in this occupation provides direct evidence of potential fit."
    );
  }

  // Assess overall evidence quality from key VFP domains to calibrate fit level
  const allVfpEvidence = [
    ...(vfp.physical_restrictions || []),
    ...(vfp.sensory_environmental_needs || []),
    ...(vfp.sensory_limitations || []),
    ...(vfp.barriers || []),
    ...(vfp.support_needs || []),
  ];
  const { best: overallEvidenceTier } = scoreEvidenceList(allVfpEvidence);

  const fitLevel = resolveOverallFitLevel(hard, moderate, unknowns, soft, overallEvidenceTier);
  const envSummary = buildEnvSummary(fitLevel, job, hard, moderate, unknowns, soft);

  return {
    overall_fit_level: fitLevel,
    evidence_tier: overallEvidenceTier,
    hard_constraints: hard,
    moderate_constraints: moderate,
    soft_preferences: soft,
    unknowns,
    environmental_fit_summary: envSummary,
    occupation_notes: envOverlay.occupation_notes,
    occupation_profile_label: envOverlay.profile?.label || null,
    staff_verification_needed: verify,
  };
}

export default buildConstraintFit;
