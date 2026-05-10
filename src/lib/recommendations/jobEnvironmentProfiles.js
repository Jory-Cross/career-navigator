/**
 * jobEnvironmentProfiles.js
 *
 * Lightweight O*NET-style occupational environment overlay.
 *
 * Each profile describes the typical environmental characteristics of an occupation
 * or occupational cluster. Values are on a 0–3 scale:
 *   0 = none/minimal   1 = low   2 = moderate   3 = high
 *
 * Fields:
 *   social_demand         — required social interaction with public/coworkers
 *   customer_interaction  — frequency of direct customer/client contact
 *   pace_level            — speed, urgency, multitasking demands
 *   sensory_load          — noise, crowding, smell, visual stimulation
 *   physical_demand       — standing, lifting, physical labor required
 *   supervision_structure — how closely supervised (3=very structured, 0=independent)
 *   unpredictability      — how variable/unpredictable the daily environment is
 *   teamwork_level        — reliance on teamwork vs. solo work
 *   routine_level         — how repetitive/consistent the work is (3=very routine)
 *   training_complexity   — amount of skill, licensing, or onboarding required
 *   standing_required     — whether extended standing/walking is typical
 *   outdoor_work          — whether work is outdoors or in variable conditions
 *   shift_variability     — likelihood of non-standard/variable hours
 *
 * Occupation keys are matched against job title text (lowercase includes).
 * Add new profiles freely — the matcher scans all entries.
 */

