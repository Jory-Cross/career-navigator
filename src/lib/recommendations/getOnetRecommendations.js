import { buildOnetSummary } from "@/lib/recommendations/buildOnetSummary";

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
    ...toArray(profile.vocational_themes),
  ].join(" ").toLowerCase();

  const conflicts = [];

  if (text.includes("overwhelm") || text.includes("overstimulation")) {
    conflicts.push("high social environments");
  }

  if (text.includes("prefers to work alone") || text.includes("independent")) {
    conflicts.push("customer-facing roles");
  }

  if (text.includes("communication difficulty")) {
    conflicts.push("high communication jobs");
  }

  return conflicts;
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
    keywords: ["cleaning", "janitorial", "maintenance", "detail", "routine"],
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

      // remove long sentences
      if (str.length > 60) return [];

      // split phrases into smaller chunks
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
    ...normalizeKeywords(profile.wsa_themes),
    ...normalizeKeywords(profile.wsa_job_goals),
    ...normalizeKeywords(profile.assessment_keywords),
    ...normalizeKeywords(profile.job_titles),
    ...normalizeKeywords(profile.vocational_themes),
  ]);
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

  if (profileKeywords.length === 0) {
    return {
      source: "empty-profile",
      items: [],
      onet_summary: buildOnetSummary([]),
    };
  }

  const results = JOB_PROFILES.map((job, index) => {
    const matches = countMatches(job.keywords, profileKeywords);

    const resumeMatches = countMatches(job.keywords, toArray(profile.resume_skills));
    const wsaStrengthMatches = countMatches(job.keywords, toArray(profile.wsa_strengths));
    const wsaThemeMatches = countMatches(job.keywords, toArray(profile.wsa_themes));
    const wsaGoalMatches = countMatches(job.keywords, toArray(profile.wsa_job_goals));

   const score =
  resumeMatches.length * 2 +
  wsaStrengthMatches.length * 4 +
  wsaThemeMatches.length * 6 +
  wsaGoalMatches.length * 10;

    return {
      onet_code: `TEMP-${index + 1}`,
      title: job.title,
      href: null,
      bright_outlook: false,
      green: false,
      apprenticeship: false,
      score,
      matched_keywords: matches,
      match_reason:
        matches.length > 0
          ? `Matched based on: ${matches.join(", ")}`
          : "General entry-level recommendation",
    };
  });

  const filtered = results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    source: "scored-fallback",
    items: filtered,
    onet_summary: buildOnetSummary(filtered),
  };
}
