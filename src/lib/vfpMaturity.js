/**
 * VFP Profile Maturity + Confidence Engine
 *
 * Pure utility — no React, no side effects.
 * Input: { vfp, client, documents, assessments }
 * Output: { maturity_level, confidence_level, confidence_score, reasons, next_steps, source_coverage }
 *
 * Do NOT modify VFP data. This is display/intelligence metadata only.
 */

// ── DOMAIN COVERAGE CHECK ─────────────────────────────────────────────────────
// For each major vocational domain, list the VFP fields that satisfy it.
const DOMAIN_FIELDS = {
  skills: ["skills", "strengths"],
  interests: ["interests", "preferred_industries"],
  goals: ["goals", "work_goal_themes", "preferred_job_titles"],
  transportation: ["transportation", "transportation_reliability", "transportation_limitations"],
  schedule: ["schedule_availability", "schedule_constraints", "work_availability", "schedule_preferences"],
  support_needs: ["support_needs"],
  physical_restrictions: ["physical_restrictions", "accommodation_needs"],
  social_communication: ["social_communication_needs", "communication_style", "social_tolerance"],
  sensory_environment: ["sensory_environmental_needs", "sensory_limitations"],
  work_environment: ["work_environment_preferences", "preferred_work_environment"],
  barriers: ["barriers", "disability_related_considerations"],
  job_readiness: ["job_readiness_level", "onboarding_readiness", "documentation_readiness"],
};

function domainHasData(vfp, fieldList) {
  return fieldList.some(f => Array.isArray(vfp[f]) ? vfp[f].length > 0 : !!vfp[f]);
}

function countCoveredDomains(vfp) {
  return Object.values(DOMAIN_FIELDS).filter(fields => domainHasData(vfp, fields)).length;
}

// ── SOURCE TYPE DETECTION ─────────────────────────────────────────────────────
// Infers which source types are present based on documents and assessments arrays,
// plus VFP internal metadata.

function detectSourceTypes({ vfp, client, documents = [], assessments = [] }) {
  const sources = new Set();

  // Intake: if any intake signals exist on the VFP
  if (vfp?._intake_extracted_at || vfp?._intake_signals) {
    sources.add("intake");
  }

  // Resume / work history
  const hasResume = documents.some(d =>
    d.category === "resume" ||
    (d.file_name || "").toLowerCase().includes("resume") ||
    (d.title || "").toLowerCase().includes("resume")
  ) || client?.resume_file_url;
  if (hasResume) sources.add("resume");

  // WSA (Work Strategy Assessment)
  const hasWSA = documents.some(d =>
    (d.document_subtype || "").toLowerCase().includes("wsa") ||
    (d.title || "").toLowerCase().includes("work strategy") ||
    (d.title || "").toLowerCase().includes("wsa")
  ) || assessments.some(a =>
    a.assessment_type === "work_strategy_assessment" ||
    (a.notes || "").toLowerCase().includes("wsa")
  );
  if (hasWSA) sources.add("wsa");

  // O*NET Interest Profiler
  const hasONet = assessments.some(a =>
    a.assessment_type === "riasec" ||
    a.assessment_type === "interest_profiler" ||
    (a.notes || "").toLowerCase().includes("o*net") ||
    (a.notes || "").toLowerCase().includes("onet") ||
    (a.notes || "").toLowerCase().includes("interest profiler")
  );
  if (hasONet) sources.add("onet_interest_profiler");

  // Other structured assessments
  const otherAssessTypes = ["career_goals", "skills_audit", "job_search_readiness", "interview_readiness"];
  if (assessments.some(a => otherAssessTypes.includes(a.assessment_type))) {
    sources.add("structured_assessment");
  }

  // Staff notes / support notes (from document category or assessment notes fields)
  const hasStaffNotes = documents.some(d => d.category === "notes") ||
    documents.some(d => d.category === "other" && d.notes);
  if (hasStaffNotes) sources.add("staff_notes");

  // Generic uploaded documents (non-resume, non-notes)
  const hasOtherDocs = documents.some(d =>
    !["resume", "notes"].includes(d.category) &&
    d.category !== "generated_report"
  );
  if (hasOtherDocs) sources.add("documents");

  return Array.from(sources);
}

