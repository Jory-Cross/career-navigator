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

  const unique = uniqueStrings(ordered);

 return unique.slice(0, 1);
}

export async function getOnetRecommendations(profile = {}) {
  const searchTerms = buildSearchTerms(profile);

  if (searchTerms.length === 0) {
    return {
      source: "onet",
      query_terms: [],
      items: [],
      onet_summary: buildOnetSummary([]),
    };
  }

  let allItems = [];

for (const term of searchTerms) {
  try {
    const result = await searchOnetCareers({
      query: term,
      limit: 5,
    });

    const items = Array.isArray(result?.items) ? result.items : [];
    allItems = allItems.concat(items);
  } catch (error) {
    console.error("O*NET recommendation search failed:", error);
  }
}

  const deduped = [];
  const seen = new Set();

  for (const item of allItems) {
    const key = `${safeLower(item?.onet_code)}::${safeLower(item?.title)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return {
    source: "onet",
    query_terms: searchTerms,
    items: deduped,
    onet_summary: buildOnetSummary(deduped),
  };
}
