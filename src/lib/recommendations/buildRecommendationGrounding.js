/**
 * buildRecommendationGrounding.js
 *
 * Generates a structured "grounding" object for a single recommendation,
 * explaining WHY it was suggested based on available vocational evidence.
 *
 * Input: (job, groundingContext)
 *   job             - the processed recommendation object
 *   groundingContext - { vfp, wsa, resumes, interestProfile, otherAssessments, maturity, profile }
 *
 * Output: grounding object with:
 *   supported_by, supporting_sources, confidence_factors,
 *   concern_factors, missing_data_factors, staff_review_flags, grounding_summary
 */

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

  const title = job?.title || "This role";
  const supporting_sources = [];
  const confidence_factors = [];
  const concern_factors = [];
  const missing_data_factors = [];
  const staff_review_flags = [];
  const supported_by = [];

  // ── SOURCE DETECTION ───────────────────────────────────────────────────────

  const hasResume = (profile.resume_skills || []).length > 0 || resumes.length > 0;
  const hasWSA = wsa || (profile.wsa_strengths || []).length > 0;
  const hasInterestProfile = !!interestProfile;
  const hasVFP = !!vfp && Object.keys(vfp).length > 0;
  const hasAssessments = otherAssessments.length > 0;

  // ── RESUME / WORK HISTORY EVIDENCE ────────────────────────────────────────

  if (hasResume) {
    const skills = profile.resume_skills || [];
    const jobText = `${job.title || ""} ${job.description || ""} ${job.match_reason || ""}`.toLowerCase();
    const matchedSkills = skills.filter(s => jobText.includes(s.toLowerCase()));

    if (matchedSkills.length > 0) {
      supported_by.push("resume");
      supporting_sources.push({
        label: "Resume / Work History",
        detail: `Matched skills: ${matchedSkills.slice(0, 4).join(", ")}`,
        type: "resume",
      });
      confidence_factors.push(`Resume skills align with ${title} requirements (${matchedSkills.slice(0, 3).join(", ")}).`);
    } else if (skills.length > 0) {
      supporting_sources.push({
        label: "Resume / Work History",
        detail: "Resume is present but skills did not directly match this role.",
        type: "resume",
      });
    }
  } else {
    missing_data_factors.push("No resume or work history data available.");
    staff_review_flags.push("Verify client's work history before presenting this recommendation.");
  }

  // ── O*NET INTEREST PROFILER ────────────────────────────────────────────────

  if (hasInterestProfile) {
    const riasec = interestProfile?.riasec_scores || interestProfile?.scores || {};
    const topCodes = Object.entries(riasec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);

    if (topCodes.length > 0) {
      supported_by.push("onet_interest_profiler");
      supporting_sources.push({
        label: "O*NET Interest Profiler",
        detail: `Top RIASEC codes: ${topCodes.join(", ")}`,
        type: "onet",
      });
      confidence_factors.push(`Interest Profiler results (${topCodes.join(", ")}) informed this career match.`);
    }
  } else {
    missing_data_factors.push("O*NET Interest Profiler has not been completed.");
    staff_review_flags.push("Consider completing the Interest Profiler to strengthen this match.");
  }

  // ── WSA EVIDENCE ──────────────────────────────────────────────────────────

  if (hasWSA) {
    const strengths = profile.wsa_strengths || [];
    const themes = profile.vocational_themes || [];
    const jobText = `${job.title || ""} ${job.description || ""}`.toLowerCase();
    const matchedThemes = themes.filter(t => jobText.includes(t.toLowerCase()));

    supported_by.push("wsa");
    supporting_sources.push({
      label: "Work Strategy Assessment (WSA)",
      detail: matchedThemes.length > 0
        ? `Work themes align: ${matchedThemes.slice(0, 3).join(", ")}`
        : strengths.length > 0
          ? `Strengths documented: ${strengths.slice(0, 3).join(", ")}`
          : "WSA data present",
      type: "wsa",
    });

    if (matchedThemes.length > 0) {
      confidence_factors.push(`WSA work themes match this role (${matchedThemes.slice(0, 2).join(", ")}).`);
    }

    // Environment preferences
    const envNeeds = profile.wsa_environment_needs || [];
    if (envNeeds.length > 0) {
      const jobEnv = `${job.title || ""} ${job.description || ""}`.toLowerCase();
      const conflicts = envNeeds.filter(e =>
        (e.includes("quiet") && jobEnv.includes("busy")) ||
        (e.includes("independent") && (jobEnv.includes("team") || jobEnv.includes("customer")))
      );
      if (conflicts.length > 0) {
        concern_factors.push(`Possible environment mismatch: client prefers ${conflicts.join(", ")}.`);
      }
    }
  } else {
    missing_data_factors.push("Work Strategy Assessment (WSA) has not been completed.");
  }

  // ── VFP FIELD-LEVEL EVIDENCE ──────────────────────────────────────────────

  if (hasVFP) {
    const vfpStrengths = vfp.strengths || [];
    const vfpSkills = vfp.skills || [];
    const vfpPreferredTitles = vfp.preferred_job_titles || [];
    const vfpBarriers = vfp.barriers || [];
    const vfpAccommodations = vfp.accommodation_needs || [];
    const jobText = `${job.title || ""} ${job.description || ""}`.toLowerCase();

    // Preferred titles match
    const titleMatch = vfpPreferredTitles.find(t =>
      jobText.includes(t.toLowerCase()) || (job.title || "").toLowerCase().includes(t.toLowerCase())
    );
    if (titleMatch) {
      supported_by.push("vfp_goals");
      confidence_factors.push(`Client's stated goal "${titleMatch}" aligns with ${title}.`);
    }

    // Skills from VFP
    const matchedVfpSkills = [...vfpStrengths, ...vfpSkills].filter(s =>
      jobText.includes(s.toLowerCase())
    );
    if (matchedVfpSkills.length > 0) {
      if (!supported_by.includes("vfp")) supported_by.push("vfp");
      supporting_sources.push({
        label: "Vocational Facts Profile",
        detail: `VFP skills matched: ${matchedVfpSkills.slice(0, 3).join(", ")}`,
        type: "vfp",
      });
    }

    // Barriers
    if (vfpBarriers.length > 0) {
      concern_factors.push(`Documented barriers may affect placement: ${vfpBarriers.slice(0, 2).join(", ")}.`);
    }

    // Accommodations
    if (vfpAccommodations.length > 0) {
      staff_review_flags.push(`Client has documented accommodation needs: ${vfpAccommodations.slice(0, 2).join(", ")}. Verify employer can support these.`);
    }

    // Physical restrictions
    const physicalRestrictions = vfp.physical_restrictions || [];
    if (physicalRestrictions.length > 0) {
      const jobHeavy = jobText.includes("labor") || jobText.includes("warehouse") || jobText.includes("physical");
      if (jobHeavy) {
        concern_factors.push(`Physical restrictions noted (${physicalRestrictions.slice(0, 2).join(", ")}) — verify job demands.`);
        staff_review_flags.push("Confirm physical demands of this role are compatible with client restrictions.");
      }
    }

    // Support needs
    const supportNeeds = vfp.support_needs || [];
    if (supportNeeds.length > 0) {
      staff_review_flags.push(`Client has support needs that should be discussed with employer: ${supportNeeds.slice(0, 2).join(", ")}.`);
    }
  }

  // ── FIT CONCERNS FROM CONSTRAINT ENGINE ───────────────────────────────────

  const fitConcerns = job.fit_concerns || [];
  if (fitConcerns.length > 0) {
    fitConcerns.forEach(concern => {
      concern_factors.push(`Constraint flag: ${concern}`);
    });
  }

  // ── MATURITY CONTEXT ──────────────────────────────────────────────────────

  if (maturity) {
    if (maturity.confidence_level === "Low") {
      concern_factors.push("Client's vocational profile has low data maturity — this match may have limited supporting evidence.");
      staff_review_flags.push("Profile data is limited. Additional assessment recommended before acting on this recommendation.");
    } else if (maturity.confidence_level === "High") {
      confidence_factors.push("Client's vocational profile is well-supported by multiple data sources.");
    }
  }

  // ── MISSING DATA ──────────────────────────────────────────────────────────

  if (!hasResume && !hasWSA && !hasInterestProfile) {
    missing_data_factors.push("No vocational assessment data available — this recommendation is based on limited information.");
    staff_review_flags.push("Gather more client data (resume, WSA, Interest Profiler) before presenting this recommendation.");
  }

  // ── GROUNDING SUMMARY ─────────────────────────────────────────────────────

  const sourceCount = supported_by.length;
  let grounding_summary = "";

  if (sourceCount === 0) {
    grounding_summary = `${title} was suggested based on general career matching. Limited client-specific evidence is available to support or refute this match.`;
  } else if (sourceCount === 1) {
    grounding_summary = `${title} is supported by ${supported_by[0].replace(/_/g, " ")} data. Additional assessment sources would strengthen confidence.`;
  } else {
    const sourceLabels = supported_by.map(s => s.replace(/_/g, " ")).join(", ");
    grounding_summary = `${title} is supported by ${sourceCount} data sources: ${sourceLabels}. ${confidence_factors[0] || ""}`;
  }

  return {
    supported_by,
    supporting_sources,
    confidence_factors,
    concern_factors,
    missing_data_factors,
    staff_review_flags,
    grounding_summary,
  };
}

export default buildRecommendationGrounding;