export const JOB_ENVIRONMENT_PROFILES = [
  // ── RETAIL / CASHIER ─────────────────────────────────────────────────────
  {
    keys: ["cashier", "checkout", "register", "grocery store", "convenience store"],
    label: "Retail Cashier",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 1,
    supervision_structure: 2,
    unpredictability: 2,
    teamwork_level: 2,
    routine_level: 2,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "High customer interaction and prolonged standing. Variable pace during peak hours.",
  },

  // ── RETAIL ASSOCIATE ──────────────────────────────────────────────────────
  {
    keys: ["retail associate", "retail worker", "stock associate", "store associate", "sales associate", "retail sales"],
    label: "Retail Associate",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 2,
    teamwork_level: 2,
    routine_level: 2,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Customer-facing role with standing, stocking, and moderate sensory stimulation.",
  },

  // ── FOOD SERVICE ──────────────────────────────────────────────────────────
  {
    keys: ["fast food", "food service", "restaurant", "server", "waitstaff", "waiter", "waitress", "line cook", "kitchen", "barista", "café", "cafe"],
    label: "Food Service",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 3,
    sensory_load: 3,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 3,
    teamwork_level: 3,
    routine_level: 1,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 3,
    notes: "High pace, loud environment, strong smells, constant customer and team interaction. Unpredictable rush periods.",
  },

  // ── CUSTODIAL / JANITORIAL ────────────────────────────────────────────────
  {
    keys: ["custodian", "janitorial", "janitor", "custodial", "cleaner", "housekeeper", "housekeeping", "sanitation worker"],
    label: "Custodial / Janitorial",
    social_demand: 1,
    customer_interaction: 1,
    pace_level: 1,
    sensory_load: 2,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 1,
    teamwork_level: 1,
    routine_level: 3,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 1,
    notes: "Structured repetitive work, largely independent. Moderate physical demand. Low social interaction.",
  },

  // ── WAREHOUSE / STOCKING ──────────────────────────────────────────────────
  {
    keys: ["warehouse", "stocking", "stocker", "stock clerk", "fulfillment", "inventory", "shipping", "receiving", "freight", "loader", "unloader"],
    label: "Warehouse / Stocking",
    social_demand: 1,
    customer_interaction: 0,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 3,
    supervision_structure: 2,
    unpredictability: 1,
    teamwork_level: 2,
    routine_level: 3,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Physically demanding, repetitive work. Loud machinery possible. Minimal customer contact.",
  },

  // ── BARBER / COSMETOLOGY ──────────────────────────────────────────────────
  {
    keys: ["barber", "cosmetologist", "hair stylist", "hair salon", "nail technician", "esthetician", "spa"],
    label: "Barber / Cosmetology",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 2,
    supervision_structure: 1,
    unpredictability: 2,
    teamwork_level: 1,
    routine_level: 2,
    training_complexity: 3,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Requires licensing. High customer interaction; extended standing. Schedule flexibility varies by setting.",
  },

  // ── ANIMAL CARE ───────────────────────────────────────────────────────────
  {
    keys: ["animal care", "veterinary", "kennel", "pet groomer", "animal shelter", "vet assistant", "zookeeper", "dog walker"],
    label: "Animal Care",
    social_demand: 1,
    customer_interaction: 2,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 2,
    teamwork_level: 2,
    routine_level: 2,
    training_complexity: 2,
    standing_required: true,
    outdoor_work: true,
    shift_variability: 2,
    notes: "Hands-on environment with animals. Moderate physical demand and unpredictability. Lower customer interaction.",
  },

  // ── DATA ENTRY / OFFICE CLERK ─────────────────────────────────────────────
  {
    keys: ["data entry", "office clerk", "file clerk", "administrative assistant", "receptionist", "administrative aide", "clerical"],
    label: "Office / Clerical",
    social_demand: 2,
    customer_interaction: 2,
    pace_level: 1,
    sensory_load: 1,
    physical_demand: 0,
    supervision_structure: 2,
    unpredictability: 1,
    teamwork_level: 2,
    routine_level: 3,
    training_complexity: 1,
    standing_required: false,
    outdoor_work: false,
    shift_variability: 1,
    notes: "Structured indoor desk work. Predictable schedule. Moderate social interaction. Sitting-based.",
  },

  // ── LANDSCAPING / GROUNDS ─────────────────────────────────────────────────
  {
    keys: ["landscaping", "groundskeeper", "lawn care", "grounds maintenance", "horticulture", "nursery worker"],
    label: "Landscaping / Grounds",
    social_demand: 1,
    customer_interaction: 1,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 3,
    supervision_structure: 2,
    unpredictability: 1,
    teamwork_level: 2,
    routine_level: 2,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: true,
    shift_variability: 1,
    notes: "Outdoor physical work, weather-dependent. Minimal customer interaction. Team-based.",
  },

  // ── MANUFACTURING / ASSEMBLY ──────────────────────────────────────────────
  {
    keys: ["manufacturing", "assembly", "assembly line", "production worker", "factory", "machine operator", "fabrication"],
    label: "Manufacturing / Assembly",
    social_demand: 1,
    customer_interaction: 0,
    pace_level: 3,
    sensory_load: 3,
    physical_demand: 2,
    supervision_structure: 3,
    unpredictability: 1,
    teamwork_level: 2,
    routine_level: 3,
    training_complexity: 2,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Loud industrial environment. Repetitive structured tasks. High pace on assembly lines. Machinery noise.",
  },

  // ── HEALTHCARE SUPPORT ────────────────────────────────────────────────────
  {
    keys: ["caregiver", "home health aide", "nursing assistant", "cna", "patient care", "direct support professional", "dsp", "personal care aide"],
    label: "Healthcare / Direct Support",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 3,
    teamwork_level: 2,
    routine_level: 1,
    training_complexity: 2,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 3,
    notes: "High human interaction with vulnerable populations. Emotionally demanding. Unpredictable situations. Physical lifting possible.",
  },

  // ── DELIVERY / DRIVER ────────────────────────────────────────────────────
  {
    keys: ["delivery driver", "courier", "mail carrier", "postal worker", "driver", "truck driver", "forklift"],
    label: "Delivery / Driver",
    social_demand: 1,
    customer_interaction: 2,
    pace_level: 2,
    sensory_load: 1,
    physical_demand: 2,
    supervision_structure: 1,
    unpredictability: 2,
    teamwork_level: 1,
    routine_level: 2,
    training_complexity: 2,
    standing_required: false,
    outdoor_work: true,
    shift_variability: 2,
    notes: "Primarily independent work. Requires license. Some customer interaction at delivery points. Variable conditions.",
  },

  // ── FOOD PREP / PRODUCTION ───────────────────────────────────────────────
  {
    keys: ["food prep", "food production", "bakery", "cook", "prep cook", "dishwasher", "kitchen helper"],
    label: "Food Prep / Production",
    social_demand: 2,
    customer_interaction: 1,
    pace_level: 3,
    sensory_load: 3,
    physical_demand: 2,
    supervision_structure: 2,
    unpredictability: 2,
    teamwork_level: 3,
    routine_level: 2,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Hot, loud kitchen environment. High pace. Strong sensory stimulation. Team-dependent work.",
  },

  // ── CALL CENTER / CUSTOMER SERVICE ───────────────────────────────────────
  {
    keys: ["call center", "customer service representative", "help desk", "support specialist", "phone support", "inbound"],
    label: "Call Center / Phone Support",
    social_demand: 3,
    customer_interaction: 3,
    pace_level: 2,
    sensory_load: 2,
    physical_demand: 0,
    supervision_structure: 3,
    unpredictability: 2,
    teamwork_level: 2,
    routine_level: 2,
    training_complexity: 1,
    standing_required: false,
    outdoor_work: false,
    shift_variability: 2,
    notes: "Constant verbal interaction. Monitored metrics. Sitting-based. Emotionally demanding. Noisy open-office environment.",
  },

  // ── SECURITY / GUARD ─────────────────────────────────────────────────────
  {
    keys: ["security guard", "security officer", "loss prevention", "patrol", "night security"],
    label: "Security",
    social_demand: 2,
    customer_interaction: 2,
    pace_level: 1,
    sensory_load: 1,
    physical_demand: 1,
    supervision_structure: 2,
    unpredictability: 2,
    teamwork_level: 1,
    routine_level: 2,
    training_complexity: 1,
    standing_required: true,
    outdoor_work: false,
    shift_variability: 3,
    notes: "Often solitary or low-team work. Variable hours including nights. Occasional unpredictable situations.",
  },

  // ── LIBRARY / ARCHIVAL ────────────────────────────────────────────────────
  {
    keys: ["library", "librarian", "library assistant", "archivist"],
    label: "Library / Archival",
    social_demand: 2,
    customer_interaction: 2,
    pace_level: 1,
    sensory_load: 1,
    physical_demand: 1,
    supervision_structure: 2,
    unpredictability: 1,
    teamwork_level: 1,
    routine_level: 3,
    training_complexity: 2,
    standing_required: false,
    outdoor_work: false,
    shift_variability: 1,
    notes: "Quiet structured environment. Moderate public interaction. Predictable schedule. Low sensory load.",
  },
];

