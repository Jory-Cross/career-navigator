/**
 * Structured Assessment Framework — Type Definitions
 *
 * This file defines the canonical types and constants for all structured
 * vocational assessments. Assessments built on this framework produce
 * structured evidence for the VFP and recommendation engine.
 *
 * Design principle: Narrative detail is critical. Do NOT over-structure
 * into checkboxes. Every question that produces evidence must support
 * rich contextual elaboration.
 */

// ── Question Types ────────────────────────────────────────────────────────────

export const QUESTION_TYPES = {
  /** Single-select from a list of options */
  MULTIPLE_CHOICE: "multiple_choice",

  /** Multi-select — check all that apply */
  SELECT_ALL: "select_all",

  /** Binary yes/no (always followed by conditional elaboration) */
  YES_NO: "yes_no",

  /** Numeric scale with labeled anchors (e.g. 1–5, 1–10) */
  SCALE: "scale",

  /** Short single-line text field for names, job roles, worksites, and brief values */
  SHORT_TEXT: "short_text",

  /** Calendar date field for observation dates, employment dates, and follow-up dates */
  DATE: "date",

  /** Numeric field for duration, hours, measurable quantities, and similar numeric responses */
  NUMBER: "number",

  /** Free-text narrative — primary evidence carrier */
  NARRATIVE: "narrative",

  /** Long free-text with structured example prompts */
  EXAMPLES: "examples",

  /** Conditional follow-up rendered only when a parent answer matches */
  CONDITIONAL: "conditional",

  /** Visual section divider — no data stored */
  SECTION_HEADER: "section_header",
};
// ── Evidence Categories ───────────────────────────────────────────────────────

export const EVIDENCE_CATEGORY = {
  ENVIRONMENTAL: "environmental",       // workplace physical/sensory environment
  SUPPORT: "support",                   // accommodations, job coaching, natural supports
  VOCATIONAL: "vocational",             // skills, work history, job match
  SOCIAL: "social",                     // interpersonal, communication
  SCHEDULE: "schedule",                 // hours, flexibility, shift tolerance
  TRANSPORTATION: "transportation",     // commute, access, reliability
  FUNCTIONAL: "functional",             // physical, cognitive, sensory capacity
  BEHAVIORAL: "behavioral",            // self-regulation, stress response
  MOTIVATION: "motivation",            // interest, engagement, values
};

// ── Implication Types ─────────────────────────────────────────────────────────

export const IMPLICATION_TYPE = {
  VOCATIONAL: "vocational",             // affects job matching
  ENVIRONMENTAL: "environmental",       // affects workplace fit
  SUPPORT: "support",                   // affects accommodation planning
  RECOMMENDATION: "recommendation",    // affects what to recommend/avoid
  STAFF_REVIEW: "staff_review",         // flags item for staff follow-up
};

// ── Priority Levels for Staff Review Flags ────────────────────────────────────

export const REVIEW_FLAG_PRIORITY = {
  HIGH: "high",       // must verify before recommendation
  MEDIUM: "medium",   // should verify
  LOW: "low",         // note for context
};

// ── Assessment Status ─────────────────────────────────────────────────────────

export const ASSESSMENT_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REVIEWED: "reviewed",
};

// ── Source Metadata ───────────────────────────────────────────────────────────

export const EVIDENCE_SOURCE = {
  SELF_REPORT: "self_report",           // client reported directly
  STAFF_OBSERVED: "staff_observed",     // observed by staff during assessment
  DOCUMENT: "document",                 // extracted from uploaded document
  GUARDIAN_REPORT: "guardian_report",   // reported by guardian/family
  EMPLOYER_REPORT: "employer_report",   // reported by employer/supervisor
};
