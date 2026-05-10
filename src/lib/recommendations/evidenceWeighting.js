/**
 * evidenceWeighting.js
 *
 * Lightweight evidence richness scoring helpers.
 *
 * Three tiers:
 *   strong  — highly specific, vocationally actionable, functionally impactful,
 *             and/or corroborated across multiple sources.
 *   moderate — somewhat detailed, partially corroborated, functionally relevant
 *              but incomplete.
 *   weak    — broad/generic labels, single-source vague data, inferred labels.
 *
 * Design rules:
 * - No hard-coding for specific clients.
 * - No unsafe medical interpretation.
 * - Always err on the side of caution — downgrade rather than upgrade uncertain evidence.
 * - Preserve all detail text; only add a tier label, never discard evidence.
 */

// ── SPECIFICITY SIGNALS ────────────────────────────────────────────────────

/**
 * Patterns that indicate a piece of evidence is STRONG:
 * - Specific functional impact described
 * - Safety/self-harm implications
 * - Named triggers or precise restrictions
 * - Corroboration markers
 * - Documented successful work behavior
 */
const STRONG_SIGNALS = [
  // Safety / escalation
  "self-harm", "safety risk", "crisis", "meltdown", "escalation",
  // Precise physical
  "cannot stand", "no standing", "unable to lift", "wheelchair", "paralyzed",
  "cannot walk", "limited dexterity", "cannot use hands", "severe mobility",
  // Named sensory triggers
  "triggered by", "coughing", "sneezing", "yawning", "bright light", "loud noise",
  "specific trigger",
  // Functional success
  "independently performs", "consistently demonstrated", "successfully completed",
  "no supervision needed", "minimal supervision",
  // Explicit accommodation docs
  "accommodation letter", "documented accommodation", "iep", "504 plan",
  // Explicit coaching requirement
  "job coaching required", "job coaching needed", "needs job coach",
  "requires on-site support", "task prompting required",
  // Schedule with specifics
  "mornings only", "no overnight", "available monday", "available tuesday",
  "available wednesday", "available thursday", "available friday",
  // Transportation with specifics
  "reliable vehicle", "bus pass", "public transit", "no driver license",
  "no personal vehicle",
  // Corroboration marker
  "confirmed by", "reported by multiple", "consistent across", "corroborated",
];

/**
 * Patterns that indicate WEAK evidence:
 * - Generic diagnostic labels without functional description
 * - Single vague adjectives
 * - Pure inferences with no observation basis
 */
const WEAK_SIGNALS = [
  "anxiety", "depression", "adhd", "autism", "bipolar", "ptsd",
  "sensory issues", "social issues", "communication issues",
  "may have", "possibly", "inferred", "not formally assessed",
  "prefers mornings", "likes routine", "enjoys working",
  "general difficulty", "some challenges", "limited support",
];

// ── CORROBORATION SCORING ─────────────────────────────────────────────────

/**
 * Count how many distinct sources provided this class of evidence.
 * sources is an array of source-type strings, e.g. ["resume", "wsa", "vfp"].
 */
export function corroborationScore(sources = []) {
  const unique = new Set(sources.filter(Boolean));
  return unique.size;
}

// ── ITEM-LEVEL RICHNESS SCORE ─────────────────────────────────────────────

/**
 * Score a single evidence string.
 * Returns: "strong" | "moderate" | "weak"
 *
 * Algorithm:
 * 1. Check for any strong signal → strong.
 * 2. Check for weak signal AND no strong signal → weak.
 * 3. Length heuristic: longer, detailed descriptions → moderate.
 * 4. Default → moderate.
 */
export function scoreEvidenceItem(text = "") {
  const t = String(text).toLowerCase();

  const hasStrong = STRONG_SIGNALS.some((s) => t.includes(s));
  if (hasStrong) return "strong";

  const hasWeak = WEAK_SIGNALS.some((s) => t.includes(s));
  if (hasWeak) return "weak";

  // Length heuristic: very short generic strings are weak, longer are moderate
  const wordCount = t.trim().split(/\s+/).length;
  if (wordCount <= 3) return "weak";

  return "moderate";
}

/**
 * Score a list of evidence items and return the highest tier found.
 * Also returns a breakdown: { strong, moderate, weak } counts.
 */
