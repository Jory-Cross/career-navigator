/**
 * buildRecommendationGrounding.js
 *
 * Generates a structured "grounding" object for a single recommendation,
 * explaining WHY it was suggested based on available vocational evidence.
 *
 * Strategy: pull evidence broadly from all available sources instead of
 * relying on narrow keyword matching against job description text.
 */

const RIASEC_LABELS = {
  R: "Realistic", r: "Realistic",
  I: "Investigative", i: "Investigative",
  A: "Artistic", a: "Artistic",
  S: "Social", s: "Social",
  E: "Enterprising", e: "Enterprising",
  C: "Conventional", c: "Conventional",
  realistic: "Realistic",
  investigative: "Investigative",
  artistic: "Artistic",
  social: "Social",
  enterprising: "Enterprising",
  conventional: "Conventional",
};

function labelRiasec(code) {
  return RIASEC_LABELS[code] || RIASEC_LABELS[code?.toLowerCase()] || code;
}

function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeStr(v) { return typeof v === "string" ? v.trim() : ""; }

/**
 * Convert a VFP fact item (string or structured object) into a readable string.
 * Supports: strings, { fact, source }, { label }, { value }, { summary }, { detail }
 * If item has both fact and source, renders "fact [source]".
 */
function readableFact(item) {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return String(item ?? "").trim();
  // Best-case: fact + source attribution
  if (item.fact && item.source) return `${item.fact} [${item.source}]`;
  if (item.fact) return item.fact;
  // Fallback priority
  return (
    item.label ||
    item.value ||
    item.summary ||
    item.detail ||
    item.text ||
    item.description ||
    item.name ||
    Object.values(item).find((v) => typeof v === "string") ||
    ""
  ).trim();
}

function readableFactList(arr) {
  return safeArr(arr).map(readableFact).filter(Boolean);
}

// Pull top N RIASEC codes from a scores object
function topRiasecCodes(scores = {}, n = 3) {
  return Object.entries(scores)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => labelRiasec(k));
}

