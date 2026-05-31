/**
 * Skills Audit — Structured Assessment Definition
 *
 * Practical structured skills review for:
 * - identifying tasks and work skills the client can do
 * - documenting skills seen in work, school, home, volunteer, or training settings
 * - identifying supports and training that may help
 * - identifying task areas worth exploring for employment
 * - supporting later FACTS/VFP and job-recommendation review
 *
 * This assessment is different from the Work Performance & Support
 * Observation. The Skills Audit summarizes known or reported skills across
 * settings. The observation assessment documents performance during a
 * specific dated worksite observation.
 *
 * assessment_type: "skills_audit"
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
// Section 1: Skills to Review and Current Work Abilities
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SKILLS_TO_REVIEW = defineSection({
  id: "skills_to_review",
  label: "Skills to Review & Current Work Abilities",
  description:
    "Identify the client's current skills, tasks they have experience with, areas staff have observed, and work tasks worth exploring further.",
  guidance:
    "Keep this section practical. Record what the client can do, what they have done before, what staff have observed, and what still needs practice or further evaluation. A reported skill can be documented even when it still needs observation.",
  questions: [
    defineQuestion({
      id: "skill_areas_to_evaluate",
      label: "Which skill areas should be reviewed for this client?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Basic work skills and following directions",
        "Cleaning or custodial tasks",
        "Laundry or linen tasks",
        "Stocking, sorting, or organizing",
        "Food preparation or kitchen support",
        "Packaging, assembly, or production tasks",
        "Warehouse or material-handling tasks",
        "Office or administrative tasks",
        "Computer or data-entry tasks",
        "Customer service or public interaction",
        "Groundskeeping or outdoor tasks",
        "Communication and workplace behavior",
        "Safety and use of tools or equipment",
        "Other",
      ],
      guidance:
        "Select the work-skill areas that are relevant to the client or are being considered for exploration.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies the skill and task areas to review for vocational exploration and later planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "tasks_client_can_currently_do",
      label: "What work-related tasks can the client currently do?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: sorts clothing by color, wipes tables, stocks lightweight items, uses a phone calculator, follows a short checklist, enters basic information on a computer.",
      guidance:
        "List practical tasks the client can currently complete based on client report, staff knowledge, or observation. Clarify when a task still needs to be observed.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures currently identified work-task skills for later job exploration and skill verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "tasks_from_work_school_home_volunteer_or_training",
      label: "What tasks has the client done before at work, school, home, volunteer activities, or training?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: cleaned classrooms at school, folded laundry at home, stocked food pantry shelves as a volunteer, used a register during prior employment, completed food preparation training.",
      guidance:
        "Include where the task was completed and whether the client reports the experience or it is documented or observed.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies past task experience that may transfer into employment or require further skills verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "tasks_client_feels_comfortable_doing",
      label: "What tasks does the client say they feel comfortable or confident doing?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document tasks the client reports liking, feeling comfortable doing, or wanting to use in a job.",
      guidance:
        "This is the client's perspective. It is important for exploration, but it should not be treated as verified skill performance unless supported by observation or documentation.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported task comfort and confidence for collaborative work exploration.",
        }),
      ],
    }),

    defineQuestion({
      id: "staff_observed_successful_tasks",
      label: "What work-related tasks have staff directly observed the client doing successfully?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: During a community observation, client correctly sorted supplies into bins using a visual checklist and one reminder.",
      guidance:
        "Document the actual task observed, what the client completed successfully, and any support used.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures direct skill evidence that may later inform FACTS/VFP and job-exploration review.",
        }),
      ],
    }),

    defineQuestion({
      id: "tools_equipment_or_technology_client_can_use",
      label: "What tools, equipment, or technology can the client use or has experience using?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: broom and mop, laundry machines, stocking cart, basic hand tools, smartphone apps, keyboard and mouse, email, word processing, calculator, cash register.",
      guidance:
        "Record equipment or technology experience and note when actual skill level or safe use still needs evaluation.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies tool, equipment, and technology experience relevant to possible work tasks and later verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "training_certifications_or_completed_learning",
      label: "What training, certifications, classes, or completed learning may support the client's work skills?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: food handler permit, CPR training, school transition program, custodial training, computer class, workplace safety training, driver's license, or no known training yet.",
      guidance:
        "Include completed or reported training and identify when documentation still needs to be obtained or verified.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures training and credential information that may support vocational planning or require verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "skills_needing_practice_training_or_observation",
      label: "Which skills need more practice, training, support, or observation?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: needs practice using a checklist consistently, has not yet been observed completing multi-step cleaning tasks, may need training with customer greetings, or needs additional computer keyboard practice.",
      guidance:
        "Identify skills that are developing, unverified, or may require additional teaching or support.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies skill-development and verification needs for later training, assessment, or support planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "supports_or_strategies_that_help_skill_performance",
      label: "What supports or strategies appear to help the client learn or perform work tasks?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "No support identified yet",
        "Verbal instruction",
        "One-step directions",
        "Demonstration or modeling",
        "Visual checklist or picture cue",
        "Written instructions",
        "Repetition or practice",
        "Extra processing time",
        "Reminders or redirection",
        "Reduced distractions",
        "Adjusted work pace",
        "Breaks or recovery time",
        "Adaptive equipment or technology",
        "Supervisor or coworker support",
        "Job-coach support",
        "Needs further observation before identifying helpful supports",
        "Other",
      ],
      guidance:
        "Select strategies already reported as helpful or observed as helpful. Use later sections to add detailed evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies supports or learning strategies that may warrant additional evaluation during skill development or work exploration.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_areas_worth_exploring_further",
      label: "Which work tasks or job areas appear worth exploring further based on current skills information?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: explore custodial tasks because client reports comfort cleaning and staff observed accurate table cleaning; evaluate stocking further because sorting strength is present but pace is unknown.",
      guidance:
        "Identify areas for exploration only. Do not treat this as a final job recommendation or job-fit decision.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies possible work-task directions for additional exploration based on available skills evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "skills_information_sources_or_next_verification_needed",
      label: "Where did this skills information come from, and what still needs to be checked or observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Client reported prior laundry experience; staff observed sorting skills during assessment; need to observe ability to use washer/dryer safely and complete the full sequence.",
      guidance:
        "Briefly identify sources and remaining verification needs in plain language. This prevents reported skills from being mistaken for demonstrated skills.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Preserves the source and verification needs for skills information before it is used in later vocational planning.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition — Initial simplified build includes Section 1 only
// Additional practical skills sections will be added and verified incrementally.
// ─────────────────────────────────────────────────────────────────────────────

export const SKILLS_AUDIT_SECTIONS = [
  SECTION_SKILLS_TO_REVIEW,
];

export const SKILLS_AUDIT_META = {
  assessment_type: "skills_audit",
  label: "Skills Audit",
  description:
    "Practical structured review of current work skills, task experience, supports, training needs, and areas for further exploration.",
  version: 1,
  repeatable: false,
};
