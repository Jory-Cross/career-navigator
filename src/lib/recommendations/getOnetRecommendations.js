import { buildOnetSummary } from "@/lib/recommendations/buildOnetSummary";
import { getInterestProfilerCareers } from "@/lib/onet/onetClient";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(values.map((v) => String(v || "").toLowerCase().trim()).filter(Boolean))
  );
}

function getConflictKeywords(profile = {}) {
  const text = [
    ...toArray(profile.wsa_strengths),
    ...toArray(profile.wsa_themes),
    ...toArray(profile.wsa_barriers),
    ...toArray(profile.vocational_themes),
  ].join(" ").toLowerCase();

  const conflicts = [];

  if (text.includes("overwhelm") || text.includes("overstimulation") || text.includes("overstimulated")) {
    conflicts.push("high social environments");
  }

  if (text.includes("prefers to work alone") || text.includes("work alone") || text.includes("independent")) {
    conflicts.push("customer-facing roles");
  }

  if (text.includes("communication difficulty")) {
    conflicts.push("high communication jobs");
  }

  return conflicts;
}

function getFitConcerns(job, conflicts = []) {
  const title = safeLower(job?.title);
  const concerns = [];

  if (conflicts.includes("customer-facing roles") && title.includes("customer")) {
    concerns.push("Customer-facing work may conflict with a preference for independent work.");
  }

  if (conflicts.includes("high social environments") && title.includes("service")) {
    concerns.push("This role may involve higher social demand or overstimulating environments.");
  }

  if (conflicts.includes("high communication jobs") && (title.includes("customer") || title.includes("support"))) {
    concerns.push("This role may require frequent communication that should be reviewed before pursuing.");
  }

  return concerns;
}

function getFitStrengths({
  resumeMatches = [],
  wsaStrengthMatches = [],
  wsaThemeMatches = [],
  wsaGoalMatches = [],
}) {
  const strengths = [];

  if (resumeMatches.length > 0) {
    strengths.push(`Resume skill match: ${resumeMatches.join(", ")}`);
  }

  if (wsaStrengthMatches.length > 0) {
    strengths.push(`WSA strength match: ${wsaStrengthMatches.join(", ")}`);
  }

  if (wsaThemeMatches.length > 0) {
    strengths.push(`WSA theme match: ${wsaThemeMatches.join(", ")}`);
  }

  if (wsaGoalMatches.length > 0) {
    strengths.push(`WSA job goal match: ${wsaGoalMatches.join(", ")}`);
  }

  return strengths;
}

function getFitLevel(score, fitConcerns = []) {
  if (fitConcerns.length > 0) return "caution";
  if (score >= 12) return "strong";
  if (score > 0) return "possible";
  return "low";
}

const JOB_PROFILES = [
  {
    title: "Office Assistant",
    keywords: ["data entry", "administrative", "organization", "clerical", "computer", "office"],
  },
  {
    title: "Customer Service Representative",
    keywords: ["customer service", "communication", "support", "phone", "people", "interpersonal"],
  },
  {
    title: "Direct Support Professional",
    keywords: ["support", "caregiving", "assistance", "daily living", "helping", "community"],
  },
  {
    title: "Food Service Worker",
    keywords: ["food", "service", "kitchen", "customer", "restaurant"],
  },
  {
    title: "Janitorial / Custodial Worker",
    keywords: ["cleaning", "janitorial", "custodial", "maintenance", "detail", "routine"],
  },
  {
    title: "Warehouse Associate",
    keywords: ["inventory", "warehouse", "shipping", "receiving", "stocking"],
  },
];

function normalizeKeywords(values = []) {
  return uniqueStrings(
    values.flatMap((v) => {
      const str = String(v || "").toLowerCase();

      if (str.length > 60) return [];

      return str
        .split(/[,\-\/]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2 && s.length < 40);
    })
  );
}

function buildProfileText(profile = {}) {
  return uniqueStrings([
    ...normalizeKeywords(profile.resume_skills),
    ...normalizeKeywords(profile.wsa_strengths),
    ...normalizeKeywords(profile.wsa_preferences),
    ...normalizeKeywords(profile.wsa_environment_needs),
    ...normalizeKeywords(profile.wsa_barriers),
    ...normalizeKeywords(profile.assessment_keywords),
    ...normalizeKeywords(profile.job_titles),
  ]);
}

