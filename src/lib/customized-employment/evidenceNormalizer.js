const STOP_WORDS = new Set(["of", "the", "and", "a", "an", "to", "in", "on", "for"]);

// Verb/gerund normalization → root concept noun form.
// Keys are lowercased words that may appear in evidence text.
const VERB_NORMALIZATIONS = {
  organizing: "organize",
  organization: "organize",
  sorting: "sort",
  creating: "create",
  creation: "create",
  making: "make",
  stocking: "stock",
  tracking: "track",
  management: "manage",
  managing: "manage",
  building: "build",
  cleaning: "clean",
  labeling: "label",
  filing: "file",
  packing: "pack",
  inspecting: "inspect",
  assembling: "assemble",
};

// Lightweight singular/plural normalization for common suffix patterns.
// Kept simple and deterministic — no full lemmatizer, just common endings.
function singularize(word) {
  if (word.length <= 3) return word;

  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y"; // inventories → inventory
  }
  if (word.endsWith("ves") && word.length > 4) {
    return word.slice(0, -3) + "f"; // shelves → shelf (approximate)
  }
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes")) {
    return word.slice(0, -2); // boxes → box
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1); // supplies → supplie (then mapped below if needed)
  }
  return word;
}

export function normalizeEvidenceText(text) {
  if (!text) return "";

  const cleaned = String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const tokens = cleaned.split(" ").filter(Boolean);

  const processed = tokens.map((token) => {
    let t = token;

    // Verb / gerund → root
    if (VERB_NORMALIZATIONS[t]) {
      t = VERB_NORMALIZATIONS[t];
    }

    // Singular/plural collapse
    t = singularize(t);

    return t;
  });

  const filtered = processed.filter((t) => t && !STOP_WORDS.has(t));

  // Word-order normalization: sort tokens alphabetically so phrase variants
  // ("inventory tracking" vs "tracking inventory") produce the same key.
  const sorted = [...filtered].sort();

  return sorted.join(" ");
}

// ── Concept Refinement Layer ──────────────────────────────────────────────
// Decomposes a narrative evidence statement into concise concept phrases
// that read as canonical labels (e.g. "Organizing Materials") while the
// original full text is preserved separately under entries[].

// Rule B — narrative lead-in phrases (removed only when they occur at the
// BEGINNING of a candidate fragment).
const NARRATIVE_LEAD_INS = [
  "sarah appeared motivated by",
  "sarah showed strong interest in",
  "sarah is most interested in",
  "sarah demonstrated strengths in",
  "sarah demonstrates strengths in",
  "sarah demonstrates strength in",
  "sarah demonstrated strength in",
  "sarah shows strength in",
  "sarah showed strength in",
  "sarah showed interest in",
  "sarah is interested in",
  "sarah enjoys",
  "sarah likes",
  "sarah prefers",
  "sarah has strengths in",
  "sarah has strength in",
  "sarah is good at",
  "client appeared motivated by",
  "client showed strong interest in",
  "client is most interested in",
  "client demonstrated strengths in",
  "client demonstrates strengths in",
  "client demonstrates strength in",
  "client demonstrated strength in",
  "client shows strength in",
  "client showed strength in",
  "client showed interest in",
  "client is interested in",
  "client enjoys",
  "client likes",
  "client prefers",
  "client has strengths in",
  "client has strength in",
  "client is good at",
  "appeared motivated by",
  "showed strong interest in",
  "is most interested in",
  "demonstrates strengths in",
  "demonstrates strength in",
  "showed interest in",
  "is interested in",
  "has strengths in",
  "has strength in",
  "is good at",
  "motivated by",
  "interested in",
  "strong interest in",
  "strengths in",
  "strength in",
  "interest in",
];

// Rule C — generic scaffolding phrases. When a fragment matches
// `<generic> that helps with <topic>` / `<generic> for <topic>` etc., the
// generic phrase is removed and the topic is promoted as the concept.
const GENERIC_SCAFFOLDS = [
  "technology that helps with",
  "technology that helps",
  "using technology for",
  "using technology",
  "technology for",
  "supports for",
  "tools for",
  "assistance with",
  "help with",
  "helps with",
  "helps",
];

// Rule F — phrases that are pure narrative fragments, not concepts.
const NARRATIVE_FRAGMENT_BLACKLIST = new Set([
  "sarah demonstrates strengths",
  "sarah demonstrates strength",
  "sarah appeared motivated",
  "sarah showed strong interest",
  "sarah showed interest",
  "client demonstrates strengths",
  "client demonstrates strength",
  "client appeared motivated",
  "client showed strong interest",
  "client showed interest",
  "appeared motivated by",
  "showed strong interest in",
  "showed interest in",
  "demonstrates strengths in",
  "demonstrates strength in",
  "is most interested in",
  "motivated by",
  "interested in",
]);

