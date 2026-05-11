import {
  buildInterestProfilerAnswerString,
  buildRiasecProfile,
} from "@/lib/onet/interestProfiler";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function cleanString(value) {
  return String(value || "").trim();
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map(cleanString).filter(Boolean)));
}

function isResume(doc) {
  return cleanString(doc?.category).toLowerCase() === "resume";
}

function getDocumentSkills(doc) {
  const summary = cleanString(doc?.ai_summary);
  const insights = cleanString(doc?.ai_insights);

  return uniqueStrings([
    ...toArray(doc?.ai_tags),
    ...toArray(doc?.tags),
    ...toArray(doc?.skills),

    // Pull meaningful phrases from AI analysis
    ...summary.split(/[.,|\n]/),
    ...insights.split(/[.,|\n]/),
  ]);
}

function isWsaAssessment(assessment) {
  const rawType =
    assessment?.assessment_type ||
    assessment?.title ||
    assessment?.name ||
    assessment?.type ||
    "";

  const type = String(rawType)
  .toLowerCase()
  .trim()
  .replace(/_/g, " ");

  console.log("CHECKING ASSESSMENT TYPE:", rawType, "→", type);

  console.log("FULL ASSESSMENT OBJECT:", assessment);
  
  return (
    type.includes("work strategy") ||
    type.includes("strategy assessment") ||
    type.includes("wsa")
  );
}

function getAssessmentText(assessment) {
  const responses = assessment?.responses || {};
  return uniqueStrings([
    assessment?.assessment_type,
    assessment?.title,
    assessment?.name,
    assessment?.summary,
    assessment?.notes,
    ...Object.values(responses),
  ]);
}

function summarizeWsa(wsa = null) {
  if (!wsa) return null;

  const responses = wsa.responses || {};

  const strengths = uniqueStrings([
    ...toArray(responses.current_work_skills),
    ...toArray(responses.work_skill_observations),
    ...toArray(responses.interpersonal_social_skills),
  ]);

  const preferences = uniqueStrings([
    ...toArray(responses.jobs_of_interest),
    ...toArray(responses.recommended_target_occupations),
  ]);

  const environmentNeeds = uniqueStrings([
    ...toArray(responses.recommended_supports_on_job),
    ...toArray(responses.assistive_technology_needs),
    ...toArray(responses.communication_needs),
  ]);

  const barriers = uniqueStrings([
    ...toArray(responses.work_skill_development_needs),
    ...toArray(responses.life_skills_needed),
    ...toArray(responses.family_issues_supports),
    ...toArray(responses.criminal_background),
  ]);

  const scheduleConstraints = uniqueStrings([
    ...toArray(responses.hours_available_to_work),
    ...toArray(responses.planned_job_search_hours_week),
  ]);

  const transportation = uniqueStrings([
    ...toArray(responses.transportation_public),
    ...toArray(responses.transportation_private),
  ]);

// 🔥 NEW: derived insights (rule-based for now)
const insights = [];

// Independent work preference
if (
  preferences.some((p) =>
    String(p).toLowerCase().includes("independent")
  )
) {
  insights.push("prefers independent work");
}

// Avoid customer interaction
if (
  barriers.some((b) =>
    String(b).toLowerCase().includes("social") ||
    String(b).toLowerCase().includes("customer")
  )
) {
  insights.push("avoid customer-facing roles");
}

// Needs structure
if (
  environmentNeeds.some((e) =>
    String(e).toLowerCase().includes("structure") ||
    String(e).toLowerCase().includes("routine")
  )
) {
  insights.push("needs structured and predictable work");
}

// Physical limitations
if (
  barriers.some((b) =>
    String(b).toLowerCase().includes("physical") ||
    String(b).toLowerCase().includes("standing")
  )
) {
  insights.push("limited tolerance for prolonged standing or physical work");
}

// Transportation limitations
if (transportation.length === 0) {
  insights.push("may require transportation support");
}
  
  return {
    assessment_id: wsa.id || "",
    assessment_type: "wsa",

    strengths,
    preferences,
    environment_needs: environmentNeeds,
    barriers,
    schedule_constraints: scheduleConstraints,
    transportation,

    insights,
    
    summary_text: [
      ...strengths,
      ...preferences,
      ...environmentNeeds,
      ...barriers,
    ].join(" | "),

    raw: responses,
  };
}