function normalizeOnetCareerItem(item = {}, index = 0) {
  const title =
    item.title ||
    item.career_title ||
    item.name ||
    item.occupation_title ||
    "O*NET Career Match";

  const code =
    item.code ||
    item.onet_code ||
    item.soc_code ||
    item.occupation_code ||
    `ONET-${index + 1}`;

  return {
    onet_code: code,
    title,
    href: item.href || item.url || null,
    bright_outlook: Boolean(item.bright_outlook),
    green: Boolean(item.green),
    apprenticeship: Boolean(item.apprenticeship),
    score: Number(item.score || item.fit_score || item.match_score || 80),
    match_score: Number(item.score || item.fit_score || item.match_score || 80),
    fit_level: "possible",
    fit_strengths: ["Matched from O*NET Interest Profiler career results."],
    fit_concerns: [],
    matched_keywords: [],
    match_reason: "Matched from O*NET Interest Profiler RIASEC career results.",
    source: "onet-interest-profiler",
  };
}

function countMatches(keywords = [], profileKeywords = []) {
  return keywords.filter((keyword) => {
    const key = safeLower(keyword);

    return profileKeywords.some((profileKeyword) => {
      const value = safeLower(profileKeyword);
      return value === key || value.includes(key) || key.includes(value);
    });
  });
}

export async function getOnetRecommendations(profile = {}) {
  const profileKeywords = buildProfileText(profile);

  console.log("O*NET PROFILE KEYWORDS:", profileKeywords);

  if (
  profileKeywords.length === 0 &&
  !profile?.onet_profile?.answers &&
  !profile?.onet_answer_string
) {
  return {
    source: "empty-profile",
    items: [],
    onet_summary: buildOnetSummary([]),
  };
}

if (profile?.onet_profile?.answers || profile?.onet_answer_string) {
  const onetCareers = await getInterestProfilerCareers({
    answers: profile?.onet_profile?.answers || profile?.onet_answer_string,
  });

  const careers = toArray(onetCareers?.career || onetCareers?.careers || onetCareers?.items)
    .map((item, index) => normalizeOnetCareerItem(item, index));

  if (careers.length > 0) {
    return {
      source: "onet-interest-profiler",
      items: careers,
      onet_summary: buildOnetSummary(careers),
    };
  }
}
  
  const conflicts = getConflictKeywords(profile);

  const results = JOB_PROFILES.map((job, index) => {
    const matches = countMatches(job.keywords, profileKeywords);

    const resumeMatches = countMatches(job.keywords, toArray(profile.resume_skills));
    const wsaStrengthMatches = countMatches(job.keywords, toArray(profile.wsa_strengths));
    const wsaPreferenceMatches = countMatches(job.keywords, toArray(profile.wsa_preferences));
const wsaEnvironmentMatches = countMatches(job.keywords, toArray(profile.wsa_environment_needs));

    const baseScore =
  resumeMatches.length * 2 +
  wsaStrengthMatches.length * 4 +
  wsaPreferenceMatches.length * 8 +
  wsaEnvironmentMatches.length * 6;

    const fit_concerns = getFitConcerns(job, conflicts);
    const fit_strengths = getFitStrengths({
  resumeMatches,
  wsaStrengthMatches,
  wsaThemeMatches: wsaPreferenceMatches,
  wsaGoalMatches: wsaEnvironmentMatches,
});

    let score = baseScore;

    if (fit_concerns.length > 0) {
      score -= fit_concerns.length * 6;
    }

    score = Math.max(score, 0);

    return {
      onet_code: `TEMP-${index + 1}`,
      title: job.title,
      href: null,
      bright_outlook: false,
      green: false,
      apprenticeship: false,
      score,
      fit_level: getFitLevel(score, fit_concerns),
      fit_strengths,
      fit_concerns,
      matched_keywords: matches,
      match_reason:
        matches.length > 0
          ? `Matched based on: ${matches.join(", ")}`
          : "General entry-level recommendation",
    };
  });

  const filtered = results
    .filter((r) => r.score > 0 || r.fit_concerns.length > 0)
    .sort((a, b) => b.score - a.score);

  return {
    source: "scored-fallback",
    items: filtered,
    onet_summary: buildOnetSummary(filtered),
  };
}
