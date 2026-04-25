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

const JOB_PROFILES = [
  {
    title: "Office Assistant",
    keywords: ["data entry", "administrative", "organization", "clerical"],
  },
  {
    title: "Customer Service Representative",
    keywords: ["customer service", "communication", "support", "phone"],
  },
  {
    title: "Direct Support Professional",
    keywords: ["support", "caregiving", "assistance", "daily living"],
  },
  {
    title: "Food Service Worker",
    keywords: ["food", "service", "kitchen", "customer"],
  },
  {
    title: "Janitorial / Custodial Worker",
    keywords: ["cleaning", "janitorial", "maintenance", "detail"],
  },
  {
    title: "Warehouse Associate",
    keywords: ["inventory", "warehouse", "shipping", "receiving"],
  },
];

function buildProfileText(profile = {}) {
  return uniqueStrings([
    ...toArray(profile.resume_skills),
    ...toArray(profile.wsa_strengths),
    ...toArray(profile.assessment_keywords),
    ...toArray(profile.job_titles),
    ...toArray(profile.vocational_themes),
  ]);
}

export async function getOnetRecommendations(profile = {}) {
  const profileKeywords = buildProfileText(profile);

  if (profileKeywords.length === 0) {
    return {
      source: "empty-profile",
      items: [],
      onet_summary: buildOnetSummary([]),
    };
  }

  const results = JOB_PROFILES.map((job, index) => {
    const matches = job.keywords.filter((keyword) => {
  const key = safeLower(keyword);

  return profileKeywords.some((profileKeyword) => {
    const value = safeLower(profileKeyword);

    return value === key || value.includes(key);
  });
});

    const score = matches.length * 3;

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
