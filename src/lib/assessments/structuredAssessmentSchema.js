/**
 * Structured Assessment Framework — Schema Builders
 *
 * Helper functions for defining assessment sections and questions.
 * Future assessments import these builders and compose their own definitions.
 *
 * Usage:
 *   import { defineSection, defineQuestion, defineConditional } from './structuredAssessmentSchema';
 *
 *   const mySection = defineSection({
 *     id: 'sensory_environment',
 *     label: 'Sensory Environment',
 *     description: 'How the client responds to sensory stimuli in the workplace.',
 *     questions: [ defineQuestion({...}), ... ]
 *   });
 */

import {
  QUESTION_TYPES,
  EVIDENCE_CATEGORY,
  EVIDENCE_SOURCE,
  IMPLICATION_TYPE,
  REVIEW_FLAG_PRIORITY,
} from "./structuredAssessmentTypes";

// ── Section Builder ───────────────────────────────────────────────────────────

/**
 * Define an assessment section.
 *
 * @param {object} config
 * @param {string} config.id               - Unique section key
 * @param {string} config.label            - Display label
 * @param {string} [config.description]    - Optional staff-facing context
 * @param {string} [config.guidance]       - Optional clinical/vocational guidance note
 * @param {Array}  config.questions        - Array of question definitions
 * @returns {object} Section definition
 */
export function defineSection({ id, label, description = "", guidance = "", questions = [] }) {
  return { id, label, description, guidance, questions };
}

// ── Question Builder ──────────────────────────────────────────────────────────

/**
 * Define a single assessment question.
 *
 * @param {object} config
 * @param {string} config.id                     - Unique field key (used for response storage)
 * @param {string} config.label                  - Question text shown to staff
 * @param {string} config.type                   - One of QUESTION_TYPES
 * @param {string} [config.placeholder]          - Input placeholder text
 * @param {string} [config.guidance]             - Staff guidance / clinical note
 * @param {string} [config.evidenceCategory]     - EVIDENCE_CATEGORY classification
 * @param {string} [config.evidenceSource]       - Default EVIDENCE_SOURCE
 * @param {Array}  [config.options]              - For MULTIPLE_CHOICE and SELECT_ALL
 * @param {object} [config.scaleConfig]          - For SCALE type: { min, max, minLabel, maxLabel }
 * @param {Array}  [config.examplePrompts]       - For EXAMPLES type: string[]
 * @param {Array}  [config.conditionals]         - Child conditional questions
 * @param {Array}  [config.implications]         - Vocational implication annotations
 * @param {boolean} [config.narrativeRequired]   - Forces narrative elaboration regardless of answer
 * @param {boolean} [config.evidenceWeight]      - Hint to extraction: high | medium | low
 * @returns {object} Question definition
 */
export function defineQuestion({
  id,
  label,
  type = QUESTION_TYPES.NARRATIVE,
  placeholder = "",
  guidance = "",
  evidenceCategory = null,
  evidenceSource = EVIDENCE_SOURCE.SELF_REPORT,
  options = [],
  scaleConfig = null,
  examplePrompts = [],
  conditionals = [],
  implications = [],
  narrativeRequired = false,
  evidenceWeight = "medium",
}) {
  return {
    id,
    label,
    type,
    placeholder,
    guidance,
    evidenceCategory,
    evidenceSource,
    options,
    scaleConfig,
    examplePrompts,
    conditionals,
    implications,
    narrativeRequired,
    evidenceWeight,
  };
}

// ── Conditional Question Builder ──────────────────────────────────────────────

/**
 * Define a conditional follow-up question that renders only when a parent
 * question's answer matches a trigger value.
 *
 * @param {object} config
 * @param {string|string[]} config.showWhen  - Answer value(s) that trigger this question
 * @param {object} config.question           - A defineQuestion() result
 * @returns {object} Conditional definition
 */
export function defineConditional({ showWhen, question }) {
  const triggers = Array.isArray(showWhen) ? showWhen : [showWhen];
  return { showWhen: triggers, question };
}

// ── Implication Builder ───────────────────────────────────────────────────────

/**
 * Attach a vocational implication annotation to a question.
 * Used by future AI extraction and recommendation engines.
 *
 * @param {object} config
 * @param {string} config.type        - IMPLICATION_TYPE
 * @param {string} config.description - What this response implies vocationally
 * @param {string} [config.flag]      - REVIEW_FLAG_PRIORITY if staff review needed
 * @returns {object} Implication definition
 */
export function defineImplication({ type, description, flag = null }) {
  return { type, description, flag };
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export {
  QUESTION_TYPES,
  EVIDENCE_CATEGORY,
  EVIDENCE_SOURCE,
  IMPLICATION_TYPE,
  REVIEW_FLAG_PRIORITY,
};