/**
 * Work Performance & Support Observation — Definition
 *
 * Repeatable structured observation tool for:
 * - pre-employment situational/community-based assessment
 * - trial work and discovery
 * - job-placement observation
 * - employed job-coaching observation
 * - support-needs review
 * - retention follow-up
 * - support fading review
 *
 * Each completed observation must be saved as its own Assessment record.
 *
 * assessment_type: "work_performance_support_observation"
 */

import {
  defineSection,
  defineQuestion,
  defineImplication,
  QUESTION_TYPES,
  EVIDENCE_CATEGORY,
  IMPLICATION_TYPE,
} from "./structuredAssessmentSchema";

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Observation Setup and Worksite Context
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_OBSERVATION_CONTEXT = defineSection({
  id: "observation_setup_context",
  label: "Observation Setup & Worksite Context",
  description:
    "Document where the observation occurred, why it was completed, what work was attempted, and the environmental and physical demands present.",
  guidance:
    "This section establishes context for later ratings. Record the actual task and setting observed. Do not make job-fit conclusions from context alone.",
  questions: [
    defineQuestion({
      id: "observation_date",
      label: "Date of observation",
      type: QUESTION_TYPES.DATE,
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "observation_purpose",
      label: "What is the purpose of this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Pre-employment situational assessment",
        "Community-based discovery",
        "Trial work experience",
        "Job placement observation",
        "Employed job-coaching observation",
        "Support-needs review",
        "Retention follow-up",
        "Support fading review",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies whether observation evidence applies to exploration, placement, current employment, retention, or support-fading planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "employment_status_at_observation",
      label: "What is the client's employment status at the time of this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Not employed",
        "Exploring work",
        "Trial/work experience",
        "Newly employed",
        "Employed - stabilization",
        "Employed - ongoing supports",
        "Employed - retention/follow-up",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "observation_type",
      label: "What type of work observation was completed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Real employer/worksite",
        "Community-based work experience",
        "Trial work experience",
        "Job shadow with task participation",
        "Simulated work task",
        "Current employment/job coaching visit",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "worksite_name",
      label: "Employer, organization, or simulated worksite name",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Enter worksite or employer name",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "worksite_location",
      label: "Observation location",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Enter location or work area",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "current_employer",
      label: "Current employer, if this is an employed-client observation",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Leave blank if not applicable",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "current_job_title",
      label: "Client's current job title, if employed",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Leave blank if not applicable",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "employment_start_date",
      label: "Employment start date, if known",
      type: QUESTION_TYPES.DATE,
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "low",
    }),

    defineQuestion({
      id: "scheduled_hours_week",
      label: "Current scheduled hours per week, if employed",
      type: QUESTION_TYPES.NUMBER,
      placeholder: "Hours per week",
      evidenceCategory: EVIDENCE_CATEGORY.SCHEDULE,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "observer_name",
      label: "Staff/job coach completing this observation",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Enter observer name",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "low",
    }),

    defineQuestion({
      id: "current_support_provider",
      label: "Current staff/job coach or support provider involved, if applicable",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Enter support provider name or role",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "low",
    }),

    defineQuestion({
      id: "observation_duration_minutes",
      label: "Total observation duration in minutes",
      type: QUESTION_TYPES.NUMBER,
      placeholder: "Minutes observed",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "job_role_observed",
      label: "Job role or occupational area being observed",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder: "Example: custodial, stocking, office support, food preparation",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Links observed evidence to the job role or occupational area evaluated.",
        }),
      ],
    }),

    defineQuestion({
      id: "tasks_attempted",
      label:
        "List the specific work tasks the client attempted or participated in during this observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: sanitized tables, stocked shelves, folded towels, sorted supplies, completed data entry, packaged items...",
      guidance:
        "Identify actual tasks completed or attempted. This is needed to interpret later ratings.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Provides direct context for observed task-performance evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_context_notes",
      label:
        "Describe the work assignment and what the client was expected to do.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Include whether tasks were ordinary employer duties, modified duties, simulated activities, newly learned tasks, or routine duties.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "prior_observation_reviewed",
      label:
        "Was a prior observation reviewed before completing this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Yes",
        "No",
        "No prior observation available",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "low",
    }),

    defineQuestion({
      id: "reason_for_current_review",
      label: "Why is this observation being completed now?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Routine monitoring",
        "New job/task",
        "Employer concern",
        "Client concern",
        "Performance change",
        "Schedule/environment change",
        "Accommodation review",
        "Support fading",
        "Retention support",
        "Incident/safety concern",
        "Initial vocational observation",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Clarifies the support-planning or retention reason for this observation.",
        }),
      ],
    }),

    defineQuestion({
      id: "customer_contact_level",
      label:
        "How much customer or public interaction was present during the observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "None",
        "Occasional",
        "Moderate",
        "Frequent",
        "Constant",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "coworker_interaction_level",
      label: "How much coworker interaction was required?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "None",
        "Occasional",
        "Moderate",
        "Frequent",
        "Constant",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "supervision_level_present",
      label: "What supervision level was naturally present in the setting?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Minimal",
        "Periodic check-ins",
        "Frequent oversight",
        "Continuous oversight",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "work_pace_expectation",
      label: "What pace did the task or worksite require?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Self-paced",
        "Steady routine pace",
        "Moderate productivity expectations",
        "Fast-paced",
        "Variable/unpredictable",
        "Not clear",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "environmental_conditions",
      label: "Which environmental conditions were present?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Quiet",
        "Moderate noise",
        "Loud noise",
        "Crowded",
        "Frequent interruptions",
        "Bright lighting",
        "Temperature exposure",
        "Outdoor setting",
        "Strong smells",
        "Machinery/equipment",
        "Customer-facing",
        "Repetitive setting",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Documents conditions present during observed work performance; later performance sections determine functional impact.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_demands_present",
      label: "Which physical demands were part of the observed task?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Sitting",
        "Standing",
        "Walking",
        "Bending",
        "Reaching",
        "Lifting/carrying",
        "Fine motor work",
        "Repetitive motion",
        "Stairs",
        "Outdoor movement",
        "None/minimal",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents physical demands encountered during observation; later sections determine client tolerance and support needs.",
        }),
      ],
    }),

    defineQuestion({
      id: "context_additional_notes",
      label:
        "Record any additional context needed to understand the observation conditions.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Include anything relevant about the worksite, task setup, supervisor presence, modified duties, unusual conditions, or limits of the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition — Phase A begins with Section 1
// Additional approved sections will be added after this file is verified.
// ─────────────────────────────────────────────────────────────────────────────

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS = [
  SECTION_OBSERVATION_CONTEXT,
];

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_META = {
  assessment_type: "work_performance_support_observation",
  label: "Work Performance & Support Observation",
  description:
    "Repeatable structured observation tool for work performance, support needs, job coaching, retention monitoring, and support fading review.",
  version: 1,
  repeatable: true,
};