export function scoreEvidenceList(items = []) {
  const counts = { strong: 0, moderate: 0, weak: 0 };
  for (const item of items) {
    const tier = scoreEvidenceItem(String(item));
    counts[tier]++;
  }
  const best = counts.strong > 0 ? "strong"
    : counts.moderate > 0 ? "moderate"
    : "weak";
  return { best, counts };
}

// ── DOMAIN-LEVEL PROFILE RICHNESS ─────────────────────────────────────────

/**
 * Evaluate overall evidence richness for a grounding context.
 * Returns: { tier: "strong"|"moderate"|"weak", score: 0-100, reasons: [] }
 *
 * Factors:
 * - Source count (corroboration)
 * - Whether strong-signal items exist across multiple domains
 * - Whether data is inferred-only vs. observed/documented
 * - Presence of key vocational domains (interest, skills, environment, schedule)
 */
export function evaluateProfileRichness({
  hasInterestProfile = false,
  hasResume = false,
  hasWSA = false,
  hasVFP = false,
  resumeSkillCount = 0,
  workHistoryCount = 0,
  vfpDomainsCovered = [],   // e.g. ["skills", "barriers", "schedule", "transportation"]
  matchedKeywordCount = 0,
  maturityLevel = null,     // "High"|"Medium"|"Low"|null
} = {}) {
  let score = 0;
  const reasons = [];

  // Source presence (corroboration)
  const sourceCount = [hasInterestProfile, hasResume, hasWSA, hasVFP].filter(Boolean).length;
  score += sourceCount * 10; // up to 40 pts

  if (sourceCount >= 3) {
    reasons.push("Multiple data sources available (strong corroboration basis).");
  } else if (sourceCount >= 2) {
    reasons.push("Two data sources available (moderate corroboration).");
  } else if (sourceCount === 1) {
    reasons.push("Only one data source available — evidence is limited.");
  }

  // Resume depth
  if (resumeSkillCount >= 5) { score += 10; reasons.push("Rich skill set documented in resume."); }
  else if (resumeSkillCount >= 2) { score += 5; }

  if (workHistoryCount >= 2) { score += 10; reasons.push("Multiple work history entries available."); }
  else if (workHistoryCount === 1) { score += 5; }

  // Keyword match depth
  if (matchedKeywordCount >= 4) { score += 10; reasons.push("Strong keyword alignment between client profile and role."); }
  else if (matchedKeywordCount >= 2) { score += 5; }

  // VFP domain coverage
  const keyDomains = ["skills", "barriers", "schedule", "transportation", "physical_restrictions", "support_needs"];
  const coveredKeyDomains = keyDomains.filter(d => vfpDomainsCovered.includes(d));
  if (coveredKeyDomains.length >= 4) { score += 15; reasons.push("Vocational profile covers multiple key domains."); }
  else if (coveredKeyDomains.length >= 2) { score += 7; }
  else if (hasVFP && coveredKeyDomains.length === 0) {
    reasons.push("Vocational profile present but key domains are sparse.");
  }

  // Maturity
  if (maturityLevel === "High" || maturityLevel === "Strong") {
    score += 5;
    reasons.push("Vocational profile assessed as high maturity.");
  } else if (maturityLevel === "Low" || maturityLevel === "Minimal" || maturityLevel === "Weak") {
    score -= 10;
    reasons.push("Vocational profile maturity is low — evidence may be incomplete.");
  }

  score = Math.max(0, Math.min(100, score));

  const tier = score >= 65 ? "strong"
    : score >= 35 ? "moderate"
    : "weak";

  return { tier, score, reasons };
}

// ── EVIDENCE STRENGTH LABEL ────────────────────────────────────────────────

/**
 * Return a human-readable label for a tier.
 * Used when annotating grounding evidence for display.
 */
export function evidenceTierLabel(tier) {
  return {
    strong: "Strong support",
    moderate: "Moderate support",
    weak: "Weak / general support",
  }[tier] || "Support";
}

/**
 * Given a list of evidence items, filter by minimum tier.
 * Useful for surfacing only "strong" or better items in summaries.
 */
export function filterByMinTier(items = [], minTier = "moderate") {
  const ORDER = { strong: 2, moderate: 1, weak: 0 };
  const min = ORDER[minTier] ?? 0;
  return items.filter((item) => (ORDER[scoreEvidenceItem(String(item))] ?? 0) >= min);
}