function isBarriersAssessment(assessment) {
  const rawType = assessment?.assessment_type || "";
  const type = String(rawType).toLowerCase().trim().replace(/_/g, " ");
  return type.includes("barriers") && type.includes("employment");
}

/**
 * Summarize a Barriers to Employment structured assessment into vocational evidence.
 * Maps functional barrier responses into categories consumed by VFP/recommendation layers.
 * Focus: functional workplace impact, not diagnoses.
 */
function summarizeBarriers(barriersRecord = null) {
  if (!barriersRecord) return null;
  const r = barriersRecord.responses || {};

  // ── Barriers (functional limitations) ──
  const barriers = [];
  const sensoryTypes = toArray(r.sensory_barrier_types);
  if (sensoryTypes.length > 0) barriers.push(...sensoryTypes.map(s => `sensory: ${s}`));

  const socialLevel = cleanString(r.social_barrier_level);
  if (socialLevel.toLowerCase().includes("moderate") || socialLevel.toLowerCase().includes("severe")) {
    barriers.push(`social barrier: ${socialLevel}`);
  }
  if (r.task_initiation_difficulty === "yes") barriers.push("task initiation difficulty");
  const memoryImpact = cleanString(r.working_memory_impact);
  if (memoryImpact.toLowerCase().includes("moderate") || memoryImpact.toLowerCase().includes("severe")) {
    barriers.push(`working memory: ${memoryImpact}`);
  }
  if (r.time_management_barrier === "yes") barriers.push("time management barrier");
  const errorPattern = cleanString(r.error_pattern);
  if (errorPattern.toLowerCase().includes("frequent") || errorPattern.toLowerCase().includes("disciplinary")) {
    barriers.push(`error pattern: ${errorPattern}`);
  }
  if (r.attendance_history === "yes") barriers.push("attendance/punctuality history");
  if (r.workplace_conflict_pattern === "yes") barriers.push("workplace conflict pattern");
  if (r.physical_fatigue_pattern === "yes") barriers.push("fatigue affecting work");
  if (r.emotional_job_loss_history === "yes") barriers.push("emotional regulation has caused job loss");

  const exitReasons = toArray(r.primary_exit_reasons);
  if (exitReasons.length > 0) barriers.push(...exitReasons);

  // ── Support needs ──
  const support_needs = [];
  const orgSupports = toArray(r.organization_supports_needed).filter(s => !s.toLowerCase().includes("none"));
  support_needs.push(...orgSupports);

  const accommodations = toArray(r.workplace_accommodations_needed).filter(s => !s.toLowerCase().includes("no accommodations"));
  support_needs.push(...accommodations);

  const coachingLevel = cleanString(r.job_coaching_intensity);
  if (coachingLevel && !coachingLevel.toLowerCase().includes("natural supports only")) {
    support_needs.push(`job coaching: ${coachingLevel}`);
  }

  // ── Environment needs ──
  const environment_needs = [];
  if (sensoryTypes.length > 0) environment_needs.push("sensory accommodation needed");
  const sensory_severity = Number(r.sensory_barrier_severity) || 0;
  if (sensory_severity >= 4) environment_needs.push("high sensory sensitivity — restricted environments required");
  else if (sensory_severity >= 3) environment_needs.push("moderate sensory sensitivity");

  const stressTolerance = Number(r.stress_tolerance_scale) || 0;
  if (stressTolerance <= 2) environment_needs.push("low stress tolerance — low-pressure environment required");

  const triggers = toArray(r.emotional_regulation_triggers);
  if (triggers.length > 0) environment_needs.push(...triggers.map(t => `stress trigger: ${t}`));

  const commBarriers = toArray(r.communication_modality_issues).filter(s => !s.toLowerCase().includes("none"));
  if (commBarriers.length > 0) environment_needs.push(...commBarriers.map(c => `communication barrier: ${c}`));

  // ── Physical limitations / stamina ──
  const physical_limitations = [];
  const standing = cleanString(r.standing_tolerance);
  if (standing && !standing.toLowerCase().includes("no limitation")) physical_limitations.push(`standing: ${standing}`);
  const lifting = cleanString(r.lifting_capacity);
  if (lifting && !lifting.toLowerCase().includes("no lifting restrictions")) physical_limitations.push(`lifting: ${lifting}`);
  const shiftDuration = cleanString(r.shift_duration_tolerance);
  if (shiftDuration && !shiftDuration.toLowerCase().includes("full-time")) physical_limitations.push(`shift tolerance: ${shiftDuration}`);

  // ── Transportation concerns ──
  const transportation = [];
  const transportMethods = toArray(r.transportation_method);
  transportation.push(...transportMethods);
  const reliabilityScore = Number(r.transportation_reliability) || 0;
  if (reliabilityScore <= 2) transportation.push("unreliable transportation");
  const commuteRadius = cleanString(r.commute_radius);
  if (commuteRadius) transportation.push(`commute range: ${commuteRadius}`);
  if (r.shift_constraints === "yes") transportation.push("shift time constraints present");

  // ── Social tolerance concerns ──
  const social_tolerance = [];
  if (socialLevel.toLowerCase().includes("moderate") || socialLevel.toLowerCase().includes("severe")) {
    social_tolerance.push(socialLevel);
  }
  const authorityResponse = cleanString(r.authority_response);
  if (authorityResponse && !authorityResponse.toLowerCase().includes("accepts correction")) {
    social_tolerance.push(`authority response: ${authorityResponse}`);
  }
  const responsePatterns = toArray(r.emotional_response_pattern);
  social_tolerance.push(...responsePatterns.filter(p => !p.toLowerCase().includes("generally manages")));

  // ── Executive function concerns ──
  const executive_function = [];
  if (r.task_initiation_difficulty === "yes") executive_function.push("task initiation difficulty");
  if (memoryImpact.toLowerCase().includes("moderate") || memoryImpact.toLowerCase().includes("severe")) {
    executive_function.push(`working memory: ${memoryImpact}`);
  }
  if (r.time_management_barrier === "yes") executive_function.push("time management barrier");
  if (errorPattern.toLowerCase().includes("frequent") || errorPattern.toLowerCase().includes("disciplinary")) {
    executive_function.push(`error pattern: ${errorPattern}`);
  }

  // ── Emotional regulation / stress ──
  const emotional_regulation = [];
  if (stressTolerance <= 2) emotional_regulation.push("low stress tolerance");
  if (triggers.length > 0) emotional_regulation.push(...triggers);
  const recoveryTime = cleanString(r.recovery_time);
  if (recoveryTime && !recoveryTime.toLowerCase().includes("quickly")) {
    emotional_regulation.push(`recovery: ${recoveryTime}`);
  }

  // ── Staff review flags ──
  const staff_review_flags = [];
  if (r.disclosure_considerations === "yes") staff_review_flags.push("employer disclosure planning needed");
  const unresolvedBarriers = cleanString(r.unresolved_barriers);
  if (unresolvedBarriers) staff_review_flags.push(`unresolved: ${unresolvedBarriers}`);
  const additionalNeeds = toArray(r.additional_assessment_needs).filter(s => !s.toLowerCase().includes("no additional"));
  if (additionalNeeds.length > 0) staff_review_flags.push(...additionalNeeds.map(n => `needs: ${n}`));
  const readiness = cleanString(r.overall_placement_readiness);
  if (readiness && !readiness.toLowerCase().includes("ready for immediate")) {
    staff_review_flags.push(`readiness: ${readiness}`);
  }

  // ── Narrative evidence (best-fit synthesis) ──
  const narratives = {};
  if (r.ideal_job_profile) narratives.ideal_job_profile = r.ideal_job_profile;
  if (r.environments_to_eliminate) narratives.environments_to_eliminate = r.environments_to_eliminate;
  if (r.successful_job_conditions) narratives.successful_job_conditions = r.successful_job_conditions;
  if (r.jobs_that_failed_pattern) narratives.jobs_that_failed_pattern = r.jobs_that_failed_pattern;
  if (r.sensory_barrier_history) narratives.sensory_barrier_history = r.sensory_barrier_history;
  if (r.fatigue_narrative) narratives.fatigue_narrative = r.fatigue_narrative;
  if (r.staff_overall_notes) narratives.staff_overall_notes = r.staff_overall_notes;

  // ── Priority ranking ──
  const barrier_priorities = toArray(r.barrier_priority_ranking);

  // ── Work history patterns ──
  const retention = cleanString(r.job_retention_history);

  // ── Insights (rule-based) ──
  const insights = [];
  if (sensory_severity >= 4) insights.push("requires sensory-controlled environment");
  if (stressTolerance <= 2) insights.push("needs low-stress, low-pressure work");
  if (r.emotional_job_loss_history === "yes") insights.push("emotional regulation coaching critical before placement");
  if (reliabilityScore <= 2) insights.push("transportation barrier must be resolved before job search");
  if (r.task_initiation_difficulty === "yes") insights.push("needs structured start-of-shift routine");
  if (standing.toLowerCase().includes("requires seated")) insights.push("seated work required");
  if (readiness.toLowerCase().includes("not ready")) insights.push("pre-employment barrier resolution needed before job search");

  return {
    assessment_id: barriersRecord.id || "",
    assessment_type: "barriers_to_employment",
    barriers: uniqueStrings(barriers),
    support_needs: uniqueStrings(support_needs),
    environment_needs: uniqueStrings(environment_needs),
    physical_limitations: uniqueStrings(physical_limitations),
    transportation: uniqueStrings(transportation),
    social_tolerance: uniqueStrings(social_tolerance),
    executive_function: uniqueStrings(executive_function),
    emotional_regulation: uniqueStrings(emotional_regulation),
    staff_review_flags: uniqueStrings(staff_review_flags),
    barrier_priorities: uniqueStrings(barrier_priorities),
    narratives,
    insights,
    retention_history: retention || null,
    source_metadata: {
      source: "barriers_to_employment_assessment",
      confidence: barriersRecord.status === "completed" ? "high" : "medium",
      assessed_at: barriersRecord.updated_date || barriersRecord.created_date || null,
    },
    raw: r,
  };
}