/**
 * Look up a job's environment profile by matching job title text.
 * Returns the best matching profile, or null if no match found.
 *
 * @param {string} jobTitle - The job title string to match
 * @param {string} [jobDescription] - Optional description for additional context
 * @returns {object|null} - Matched profile or null
 */
export function lookupJobEnvironmentProfile(jobTitle = "", jobDescription = "") {
  const searchText = `${jobTitle} ${jobDescription}`.toLowerCase();

  // Try to find the profile with the most keyword matches (best match wins)
  let bestMatch = null;
  let bestMatchCount = 0;

  for (const profile of JOB_ENVIRONMENT_PROFILES) {
    const matchCount = profile.keys.filter((key) => searchText.includes(key.toLowerCase())).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestMatch = profile;
    }
  }

  return bestMatch;
}

/**
 * Compare a job environment profile against client VFP constraints to produce
 * occupational overlay insights.
 *
 * Returns:
 * {
 *   profile: object|null,         — the matched occupation profile
 *   occupation_notes: string[],   — descriptive notes about the job environment
 *   soft: string[],               — positive alignment observations
 *   moderate: string[],           — moderate concerns from job environment
 *   unknowns: string[],           — unknowns surfaced by job environment
 *   verify: string[],             — staff verification flags
 * }
 *
 * Respects evidence weighting — generic client evidence produces softer outputs.
 *
 * @param {object} job - The recommendation job object
 * @param {object} vfp - Normalized VFP object
 * @param {Function} scoreEvidenceListFn - scoreEvidenceList from evidenceWeighting
 * @param {Function} matchesAnyFn - matchesAny helper
 */