export function buildRecommendationGrounding(job, context = {}) {
  const {
    vfp = null,
    wsa = null,
    resumes = [],
    interestProfile = null,
    otherAssessments = [],
    maturity = null,
    profile = {},
  } = context;

  const title = safeStr(job?.title || job?.job_title) || "This role";

  const supported_by = [];
  const supporting_sources = [];
  const confidence_factors = [];
  const concern_factors = [];
  const missing_data_factors = [];
  const staff_review_flags = [];

  // ── What did O*NET / the engine already give us? ──────────────────────────

  const matchReason = safeStr(job?.match_reason);
  const fitStrengths = safeArr(job?.fit_strengths);
  const matchedKeywords = safeArr(job?.matched_keywords);
  const onetCode = safeStr(job?.onet_code);
  const fitConcerns = safeArr(job?.fit_concerns);
  const notFitReasons = safeArr(job?.not_fit_reasons);

  // ── Source availability flags ─────────────────────────────────────────────

  const resumeSkills = safeArr(profile?.resume_skills).concat(
    safeArr(vfp?.skills), safeArr(vfp?.strengths)
  ).filter(Boolean);

  const workHistory = safeArr(resumes).flatMap(r => safeArr(r?.work_history))
    .concat(safeArr(vfp?.work_history));

  const hasResume = resumeSkills.length > 0 || workHistory.length > 0 || resumes.length > 0;
  const hasWSA = !!(wsa || safeArr(profile?.wsa_strengths).length > 0);
  const hasInterestProfile = !!(
    interestProfile &&
    (interestProfile.riasec_scores || interestProfile.scores || interestProfile.answer_string || interestProfile.answerString)
  );
  const hasVFP = !!(vfp && Object.keys(vfp).length > 0);

  // ── 1. O*NET Interest Profiler match ─────────────────────────────────────

  const riasecScores = interestProfile?.riasec_scores || interestProfile?.scores || profile?.riasec_scores || {};
  const topCodes = topRiasecCodes(riasecScores, 3);

  if (hasInterestProfile) {
    supported_by.push("onet_interest_profiler");
    supporting_sources.push({ label: "O*NET Interest Profiler", type: "onet" });

    supported_by.push("onet_match");
    supporting_sources.push({
      label: "O*NET Career Match",
      detail: onetCode ? `O*NET occupation code: ${onetCode}` : "Matched from O*NET Interest Profiler career results.",
      type: "onet",
    });

    confidence_factors.push("Matched from O*NET Interest Profiler career results.");

    if (topCodes.length > 0) {
      confidence_factors.push(
        `Interest Profiler indicates ${topCodes.slice(0, 2).map(labelRiasec).join(" and ")} interests.`
      );
    }
  } else {
    missing_data_factors.push("O*NET Interest Profiler has not been completed.");
    staff_review_flags.push("Complete the Interest Profiler to strengthen the basis for this match.");
  }

  // ── 2. Resume / Skills / Work History ────────────────────────────────────

  if (hasResume) {
    supported_by.push("resume");

    // Prefer matched keywords from engine if available
    if (matchedKeywords.length > 0) {
      supporting_sources.push({
        label: "Resume / Work History",
        detail: `Resume shows: ${matchedKeywords.slice(0, 5).join(", ")}.`,
        type: "resume",
      });
      confidence_factors.push(`Resume shows ${matchedKeywords.slice(0, 3).join(", ")}.`);
    } else if (resumeSkills.length > 0) {
      supporting_sources.push({
        label: "Resume / Work History",
        detail: `Resume includes skills: ${resumeSkills.slice(0, 5).join(", ")}.`,
        type: "resume",
      });
      confidence_factors.push(`Resume includes relevant skills: ${resumeSkills.slice(0, 3).join(", ")}.`);
    } else {
      supporting_sources.push({
        label: "Resume / Work History",
        detail: "Resume or work history is available.",
        type: "resume",
      });
      confidence_factors.push("Resume or work history is available.");
    }

    // Work history jobs
    const jobTitles = workHistory
      .map(w => safeStr(w?.title || w?.job_title || w?.position))
      .filter(Boolean);
    if (jobTitles.length > 0) {
      confidence_factors.push(
        `Work history includes: ${jobTitles.slice(0, 3).join(", ")}.`
      );
    }
  } else {
    missing_data_factors.push("No resume or work history data available.");
    staff_review_flags.push("Verify client's work history and transferable skills before presenting this recommendation.");
  }

  // ── 3. Match reason / fit strengths from engine ───────────────────────────

  if (matchReason) {
    if (!supported_by.includes("engine_match")) supported_by.push("engine_match");
    confidence_factors.push(`Broadly supported by: ${matchReason}`);
  }

  if (fitStrengths.length > 0) {
    fitStrengths.slice(0, 3).forEach(s => {
      confidence_factors.push(safeStr(s));
    });
  }

  // ── 4. VFP — goals, interests, preferences ───────────────────────────────

  if (hasVFP) {
    const preferredTitles = readableFactList(
      safeArr(vfp.preferred_job_titles).concat(safeArr(vfp.suggested_job_targets))
    );
    const vfpInterests = readableFactList(
      safeArr(vfp.interests).concat(safeArr(vfp.career_interests))
    );
    const vfpBarriers = readableFactList(
      safeArr(vfp.barriers).concat(safeArr(vfp.employment_barriers))
    );
    const accommodations = readableFactList(
      safeArr(vfp.accommodation_needs).concat(safeArr(vfp.accommodations))
    );
    const supportNeeds = readableFactList(safeArr(vfp.support_needs));
    const physRestrictions = readableFactList(safeArr(vfp.physical_restrictions));
    const scheduleConstraints = readableFactList(
      safeArr(vfp.schedule_constraints).concat(safeArr(profile?.wsa_schedule_constraints))
    );
    const transportation = readableFactList(
      safeArr(vfp.transportation).concat(safeArr(profile?.wsa_transportation))
    );
    const envPrefs = readableFactList(
      safeArr(vfp.work_environment_preferences).concat(safeArr(profile?.wsa_environment_needs))
    );

    // Preferred titles / goals
    if (preferredTitles.length > 0) {
      supported_by.push("vfp_goals");
      supporting_sources.push({
        label: "Vocational Facts Profile – Career Goals",
        detail: `Client career interests include: ${preferredTitles.slice(0, 3).join(", ")}.`,
        type: "vfp",
      });
      confidence_factors.push(`Client's vocational profile lists career interests: ${preferredTitles.slice(0, 2).join(", ")}.`);
    }

    // Interests
    if (vfpInterests.length > 0 && !preferredTitles.length) {
      supported_by.push("vfp_interests");
      confidence_factors.push(`Client interests documented in vocational profile: ${vfpInterests.slice(0, 3).join(", ")}.`);
    }

    // Barriers
    if (vfpBarriers.length > 0) {
      concern_factors.push(`Documented barriers may affect placement: ${vfpBarriers.slice(0, 2).join("; ")}.`);
    }

    // Accommodations
    if (accommodations.length > 0) {
      staff_review_flags.push(
        `Client has documented accommodation needs (${accommodations.slice(0, 2).join(", ")}). Verify employer can support these.`
      );
    }

    // Support needs
    if (supportNeeds.length > 0) {
      staff_review_flags.push(
        `Client support needs should be discussed with employer: ${supportNeeds.slice(0, 2).join("; ")}.`
      );
    }

    // Physical restrictions
    if (physRestrictions.length > 0) {
      concern_factors.push(`Physical restrictions documented (${physRestrictions.slice(0, 2).join(", ")}). Verify this role's physical demands.`);
      staff_review_flags.push("Confirm physical demands of this role are compatible with client restrictions.");
    }

    // Schedule
    if (scheduleConstraints.length > 0) {
      concern_factors.push(`Schedule constraints may apply: ${scheduleConstraints.slice(0, 2).join(", ")}.`);
    } else {
      missing_data_factors.push("Schedule availability is not documented.");
    }

    // Transportation
    if (transportation.length > 0) {
      const hasUnknown = transportation.some(t =>
        t.toLowerCase().includes("unknown") || t.toLowerCase().includes("unclear")
      );
      if (hasUnknown) {
        concern_factors.push("Transportation availability requires clarification.");
      }
    } else {
      concern_factors.push("Transportation availability is not documented.");
      staff_review_flags.push("Confirm transportation availability for this occupation.");
    }

    // Environment preferences
    if (envPrefs.length > 0) {
      confidence_factors.push(`Client environment preferences documented: ${envPrefs.slice(0, 2).join(", ")}.`);
    }
  }

  // ── 5. WSA Evidence ───────────────────────────────────────────────────────

  if (hasWSA) {
    supported_by.push("wsa");
    const wsaStrengths = safeArr(profile?.wsa_strengths);
    const wsaThemes = safeArr(profile?.vocational_themes);

    supporting_sources.push({
      label: "Work Strategy Assessment (WSA)",
      detail: wsaStrengths.length > 0
        ? `WSA strengths: ${wsaStrengths.slice(0, 3).join(", ")}.`
        : wsaThemes.length > 0
          ? `Work themes: ${wsaThemes.slice(0, 3).join(", ")}.`
          : "WSA data is available.",
      type: "wsa",
    });

    if (wsaThemes.length > 0) {
      confidence_factors.push(`Work Strategy Assessment themes: ${wsaThemes.slice(0, 2).join(", ")}.`);
    }
  } else {
    missing_data_factors.push("Work Strategy Assessment (WSA) has not been completed.");
  }

  // ── 6. Maturity/profile quality ───────────────────────────────────────────

  if (maturity) {
    const level = maturity.confidence_level || maturity.maturity_level || "";
    if (["High", "Strong", "Good"].includes(level)) {
      confidence_factors.push("Multiple non-intake sources support the vocational profile.");
    } else if (["Low", "Minimal", "Weak"].includes(level)) {
      concern_factors.push("Client's vocational profile has limited data — this match may have weaker supporting evidence.");
      staff_review_flags.push("Profile data is limited. Additional assessment recommended before acting on this recommendation.");
    }
  }

  // ── 7. Universal staff verify flags ──────────────────────────────────────

  staff_review_flags.push("Confirm client's interest in this specific occupation.");
  staff_review_flags.push("Confirm any training or licensing requirements relevant to this role.");
  if (!hasVFP || !(vfp?.transportation?.length > 0)) {
    // already added above, avoid duplicate
  }

  // ── 8. Constraint engine concerns ────────────────────────────────────────

  if (fitConcerns.length > 0) {
    fitConcerns.slice(0, 3).forEach(c => {
      concern_factors.push(`Constraint flag: ${safeStr(c)}`);
    });
  }

  // ── 9. Grounding summary ──────────────────────────────────────────────────

  const dedupedConfidence = [...new Set(confidence_factors.filter(Boolean))];
  const dedupedConcern = [...new Set(concern_factors.filter(Boolean))];
  const dedupedMissing = [...new Set(missing_data_factors.filter(Boolean))];
  const dedupedFlags = [...new Set(staff_review_flags.filter(Boolean))];
  const dedupedSupported = [...new Set(supported_by)];

  let grounding_summary = "";
  const sourceCount = dedupedSupported.length;

  if (sourceCount === 0) {
    grounding_summary = `${title} was suggested based on general career matching. Gather more client data to strengthen this match.`;
  } else if (hasInterestProfile && topCodes.length > 0) {
    grounding_summary = `${title} was matched via O*NET Interest Profiler (${topCodes.slice(0, 2).join(", ")} interests). ${
      hasResume ? "Resume and work history provide additional context. " : ""
    }${dedupedConcern.length > 0 ? "Some areas require staff verification before proceeding." : "Staff should confirm client interest and any training requirements."}`;
  } else if (sourceCount >= 2) {
    grounding_summary = `${title} is broadly supported by ${sourceCount} data sources. ${dedupedConfidence[0] || ""} Staff should verify fit before presenting to client.`;
  } else {
    grounding_summary = `${title} is supported by ${dedupedSupported[0]?.replace(/_/g, " ") || "available data"}. Additional assessment would strengthen this match.`;
  }

  return {
    supported_by: dedupedSupported,
    supporting_sources: [...new Set(supporting_sources.map(s => JSON.stringify(s)))].map(s => JSON.parse(s)),
    confidence_factors: dedupedConfidence.slice(0, 8),
    concern_factors: dedupedConcern.slice(0, 6),
    missing_data_factors: dedupedMissing.slice(0, 5),
    staff_review_flags: dedupedFlags.slice(0, 6),
    grounding_summary,
  };
}

export default buildRecommendationGrounding;