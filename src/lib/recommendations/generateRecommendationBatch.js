import { base44 } from "@/api/base44Client";
import { getOnetRecommendations } from "@/lib/recommendations/getOnetRecommendations";
import { generateJobCoachResponse } from "@/lib/recommendations/generateJobCoachResponse";
import {
  buildClientConstraints,
  applyConstraintRules,
  resolveFitLevel,
} from "@/lib/recommendations/constraintRules";

export async function generateRecommendationBatch({
  client,
  resumes = [],
  wsa = null,
  otherAssessments = [],
} = {}) {
  const profile = {
    resume_skills: resumes.flatMap((r) => r.skills || []),
    wsa_strengths: wsa?.strengths || [],
    assessment_keywords: otherAssessments.flatMap((a) => a.keywords || []),
    job_titles: resumes.flatMap((r) => r.job_titles || []),
    vocational_themes: wsa?.themes || [],
    riasec_scores: otherAssessments.find((a) => a.riasec_scores)?.riasec_scores || {},
    wsa,
    other_assessments: otherAssessments,
  };

  const constraintProfile = buildClientConstraints(profile);

  console.log("RECOMMENDATION PROFILE:", profile);
  console.log("CLIENT CONSTRAINT PROFILE:", constraintProfile);

  const result = await getOnetRecommendations(profile);

  const recommendationsWithConstraints = (result?.items || []).map((job) => {
    const constraintResult = applyConstraintRules(
      job,
      constraintProfile.constraints
    );

    const existingConcerns = Array.isArray(job.fit_concerns)
      ? job.fit_concerns
      : [];

    const fitConcerns = Array.from(
      new Set([
        ...existingConcerns,
        ...constraintResult.fit_concerns,
      ])
    );

    let score =
  Number(job.match_score) ||
  Number(job.score) ||
  Number(job.fit_score) ||
  0;

// BOOST score if job aligns with preferred environments
const envText = `${job.title || ""} ${job.description || ""}`.toLowerCase();

const preferred = constraintProfile.preferredEnvironments || [];

if (preferred.includes("independent_work") && envText.includes("custodial")) {
  score += 10;
}

if (preferred.includes("low_stimulation") && envText.includes("clean")) {
  score += 5;
}

if (preferred.includes("structured_routine") && envText.includes("routine")) {
  score += 5;
}

// PENALIZE score if conflicts exist
if (constraintResult.fit_concerns.length > 0) {
  score -= constraintResult.fit_concerns.length * 10;
}

// Clamp score
if (score > 100) score = 100;
if (score < 0) score = 0;

   return {
  ...job,
  match_score: score,
  fit_concerns: fitConcerns,
      recommended_environments:
        constraintResult.recommended_environments || [],
      fit_level: resolveFitLevel({
        score,
        fitConcerns,
      }),
      constraint_codes: constraintProfile.constraints.map((c) => c.code),
    };
  });

  const aiCoachText = await generateJobCoachResponse({
    recommendations: recommendationsWithConstraints,
    profile: {
      ...profile,
      constraints: constraintProfile.constraints,
      preferred_environments: constraintProfile.preferredEnvironments,
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
    search_summary: result?.onet_summary?.narrative || "Generated recommendations",
    job_count: recommendationsWithConstraints.length,
    generated_at: new Date().toISOString(),
    generated_by: "ai",
    ai_coach_summary: aiCoachText,
  };

  console.log("LOCAL BATCH BEFORE SAVE:", localBatch);

  try {
    const savedBatch = await base44.entities.JobRecommendationBatch.create(localBatch);
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
