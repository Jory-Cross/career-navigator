function safeLower(value) {
  return String(value || "").toLowerCase();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function joinText(parts) {
  return parts.filter(Boolean).join(" ");
}

function containsAny(text, keywords) {
  const lower = safeLower(text);
  return keywords.some((keyword) => lower.includes(safeLower(keyword)));
}

const JOB_PROFILES = [
  {
    code: "office_support",
    title: "Office Support",
    keywords: [
      "microsoft office",
      "excel",
      "word",
      "outlook",
      "filing",
      "data entry",
      "calendar",
      "reception",
      "administrative",
      "office assistant",
      "customer service",
      "phones",
      "scheduling",
    ],
    riasec: ["C", "S"],
  },
  {
    code: "warehouse",
    title: "Warehouse Associate",
    keywords: [
      "warehouse",
      "inventory",
      "shipping",
      "receiving",
      "forklift",
      "stocking",
      "pallet",
      "order picking",
      "delivery",
      "loading",
      "unloading",
    ],
    riasec: ["R", "C"],
  },
  {
    code: "customer_service",
    title: "Customer Service",
    keywords: [
      "customer service",
      "call center",
      "phone support",
      "front desk",
      "cashier",
      "sales",
      "clients",
      "retail",
      "guest service",
      "communication",
    ],
    riasec: ["S", "E"],
  },
  {
    code: "food_service",
    title: "Food Service",
    keywords: [
      "food service",
      "restaurant",
      "kitchen",
      "dishwasher",
      "prep",
      "cook",
      "server",
      "host",
      "cleaning",
      "sanitation",
    ],
    riasec: ["R", "S"],
  },
  {
    code: "janitorial",
    title: "Janitorial / Cleaning",
    keywords: [
      "janitorial",
      "cleaning",
      "custodial",
      "housekeeping",
      "sanitize",
      "maintenance",
      "sweeping",
      "mopping",
      "laundry",
    ],
    riasec: ["R", "C"],
  },
  {
    code: "it_support",
    title: "IT Support",
    keywords: [
      "computer",
      "technical support",
      "help desk",
      "troubleshooting",
      "software",
      "hardware",
      "technology",
      "network",
      "ticketing",
      "systems",
    ],
    riasec: ["I", "C"],
  },
];

function getTopRiasecCodes(riasecScores = {}) {
  return Object.entries(riasecScores)
    .filter(([, score]) => typeof score === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code]) => code.toUpperCase());
}

export function buildJobRecommendations({
  resumeText = "",
  wsaText = "",
  assessmentText = "",
  riasecScores = {},
}) {
  const combinedText = joinText([resumeText, wsaText, assessmentText]);
  const topRiasec = getTopRiasecCodes(riasecScores);

  const recommendations = JOB_PROFILES.map((profile) => {
    const matchedKeywords = profile.keywords.filter((keyword) =>
      containsAny(combinedText, [keyword])
    );

    const riasecMatches = profile.riasec.filter((code) =>
      topRiasec.includes(code)
    );

    const score =
      matchedKeywords.length * 10 +
      riasecMatches.length * 15;

    const reasons = [
      matchedKeywords.length
        ? `Matched skills/terms: ${matchedKeywords.join(", ")}`
        : null,
      riasecMatches.length
        ? `RIASEC alignment: ${riasecMatches.join(", ")}`
        : null,
      wsaText ? "Used WSA content in scoring" : null,
      assessmentText ? "Used assessment content in scoring" : null,
    ].filter(Boolean);

    return {
      code: profile.code,
      title: profile.title,
      score,
      matched_keywords: matchedKeywords,
      riasec_matches: riasecMatches,
      reasoning: reasons.join(". "),
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    riasec_summary: topRiasec.length
      ? `Top RIASEC codes: ${topRiasec.join(", ")}`
      : "",
    wsa_summary: wsaText ? "WSA content included in recommendation run." : "",
    combined_profile: combinedText,
    recommendations,
  };
}
