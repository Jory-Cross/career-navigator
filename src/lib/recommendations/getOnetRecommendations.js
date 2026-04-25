// import { searchOnetCareers } from "@/lib/adapters/onetAdapter";
import { buildOnetSummary } from "@/lib/recommendations/buildOnetSummary";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
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

function countMatches(textParts = [], keywords = []) {
  const text = textParts.map(safeLower).join(" ");
  return keywords.filter((keyword) => text.includes(safeLower(keyword))).length;
}

const FALLBACK_JOB_PROFILES = [
  {
    onet_code: "TEMP-WAREHOUSE-1",
    title: "Warehouse Associate",
    keywords: ["warehouse", "inventory", "forklift", "shipping", "receiving", "stocking", "packaging"],
  },
  {
    onet_code: "TEMP-OFFICE-1",
    title: "Office Assistant",
    keywords: ["office", "filing", "data entry", "microsoft office", "customer service", "organization", "administrative"],
  },
  {
    onet_code: "TEMP-CUSTOMER-1",
    title: "Customer Service Representative",
    keywords: ["customer service", "communication", "phone", "support", "cashier", "retail", "problem solving"],
  },
  {
    onet_code: "TEMP-FOOD-1",
    title: "Food Service Worker",
    keywords: ["food", "kitchen", "restaurant", "prep", "cleaning", "customer service", "cashier"],
  },
  {
    onet_code: "TEMP-JANITORIAL-1",
    title: "Janitorial / Custodial Worker",
    keywords: ["cleaning", "custodial", "janitorial", "maintenance", "sanitation", "detail"],
  },
  {
    onet_code: "TEMP-RETAIL-1",
    title: "Retail Sales Associate",
    keywords: ["retail", "sales", "cashier", "customer service", "stocking", "merchandising"],
  },
  {
    onet_code: "TEMP-LANDSCAPE-1",
    title: "Grounds Maintenance Worker",
    keywords: ["landscaping", "grounds", "maintenance", "outdoor", "tools", "labor"],
  },
  {
    onet_code: "TEMP-CARE-1",
    title: "Direct Support Professional",
    keywords: ["caregiving", "support", "helping", "communication", "personal care", "community", "patience"],
  },
  {
    onet_code: "TEMP-MANUFACTURING-1",
    title: "Production Worker",
    keywords: ["production", "assembly", "manufacturing", "quality", "machine", "packaging"],
  },
  {
    onet_code: "TEMP-TECH-1",
    title: "Computer Support Assistant",
    keywords: ["computer", "technology", "troubleshooting", "data entry", "software", "technical support"],
  },
];

function buildSearchTerms(profile = {}) {
  const resumeSkills = toArray(profile.resume_skills);
  const wsaStrengths = toArray(profile.wsa_strengths);
  const assessmentKeywords = toArray(profile.assessment_keywords);
  const jobTitles = toArray(profile.job_titles);
  const vocationalThemes = toArray(profile.vocational_themes);

  const ordered = [
    ...jobTitles,
    ...vocationalThemes,
    ...resumeSkills,
    ...wsaStrengths,
    ...assessmentKeywords,
  ];

  return uniqueStrings(ordered).slice(0, 12);
}

function buildMatchedRecommendations(profile = {}) {
  const resumeSkills = toArray(profile.resume_skills);
  const wsaStrengths = toArray(profile.wsa_strengths);
  const assessmentKeywords = toArray(profile.assessment_keywords);
  const jobTitles = toArray(profile.job_titles);
  const vocationalThemes = toArray(profile.vocational_themes);

  const allSignals = [
    ...resumeSkills,
    ...wsaStrengths,
    ...assessmentKeywords,
    ...jobTitles,
    ...vocationalThemes,
  ];

  return FALLBACK_JOB_PROFILES.map((job) => {
    const resumeMatchCount = countMatches(resumeSkills, job.keywords);
    const wsaMatchCount = countMatches(wsaStrengths, job.keywords);
    const assessmentMatchCount = countMatches(assessmentKeywords, job.keywords);
    const titleMatchCount = countMatches(jobTitles, job.keywords);
    const themeMatchCount = countMatches(vocationalThemes, job.keywords);

    const score =
      resumeMatchCount * 3 +
      wsaMatchCount * 3 +
      assessmentMatchCount * 2 +
      titleMatchCount * 4 +
      themeMatchCount * 2;

    const matched_keywords = job.keywords.filter((keyword) =>
      allSignals.some((signal) => safeLower(signal).includes(safeLower(keyword)))
    );

    return {
      onet_code: job.onet_code,
      title: job.title,
      href: null,
      bright_outlook: false,
      green: false,
      apprenticeship: false,
      score,
      matched_keywords: uniqueStrings(matched_keywords),
      match_reason:
        matched_keywords.length > 0
          ? `Matched based on: ${uniqueStrings(matched_keywords).join(", ")}`
          : "General entry-level match based on available client information.",
    };
  })
    .filter((job) => job.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function getOnetRecommendations(profile = {}) {
  const searchTerms = buildSearchTerms(profile);
  const matchedItems = buildMatchedRecommendations(profile);

  const fallbackItems =
    matchedItems.length > 0
      ? matchedItems
      : FALLBACK_JOB_PROFILES.slice(0, 5).map((job) => ({
          onet_code: job.onet_code,
          title: job.title,
          href: null,
          bright_outlook: false,
          green: false,
          apprenticeship: false,
          score: 0,
          matched_keywords: [],
          match_reason: "General entry-level recommendation. More resume, WSA, or assessment data will improve matching.",
        }));

  const deduped = [];
  const seen = new Set();

  for (const item of fallbackItems) {
    const key = `${safeLower(item?.onet_code)}::${safeLower(item?.title)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return {
    source: "temporary-scored-fallback",
    query_terms: searchTerms.length > 0 ? searchTerms : ["fallback"],
    items: deduped,
    onet_summary: buildOnetSummary(deduped),
  };
}
