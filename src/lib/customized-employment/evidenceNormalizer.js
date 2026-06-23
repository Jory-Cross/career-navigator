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

export function createEvidenceConcepts(entries = []) {
  const concepts = new Map();

  entries.forEach((entry) => {
    const normalized = normalizeEvidenceText(entry?.text);

    if (!normalized) return;

    if (!concepts.has(normalized)) {
      concepts.set(normalized, {
        concept: entry.text,
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

  return Array.from(concepts.values()).map((concept) => ({
    concept: concept.concept,
    sourceCount: concept.sources.size,
    sources: Array.from(concept.sources),
    entries: concept.entries,
    entryCount: concept.entries.length,
  }));
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