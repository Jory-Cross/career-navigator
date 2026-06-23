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