function extractRiasecAssessment(assessments = []) {
  return assessments.find((assessment) => {
    const type = String(
      assessment?.assessment_type ||
        assessment?.type ||
        assessment?.title ||
        assessment?.name ||
        ""
    )
      .toLowerCase()
      .trim()
      .replace(/_/g, " ");

    return type.includes("interest") || type.includes("riasec");
  }) || null;
}

function getVfpField(vfp = null, keys = []) {
  if (!vfp) return [];

  return uniqueStrings(
    keys.flatMap((key) =>
      toArray(vfp?.[key]).map((item) => {
        if (typeof item === "string") return item;
        if (item?.fact) return item.fact;
        if (item?.value) return item.value;
        if (item?.label) return item.label;
        return "";
      })
    )
  );
}

function summarizeVfp(vfp = null) {
  if (!vfp) return null;

  return {
    profile_id: vfp.id || "",
    strengths: getVfpField(vfp, [
      "strengths",
      "work_strengths",
      "skills",
      "resume_skills",
    ]),
    preferences: getVfpField(vfp, [
  "preferences",
  "work_preferences",
  "job_preferences",
  "career_interests",
  "jobs_of_interest",
  "target_occupations",
  "interests",
  "preferred_tasks",
  "goals",
  "work_environment_preferences",
]),
   environment_needs: getVfpField(vfp, [
  "environment_needs",
  "work_environment_needs",
  "support_needs",
  "accommodations",
  "work_environment_preferences",
  "job_readiness_level",
]),
    barriers: getVfpField(vfp, [
      "barriers",
      "work_barriers",
      "limitations",
      "support_barriers",
    ]),
    schedule_constraints: getVfpField(vfp, [
      "schedule_constraints",
      "availability",
      "preferred_schedule",
      "hours_available",
    ]),
    transportation: getVfpField(vfp, [
      "transportation",
      "transportation_needs",
      "commute_limitations",
    ]),
    job_titles: getVfpField(vfp, [
      "job_titles",
      "preferred_job_titles",
      "recommended_jobs",
      "target_jobs",
    ]),
    raw: vfp,
  };
}