// Rule A — split a narrative into candidate fragments.
function splitIntoFragments(text) {
  if (!text) return [];
  const raw = String(text)
    .replace(/[\n•;]/g, ",")
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .replace(/\bas well as\b/gi, ",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripLeadIn(fragment) {
  let f = fragment.toLowerCase().trim();
  for (const lead of NARRATIVE_LEAD_INS) {
    if (f.startsWith(lead + " ")) {
      f = f.slice(lead.length).trim();
      break;
    }
  }
  return f;
}

function stripGenericScaffold(fragment) {
  let f = fragment.toLowerCase().trim();
  for (const scaffold of GENERIC_SCAFFOLDS) {
    if (f.startsWith(scaffold + " ")) {
      f = f.slice(scaffold.length).trim();
      break;
    }
  }
  return f;
}

function isNarrativeFragment(phrase) {
  const p = phrase.toLowerCase().trim();
  if (!p) return true;
  if (NARRATIVE_FRAGMENT_BLACKLIST.has(p)) return true;
  // bare subject/auxiliary words are not concepts
  const singleStopword = /^[a-z]+$/.test(p) && (STOP_WORDS.has(p) || p.length < 3);
  return singleStopword;
}

function titleCase(phrase) {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}

// Rule G — one statement may produce multiple concise labels; original
// text is preserved by the caller under entries[].
export function extractConceptLabels(text) {
  if (!text) return [];
  const fragments = splitIntoFragments(text);
  const labels = [];
  const seen = new Set();

  fragments.forEach((frag) => {
    let phrase = stripLeadIn(frag);
    phrase = stripGenericScaffold(phrase);
    // remove leading/trailing punctuation and collapse whitespace
    phrase = phrase.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

    if (!phrase) return;
    if (isNarrativeFragment(phrase)) return;

    // Rule F — length cap & skip
    const wordCount = phrase.split(/\s+/).length;
    if (wordCount > 6) return;        // still narrative
    if (phrase.length < 3) return;    // artifact

    const label = toConceptLabel(phrase);
    if (!label) return;

    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  });

  // If decomposition yielded nothing, fall back to a single label derived
  // from the whole text so we never drop evidence silently.
  if (labels.length === 0) {
    const whole = toConceptLabel(stripGenericScaffold(stripLeadIn(text)));
    if (whole) labels.push(whole);
  }

  return labels;
}

// Rule D + Rule E — convert a phrase into a title-cased canonical concept
// label, preserving original word order (NO alphabetical sort).
export function toConceptLabel(phrase) {
  if (!phrase) return "";
  let p = String(phrase)
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!p) return "";

  // Stop-word trimming on leading/trailing words only — never interior.
  const tokens = p.split(" ").filter(Boolean);
  while (tokens.length > 1 && STOP_WORDS.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && STOP_WORDS.has(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length === 0) return "";
  if (tokens.length === 1 && tokens[0].length < 3) return "";

  return titleCase(tokens.join(" "));
}

export function createEvidenceConcepts(entries = []) {
  const concepts = new Map();

  entries.forEach((entry) => {
    // Produce one or more concise concept labels from the narrative text.
    const labels = extractConceptLabels(entry?.text || "");

    // If no labels could be derived, fall back to a single concept keyed on
    // the normalized raw text so no entry is silently dropped.
    const labelSet = labels.length > 0 ? labels : [entry?.text];

    labelSet.forEach((label) => {
      const displayLabel = label || entry?.text || "";
      const normalized = normalizeEvidenceText(label || "") || normalizeEvidenceText(entry?.text || "");

      if (!normalized) return;

      if (!concepts.has(normalized)) {
        concepts.set(normalized, {
          concept: displayLabel,
          sources: new Set(),
          entries: [],
        });
      }

      const concept = concepts.get(normalized);

      if (entry?.source) {
        concept.sources.add(entry.source);
      }

      concept.entries.push(entry);
    });
  });

  const refinedConcepts = Array.from(concepts.values()).map((concept) => ({
    concept: concept.concept,
    sourceCount: concept.sources.size,
    sources: Array.from(concept.sources),
    entries: concept.entries,
    entryCount: concept.entries.length,
  }));

  return consolidateConcepts(refinedConcepts);
}

// ── Concept Consolidation Layer ───────────────────────────────────────────
// Pipeline stage 3: merges fragmented refined concepts into canonical
// concept families. Additive only — concepts with no family match pass
// through unchanged. Original entries and source attribution are preserved
// verbatim on each consolidated concept.

// Match against a normalized concept key (output of normalizeEvidenceText):
// lowercased, verb/gerund → root, singularized, stop-words removed, tokens
// alphabetically SORTED. Sample normalized keys:
//   "Labeling"            -> "label"
//   "Labeling Containers" -> "container label"
//   "Creating Lists"      -> "create list"
//   "Inventory Checklist" -> "checklist inventory"
//   "Organizing Supplies"  -> "organize supplie"
//   "Household Organization" -> "household organize"
//   "Tracking Supplies"    -> "supplie track"
//   "Inventory Tracking"  -> "inventory track"
//   "Sorting Donations"   -> "donation sort"
function buildConceptFamilies() {
  const SPACE = " ";
  const has = (k, word) => k.split(SPACE).includes(word);
  return [
    {
      familyLabel: "Labeling",
      matchers: [
        (k) => k === "label" || has(k, "label"),
      ],
    },
    {
      familyLabel: "Lists & Checklists",
      matchers: [
        (k) => has(k, "list") || has(k, "checklist") || k === "checklist" || k === "list",
      ],
    },
    {
      familyLabel: "Inventory Systems",
      matchers: [
        (k) => (has(k, "inventory") && has(k, "system")) || k === "organize system",
      ],
    },
    {
      familyLabel: "Organization",
      matchers: [
        (k) => k === "organize" || has(k, "organize") || has(k, "organization") || has(k, "organized"),
      ],
    },
    {
      familyLabel: "Sorting",
      matchers: [
        (k) => k === "sort" || has(k, "sort"),
      ],
    },
    {
      familyLabel: "Inventory Tracking",
      matchers: [
        (k) => (has(k, "track") && has(k, "inventory"))
            || (has(k, "track") && (has(k, "supplie") || has(k, "supply")))
            || (has(k, "track") && (has(k, "material") || has(k, "materials")))
            || (has(k, "track") && has(k, "stock"))
            || k === "track",
      ],
    },
  ];
}

// Resolve a single refined concept to its family label by matching the
// normalized concept key. Returns null when no family matches (singleton).
function matchConceptToFamily(normalizedKey, families) {
  if (!normalizedKey) return null;
  for (const family of families) {
    if (family.matchers.some((m) => m(normalizedKey))) {
      return family.familyLabel;
    }
  }
  return null;
}

// Pure grouping pass. Buckets refined concepts by family label; concepts
// with no family match form a singleton bucket keyed on their own concept
// label so they pass through unchanged.
function groupRelatedConcepts(refinedConcepts = []) {
  const families = buildConceptFamilies();
  const buckets = new Map(); // familyLabel -> { familyLabel, members: [] }

  refinedConcepts.forEach((concept) => {
    const normalized = normalizeEvidenceText(concept.concept || "");
    const familyLabel = matchConceptToFamily(normalized, families);

    if (!familyLabel) {
      // Singleton — bucket on the concept's own label so it passes through.
      const singletonKey = concept.concept || "Unknown";
      if (!buckets.has(singletonKey)) {
        buckets.set(singletonKey, { familyLabel: singletonKey, members: [] });
      }
      buckets.get(singletonKey).members.push(concept);
      return;
    }

    if (!buckets.has(familyLabel)) {
      buckets.set(familyLabel, { familyLabel, members: [] });
    }
    buckets.get(familyLabel).members.push(concept);
  });

  return Array.from(buckets.values());
}

/**
 * consolidateConcepts — top-level consolidation pass.
 * Input:  array of refined concept objects (from createEvidenceConcepts),
 *         shape: { concept, sourceCount, sources, entries, entryCount }
 * Output: array of consolidated concept objects, same shape.
 *
 * Each bucket becomes ONE concept:
 *   concept     = bucket familyLabel
 *   entries     = union of member entries, deduped by entry.text (preserves originals)
 *   sources     = union of member sources
 *   entryCount  = entries.length
 *   sourceCount = sources.length
 *
 * Original entries are referenced, never mutated; source attribution is
 * unioned (never dropped). Singletons pass through as single-member buckets.
 */
export function consolidateConcepts(refinedConcepts = []) {
  if (!Array.isArray(refinedConcepts) || refinedConcepts.length === 0) return [];

  const buckets = groupRelatedConcepts(refinedConcepts);

  return buckets.map((bucket) => {
    const entriesMap = new Map(); // dedupe by entry text
    const sourcesSet = new Set();

    bucket.members.forEach((member) => {
      (member.entries || []).forEach((entry) => {
        const key = entry?.text || "";
        if (!entriesMap.has(key)) {
          entriesMap.set(key, entry);
        }
      });
      (member.sources || []).forEach((src) => {
        if (src) sourcesSet.add(src);
      });
    });

    const entries = Array.from(entriesMap.values());
    return {
      concept: bucket.familyLabel,
      sourceCount: sourcesSet.size,
      sources: Array.from(sourcesSet),
      entries,
      entryCount: entries.length,
    };
  });
}

// ── Theme Grouping Engine ─────────────────────────────────────────────────
// Deterministic keyword dictionary. A concept may belong to multiple themes.
// Match is against the normalized concept key (lowercased, verb/singular
// collapsed, stop-words removed, tokens sorted). No AI, no fuzzy matching.
const THEME_DICTIONARY = [
  {
    themeName: "Organization & Inventory Systems",
    keywords: [
      "inventory",
      "tracking",
      "track",
      "label",
      "labeling",
      "labels",
      "sort",
      "sorting",
      "organize",
      "organization",
      "organized",
      "stock",
      "stocking",
      "shelf",
      "shelves",
      "supply",
      "supplies",
      "records",
      "recordkeeping",
      "record",
      "catalog",
      "cataloging",
      "list",
      "lists",
      "checklist",
    ],
  },
  {
    themeName: "Libraries & Information Organization",
    keywords: [
      "library",
      "libraries",
      "books",
      "book",
      "catalog",
      "cataloging",
      "records",
      "information",
      "file",
      "filing",
      "archive",
      "archiving",
    ],
  },
  {
    themeName: "Community Service & Helping Roles",
    keywords: [
      "volunteer",
      "volunteering",
      "food",
      "pantry",
      "church",
      "helping",
      "help",
      "community",
      "donation",
      "donations",
      "charity",
      "nonprofit",
      "service",
    ],
  },
  {
    themeName: "Administrative & Clerical Support",
    keywords: [
      "office",
      "clerical",
      "administrative",
      "paperwork",
      "filing",
      "records",
      "data",
      "entry",
      "forms",
      "form",
      "documentation",
    ],
  },
  {
    themeName: "Routine Structured Work",
    keywords: [
      "routine",
      "predictable",
      "schedule",
      "structured",
      "consistency",
      "consistent",
      "step",
      "written",
      "instructions",
      "instruction",
      "checklist",
      "procedures",
      "procedure",
    ],
  },
  {
    themeName: "Customer & Community Interaction",
    keywords: [
      "customer",
      "public",
      "people",
      "community",
      "greeting",
      "greet",
      "assisting",
      "assist",
      "helping",
      "others",
    ],
  },
];

// Match a normalized concept against the dictionary. Returns theme names.
// A concept matches a theme if ANY of its tokens appear in that theme's
// keyword list, OR if any multi-word dictionary keyword is a substring of
// the normalized concept text.
function matchConceptToThemes(normalizedConcept) {
  if (!normalizedConcept) return [];
  const tokens = normalizedConcept.split(" ").filter(Boolean);
  const matched = new Set();

  THEME_DICTIONARY.forEach((theme) => {
    const tokenHit = tokens.some((t) => theme.keywords.includes(t));
    const phraseHit = theme.keywords.some(
      (kw) => kw.includes(" ") && normalizedConcept.includes(kw)
    );
    if (tokenHit || phraseHit) {
      matched.add(theme.themeName);
    }
  });

  return Array.from(matched);
}

/**
 * buildEvidenceThemes — additive theme grouping layer.
 * Input: createEvidenceConcepts() output.
 * Output: themes with aggregated entry/source/concept counts.
 * A concept may contribute to multiple themes; its entries are included in
 * each theme it matches (no evidence is removed or hidden upstream).
 */
export function buildEvidenceThemes(concepts = []) {
  if (!Array.isArray(concepts) || concepts.length === 0) return [];

  const themeMap = new Map();

  concepts.forEach((conceptObj) => {
    const normalized = normalizeEvidenceText(conceptObj.concept || conceptObj.conceptKey || "");
    const themeNames = matchConceptToThemes(normalized);

    themeNames.forEach((themeName) => {
      if (!themeMap.has(themeName)) {
        themeMap.set(themeName, {
          themeName,
          conceptSet: new Set(),
          entrySet: new Set(),
          sourceSet: new Set(),
          conceptObjects: [],
          entryObjects: [],
        });
      }

      const theme = themeMap.get(themeName);

      // Track unique concepts by their display text
      if (!theme.conceptSet.has(conceptObj.concept)) {
        theme.conceptSet.add(conceptObj.concept);
        theme.conceptObjects.push(conceptObj);
      }

      // Track unique entries by their text (dedupe across concept repeats)
      (conceptObj.entries || []).forEach((entry) => {
        const entryKey = entry?.text || "";
        if (!theme.entrySet.has(entryKey)) {
          theme.entrySet.add(entryKey);
          theme.entryObjects.push(entry);
          if (entry?.source) {
            theme.sourceSet.add(entry.source);
          }
        }
      });
    });
  });

  return Array.from(themeMap.values())
    .map((theme) => ({
      themeName: theme.themeName,
      entryCount: theme.entryObjects.length,
      sourceCount: theme.sourceSet.size,
      concepts: theme.conceptObjects.map((c) => c.concept),
      entries: theme.entryObjects,
      sources: Array.from(theme.sourceSet),
    }))
    .sort((a, b) => b.entryCount - a.entryCount);
}

// ── Theme Intelligence Layer ──────────────────────────────────────────────
// Deterministic evidence-strength classification + prose summary for a theme.
// No AI, no external calls, no vocational theme generation. Pure functions of
// the aggregated theme shape produced by buildEvidenceThemes().

/**
 * getThemeEvidenceStrength — classify a theme's support level.
 * Rules (evaluated in order; first match wins):
 *   Strong Evidence    : sourceCount >= 3 AND entryCount >= 10 AND conceptCount >= 5
 *   Moderate Evidence  : sourceCount >= 2 AND entryCount >= 5
 *   Emerging Evidence  : sourceCount >= 1 AND entryCount >= 1
 *   No Evidence        : no entries
 * Returns { strengthLabel, strengthKey }.
 */
export function getThemeEvidenceStrength(theme = {}) {
  const entryCount = theme?.entryCount ?? 0;
  const sourceCount = theme?.sourceCount ?? 0;
  const conceptCount = (theme?.concepts || []).length;

  if (entryCount === 0) {
    return { strengthLabel: "No Evidence", strengthKey: "none" };
  }
  if (sourceCount >= 3 && entryCount >= 10 && conceptCount >= 5) {
    return { strengthLabel: "Strong Evidence", strengthKey: "strong" };
  }
  if (sourceCount >= 2 && entryCount >= 5) {
    return { strengthLabel: "Moderate Evidence", strengthKey: "moderate" };
  }
  return { strengthLabel: "Emerging Evidence", strengthKey: "emerging" };
}

// Cap for displayed concept names in the summary (UI density guard).
const CONCEPT_SUMMARY_CAP = 12;

// Deterministic prose templates per strength key. The strong template injects
// the first few concept names so the sentence reads naturally; the others are
// static. No AI, no variation beyond the concept-name interpolation.
const STRENGTH_REASON_TEMPLATES = {
  strong: (themeName, concepts) => {
    const sample = concepts.slice(0, 4).join(", ");
    const tail = concepts.length > 4 ? ", and other related concepts." : ".";
    return `This theme is strongly supported because it appears across multiple discovery sources and includes repeated concepts related to ${sample}${tail}`;
  },
  moderate: () =>
    "This theme has moderate support because it appears in more than one discovery source and includes repeated evidence.",
  emerging: () =>
    "This theme is emerging because it is currently supported by limited evidence.",
  none: () =>
    "No evidence has been recorded for this theme yet.",
};

/**
 * getThemeInsightSummary — assemble the deterministic intelligence summary
 * object for a single theme. Pure projection of buildEvidenceThemes() output.
 */
export function getThemeInsightSummary(theme = {}) {
  const { strengthLabel, strengthKey } = getThemeEvidenceStrength(theme);

  const concepts = Array.isArray(theme?.concepts) ? theme.concepts : [];
  const conceptSummary = concepts.slice(0, CONCEPT_SUMMARY_CAP);
  const primarySources = Array.isArray(theme?.sources) ? theme.sources : [];
  const observedAcrossCount = primarySources.length;

  return {
    themeName: theme?.themeName || "",
    strengthLabel,
    strengthKey,
    entryCount: theme?.entryCount ?? 0,
    sourceCount: theme?.sourceCount ?? 0,
    conceptCount: concepts.length,
    primarySources,
    observedAcrossCount,
    conceptSummary,
    strengthReason: (STRENGTH_REASON_TEMPLATES[strengthKey] || STRENGTH_REASON_TEMPLATES.none)(theme?.themeName || "", conceptSummary),
  };
}