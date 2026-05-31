import { buildOnetRecommendationProfile } from "@/lib/onet/onetClient";
import { base44 } from "@/api/base44Client";
import { getOnetRecommendations } from "@/lib/recommendations/getOnetRecommendations";
import { generateJobCoachResponse } from "@/lib/recommendations/generateJobCoachResponse";
import {
  buildClientConstraints,
  applyConstraintRules,
  resolveFitLevel,
} from "@/lib/recommendations/constraintRules";
import { buildRecommendationGrounding } from "@/lib/recommendations/buildRecommendationGrounding.js";
import { buildConstraintFit } from "@/lib/recommendations/buildConstraintFit.js";
import { buildRecommendationPriority, extractPriorityContext } from "@/lib/recommendations/buildRecommendationPriority.js";
import { evaluateVFPMaturity } from "@/lib/vfpMaturity.js";

function resolveConfidenceLevel({
  score = 0,
  fitConcerns = [],
  profile = {},
  groundingEvidenceTier = null,   // "strong"|"moderate"|"weak" from grounding layer
  conflictScore = 0,              // environmental/functional conflict severity (0–6+)
  constraintFitLevel = "unknown", // overall_fit_level from buildConstraintFit
}) {
  const hasResume = (profile.resume_skills || []).length > 0;
  const hasWSA = (profile.wsa_strengths || []).length > 0;
  const hasAssessments = (profile.assessment_keywords || []).length > 0;
  const hasRiasec = profile.interest_profile && Object.keys(profile.interest_profile).length > 0;

  const dataScore =
    (hasResume ? 1 : 0) +
    (hasWSA ? 2 : 0) +
    (hasAssessments ? 1 : 0) +
    (hasRiasec ? 1 : 0); // RIASEC reduced from 2→1: shouldn't dominate confidence alone

  const hasConflicts = fitConcerns.length > 0;

  // Evidence tier modifier
  const evidenceBoost = groundingEvidenceTier === "strong" ? 5
    : groundingEvidenceTier === "weak" ? -10
    : 0;

  // Conflict penalty: environmental conflicts reduce effective confidence score
  // Severe conflicts (5+) = -25, moderate (3-4) = -15, mild (1-2) = -5
  const conflictPenalty = conflictScore >= 5 ? 25
    : conflictScore >= 3 ? 15
    : conflictScore >= 1 ? 5
    : 0;

  // Environmental fit penalty
  const fitPenalty = constraintFitLevel === "poor_fit" ? 20
    : constraintFitLevel === "caution" ? 10
    : 0;

  const effectiveScore = score + evidenceBoost - conflictPenalty - fitPenalty;

  // HIGH CONFIDENCE — requires strong evidence base AND no severe conflicts
  if (
    effectiveScore >= 70 &&
    !hasConflicts &&
    dataScore >= 3 &&
    groundingEvidenceTier !== "weak" &&
    conflictScore < 3 &&
    constraintFitLevel !== "poor_fit" &&
    constraintFitLevel !== "caution"
  ) {
    return {
      confidence_level: "high",
      confidence_reason: groundingEvidenceTier === "strong"
        ? "Strong match supported by specific, corroborated vocational evidence across multiple sources."
        : "Strong match with no conflicts and supported by multiple data sources (resume, WSA, or assessments).",
    };
  }

  // MEDIUM CONFIDENCE
  if (
    (effectiveScore >= 40 && !hasConflicts && conflictScore < 4) ||
    (effectiveScore >= 55 && hasConflicts && conflictScore < 3) ||
    (dataScore >= 3 && effectiveScore >= 30 && conflictScore < 4)
  ) {
    const weakCaveat = groundingEvidenceTier === "weak"
      ? " Evidence is general — gather more specific vocational data before acting."
      : "";
    const conflictCaveat = conflictScore >= 2
      ? " Some environmental conflicts present — review fit carefully."
      : "";
    return {
      confidence_level: "medium",
      confidence_reason: `Reasonable match with some supporting data. May require staff review but is a viable option.${weakCaveat}${conflictCaveat}`,
    };
  }

  // LOW CONFIDENCE
  const weakNote = groundingEvidenceTier === "weak"
    ? " Evidence is primarily general or inferred."
    : "";
  const conflictNote = conflictScore >= 3
    ? " Environmental/functional conflicts reduce fit confidence."
    : "";
  return {
    confidence_level: "low",
    confidence_reason: `Lower match score, limited supporting data, or fit concerns are present. This recommendation should be reviewed carefully.${weakNote}${conflictNote}`,
  };
}

