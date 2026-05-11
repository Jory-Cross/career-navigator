/**
 * Structured Assessment Framework — Response Helpers
 *
 * Utilities for:
 * - Evaluating conditional visibility
 * - Normalizing stored responses
 * - Extracting flat evidence from a completed structured assessment
 * - Building source metadata for VFP integration
 */

import { QUESTION_TYPES, EVIDENCE_SOURCE } from "./structuredAssessmentTypes";

// ── Conditional Visibility ────────────────────────────────────────────────────

/**
 * Determine if a conditional question should be visible based on the current
 * responses and the conditional's showWhen trigger values.
 *
 * @param {object} conditional  - A defineConditional() result
 * @param {object} responses    - Current { questionId: value } response map
 * @param {string} parentId     - The parent question's id
 * @returns {boolean}
 */
export function isConditionalVisible(conditional, responses, parentId) {
  const parentValue = responses[parentId];
  if (parentValue === undefined || parentValue === null || parentValue === "") return false;

  const triggers = conditional.showWhen;

  // SELECT_ALL parent: parentValue is an array
  if (Array.isArray(parentValue)) {
    return triggers.some((t) => parentValue.includes(t));
  }

  // YES_NO / MULTIPLE_CHOICE / SCALE: string or number comparison
  return triggers.some((t) => String(t).toLowerCase() === String(parentValue).toLowerCase());
}

// ── Response Normalization ────────────────────────────────────────────────────

/**
 * Normalize a raw response value based on question type.
 * Ensures stored values are always in a predictable format.
 *
 * @param {*}      value         - Raw input value
 * @param {string} questionType  - QUESTION_TYPES constant
 * @returns {*} Normalized value
 */
export function normalizeResponse(value, questionType) {
  if (value === undefined || value === null) return null;

  switch (questionType) {
    case QUESTION_TYPES.YES_NO:
      if (typeof value === "boolean") return value ? "yes" : "no";
      return String(value).toLowerCase() === "yes" ? "yes" : "no";

    case QUESTION_TYPES.SELECT_ALL:
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === "string" && value.length > 0) return [value];
      return [];

    case QUESTION_TYPES.SCALE:
      return value === "" ? null : Number(value);

    case QUESTION_TYPES.NARRATIVE:
    case QUESTION_TYPES.EXAMPLES:
      return typeof value === "string" ? value.trim() : String(value ?? "").trim();

    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return typeof value === "string" ? value : String(value ?? "");

    default:
      return value;
  }
}

// ── Evidence Extraction ───────────────────────────────────────────────────────

/**
 * Extract a flat list of evidence items from a completed structured assessment.
 * Only questions with evidenceCategory and non-empty responses are included.
 * Preserves full narrative text — does NOT truncate.
 *
 * @param {object[]} sections   - Array of defineSection() results
 * @param {object}   responses  - Stored response map { questionId: value }
 * @param {object}   [meta]     - Optional metadata { completedBy, completedAt, source }
 * @returns {object[]} Evidence items ready for VFP integration
 */
export function extractEvidenceFromResponses(sections, responses, meta = {}) {
  const evidence = [];

  for (const section of sections) {
    for (const question of section.questions) {
      _collectEvidence(question, responses, section.id, meta, evidence);
    }
  }

  return evidence;
}

/**
 * Normalize any evidence value to a string for schema compliance.
 */
function normalizeEvidenceValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Convert an implications array (which may contain objects) into strings.
 * Objects are serialized as "<type>: <description> [flag: <flag>]" for readability.
 */
function normalizeImplications(implications) {
  if (!Array.isArray(implications)) return [];
  return implications.map((imp) => {
    if (typeof imp === "string") return imp;
    if (imp && typeof imp === "object") {
      const parts = [];
      if (imp.type) parts.push(imp.type);
      if (imp.description) parts.push(imp.description);
      if (imp.flag) parts.push(`[flag: ${imp.flag}]`);
      return parts.join(": ") || JSON.stringify(imp);
    }
    return String(imp);
  });
}

