/**
 * Work Environment Tolerance Assessment — Definition
 *
 * Uses the Structured Assessment Framework to define all sections and questions.
 * Produces structured vocational evidence for VFP / recommendation integration.
 *
 * assessment_type: "work_environment_tolerance"
 */

import {
  defineSection,
  defineQuestion,
  defineConditional,
  defineImplication,
  QUESTION_TYPES,
  EVIDENCE_CATEGORY,
  EVIDENCE_SOURCE,
  IMPLICATION_TYPE,
  REVIEW_FLAG_PRIORITY,
} from "./structuredAssessmentSchema";

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: General Work Environment Preference
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_GENERAL = defineSection({
  id: "general_environment",
  label: "General Work Environment Preference",
  description: "Capture the client's broad preferences for physical setting, structure, and work style.",
  questions: [
    defineQuestion({
      id: "setting_preference",
      label: "Preferred work setting",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Indoors only", "Outdoors only", "Mix of indoor/outdoor", "No strong preference"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "medium",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Filters jobs by physical setting requirement" }),
      ],
    }),

    defineQuestion({
      id: "environment_noise_level",
      label: "Preferred noise/activity level",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Very quiet", "Moderate / moderate background noise", "Busy / high-energy environment", "No preference"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Informs noise constraint filtering in job recommendations" }),
      ],
    }),

    defineQuestion({
      id: "routine_vs_variety",
      label: "Predictable routine vs. changing tasks",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Strong preference for routine / predictable tasks", "Slight preference for routine", "Comfortable with a mix", "Prefers variety / changing tasks"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Affects tolerance for dynamic vs. structured job roles" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Strong preference for routine / predictable tasks", "Slight preference for routine"],
          question: defineQuestion({
            id: "routine_importance_narrative",
            label: "Describe why routine/predictability is important and what happens when it's disrupted",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Client becomes anxious when tasks change without warning, needs time to adjust, has had job losses related to schedule changes…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Strong evidence for structured, predictable job roles only", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "independent_vs_team",
      label: "Independent vs. team-based work",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Strongly prefers working alone", "Slightly prefers working alone", "Comfortable with either", "Slightly prefers team/collaborative work", "Strongly prefers team/collaborative work"],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Informs team vs. solo role filtering" }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Sensory Tolerance
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SENSORY = defineSection({
  id: "sensory_tolerance",
  label: "Sensory Tolerance",
  description: "Identify specific sensory conditions that may affect the client's ability to function in different workplaces. Narrative detail is critical here.",
  guidance: "Do not frame as diagnosis. Focus on functional workplace impact — what the client can and cannot tolerate, and what happens when exposed.",
  questions: [
    defineQuestion({
      id: "noise_tolerance_scale",
      label: "Noise tolerance — rate overall sensitivity (1 = very sensitive, 5 = not sensitive)",
      type: QUESTION_TYPES.SCALE,
      scaleConfig: { min: 1, max: 5, minLabel: "Very sensitive", maxLabel: "Not sensitive" },
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Noise sensitivity score informs constraint filtering" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: [1, 2],
          question: defineQuestion({
            id: "noise_sensitivity_detail",
            label: "Describe specific noise types that are problematic and how the client responds",
            type: QUESTION_TYPES.EXAMPLES,
            placeholder: "Describe the specific sounds and the client's reaction",
            examplePrompts: ["loud coughing or yawning", "machinery", "music", "crowded room chatter", "phones ringing"],
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            narrativeRequired: false,
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Specific noise triggers for hard constraint filtering", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "May require quiet workspace accommodation" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "lighting_tolerance",
      label: "Lighting sensitivity",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["No issues with any lighting", "Sensitive to fluorescent / overhead lighting", "Sensitive to bright sunlight / outdoor glare", "Prefers dim / natural lighting", "Significant lighting issues — describe below"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["Significant lighting issues — describe below", "Sensitive to fluorescent / overhead lighting"],
          question: defineQuestion({
            id: "lighting_detail",
            label: "Describe the lighting issue and its workplace impact",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Fluorescent lights cause migraines after 2 hours, has worn sunglasses indoors in past jobs…",
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Lighting constraint may require accommodation", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "sensory_triggers_select",
      label: "Other sensory conditions — check all that are problematic",
      type: QUESTION_TYPES.SELECT_ALL,
      options: ["Strong smells / chemical odors", "Temperature extremes (hot or cold)", "Crowded spaces / close proximity to others", "Physical contact / being touched", "Vibration / physical sensations", "None of these apply"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Multiple sensory triggers narrow viable work environments" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Strong smells / chemical odors", "Temperature extremes (hot or cold)", "Crowded spaces / close proximity to others", "Physical contact / being touched", "Vibration / physical sensations"],
          question: defineQuestion({
            id: "sensory_triggers_narrative",
            label: "Describe the specific triggers and their impact on the client's ability to work",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Strong cleaning product smells trigger nausea, client cannot work near chemicals or cleaning staff. Has left jobs due to this…",
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Detailed sensory triggers for constraint engine", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Eliminates specific job settings from recommendations" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "sensory_examples_history",
      label: "Past job situations where sensory issues caused problems or job loss",
      type: QUESTION_TYPES.EXAMPLES,
      placeholder: "Describe what happened, what the trigger was, and how it affected the client's employment",
      examplePrompts: ["left a warehouse job due to loud machinery", "couldn't work restaurant due to smells", "wore headphones but was written up"],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Historical sensory barriers are strongest evidence for constraint filtering", flag: REVIEW_FLAG_PRIORITY.HIGH }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Social / Customer Interaction
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SOCIAL = defineSection({
  id: "social_interaction",
  label: "Social & Customer Interaction",
  description: "Assess comfort with different types of workplace relationships and communication.",
  questions: [
    defineQuestion({
      id: "customer_interaction_comfort",
      label: "Comfort with customer-facing work",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Very comfortable — enjoys customer interaction", "Comfortable in limited amounts", "Neutral", "Prefers minimal customer contact", "Cannot tolerate customer-facing work"],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Customer interaction tolerance informs public-facing role filtering" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Prefers minimal customer contact", "Cannot tolerate customer-facing work"],
          question: defineQuestion({
            id: "customer_avoidance_detail",
            label: "Describe what specifically makes customer interaction difficult",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Struggles with upset customers, freezes when asked unexpected questions, scripted interactions are okay but open-ended are not…",
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Strong evidence to filter out public-facing/retail roles", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "coworker_comfort",
      label: "Comfort working alongside coworkers",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Works well with others — no significant issues", "Prefers limited coworker interaction", "Struggles with close proximity or frequent contact", "Has had significant coworker conflicts in past jobs"],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["Struggles with close proximity or frequent contact", "Has had significant coworker conflicts in past jobs"],
          question: defineQuestion({
            id: "coworker_conflict_narrative",
            label: "Describe past coworker issues and what triggered them",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Arguments related to noise, misread social cues, felt singled out, reacted strongly to perceived rudeness…",
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "May need job coaching for workplace social navigation", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "supervision_style_preference",
      label: "Preferred supervision style",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Direct and clear — frequent check-ins preferred", "Light touch — general direction only", "Autonomous — minimal supervision needed", "Mixed — depends on the task", "Has struggled with authority figures"],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["Has struggled with authority figures"],
          question: defineQuestion({
            id: "supervision_issues_narrative",
            label: "Describe the nature of past supervision difficulties",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Perceived criticism as personal attacks, reacted defensively when corrected, had better outcomes with collaborative vs. directive supervisors…",
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Supervision compatibility is key — verify management style with employer", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "phone_communication",
      label: "Comfort with phone communication at work",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["no"],
          question: defineQuestion({
            id: "phone_difficulty_detail",
            label: "Describe what makes phone communication difficult",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Cannot process spoken information quickly, gets anxious not being able to see the person, prefers written communication…",
            evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
            evidenceWeight: "medium",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Filter out roles requiring frequent phone communication" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "conflict_tolerance",
      label: "How does the client typically respond to workplace conflict or criticism?",
      type: QUESTION_TYPES.EXAMPLES,
      placeholder: "Describe the client's typical response — emotional reactions, withdrawal, escalation, recovery time…",
      examplePrompts: ["shuts down", "argues or escalates", "cries", "takes it personally", "needs time to decompress", "handles it well"],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Conflict response informs job coaching and employer communication needs" }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Pace / Multitasking / Routine
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_PACE = defineSection({
  id: "pace_and_routine",
  label: "Pace, Multitasking & Routine",
  description: "Understand how the client handles workload pressure, task switching, and structured vs. flexible environments.",
  questions: [
    defineQuestion({
      id: "fast_pace_tolerance",
      label: "Ability to work in a fast-paced environment",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Thrives in fast-paced settings", "Can manage for short periods", "Prefers moderate pace", "Struggles significantly with fast pace", "Cannot sustain fast-paced work"],
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Pace tolerance constrains retail, food service, and production roles" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Struggles significantly with fast pace", "Cannot sustain fast-paced work"],
          question: defineQuestion({
            id: "pace_struggle_narrative",
            label: "Describe what happens when pace becomes overwhelming",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Makes errors, becomes physically tense, shuts down, needs to leave the area, has quit or been let go from fast-paced jobs…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Eliminate high-pace roles; flag in environmental constraints", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "multitasking_ability",
      label: "Ability to multitask or handle multiple responsibilities simultaneously",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Multitasks well", "Manages with effort", "Prefers one task at a time", "Cannot multitask effectively"],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Multitasking limitations filter complex or dynamic role types" }),
      ],
    }),

    defineQuestion({
      id: "interruptions_tolerance",
      label: "How does the client handle interruptions while working on a task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Handles interruptions easily", "Mildly affected — can re-focus", "Frequently loses track after interruptions", "Interruptions cause significant problems"],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["Frequently loses track after interruptions", "Interruptions cause significant problems"],
          question: defineQuestion({
            id: "interruption_impact_narrative",
            label: "Describe what happens when interrupted and how long recovery takes",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Loses place in task completely, needs 10–15 minutes to re-engage, becomes frustrated or anxious, makes errors…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "May need uninterrupted work blocks or private workspace", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "written_instructions_need",
      label: "Does the client need written instructions or visual checklists to perform tasks?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "written_instructions_detail",
            label: "Describe what type of support is most helpful and what happens without it",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Visual task lists, step-by-step written procedures, struggles to retain verbal instructions, needs instructions in writing to function independently…",
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Written instructions / visual supports needed — confirm employer can provide", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "task_switching_tolerance",
      label: "Ease of switching between different types of tasks during a shift",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: ["Switches easily — enjoys variety", "Manageable with warning/transition time", "Struggles without preparation", "Very difficult — prefers one task type per shift"],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Stress / Overstimulation Recovery
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_STRESS = defineSection({
  id: "stress_and_recovery",
  label: "Stress & Overstimulation Recovery",
  description: "Understand how the client recognizes and manages overstimulation, overwhelm, or stress at work.",
  guidance: "This section captures critical evidence for accommodation planning. Be specific — generic answers produce weak vocational evidence.",
  questions: [
    defineQuestion({
      id: "overwhelm_triggers",
      label: "What specific workplace situations cause the client to feel overwhelmed or shut down?",
      type: QUESTION_TYPES.EXAMPLES,
      placeholder: "Be specific — list situations, not just general stress",
      examplePrompts: [
        "multiple people talking at once",
        "being observed while working",
        "unexpected change in schedule",
        "conflict with a coworker",
        "too many tasks at once",
        "sensory overload",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      narrativeRequired: false,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Specific overwhelm triggers inform hard environmental constraints" }),
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Triggers are primary input for accommodation planning" }),
      ],
    }),

    defineQuestion({
      id: "overwhelm_signs",
      label: "What signs or behaviors indicate the client is becoming overwhelmed?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Withdrawal / becomes quiet",
        "Physical symptoms (headache, nausea, racing heart)",
        "Verbal outbursts or arguing",
        "Crying",
        "Leaving the area / walking out",
        "Errors increase significantly",
        "Self-stimulating behaviors",
        "Freezing up / unable to respond",
        "Other — describe below",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Observable signals that employer/job coach can watch for" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Other — describe below", "Verbal outbursts or arguing", "Leaving the area / walking out"],
          question: defineQuestion({
            id: "overwhelm_signs_detail",
            label: "Describe in more detail — including frequency and context",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Will argue with supervisors when feeling cornered, has walked off the floor twice in past jobs — both times related to schedule changes with no warning…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Behavioral patterns require employer disclosure planning", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "recovery_strategies",
      label: "What helps the client recover after becoming overwhelmed at work?",
      type: QUESTION_TYPES.EXAMPLES,
      placeholder: "Describe what helps and how long recovery typically takes",
      examplePrompts: [
        "5-minute break in a quiet area",
        "walking outside",
        "being left alone for 10–15 minutes",
        "talking to a trusted person",
        "listening to music with headphones",
        "nothing — needs to leave for the day",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Recovery strategies inform accommodation and supervisor communication planning" }),
      ],
    }),

    defineQuestion({
      id: "break_or_quiet_space_needed",
      label: "Does the client benefit from scheduled breaks or access to a quiet space during the workday?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "break_quiet_detail",
            label: "Describe the type and frequency of break or quiet space needed",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Needs a 10-minute quiet break every 2 hours, has a hard time in open-floor environments without a retreat space, benefits from consistent break schedule…",
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Break/quiet space accommodation should be confirmed with employer", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "past_stress_job_impact",
      label: "Has stress or overstimulation contributed to job loss or poor performance in past employment?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "past_stress_job_narrative",
            label: "Describe what happened — what the trigger was and how it affected employment",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Left three jobs in a year due to noise sensitivity — could not sustain warehouse or retail settings. Most successful in a library job where environment was quiet and predictable…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            narrativeRequired: false,
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Stress-related job loss history is strongest evidence for environmental constraint filtering", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Identifies specific environments to eliminate from recommendations" }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Best-Fit Work Conditions
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_BEST_FIT = defineSection({
  id: "best_fit_conditions",
  label: "Best-Fit Work Conditions",
  description: "Capture staff synthesis of the client's ideal work environment and any red-flag settings to avoid.",
  guidance: "This section is for staff narrative synthesis. These answers feed directly into recommendation constraint logic.",
  questions: [
    defineQuestion({
      id: "ideal_environment_narrative",
      label: "Describe the ideal work environment for this client in detail",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. Quiet office or library-style setting, predictable tasks, minimal customer contact, supportive supervisor who gives clear written instructions, flexible break schedule…",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      narrativeRequired: false,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Primary positive constraint for recommendation engine" }),
      ],
    }),

    defineQuestion({
      id: "environments_to_avoid",
      label: "List specific work environments or conditions this client should NOT be placed in",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. No food service, no loud manufacturing, no outdoor summer work, no roles requiring frequent phone calls, no environments with chemical smells…",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Hard negative constraints for recommendation engine — eliminates specific environments", flag: REVIEW_FLAG_PRIORITY.HIGH }),
      ],
    }),

    defineQuestion({
      id: "preferred_supports_at_work",
      label: "What supports would be most helpful for this client in a new job?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Job coach on-site during initial weeks",
        "Written task list / visual schedule",
        "Sensory accommodation (quiet space, noise-canceling headphones, etc.)",
        "Flexible break schedule",
        "Modified hours / reduced schedule",
        "Employer communication support",
        "Transportation support",
        "Peer mentor or buddy",
        "Natural supports from family/guardian",
        "Regular check-ins with VR counselor",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Recommended supports for job development and placement planning" }),
      ],
    }),

    defineQuestion({
      id: "staff_followup_flags",
      label: "Staff follow-up notes — anything from this assessment that needs to be verified or discussed before job placement",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. Client described behavior that may need employer disclosure discussion. Recommend confirming break accommodation before placement. Family expressed concern about…",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Direct staff follow-up flags", flag: REVIEW_FLAG_PRIORITY.HIGH }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition
// ─────────────────────────────────────────────────────────────────────────────

export const WORK_ENVIRONMENT_TOLERANCE_SECTIONS = [
  SECTION_GENERAL,
  SECTION_SENSORY,
  SECTION_SOCIAL,
  SECTION_PACE,
  SECTION_STRESS,
  SECTION_BEST_FIT,
];

export const WORK_ENVIRONMENT_TOLERANCE_META = {
  assessment_type: "work_environment_tolerance",
  label: "Work Environment Tolerance Assessment",
  description: "Captures structured and narrative evidence about the client's preferred and tolerated work environments for vocational planning.",
  version: 1,
};