// ── SAVED RECOMMENDATION PAYLOAD COMPACTION ──────────────────────────────────
// Recommendation generation uses rich analysis objects while processing.
// Base44 stores the final recommendation array in a JSON text field with a
// limited maximum size. Save only the nested fields currently rendered by the
// recommendation review cards while preserving all standard top-level fields,
// including O*NET code and Job Zone.

function compactRecommendationForStorage(job = {}) {
  const grounding = job.grounding || null;
  const constraintFit = job.constraint_fit || null;
  const priority = job.priority || null;

  return {
    // Occupation identity and O*NET preparation information
    onet_code: job.onet_code || null,
    title: job.title || job.job_title || "Untitled Recommendation",
    source_url: job.source_url || job.href || null,
    bright_outlook: !!job.bright_outlook,
    green: !!job.green,
    apprenticeship: !!job.apprenticeship,
    job_zone: job.job_zone ?? null,
    job_zone_title: job.job_zone_title || null,

    // Recommendation scoring and visible reasoning
    match_score: job.match_score ?? null,
    fit_score: job.fit_score ?? null,
    match_reason: job.match_reason || "",
    matched_keywords: (job.matched_keywords || []).slice(0, 6),
    fit_strengths: (job.fit_strengths || []).slice(0, 3),
    fit_concerns: (job.fit_concerns || []).slice(0, 3),
    not_fit_reasons: (job.not_fit_reasons || []).slice(0, 3),
    constraint_codes: (job.constraint_codes || []).slice(0, 6),
    confidence_level: job.confidence_level || "low",
    confidence_reason: job.confidence_reason || "",

    // Staff and client review workflow fields
    status: job.status || null,
    review_notes: job.review_notes || "",
    reviewed_by: job.reviewed_by || null,
    reviewed_at: job.reviewed_at || null,
    reviewed_by_staff: !!job.reviewed_by_staff,
    shared_with_client: !!job.shared_with_client,
    client_response: job.client_response || null,
    client_responded_at: job.client_responded_at || null,
    client_response_notes: job.client_response_notes || "",

    // Visible Why This Recommendation panel
    grounding: grounding
      ? {
          supported_by: (grounding.supported_by || []).slice(0, 4),
          supporting_sources: (grounding.supporting_sources || []).slice(0, 4),
          confidence_factors: (grounding.confidence_factors || []).slice(0, 3),
          concern_factors: (grounding.concern_factors || []).slice(0, 3),
          missing_data_factors: (grounding.missing_data_factors || []).slice(0, 3),
          grounding_summary: grounding.grounding_summary || "",
          staff_review_flags: (grounding.staff_review_flags || []).slice(0, 4),
        }
      : null,

    // Visible Environmental Fit and Staff Should Verify panels
    constraint_fit: constraintFit
      ? {
          overall_fit_level: constraintFit.overall_fit_level || "unknown",
          hard_constraints: (constraintFit.hard_constraints || []).slice(0, 3),
          moderate_constraints: (constraintFit.moderate_constraints || []).slice(0, 3),
          soft_preferences: (constraintFit.soft_preferences || []).slice(0, 3),
          unknowns: (constraintFit.unknowns || []).slice(0, 3),
          environmental_fit_summary:
            constraintFit.environmental_fit_summary || "",
          occupation_notes: (constraintFit.occupation_notes || []).slice(0, 3),
          occupation_profile_label:
            constraintFit.occupation_profile_label || null,
          staff_verification_needed:
            (constraintFit.staff_verification_needed || []).slice(0, 4),
        }
      : null,

    // Visible Recommendation Priority panel
    priority: priority
      ? {
          priority_level: priority.priority_level || "unknown",
          priority_reason: priority.priority_reason || "",
          priority_factors: (priority.priority_factors || []).slice(0, 6),
          staff_action: priority.staff_action || "",
        }
      : null,
  };
}