// ── SOURCE QUALITY WEIGHTS ────────────────────────────────────────────────────
const SOURCE_WEIGHTS = {
  wsa: 3,
  onet_interest_profiler: 3,
  resume: 2,
  structured_assessment: 2,
  intake: 1,
  documents: 1,
  staff_notes: 1,
};

function sourceQualityScore(sourceTypes) {
  return sourceTypes.reduce((sum, s) => sum + (SOURCE_WEIGHTS[s] || 1), 0);
}

// ── FRESHNESS CHECK ───────────────────────────────────────────────────────────
function profileAgeDays(vfp, client) {
  const extractedAt =
    client?.vocational_facts_extracted_at ||
    vfp?._intake_extracted_at ||
    null;
  if (!extractedAt) return null;
  return Math.floor((Date.now() - new Date(extractedAt).getTime()) / (1000 * 60 * 60 * 24));
}

// ── MAIN EVALUATOR ─────────────────────────────────────────────────────────────
export function evaluateVFPMaturity({ vfp, client, documents = [], assessments = [] }) {
  if (!vfp) {
    return {
      maturity_level: null,
      confidence_level: null,
      confidence_score: 0,
      reasons: ["No vocational facts have been extracted yet."],
      next_steps: ["Run the VFP extraction to begin building a profile."],
      source_coverage: [],
    };
  }

  const sourceTypes = detectSourceTypes({ vfp, client, documents, assessments });
  const sourceCount = sourceTypes.length;
  const qualityScore = sourceQualityScore(sourceTypes);

  const coveredDomains = countCoveredDomains(vfp);
  const totalDomains = Object.keys(DOMAIN_FIELDS).length; // 12
  const domainCoverage = coveredDomains / totalDomains;

  const missingCount = vfp.missing_critical_data?.length || 0;
  const conflictCount = vfp.conflicts?.length || 0;
  const ageDays = profileAgeDays(vfp, client);
  const isStale = ageDays !== null && ageDays > 90;

  const hasIntakeOnly = sourceTypes.length === 1 && sourceTypes[0] === "intake";
  const hasResume = sourceTypes.includes("resume");
  const hasWSA = sourceTypes.includes("wsa");
  const hasONet = sourceTypes.includes("onet_interest_profiler");
  const hasStructuredAssessment = sourceTypes.includes("structured_assessment");

  // ── MATURITY LEVEL ──────────────────────────────────────────────────────────
  let maturity_level;
  if (sourceCount === 0 || (sourceCount === 1 && sourceTypes[0] === "intake" && domainCoverage < 0.35)) {
    maturity_level = "Early Intake Profile";
  } else if (qualityScore >= 6 && coveredDomains >= 8 && (hasResume || hasWSA || hasONet)) {
    maturity_level = "Comprehensive Vocational Profile";
  } else if ((hasResume || hasWSA || hasONet || hasStructuredAssessment) && sourceCount >= 2) {
    maturity_level = "Multi-Source Profile";
  } else {
    maturity_level = "Foundational Profile";
  }

  // ── CONFIDENCE SCORE (0–100) ────────────────────────────────────────────────
  let score = 0;

  // Source diversity (max 35)
  score += Math.min(35, sourceCount * 7);

  // Source quality weight (max 25)
  score += Math.min(25, qualityScore * 3);

  // Domain coverage (max 25)
  score += Math.round(domainCoverage * 25);

  // Deductions
  score -= Math.min(15, missingCount * 3);   // missing data
  score -= Math.min(10, conflictCount * 5);  // conflicts
  if (isStale) score -= 8;                   // stale profile

  score = Math.max(0, Math.min(100, score));

  const confidence_level =
    score >= 65 ? "High" :
    score >= 35 ? "Moderate" :
    "Low";

  // ── REASON SENTENCES ────────────────────────────────────────────────────────
  const reasons = [];

  if (hasIntakeOnly) {
    reasons.push("Only intake data is currently available.");
  } else {
    const sourceLabels = {
      intake: "intake form",
      resume: "resume / work history",
      wsa: "Work Strategy Assessment (WSA)",
      onet_interest_profiler: "O*NET Interest Profiler",
      structured_assessment: "structured assessments",
      documents: "uploaded documents",
      staff_notes: "staff notes",
    };
    const listedSources = sourceTypes.map(s => sourceLabels[s] || s).join(", ");
    reasons.push(`Sources available: ${listedSources}.`);
  }

  if (!hasResume) reasons.push("Resume / work history has not been added.");
  if (!hasONet) reasons.push("O*NET Interest Profiler is missing.");
  if (!hasWSA) reasons.push("Work Strategy Assessment (WSA) is missing.");

  if (missingCount > 0) {
    reasons.push(`${missingCount} critical data point${missingCount !== 1 ? "s" : ""} are missing from the profile.`);
  }

  if (conflictCount > 0) {
    reasons.push(`${conflictCount} conflict${conflictCount !== 1 ? "s" : ""} exist and should be reviewed before relying on recommendations.`);
  }

  const missingDomains = Object.entries(DOMAIN_FIELDS)
    .filter(([, fields]) => !domainHasData(vfp, fields))
    .map(([domain]) => domain.replace(/_/g, " "));

  if (missingDomains.length > 0 && missingDomains.length <= 4) {
    reasons.push(`Incomplete domains: ${missingDomains.join(", ")}.`);
  } else if (missingDomains.length > 4) {
    reasons.push(`Many vocational domains are still incomplete (${missingDomains.length} of ${totalDomains}).`);
  }

  if (sourceCount >= 3 && conflictCount === 0) {
    reasons.push("Multiple sources support the same vocational direction.");
  }

  if (isStale) {
    reasons.push(`Profile was last extracted ${ageDays} days ago — consider refreshing.`);
  }

  // ── NEXT STEPS ──────────────────────────────────────────────────────────────
  const next_steps = [];

  if (!hasResume) next_steps.push("Upload or build a resume to add work history context.");
  if (!hasONet) next_steps.push("Complete the O*NET Interest Profiler assessment.");
  if (!hasWSA) next_steps.push("Complete a Work Strategy Assessment (WSA).");
  if (conflictCount > 0) next_steps.push("Review flagged conflicts with the client before using recommendations.");
  if (missingCount > 0) next_steps.push("Fill in missing critical data in intake sections.");
  if (isStale) next_steps.push("Re-extract the Vocational Facts Profile to reflect recent updates.");
  if (next_steps.length === 0 && confidence_level !== "High") {
    next_steps.push("Continue building out assessments and documents to strengthen the profile.");
  }

  // ── SOURCE COVERAGE SUMMARY ──────────────────────────────────────────────────
  const source_coverage = [
    { label: "Intake Form", present: sourceTypes.includes("intake") },
    { label: "Resume / Work History", present: hasResume },
    { label: "Work Strategy Assessment", present: hasWSA },
    { label: "O*NET Interest Profiler", present: hasONet },
    { label: "Structured Assessments", present: hasStructuredAssessment },
    { label: "Uploaded Documents", present: sourceTypes.includes("documents") },
    { label: "Staff Notes", present: sourceTypes.includes("staff_notes") },
  ];

  return {
    maturity_level,
    confidence_level,
    confidence_score: score,
    reasons,
    next_steps,
    source_coverage,
    // raw for future use
    _meta: {
      source_types: sourceTypes,
      source_count: sourceCount,
      quality_score: qualityScore,
      covered_domains: coveredDomains,
      total_domains: totalDomains,
      missing_count: missingCount,
      conflict_count: conflictCount,
      age_days: ageDays,
    },
  };
}