export function buildRecommendationInputs({
  documents = [],
  assessments = [],
  vocationalProfile = null, // ✅ NEW (VFP)
} = {}) {
  const resumes = documents.filter(isResume);
  const wsaAssessments = assessments.filter(isWsaAssessment);
  console.log("WSA ASSESSMENTS FOUND:", wsaAssessments);
  const barriersAssessments = assessments.filter(isBarriersAssessment);
  const otherAssessments = assessments.filter(
    (assessment) => !isWsaAssessment(assessment) && !isBarriersAssessment(assessment)
  );

  const resumeSkills = uniqueStrings(
    resumes.flatMap((doc) => getDocumentSkills(doc))
  );

  const wsa = wsaAssessments[0] || null;
  console.log("FULL WSA OBJECT:", wsa);
  console.log("FULL WSA RESPONSES:", wsa?.responses);
  console.log("FULL WSA RESPONSE KEYS:", Object.keys(wsa?.responses || {}));

  const barriers = barriersAssessments[0] || null;
  const summarizedBarriers = summarizeBarriers(barriers);
  console.log("BARRIERS ASSESSMENT FOUND:", !!barriers, summarizedBarriers?.barriers?.length ?? 0, "barriers");

  const assessmentKeywords = uniqueStrings(
    otherAssessments.flatMap(getAssessmentText)
  );

  const summarizedWsa = summarizeWsa(wsa);
  const summarizedVfp = summarizeVfp(vocationalProfile);

const interestAssessment = extractRiasecAssessment(assessments);

let interestProfile = null;
let onetAnswerString = null;

if (interestAssessment) {
  const responses = interestAssessment.responses || {};

  const answers =
    interestAssessment.answers ||
    responses.answers ||
    [];

  const scores =
    interestAssessment.riasec_scores ||
    responses.riasec_scores ||
    responses.scores ||
    {};

  interestProfile = buildRiasecProfile({
    scores,
    answers,
  });

  onetAnswerString =
    responses.answerString ||
    responses.answer_string ||
    responses.onet_answer_string ||
    interestAssessment.answerString ||
    interestAssessment.answer_string ||
    interestAssessment.onet_answer_string ||
    buildInterestProfilerAnswerString(answers);

  console.log("RIASEC PROFILE:", interestProfile);
  console.log("ONET ANSWER STRING:", onetAnswerString);
}

// Barriers assessment evidence — augments VFP/WSA without overwriting stronger sources
const barriersBarriers = summarizedBarriers?.barriers || [];
const barriersEnvironmentNeeds = summarizedBarriers?.environment_needs || [];
const barriersTransportation = summarizedBarriers?.transportation || [];
const barriersSupportNeeds = summarizedBarriers?.support_needs || [];
const barriersPhysicalLimitations = summarizedBarriers?.physical_limitations || [];
const barriersSocialTolerance = summarizedBarriers?.social_tolerance || [];
const barriersExecutiveFunction = summarizedBarriers?.executive_function || [];
const barriersEmotionalRegulation = summarizedBarriers?.emotional_regulation || [];
const barriersInsights = summarizedBarriers?.insights || [];

const combined_profile = {
  resume_skills: summarizedVfp?.strengths?.length
    ? summarizedVfp.strengths
    : resumeSkills,

  wsa_strengths: summarizedVfp?.strengths?.length
    ? summarizedVfp.strengths
    : uniqueStrings([
        ...(summarizedWsa?.strengths || []),
        ...(summarizedWsa?.insights || []),
      ]),

  wsa_preferences: summarizedVfp?.preferences?.length
    ? summarizedVfp.preferences
    : summarizedWsa?.preferences || [],

  // Environment needs: VFP > Barriers > WSA (merge Barriers into VFP/WSA rather than override)
  wsa_environment_needs: uniqueStrings([
    ...(summarizedVfp?.environment_needs?.length
      ? summarizedVfp.environment_needs
      : summarizedWsa?.environment_needs || []),
    ...barriersEnvironmentNeeds,
  ]),

  // Barriers: VFP wins if strong, else merge Barriers assessment evidence
  wsa_barriers: uniqueStrings([
    ...(summarizedVfp?.barriers?.length
      ? summarizedVfp.barriers
      : summarizedWsa?.barriers || []),
    ...barriersBarriers,
  ]),

  wsa_schedule_constraints: summarizedVfp?.schedule_constraints?.length
    ? summarizedVfp.schedule_constraints
    : summarizedWsa?.schedule_constraints || [],

  // Transportation: VFP > merge Barriers > WSA
  wsa_transportation: uniqueStrings([
    ...(summarizedVfp?.transportation?.length
      ? summarizedVfp.transportation
      : summarizedWsa?.transportation || []),
    ...barriersTransportation,
  ]),

  // Barriers-specific evidence fields (new — not previously in combined_profile)
  barriers_support_needs: barriersSupportNeeds,
  barriers_physical_limitations: barriersPhysicalLimitations,
  barriers_social_tolerance: barriersSocialTolerance,
  barriers_executive_function: barriersExecutiveFunction,
  barriers_emotional_regulation: barriersEmotionalRegulation,
  barriers_staff_flags: summarizedBarriers?.staff_review_flags || [],
  barriers_insights: barriersInsights,
  barriers_narratives: summarizedBarriers?.narratives || {},

  assessment_keywords: assessmentKeywords,

  job_titles: summarizedVfp?.job_titles?.length
    ? summarizedVfp.job_titles
    : uniqueStrings(resumes.flatMap((doc) => toArray(doc?.job_titles))),
};

  return {
    resumes: resumes.map((doc) => ({
      ...doc,
      skills: getDocumentSkills(doc),
    })),
    vocationalProfile: summarizedVfp,
    wsa: summarizedWsa,
    barriers: summarizedBarriers,
    otherAssessments,
    assessments_summary: {
      wsa_strengths: summarizedWsa?.strengths || [],
      wsa_preferences: summarizedWsa?.preferences || [],
      wsa_environment_needs: summarizedWsa?.environment_needs || [],
      wsa_barriers: summarizedWsa?.barriers || [],
      wsa_schedule_constraints: summarizedWsa?.schedule_constraints || [],
      wsa_transportation: summarizedWsa?.transportation || [],

      // Barriers assessment summary
      barriers_barriers: barriersBarriers,
      barriers_support_needs: barriersSupportNeeds,
      barriers_environment_needs: barriersEnvironmentNeeds,
      barriers_physical_limitations: barriersPhysicalLimitations,
      barriers_transportation: barriersTransportation,
      barriers_social_tolerance: barriersSocialTolerance,
      barriers_executive_function: barriersExecutiveFunction,
      barriers_emotional_regulation: barriersEmotionalRegulation,
      barriers_staff_flags: summarizedBarriers?.staff_review_flags || [],
      barriers_insights: barriersInsights,

      other_assessment_keywords: assessmentKeywords,
    },
    interestProfile,
    onet_answer_string: onetAnswerString,
    combined_profile,
    active_sources: {
      resumes: resumes.length,
      wsa: wsaAssessments.length,
      barriers_assessment: barriersAssessments.length,
      other_assessments: otherAssessments.length,
    },
    source_resume_ids: resumes.map((doc) => doc.id).filter(Boolean),
    source_wsa_ids: wsaAssessments.map((assessment) => assessment.id).filter(Boolean),
    source_barriers_ids: barriersAssessments.map((assessment) => assessment.id).filter(Boolean),
    source_other_assessment_ids: otherAssessments.map((assessment) => assessment.id).filter(Boolean),
  };
}