export async function generateRecommendationBatch({
  client,
  resumes = [],
  vocationalProfile = null,
  wsa = null,
  barriers = null,     // summarized Barriers to Employment assessment
  otherAssessments = [],
  interestProfile = null,
  onet_answer_string = null,
  rawVfp = null,       // raw VFP object for grounding (vocational_facts_profile)
} = {}) {
    const profile = {
    resume_skills: vocationalProfile?.strengths?.length
      ? vocationalProfile.strengths
      : resumes.flatMap((r) => r.skills || []),

    wsa_strengths: vocationalProfile?.strengths?.length
      ? vocationalProfile.strengths
      : wsa?.strengths || [],

    wsa_preferences: vocationalProfile?.preferences?.length
      ? vocationalProfile.preferences
      : wsa?.preferences || [],

    wsa_environment_needs: vocationalProfile?.environment_needs?.length
      ? vocationalProfile.environment_needs
      : wsa?.environment_needs || [],

    wsa_barriers: vocationalProfile?.barriers?.length
      ? vocationalProfile.barriers
      : wsa?.barriers || [],

    wsa_schedule_constraints: vocationalProfile?.schedule_constraints?.length
      ? vocationalProfile.schedule_constraints
      : wsa?.schedule_constraints || [],

    wsa_transportation: vocationalProfile?.transportation?.length
      ? vocationalProfile.transportation
      : wsa?.transportation || [],

    assessment_keywords: otherAssessments.flatMap((a) => a.keywords || []),

    job_titles: vocationalProfile?.job_titles?.length
      ? vocationalProfile.job_titles
      : resumes.flatMap((r) => r.job_titles || []),

    vocational_themes: vocationalProfile?.preferences?.length
      ? vocationalProfile.preferences
      : wsa?.themes || [],

    riasec_scores:
      otherAssessments.find((a) => a.riasec_scores)?.riasec_scores || {},

    interest_profile: interestProfile,
    vocational_profile: vocationalProfile,
    wsa,
    other_assessments: otherAssessments,
  };

  const constraintProfile = buildClientConstraints(profile);

  // Build maturity evaluation for grounding context
  const vfpMaturity = evaluateVFPMaturity({
    vfp: rawVfp,
    client,
    documents: resumes,
    assessments: otherAssessments,
  });

  // Grounding context passed to each recommendation
  // Provide multiple fallback paths so buildConstraintFit always finds the VFP
  const resolvedVfp = rawVfp || vocationalProfile?.raw || null;
  console.log("CONSTRAINT FIT HAS VFP (batch):", !!resolvedVfp, resolvedVfp ? Object.keys(resolvedVfp) : "none");

  const groundingContext = {
    vfp: resolvedVfp,
    vocationalProfile,
    wsa,
    barriers,
    resumes,
    interestProfile,
    otherAssessments,
    maturity: vfpMaturity,
    profile,
  };

  const onetProfile = buildOnetRecommendationProfile({
    riasecProfile: interestProfile,
    onetAnswerString: onet_answer_string,
  });

  console.log("RECOMMENDATION PROFILE:", profile);
  console.log("CLIENT CONSTRAINT PROFILE:", constraintProfile);
  console.log("O*NET RECOMMENDATION PROFILE:", onetProfile);

  const cleanedProfile = {
    ...profile,
    resume_skills: profile.resume_skills.filter(
      (s) => !["customer service", "retail", "sales"].includes(s.toLowerCase())
    ),
    assessment_keywords: profile.assessment_keywords.filter(
      (s) => !["customer service", "retail", "sales"].includes(s.toLowerCase())
    ),
    vocational_themes: profile.vocational_themes.filter(
      (s) => !["customer service", "retail", "sales"].includes(s.toLowerCase())
    ),
  };

  const result = await getOnetRecommendations({
    ...cleanedProfile,
    onet_profile: onetProfile,
    interest_profile: interestProfile,
    onet_answer_string,
  });

// 🔴 HARD STOP if O*NET returned an error
if (result?.error) {
  console.error("O*NET ERROR:", result.error);

  return {
    batch: {
      client_id: client?.id,
      recommendations: [],
      summary: {},
      source: "onet-error",
      job_count: 0,
      generated_at: new Date().toISOString(),
      generated_by: "ai",
      error: result.error, // ✅ THIS IS THE KEY
    },
    payload: result,
  };
}
  
  const processed = (result?.items || []).map((job) => {
  const constraintResult = applyConstraintRules(
    job,
    constraintProfile.constraints
  );

  const existingConcerns = Array.isArray(job.fit_concerns)
    ? job.fit_concerns
    : [];

  const fitConcerns = Array.from(
    new Set([...existingConcerns, ...constraintResult.fit_concerns])
  );

  let baseScore =
    Number(job.match_score) ||
    Number(job.score) ||
    Number(job.fit_score) ||
    0;

  let score = baseScore;

 // Severity-based scoring
constraintProfile.constraints.forEach((constraint) => {
  const applies =
    constraintResult.fit_concerns.includes(constraint.concern);

  if (!applies) return;

  if (constraint.severity === "hard") {
    score = 0;
  }

  if (constraint.severity === "moderate") {
    score = Math.max(0, score - 30);
  }

  if (constraint.severity === "soft") {
    score = Math.max(0, score - 10);
  }
});

  const riskText = `${job.title || ""} ${job.match_reason || ""}`.toLowerCase();

  if (
    riskText.includes("customer") ||
    riskText.includes("cashier") ||
    riskText.includes("retail") ||
    riskText.includes("restaurant") ||
    riskText.includes("sales")
  ) {
    if (
      constraintProfile.preferredEnvironments.includes(
        "limited_customer_contact"
      )
    ) {
      score = 0;
    }
  }

  const envText = `${job.title || ""} ${job.description || ""}`.toLowerCase();

 // 🔥 Insight-based scoring — barriers + WSA evidence adjustments
const insights = [
  ...(profile?.wsa?.insights || []),
  ...(barriers?.insights || []),
];

const jobText = `${job.title || ""} ${job.description || ""}`.toLowerCase();
const jobTitle = (job.title || "").toLowerCase();

// ── POSITIVE ADJUSTMENTS ────────────────────────────────────────────────
// Prefer independent work
if (insights.includes("prefers independent work") && jobText.includes("independent")) {
  score += 15;
}
// Needs structure — reward structured/routine roles
if (insights.includes("needs structured and predictable work") &&
    (jobText.includes("routine") || jobText.includes("structured"))) {
  score += 10;
}
// Calm/low-stimulation job match
if (insights.includes("needs low-stress, low-pressure work") &&
    (jobText.includes("quiet") || jobText.includes("routine") || jobText.includes("low-stress"))) {
  score += 10;
}

// ── NEGATIVE ADJUSTMENTS (score penalties) ──────────────────────────────
// Avoid customer-facing roles
if (insights.includes("avoid customer-facing roles") &&
    (jobText.includes("customer") || jobText.includes("cashier") ||
     jobText.includes("retail") || jobText.includes("sales"))) {
  score = Math.max(0, score - 40);
}

// Physical limitation (WSA) — standing/labor
if (insights.includes("limited tolerance for prolonged standing or physical work") &&
    (jobText.includes("labor") || jobText.includes("warehouse") ||
     jobText.includes("construction") || jobText.includes("standing"))) {
  score = Math.max(0, score - 50);
}

// Seated work required — penalize physically demanding roles
if (insights.includes("seated work required") &&
    (jobText.includes("labor") || jobText.includes("warehouse") ||
     jobText.includes("standing") || jobText.includes("dishwasher") ||
     jobText.includes("construction") || jobText.includes("manual"))) {
  score = Math.max(0, score - 50);
}

// Sensory needs — penalize loud/chaotic environments
if (insights.includes("requires sensory-controlled environment") &&
    (jobText.includes("restaurant") || jobText.includes("fast food") ||
     jobText.includes("warehouse") || jobText.includes("call center") ||
     jobText.includes("factory") || jobText.includes("loud") ||
     jobText.includes("crowded") || jobText.includes("busy"))) {
  score = Math.max(0, score - 40);
}

// Low stress tolerance — penalize fast-paced/high-pressure
if (insights.includes("needs low-stress, low-pressure work") &&
    (jobText.includes("fast-paced") || jobText.includes("high volume") ||
     jobText.includes("deadline") || jobText.includes("urgent") ||
     jobText.includes("pressure") || jobText.includes("on-call") ||
     jobText.includes("high-stress") || jobText.includes("emergency"))) {
  score = Math.max(0, score - 35);
}

// Social/emotional limitations — penalize intensive public-facing/performance roles
const hasSocialBarriers = insights.some(i =>
  i.includes("avoid customer-facing") || i.includes("low social") || i.includes("social limitations")
);
const isHighSocialDemand =
  jobTitle.includes("actor") || jobTitle.includes("actress") ||
  jobTitle.includes("performer") || jobTitle.includes("entertainer") ||
  jobTitle.includes("advertising sales") || jobTitle.includes("sales agent") ||
  jobTitle.includes("telemarketer") || jobTitle.includes("real estate agent") ||
  jobTitle.includes("flight attendant") || jobTitle.includes("tour guide");
if (hasSocialBarriers && isHighSocialDemand) {
  score = Math.max(0, score - 45);
}

// Acute care / emergency — penalize if stress limitations present
const hasStressBarriers = insights.some(i =>
  i.includes("low-stress") || i.includes("low stress") || i.includes("stress tolerance")
);
const isAcuteCare =
  jobTitle.includes("acute care") || jobTitle.includes("emergency") ||
  jobTitle.includes("trauma") || jobTitle.includes("icu") ||
  jobTitle.includes("intensive care") || jobTitle.includes("first responder");
if (hasStressBarriers && isAcuteCare) {
  score = Math.max(0, score - 40);
}

  if (score > 100) score = 100;
  if (score < 0) score = 0;

let notFitReasons = [
  ...(constraintResult.not_fit_reasons || []),
];

// Add additional reasons
if (score < 40) {
  notFitReasons.push({
    text: `${job.title || "This role"} has a lower overall match score based on the available client data.`,
    priority: 3,
  });
}

if (!profile.resume_skills?.length && !profile.wsa_strengths?.length) {
  notFitReasons.push({
    text: "There is limited resume or WSA data available to support this recommendation.",
    priority: 3,
  });
}

if (fitConcerns.length > 0) {
  notFitReasons.push({
    text: `${job.title || "This role"} should be reviewed because one or more client constraints may affect fit.`,
    priority: 2,
  });
}

// Normalize constraint reasons (priority 1 = highest)
notFitReasons = [
  ...notFitReasons.map((r) =>
    typeof r === "string"
      ? { text: r, priority: 1 }
      : r
  ),
];

// Sort by priority
notFitReasons.sort((a, b) => a.priority - b.priority);

// Return top 3 only
notFitReasons = notFitReasons.slice(0, 3).map((r) => r.text);

if (score < 40) {
  notFitReasons.push(
    `${job.title || "This role"} has a lower overall match score based on the available client data.`
  );
}

if (!profile.resume_skills?.length && !profile.wsa_strengths?.length) {
  notFitReasons.push(
    "There is limited resume or WSA data available to support this recommendation."
  );
}

if (fitConcerns.length > 0) {
  notFitReasons.push(
    `${job.title || "This role"} should be reviewed because one or more client constraints may affect fit.`
  );
}
    
  const confidence = resolveConfidenceLevel({
    score,
    fitConcerns,
    profile,
  });

  const groundedJob = {
    ...job,
    match_score: score,
    fit_concerns: fitConcerns,
    not_fit_reasons: notFitReasons,
    recommended_environments: constraintResult.recommended_environments || [],
    fit_level: resolveFitLevel({ score, fitConcerns }),
    confidence_level: confidence.confidence_level,
    confidence_reason: confidence.confidence_reason,
    constraint_codes: constraintProfile.constraints.map((c) => c.code),
  };

  // Attach grounding object (explainability layer)
  try {
    groundedJob.grounding = buildRecommendationGrounding(groundedJob, groundingContext);
  } catch (e) {
    console.error("[generateRecommendationBatch] buildRecommendationGrounding failed for:", groundedJob.title, e);
    groundedJob.grounding = null;
  }

  // Attach constraint fit layer (severity + environmental analysis)
  try {
    groundedJob.constraint_fit = buildConstraintFit(groundedJob, groundingContext);
  } catch (e) {
    console.error("[generateRecommendationBatch] buildConstraintFit failed for:", groundedJob.title, e);
    groundedJob.constraint_fit = null;
  }

  // Re-resolve confidence using evidence tier from grounding + conflict signals
  const groundingEvidenceTier = groundedJob.grounding?.evidence_richness?.tier || null;
  const constraintFitLevel = groundedJob.constraint_fit?.overall_fit_level || "unknown";
  // Compute conflict score for confidence calibration (mirrors priority layer logic)
  const hardCount = (groundedJob.constraint_fit?.hard_constraints || []).length;
  const moderateCount = (groundedJob.constraint_fit?.moderate_constraints || []).length;
  const fitPenaltyConflict =
    (hardCount >= 2 ? 5 : hardCount === 1 ? 3 : 0) +
    (moderateCount >= 3 ? 3 : moderateCount >= 2 ? 2 : moderateCount === 1 ? 1 : 0) +
    (constraintFitLevel === "poor_fit" ? 4 : constraintFitLevel === "caution" ? 2 : 0);

  const recalibratedConfidence = resolveConfidenceLevel({
    score,
    fitConcerns,
    profile,
    groundingEvidenceTier,
    conflictScore: fitPenaltyConflict,
    constraintFitLevel,
  });
  groundedJob.confidence_level = recalibratedConfidence.confidence_level;
  groundedJob.confidence_reason = recalibratedConfidence.confidence_reason;

  // Attach priority/ranking layer
  try {
    // Pass full groundingContext so priority layer sees barriers, interestProfile, resumes
    const priorityContext = extractPriorityContext(groundedJob, groundingContext);
    groundedJob.priority = buildRecommendationPriority(groundedJob, priorityContext);
  } catch (e) {
    console.error("[generateRecommendationBatch] buildRecommendationPriority failed for:", groundedJob.title, e);
    groundedJob.priority = {
      priority_level: "unknown",
      priority_reason: "Could not assess priority",
      priority_factors: [],
      staff_action: "Review manually",
    };
  }

  console.log("[generateRecommendationBatch] enriched job:", {
    title: groundedJob.title,
    hasGrounding: !!groundedJob.grounding,
    hasConstraintFit: !!groundedJob.constraint_fit,
    priority: groundedJob.priority?.priority_level,
  });

  return groundedJob;
});

console.log("FIRST REC CONSTRAINT FIT:", processed[0]?.constraint_fit?.overall_fit_level, processed[0]?.title);

// ── MULTI-FACTOR PRIORITY-AWARE SORT ────────────────────────────────────────
// Priority order (higher = better rank):
//   strong_target(5) > explore_further(4) > stretch(3) > caution(2) > low_priority(1) > unknown(0)
// Within the same priority bucket: sort by confidence, then match_score.
// This ensures environmental conflicts that demote priority actually affect ranking,
// not just labeling.
const priorityRank = {
  strong_target: 5,
  explore_further: 4,
  stretch: 3,
  caution: 2,
  low_priority: 1,
  unknown: 0,
};
const confidenceRank = { high: 3, medium: 2, low: 1 };

const recommendationsWithConstraints = processed
  .filter((job) => job.match_score > 0)
  .sort((a, b) => {
    const aPriority = priorityRank[a.priority?.priority_level] ?? 0;
    const bPriority = priorityRank[b.priority?.priority_level] ?? 0;

    // Primary: priority level (most important — reflects all evidence)
    if (bPriority !== aPriority) return bPriority - aPriority;

    // Secondary: confidence level (within same priority bucket)
    const aConf = confidenceRank[a.confidence_level] || 0;
    const bConf = confidenceRank[b.confidence_level] || 0;
    if (bConf !== aConf) return bConf - aConf;

    // Tertiary: match score (tie-breaker)
    return (b.match_score || 0) - (a.match_score || 0);
  });

          const aiCoachText = await generateJobCoachResponse({
    recommendations: recommendationsWithConstraints,
    profile: {
      ...profile,
      constraints: constraintProfile.constraints,
      preferred_environments: constraintProfile.preferredEnvironments,
      active_sources: {
        vocational_profile: vocationalProfile ? 1 : 0,
        resumes: resumes.length,
        wsa: wsa ? 1 : 0,
        other_assessments: otherAssessments.length,
      },
    },
  });

  const recommendationsForStorage =
    recommendationsWithConstraints.map(compactRecommendationForStorage);

    console.log(
    "RECOMMENDATION STORAGE PAYLOAD SIZE:",
    JSON.stringify(recommendationsForStorage).length
  );

  const storageFieldSizeBreakdown = recommendationsForStorage.reduce(
    (totals, recommendation) => {
      Object.entries(recommendation).forEach(([key, value]) => {
        const fieldSize = JSON.stringify(value ?? null).length;
        totals[key] = (totals[key] || 0) + fieldSize;
      });
      return totals;
    },
    {}
  );

   console.log(
    "RECOMMENDATION STORAGE FIELD SIZE BREAKDOWN TEXT:",
    Object.entries(storageFieldSizeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([field, size]) => `${field}: ${size}`)
      .join(" | ")
  );

    console.log(
    "FIRST STORED RECOMMENDATION FIELD SIZE BREAKDOWN TEXT:",
    Object.entries(recommendationsForStorage[0] || {})
      .map(([field, value]) => ({
        field,
        size: JSON.stringify(value ?? null).length,
      }))
      .sort((a, b) => b.size - a.size)
      .map(({ field, size }) => `${field}: ${size}`)
      .join(" | ")
  );

  const nestedStorageSizeBreakdown = recommendationsForStorage.reduce(
    (totals, recommendation) => {
      Object.entries(recommendation.grounding || {}).forEach(([key, value]) => {
        const field = `grounding.${key}`;
        totals[field] = (totals[field] || 0) + JSON.stringify(value ?? null).length;
      });

      Object.entries(recommendation.constraint_fit || {}).forEach(([key, value]) => {
        const field = `constraint_fit.${key}`;
        totals[field] = (totals[field] || 0) + JSON.stringify(value ?? null).length;
      });

      Object.entries(recommendation.priority || {}).forEach(([key, value]) => {
        const field = `priority.${key}`;
        totals[field] = (totals[field] || 0) + JSON.stringify(value ?? null).length;
      });

      return totals;
    },
    {}
  );

  console.log(
    "NESTED RECOMMENDATION STORAGE FIELD SIZE BREAKDOWN TEXT:",
    Object.entries(nestedStorageSizeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([field, size]) => `${field}: ${size}`)
      .join(" | ")
  );

  const localBatch = {
    client_id: client?.id,
     recommended_job_fields_json: JSON.stringify(recommendationsForStorage),
    summary: {
      ...(result?.onet_summary || {}),
      constraints: constraintProfile.constraints,
      preferred_environments: constraintProfile.preferredEnvironments,
    },
    source: result?.source || "scored-fallback",
    search_summary:
      result?.onet_summary?.narrative || "Generated recommendations",
    job_count: recommendationsWithConstraints.length,
    generated_at: new Date().toISOString(),
    generated_by: "ai",
    ai_coach_summary: aiCoachText,
  };

  console.log("LOCAL BATCH BEFORE SAVE:", localBatch);

  try {
    const savedBatch =
      await base44.entities.JobRecommendationBatch.create(localBatch);
    console.log("SAVED RECOMMENDATION BATCH:", savedBatch);
  } catch (err) {
    console.error("Failed to save recommendation batch", err);
  }

  return {
    batch: {
      ...localBatch,
      recommendations: recommendationsWithConstraints,
    },
    payload: {
      ...result,
      items: recommendationsWithConstraints,
    },
  };
}

export default generateRecommendationBatch;