export function evalJobEnvironmentOverlay(job, vfp, scoreEvidenceListFn, matchesAnyFn) {
  const occupation_notes = [];
  const soft = [];
  const moderate = [];
  const unknowns = [];
  const verify = [];

  const envProfile = lookupJobEnvironmentProfile(
    job?.title || job?.job_title || "",
    job?.description || job?.match_reason || ""
  );

  if (!envProfile) {
    // No profile found — surface a mild unknown so staff knows context is limited
    unknowns.push("Occupational environment data is not available for this specific job title.");
    return { profile: null, occupation_notes, soft, moderate, unknowns, verify };
  }

  // Always surface the descriptive note about this occupation's environment
  if (envProfile.notes) {
    occupation_notes.push(envProfile.notes);
  }

  // Helper: score the evidence tier for a VFP field
  const getTier = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "none";
    return scoreEvidenceListFn(arr).best;
  };

  // ── CUSTOMER INTERACTION ──────────────────────────────────────────────────

  if (envProfile.customer_interaction >= 3) {
    occupation_notes.push(`${envProfile.label} typically involves high customer interaction.`);

    const socialNeeds = [
      ...(vfp?.social_communication_needs || []),
      ...(vfp?.social_tolerance || []),
    ];
    const prefersLowContact = (vfp?.work_environment_preferences || []).some((p) =>
      matchesAnyFn(p, ["independent", "solo", "low_social", "limited_customer", "low contact"])
    );

    if (socialNeeds.length > 0) {
      const tier = getTier(socialNeeds);
      const lowFlags = socialNeeds.filter((s) =>
        matchesAnyFn(s, ["low social", "limited tolerance", "social anxiety", "avoids interaction", "non-verbal", "limited verbal"])
      );
      if (lowFlags.length > 0) {
        if (tier === "strong" || tier === "moderate") {
          moderate.push(`${envProfile.label} requires high customer contact — client has documented low social tolerance.`);
          verify.push("Discuss social demands of this role with client. High customer interaction may be challenging.");
        } else {
          unknowns.push(`${envProfile.label} involves high customer interaction — social tolerance not fully assessed.`);
          verify.push("Clarify client's tolerance for frequent customer interaction before presenting this role.");
        }
      } else if (prefersLowContact) {
        soft.push(`Client prefers limited customer contact — ${envProfile.label} involves frequent public interaction.`);
      }
    } else if (prefersLowContact) {
      soft.push(`Client prefers limited customer contact — ${envProfile.label} involves frequent public interaction.`);
    } else {
      unknowns.push(`Social tolerance not documented — ${envProfile.label} typically involves high customer interaction.`);
    }
  } else if (envProfile.customer_interaction <= 1) {
    const prefersLowContact = (vfp?.work_environment_preferences || []).some((p) =>
      matchesAnyFn(p, ["independent", "solo", "low_social", "limited_customer"])
    );
    if (prefersLowContact) {
      soft.push(`${envProfile.label} involves minimal customer contact — aligns with client's preference for low-contact work.`);
    }
  }

  // ── SENSORY LOAD ──────────────────────────────────────────────────────────

  if (envProfile.sensory_load >= 3) {
    occupation_notes.push(`${envProfile.label} typically involves a high sensory load (noise, activity, stimulation).`);

    const sensoryNeeds = [
      ...(vfp?.sensory_environmental_needs || []),
      ...(vfp?.sensory_limitations || []),
    ];

    if (sensoryNeeds.length > 0) {
      const tier = getTier(sensoryNeeds);
      const hasSpecificFlags = sensoryNeeds.some((s) =>
        matchesAnyFn(s, ["cannot tolerate loud", "noise sensitivity", "sensory overload", "overstimulation", "loud environment"])
      );

      if (hasSpecificFlags) {
        if (tier === "strong" || tier === "moderate") {
          moderate.push(`${envProfile.label} is a high-sensory environment — documented sensory sensitivity may be a concern.`);
          verify.push("Confirm whether the sensory demands of this environment are manageable for this client.");
        } else {
          unknowns.push(`Sensory sensitivity noted — ${envProfile.label} is typically a high-stimulation environment; specific tolerance not fully assessed.`);
          verify.push("Clarify client's sensory tolerance before placing in a high-stimulation environment.");
        }
      } else {
        // Vague sensory needs + high-sensory environment → soft concern
        unknowns.push(`General sensory preferences noted — ${envProfile.label} involves elevated sensory stimulation; confirm tolerance.`);
        verify.push("Review sensory needs against the occupational context for this role.");
      }
    } else {
      unknowns.push(`Sensory tolerance is not documented — ${envProfile.label} typically involves a high-stimulation environment.`);
    }
  } else if (envProfile.sensory_load <= 1) {
    const hasSensoryNeeds = (vfp?.sensory_environmental_needs || []).length > 0
      || (vfp?.sensory_limitations || []).length > 0;
    if (hasSensoryNeeds) {
      soft.push(`${envProfile.label} is a low-sensory environment — may align with client's sensory needs.`);
    }
  }

  // ── PHYSICAL DEMAND ───────────────────────────────────────────────────────

  if (envProfile.physical_demand >= 3 || envProfile.standing_required) {
    const physRestrictions = vfp?.physical_restrictions || [];

    if (envProfile.physical_demand >= 3) {
      occupation_notes.push(`${envProfile.label} is physically demanding with heavy lifting or strenuous activity.`);
    } else if (envProfile.standing_required) {
      occupation_notes.push(`${envProfile.label} typically requires extended standing or walking.`);
    }

    if (physRestrictions.length > 0) {
      const tier = getTier(physRestrictions);
      const standingIssue = physRestrictions.some((r) =>
        matchesAnyFn(r, ["cannot stand", "limited standing", "no prolonged standing", "sitting only"])
      );
      const liftingIssue = physRestrictions.some((r) =>
        matchesAnyFn(r, ["cannot lift", "no lifting", "limited lifting", "no heavy"])
      );

      if (standingIssue && envProfile.standing_required) {
        if (tier === "strong" || tier === "moderate") {
          moderate.push(`${envProfile.label} requires extended standing — client has documented standing restriction.`);
          verify.push("Confirm whether this role's standing requirements are compatible with client's restrictions.");
        } else {
          unknowns.push(`Standing restriction noted (general) — ${envProfile.label} typically requires extended standing; verify capacity.`);
          verify.push("Clarify the client's standing tolerance for this occupational context.");
        }
      }

      if (liftingIssue && envProfile.physical_demand >= 2) {
        if (tier === "strong" || tier === "moderate") {
          moderate.push(`${envProfile.label} involves physical demands — client has documented lifting restrictions.`);
          verify.push("Confirm physical demands are compatible with documented lifting restrictions.");
        } else {
          unknowns.push(`Lifting restriction noted (general) — ${envProfile.label} has physical demands; verify functional capacity.`);
        }
      }
    }
  }

  // ── PACE / UNPREDICTABILITY ───────────────────────────────────────────────

  if (envProfile.pace_level >= 3 || envProfile.unpredictability >= 3) {
    if (envProfile.pace_level >= 3) {
      occupation_notes.push(`${envProfile.label} is fast-paced with high work volume or time pressure.`);
    }
    if (envProfile.unpredictability >= 3) {
      occupation_notes.push(`${envProfile.label} involves highly unpredictable or variable daily conditions.`);
    }

    const barriers = vfp?.barriers || [];
    const hasAnxietyBarrier = barriers.some((b) =>
      matchesAnyFn(b, ["anxiety", "stress", "overwhelm", "executive function", "difficulty with change"])
    );
    const needsStructure = (vfp?.work_environment_preferences || []).some((p) =>
      matchesAnyFn(p, ["structured", "predictable", "routine", "consistent"])
    );
    const supportNeeds = vfp?.support_needs || [];
    const hasHighSupportNeed = supportNeeds.some((s) =>
      matchesAnyFn(s, ["task prompting", "job coaching", "structure", "prompting"])
    );

    if (hasAnxietyBarrier || needsStructure || hasHighSupportNeed) {
      const tier = getTier([...barriers, ...supportNeeds]);
      if (tier === "strong" || tier === "moderate") {
        moderate.push(`${envProfile.label} involves ${envProfile.pace_level >= 3 ? "high pace" : "unpredictable conditions"} — client has documented need for structure or has anxiety-related barriers.`);
        verify.push("Discuss pace and predictability demands of this role with client before pursuing.");
      } else {
        unknowns.push(`Preference for structured work noted — ${envProfile.label} may involve ${envProfile.unpredictability >= 3 ? "unpredictable" : "fast-paced"} conditions; confirm tolerance.`);
        verify.push("Clarify whether the pace and variability of this role is appropriate for this client.");
      }
    }
  }

  // ── ROUTINE / STRUCTURED ALIGNMENT ───────────────────────────────────────

  if (envProfile.routine_level >= 3) {
    const prefersRoutine = (vfp?.work_environment_preferences || []).some((p) =>
      matchesAnyFn(p, ["routine", "structured", "predictable", "consistent", "repetitive"])
    );
    if (prefersRoutine) {
      soft.push(`${envProfile.label} involves structured, repetitive work — aligns with client's preference for routine-based work.`);
    }
  }

  // ── INDEPENDENT WORK ALIGNMENT ────────────────────────────────────────────

  if (envProfile.teamwork_level <= 1 || (envProfile.supervision_structure <= 1 && envProfile.social_demand <= 1)) {
    const prefersIndependent = (vfp?.work_environment_preferences || []).some((p) =>
      matchesAnyFn(p, ["independent", "solo", "self-directed", "autonomous"])
    );
    if (prefersIndependent) {
      soft.push(`${envProfile.label} typically involves independent or low-supervision work — aligns with client's stated preference.`);
    }
  }

  // ── TRAINING COMPLEXITY ───────────────────────────────────────────────────

  if (envProfile.training_complexity >= 3) {
    occupation_notes.push(`${envProfile.label} typically requires licensing, certification, or significant training.`);
    verify.push("Confirm whether client has or is eligible for required licensing/certification for this occupation.");
  }

  // ── OUTDOOR / VARIABLE CONDITIONS ────────────────────────────────────────

  if (envProfile.outdoor_work) {
    occupation_notes.push(`${envProfile.label} typically involves outdoor work and exposure to weather conditions.`);
    const hasOutdoorRestriction = (vfp?.physical_restrictions || []).some((r) =>
      matchesAnyFn(r, ["outdoor", "weather", "cold", "heat", "sun exposure"])
    );
    if (hasOutdoorRestriction) {
      verify.push("Confirm whether outdoor/weather conditions are tolerable given client's documented restrictions.");
    }
  }

  // ── SHIFT VARIABILITY ─────────────────────────────────────────────────────

  if (envProfile.shift_variability >= 3) {
    occupation_notes.push(`${envProfile.label} often involves variable or non-standard hours.`);
    const hasScheduleConstraints = (vfp?.schedule_constraints || []).length > 0;
    if (hasScheduleConstraints) {
      verify.push(`Confirm whether client's schedule constraints are compatible with ${envProfile.label}'s typical variable shift hours.`);
    } else {
      unknowns.push(`Schedule flexibility requirements for ${envProfile.label} are not matched against client's documented availability.`);
    }
  }

  return { profile: envProfile, occupation_notes, soft, moderate, unknowns, verify };
}

export default { lookupJobEnvironmentProfile, evalJobEnvironmentOverlay, JOB_ENVIRONMENT_PROFILES };