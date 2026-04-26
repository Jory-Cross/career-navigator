import { getOnetRecommendations } from "@/lib/recommendations/getOnetRecommendations";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function safeText(value) {
  return String(value || "").trim();
}

function pickResumeSkills(resumeDocs = []) {
  const docs = Array.isArray(resumeDocs) ? resumeDocs : [];

  return uniqueStrings(
    docs.flatMap((doc) => [
      ...toArray(doc?.ai_tags),
      ...toArray(doc?.tags),
    ])
  );
}

function buildOtherAssessmentSummary(otherAssessments = []) {
  const items = Array.isArray(otherAssessments) ? otherAssessments : [];

  const keywords = uniqueStrings(
    items.flatMap((item) => [
      ...toArray(item?.keywords),
      ...toArray(item?.tags),
      ...toArray(item?.findings),
      safeText(item?.summary),
    ])
  );

  return {
    count: items.length,
    keywords,
    narrative:
      keywords.length > 0
        ? `Other assessment signals include: ${keywords.slice(0, 8).join(", ")}.`
        : "No additional assessment signals were summarized yet.",
  };
}

function buildCombinedProfile({
  resumes = [],
  wsa = {},
  otherAssessments = [],
}) {
  const resume_skills = pickResumeSkills(resumes);

  const wsa_strengths = uniqueStrings([
  ...toArray(wsa?.strengths),
]);

const wsa_preferences = uniqueStrings([
  ...toArray(wsa?.preferences),
]);

const wsa_environment_needs = uniqueStrings([
  ...toArray(wsa?.environment_needs),
]);

const wsa_barriers = uniqueStrings([
  ...toArray(wsa?.barriers),
]);

const wsa_schedule_constraints = uniqueStrings([
  ...toArray(wsa?.schedule_constraints),
]);

const wsa_transportation = uniqueStrings([
  ...toArray(wsa?.transportation),
]);
  const other_summary = buildOtherAssessmentSummary(otherAssessments);

  const assessment_keywords = uniqueStrings([
    ...other_summary.keywords,
    ...wsa_strengths,
    ...wsa_themes,
    ...wsa_job_goals,
  ]);

  const vocational_themes = uniqueStrings([
    ...wsa_themes,
  ]);

  const job_titles = uniqueStrings([
    ...wsa_job_goals,
  ]);

  return {
    resume_skills,
    wsa_strengths,
    wsa_themes,
    wsa_barriers,
    wsa_job_goals,
    assessment_keywords,
    vocational_themes,
    job_titles,
    source_counts: {
      resumes: Array.isArray(resumes) ? resumes.length : 0,
      other_assessments: Array.isArray(otherAssessments) ? otherAssessments.length : 0,
    },
    summaries: {
      wsa_summary: {
        strengths: wsa_strengths,
        themes: wsa_themes,
        barriers: wsa_barriers,
        job_goals: wsa_job_goals,
        narrative:
          wsa_strengths.length > 0
            ? `WSA strengths include ${wsa_strengths.slice(0, 6).join(", ")}.`
            : "No WSA strengths were summarized yet.",
      },
      other_summary,
    },
  };
}

function buildNarrativeExplanation({
  combinedProfile,
  onetSummary,
}) {
  const parts = [];

  if (combinedProfile.resume_skills.length > 0) {
    parts.push(
      `Resume signals suggest strengths in ${combinedProfile.resume_skills.slice(0, 8).join(", ")}.`
    );
  }

  if (combinedProfile.summaries.wsa_summary.strengths.length > 0) {
    parts.push(combinedProfile.summaries.wsa_summary.narrative);
  }

  if (combinedProfile.summaries.wsa_summary.themes.length > 0) {
    parts.push(
      `WSA themes include ${combinedProfile.summaries.wsa_summary.themes.slice(0, 6).join(", ")}.`
    );
  }

  if (combinedProfile.summaries.wsa_summary.job_goals.length > 0) {
    parts.push(
      `Client job goals include ${combinedProfile.summaries.wsa_summary.job_goals.slice(0, 6).join(", ")}.`
    );
  }

  if (combinedProfile.summaries.other_summary.count > 0) {
    parts.push(combinedProfile.summaries.other_summary.narrative);
  }

  if (onetSummary?.narrative) {
    parts.push(onetSummary.narrative);
  }

  if (parts.length === 0) {
    return "Not enough client profile data was available to generate a full recommendation explanation yet.";
  }

  return parts.join(" ");
}

function buildJobFitReasoning(onetHighlights = []) {
  const items = Array.isArray(onetHighlights) ? onetHighlights : [];

  return items.slice(0, 5).map((item) => ({
    onet_code: item?.onet_code || "",
    title: item?.title || "",
    reasoning: "This occupation aligned with resume skills, WSA signals, assessment data, and O*NET results.",
    bright_outlook: Boolean(item?.bright_outlook),
    green: Boolean(item?.green),
    apprenticeship: Boolean(item?.apprenticeship),
  }));
}

function buildSuggestedDirections(onetHighlights = []) {
  return (Array.isArray(onetHighlights) ? onetHighlights : [])
    .slice(0, 5)
    .map((item) => ({
      title: item?.title || "",
      onet_code: item?.onet_code || "",
      href: item?.href || null,
    }));
}

export async function buildRecommendationPayload({
  client,
  resumes = [],
  wsa = {},
  otherAssessments = [],
}) {
  const combined_profile = buildCombinedProfile({
    resumes,
    wsa,
    otherAssessments,
  });

  const onetResult = await getOnetRecommendations(combined_profile);
  const onet_summary = onetResult?.onet_summary || {
    top_titles: [],
    top_codes: [],
    highlights: [],
    narrative: "No O*NET occupations were returned for this client profile yet.",
  };

  const ai_coach_summary = {
    narrative_explanation: buildNarrativeExplanation({
      combinedProfile: combined_profile,
      onetSummary: onet_summary,
    }),
    job_fit_reasoning: buildJobFitReasoning(onet_summary.highlights),
    suggested_directions: buildSuggestedDirections(onet_summary.highlights),
    future_guidance: [],
  };

  return {
    client_id: client?.id || "",
    active_sources: uniqueStrings([
      resumes.length > 0 ? "resume" : "",
      wsa && Object.keys(wsa).length > 0 ? "wsa" : "",
      otherAssessments.length > 0 ? "other_assessments" : "",
      "onet",
    ]),
    source_resume_ids: uniqueStrings(resumes.map((item) => item?.id || "")),
    source_wsa_ids: uniqueStrings([wsa?.id || ""]),
    source_other_assessment_ids: uniqueStrings(
      otherAssessments.map((item) => item?.id || "")
    ),
    wsa_summary: combined_profile.summaries.wsa_summary,
    combined_profile,
    recommendations: onet_summary.highlights,
    onet_summary,
    ai_coach_summary,
    status: "draft",
    reviewed_by: "",
    approved_recommendation: null,
  };
}

export async function getRecommendations(args = {}) {
  return buildRecommendationPayload(args);
}
