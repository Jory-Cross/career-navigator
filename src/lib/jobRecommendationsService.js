const recommendationStore = new Map();

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRecommendationBatch({
  client_id,
  org_id = null,
  source_resume_ids = [],
  source_assessment_ids = [],
  riasec_summary = "",
  wsa_summary = "",
  combined_profile = "",
  recommendations = [],
  staff_notes = "",
}) {
  const batch = {
    id: makeId(),
    client_id,
    org_id,
    status: "draft",
    source_resume_ids,
    source_assessment_ids,
    riasec_summary,
    wsa_summary,
    combined_profile,
    recommendations,
    staff_notes,
    reviewed_by: null,
    reviewed_at: null,
    approved_recommendation: null,
    generated_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  recommendationStore.set(batch.id, batch);
  return batch;
}

export function getRecommendationBatch(batchId) {
  return recommendationStore.get(batchId) || null;
}

export function getRecommendationBatchesForClient(clientId) {
  return Array.from(recommendationStore.values())
    .filter((batch) => batch.client_id === clientId)
    .sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
}

export function updateRecommendationBatch(batchId, updates) {
  const existing = recommendationStore.get(batchId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    updated_at: nowIso(),
  };

  recommendationStore.set(batchId, updated);
  return updated;
}

export function setRecommendationReview({
  batchId,
  status,
  reviewed_by,
  staff_notes = "",
  approved_recommendation = null,
}) {
  const existing = recommendationStore.get(batchId);
  if (!existing) return null;

  const updated = {
    ...existing,
    status,
    reviewed_by,
    reviewed_at: nowIso(),
    staff_notes,
    approved_recommendation,
    updated_at: nowIso(),
  };

  recommendationStore.set(batchId, updated);
  return updated;
}
