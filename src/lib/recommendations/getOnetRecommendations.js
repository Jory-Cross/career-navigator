import { buildOnetSummary } from "@/lib/recommendations/buildOnetSummary";
import { getInterestProfilerCareers } from "@/lib/onet/onetClient";
import { base44 } from "@/api/base44Client";
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
  ...toArray(profile.wsa_preferences),
  ...toArray(profile.wsa_environment_needs),
  ...toArray(profile.wsa_barriers),
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

function normalizeOnetCareerItem(
  item = {},
  index = 0,
  profileKeywords = [],
  conflicts = []
) {
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

  const loweredTitle = safeLower(title);

  const matchedKeywords = profileKeywords.filter((keyword) =>
    loweredTitle.includes(safeLower(keyword))
  );

  let score =
    Number(item.score || item.fit_score || item.match_score || 50);

  score += matchedKeywords.length * 5;

  const fit_concerns = [];

  if (
    conflicts.includes("customer-facing roles") &&
    (
      loweredTitle.includes("customer") ||
      loweredTitle.includes("bartender") ||
      loweredTitle.includes("server") ||
      loweredTitle.includes("attendant")
    )
  ) {
    fit_concerns.push(
      "This role may conflict with preference for independent or lower-social work."
    );

    score -= 25;
  }

  if (
    conflicts.includes("high social environments") &&
    (
      loweredTitle.includes("service") ||
      loweredTitle.includes("attendant") ||
      loweredTitle.includes("bartender")
    )
  ) {
    fit_concerns.push(
      "This role may involve overstimulating or highly social environments."
    );

    score -= 20;
  }

  score = Math.max(score, 0);

  return {
    onet_code: code,
    title,
    href: item.href || item.url || null,
    bright_outlook: Boolean(item.bright_outlook),
    green: Boolean(item.green),
    apprenticeship: Boolean(item.apprenticeship),

    score,
    match_score: score,

    fit_level:
      fit_concerns.length > 0
        ? "caution"
        : score >= 85
        ? "strong"
        : score >= 60
        ? "possible"
        : "low",

    fit_strengths:
      matchedKeywords.length > 0
        ? [`Matched profile themes: ${matchedKeywords.join(", ")}`]
        : ["Matched from O*NET Interest Profiler career results."],

    fit_concerns,

    matched_keywords: matchedKeywords,

    match_reason:
      matchedKeywords.length > 0
        ? `Matched using profile themes: ${matchedKeywords.join(", ")}`
        : "Matched from O*NET Interest Profiler RIASEC career results.",

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

// 🔴 HARD REQUIREMENT: completed O*NET Interest Profiler answer string must exist
const answers =
  profile?.onet_profile?.answerString ||
  profile?.onet_profile?.answer_string ||
  profile?.onet_profile?.onet_answer_string ||
  profile?.onet_profile?.answers ||
  profile?.answerString ||
  profile?.answer_string ||
  profile?.onet_answer_string ||
  "";

const normalizedAnswers = String(answers || "").replace(/[^1-5]/g, "");

if (normalizedAnswers.length < 30) {
  console.error("Interest Profiler not completed — blocking recommendations");

  return {
    source: "missing-interest-profiler",
    items: [],
    onet_summary: null,
    error: "Interest Profiler must be completed before generating recommendations.",
  };
}
  
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

// 🔥 ALWAYS TRY O*NET FIRST (via backend proxy)
try {
  const response = await base44.functions.invoke("onetProxy", {
  path: "/mnm/interestprofiler/careers",
  params: {
    answers: normalizedAnswers,
  },
});

  const raw = response?.data?.data;

  const careers = toArray(
    raw?.career || raw?.careers || raw?.items
  ).map((item, index) => normalizeOnetCareerItem(item, index));

  if (careers.length > 0) {
    return {
      source: "onet-live",
      items: careers,
      onet_summary: buildOnetSummary(careers),
    };
  }
} catch (err) {
  console.error("O*NET proxy failed, falling back:", err);
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

// 🔥 HARD FILTERS
let isBlocked = false;

if (
  conflicts.includes("customer-facing roles") &&
  safeLower(job.title).includes("customer")
) {
  isBlocked = true;
}

if (
  conflicts.includes("high social environments") &&
  (safeLower(job.title).includes("service") ||
    safeLower(job.title).includes("support"))
) {
  isBlocked = true;
}

// apply penalties if not blocked
if (!isBlocked && fit_concerns.length > 0) {
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
  score: isBlocked ? 0 : score,
  fit_level: isBlocked ? "low" : getFitLevel(score, fit_concerns),
  fit_strengths,
  fit_concerns: isBlocked
  ? [...fit_concerns, "This role conflicts with critical work preferences."]
    : fit_concerns,
  matched_keywords: matches,
  match_reason: isBlocked
    ? "Filtered due to conflict with WSA constraints."
    : matches.length > 0
    ? `Matched based on: ${matches.join(", ")}`
    : "General entry-level recommendation",
};
});

  // ❌ NO FALLBACK — HARD FAIL IF O*NET DOES NOT RETURN RESULTS
console.error("O*NET returned no results — aborting recommendation generation");

return {
  source: "onet-failed",
  items: [],
  onet_summary: null,
  error: "O*NET could not return results. Check API connection or profile inputs.",
};
}
