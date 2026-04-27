import { buildOnetRecommendationProfile } from "@/lib/onet/onetClient";
import { base44 } from "@/api/base44Client";
import { getOnetRecommendations } from "@/lib/recommendations/getOnetRecommendations";
import { generateJobCoachResponse } from "@/lib/recommendations/generateJobCoachResponse";
import {
  buildClientConstraints,
  applyConstraintRules,
  resolveFitLevel,
} from "@/lib/recommendations/constraintRules";

function resolveConfidenceLevel({
  score = 0,
  fitConcerns = [],
  profile = {},
}) {
  const hasResume = (profile.resume_skills || []).length > 0;
  const hasWSA = (profile.wsa_strengths || []).length > 0;
  const hasAssessments = (profile.assessment_keywords || []).length > 0;
  const hasRiasec = profile.interest_profile && Object.keys(profile.interest_profile).length > 0;

  const dataScore =
    (hasResume ? 1 : 0) +
    (hasWSA ? 2 : 0) +
    (hasAssessments ? 1 : 0) +
    (hasRiasec ? 2 : 0);

  const hasConflicts = fitConcerns.length > 0;

  // HIGH CONFIDENCE
  if (score >= 70 && !hasConflicts && dataScore >= 3) {
    return {
      confidence_level: "high",
      confidence_reason:
        "Strong match with no conflicts and supported by multiple data sources (resume, WSA, or assessments).",
    };
  }

  // MEDIUM CONFIDENCE (THIS IS THE KEY FIX)
  if (
    (score >= 40 && !hasConflicts) ||
    (score >= 55 && hasConflicts) ||
    (dataScore >= 3 && score >= 25)
  ) {
    return {
      confidence_level: "medium",
      confidence_reason:
        "Reasonable match with some supporting data. May require staff review but is a viable option.",
    };
  }

  // LOW CONFIDENCE
  return {
    confidence_level: "low",
    confidence_reason:
      "Lower match score, limited supporting data, or fit concerns are present. This recommendation should be reviewed carefully.",
  };
}

export async function generateRecommendationBatch({
  client,
  resumes = [],
  vocationalProfile = null,
  wsa = null,
  otherAssessments = [],
  interestProfile = null,
  onet_answer_string = null,
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

 // 🔥 Insight-based scoring
const insights = profile?.wsa?.insights || [];

const jobText = `${job.title || ""} ${job.description || ""}`.toLowerCase();

// Prefer independent work
if (
  insights.includes("prefers independent work") &&
  jobText.includes("independent")
) {
  score += 15;
}

// Avoid customer-facing roles
if (
  insights.includes("avoid customer-facing roles") &&
  (
    jobText.includes("customer") ||
    jobText.includes("cashier") ||
    jobText.includes("retail") ||
    jobText.includes("sales")
  )
) {
  score = Math.max(0, score - 40);
}

// Needs structure
if (
  insights.includes("needs structured and predictable work") &&
  (
    jobText.includes("routine") ||
    jobText.includes("structured")
  )
) {
  score += 10;
}

// Physical limitation penalty
if (
  insights.includes("limited tolerance for prolonged standing or physical work") &&
  (
    jobText.includes("labor") ||
    jobText.includes("warehouse") ||
    jobText.includes("construction")
  )
) {
  score = Math.max(0, score - 50);
}

  if (score > 100) score = 100;
  if (score < 0) score = 0;

const notFitReasons = [
  ...(constraintResult.not_fit_reasons || []),
];

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

  return {
  ...job,
  match_score: score,
  fit_concerns: fitConcerns,
  not_fit_reasons: constraintResult.not_fit_reasons || [],
  recommended_environments:
    constraintResult.recommended_environments || [],
  fit_level: resolveFitLevel({
    score,
    fitConcerns,
  }),
  confidence_level: confidence.confidence_level,
  confidence_reason: confidence.confidence_reason,
  constraint_codes: constraintProfile.constraints.map((c) => c.code),
};
});

const recommendationsWithConstraints = processed
.filter((job) => job.match_score > 0)
  .sort((a, b) => {
    const confidenceRank = { high: 3, medium: 2, low: 1 };

    const confDiff =
      (confidenceRank[b.confidence_level] || 0) -
      (confidenceRank[a.confidence_level] || 0);

    if (confDiff !== 0) return confDiff;

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
  const localBatch = {
    client_id: client?.id,
    recommended_job_fields_json: JSON.stringify(recommendationsWithConstraints),
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