function _collectEvidence(question, responses, sectionId, meta, output) {
  if (question.type === QUESTION_TYPES.SECTION_HEADER) return;

  const value = responses[question.id];
  const normalized = normalizeResponse(value, question.type);

  // Skip empty responses
  if (normalized === null || normalized === "" || (Array.isArray(normalized) && normalized.length === 0)) {
    // Still recurse into conditionals in case they have explicit values
  } else if (question.evidenceCategory) {
    output.push({
      question_id: question.id,
      section_id: sectionId,
      label: question.label,
      value: normalizeEvidenceValue(normalized),
      evidence_category: question.evidenceCategory,
      evidence_source: meta.source || question.evidenceSource || EVIDENCE_SOURCE.SELF_REPORT,
      evidence_weight: question.evidenceWeight || "medium",
      implications: normalizeImplications(question.implications),
      completed_by: meta.completedBy || null,
      completed_at: meta.completedAt || null,
    });
  }

  // Recurse into conditionals
  if (question.conditionals?.length) {
    for (const conditional of question.conditionals) {
      if (isConditionalVisible(conditional, responses, question.id)) {
        _collectEvidence(conditional.question, responses, sectionId, meta, output);
      }
    }
  }
}

// ── Source Metadata Builder ───────────────────────────────────────────────────

/**
 * Build a source metadata object for VFP integration.
 * Attach this to evidence items or assessment records.
 *
 * @param {object} config
 * @param {string} config.assessmentType  - e.g. "work_environment_tolerance"
 * @param {string} config.completedBy     - Staff email
 * @param {string} config.completedAt     - ISO datetime string
 * @param {string} [config.source]        - EVIDENCE_SOURCE override
 * @param {string} [config.clientId]      - Client ID for traceability
 * @returns {object} Source metadata
 */
export function buildSourceMetadata({ assessmentType, completedBy, completedAt, source, clientId }) {
  return {
    assessment_type: assessmentType,
    completed_by: completedBy || null,
    completed_at: completedAt || new Date().toISOString(),
    source: source || EVIDENCE_SOURCE.STAFF_OBSERVED,
    client_id: clientId || null,
  };
}

// ── Completion Check ──────────────────────────────────────────────────────────

/**
 * Determine which required questions are unanswered.
 * A question is considered required if narrativeRequired === true.
 *
 * @param {object[]} sections   - Section definitions
 * @param {object}   responses  - Current response map
 * @returns {string[]} Array of unanswered required question IDs
 */
export function findUnansweredRequired(sections, responses) {
  const missing = [];

  for (const section of sections) {
    for (const question of section.questions) {
      _checkRequired(question, responses, missing);
    }
  }

  return missing;
}

function _checkRequired(question, responses, missing) {
  if (!question.narrativeRequired) return;

  const value = responses[question.id];
  const normalized = normalizeResponse(value, question.type);
  const isEmpty =
    normalized === null ||
    normalized === "" ||
    (Array.isArray(normalized) && normalized.length === 0);

  if (isEmpty) missing.push(question.id);

  if (question.conditionals?.length) {
    for (const conditional of question.conditionals) {
      if (isConditionalVisible(conditional, responses, question.id)) {
        _checkRequired(conditional.question, responses, missing);
      }
    }
  }
}

// ── Staff Review Flags Extractor ──────────────────────────────────────────────

/**
 * Collect all staff review flags from implications across sections,
 * filtered to only questions that have a non-empty response.
 *
 * @param {object[]} sections   - Section definitions
 * @param {object}   responses  - Current response map
 * @returns {object[]} Array of { label, flag, description }
 */
export function extractStaffReviewFlags(sections, responses) {
  const flags = [];

  for (const section of sections) {
    for (const question of section.questions) {
      _collectFlags(question, responses, flags);
    }
  }

  return flags;
}

function _collectFlags(question, responses, flags) {
  const value = responses[question.id];
  const normalized = normalizeResponse(value, question.type);
  const hasValue =
    normalized !== null &&
    normalized !== "" &&
    !(Array.isArray(normalized) && normalized.length === 0);

  if (hasValue && question.implications?.length) {
    for (const implication of question.implications) {
      if (implication.flag) {
        flags.push({
          question_id: question.id,
          label: question.label,
          flag: implication.flag,
          description: implication.description,
          implication_type: implication.type,
        });
      }
    }
  }

  if (question.conditionals?.length) {
    for (const conditional of question.conditionals) {
      if (isConditionalVisible(conditional, responses, question.id)) {
        _collectFlags(conditional.question, responses, flags);
      }
    }
  }
}