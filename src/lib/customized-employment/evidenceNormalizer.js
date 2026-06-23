export function normalizeEvidenceText(text) {
  if (!text) return "";

  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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