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
// Section 2: Task Instructions and Learning
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TASK_INSTRUCTIONS_LEARNING = defineSection({
  id: "task_instructions_learning",
  label: "Task Instructions & Learning",
  description:
    "Document how work tasks were introduced or taught, how the client responded to instruction, and what learning strategies were effective during this observation.",
  guidance:
    "This section documents instruction and observed learning response only. Do not make final conclusions about job fit, overall work performance, accommodation need, retention risk, or ongoing support level from this section alone. Prompting levels for ongoing job-task performance will be documented in the task-performance section.",
  questions: [
    defineQuestion({
      id: "task_familiarity_at_start",
      label: "How familiar was the client with the observed task at the start of this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "New task - not previously attempted",
        "Previously introduced but not routine",
        "Previously practiced task",
        "Routine or familiar task",
        "Known task with changed expectations or conditions",
        "Unable to determine",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Clarifies whether observed learning occurred on a new, practiced, routine, or changed job task.",
        }),
      ],
    }),

    defineQuestion({
      id: "instruction_provider",
      label: "Who provided instruction or task guidance during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Employment specialist/job coach",
        "Supervisor",
        "Coworker/natural support",
        "Trainer/instructor",
        "Client already knew task - no new instruction provided",
        "Other",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "instruction_methods_used",
      label: "Which instruction or teaching methods were used?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Verbal explanation",
        "Demonstration/modeling",
        "Written instructions",
        "Visual checklist or visual cue",
        "Task breakdown into smaller steps",
        "Repeated practice",
        "Side-by-side coaching",
        "Technology-based instruction or reminder",
        "Natural coworker/supervisor instruction",
        "No instruction needed during observation",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies teaching methods used during observed work-task learning for later review of effective support strategies.",
        }),
      ],
    }),

    defineQuestion({
      id: "instruction_complexity",
      label: "How complex were the instructions or task sequence being taught?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Single simple step",
        "Short predictable multi-step sequence",
        "Longer structured multi-step sequence",
        "Complex task requiring judgment or problem solving",
        "Variable task with changing instructions",
        "Unable to determine",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "instructions_given_notes",
      label: "Describe the actual instructions or teaching provided during this observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the task directions, demonstrations, written or visual materials, step-by-step teaching, practice opportunities, or natural supports provided.",
      guidance:
        "Record what was taught and how it was taught. Include enough detail to understand the learning demand placed on the client.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "initial_understanding_after_instruction",
      label: "After initial instruction, how did the client demonstrate understanding of the task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Demonstrated understanding and began task appropriately",
        "Demonstrated partial understanding and needed clarification",
        "Needed instruction repeated or broken into smaller steps",
        "Needed demonstration before beginning",
        "Did not demonstrate understanding during the observation",
        "No new instruction was provided",
        "Not observed",
      ],
      guidance:
        "Rate the initial learning response only. Ongoing prompt levels for task performance will be recorded in the next section.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "clarification_or_reteaching_needed",
      label: "How much clarification or reteaching was needed while the client was learning the task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "None needed",
        "One clarification or brief reminder",
        "Occasional reteaching",
        "Repeated reteaching",
        "Continuous teaching throughout the observation",
        "No new learning demand was observed",
        "Unable to determine",
      ],
      guidance:
        "Document the frequency of reteaching needed for learning. Do not use this field as the ongoing task-performance prompt rating.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether task learning required clarification, repeated teaching, or continuous instruction during this observation.",
        }),
      ],
    }),

    defineQuestion({
      id: "learning_strategies_that_helped",
      label: "Which learning strategies appeared helpful during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Verbal explanation",
        "Demonstration/modeling",
        "Visual cue or checklist",
        "Written directions",
        "Breaking task into smaller steps",
        "Practice and repetition",
        "Immediate corrective feedback",
        "Reduced distractions during learning",
        "Extra processing time",
        "Coworker or supervisor natural support",
        "No specific strategy identified",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies observed teaching strategies that may warrant continued evaluation in future work observations.",
        }),
      ],
    }),

    defineQuestion({
      id: "retention_during_observation",
      label: "During this observation, how well did the client retain the task steps after instruction or practice?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Retained task steps during the observation",
        "Retained most steps but needed occasional review",
        "Repeatedly forgot or missed previously taught steps",
        "Unable to retain the task steps during the observation",
        "Task was too brief to evaluate retention",
        "No new instruction was provided",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "response_to_correction",
      label: "How did the client respond to correction or feedback during task learning?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Accepted feedback and adjusted performance",
        "Accepted feedback but needed repeated explanation",
        "Accepted feedback but needed additional practice",
        "Became frustrated, stressed, or discouraged",
        "Resisted or did not apply feedback",
        "No correction or feedback was needed",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "adaptation_to_change_or_new_instruction",
      label: "How did the client respond when instructions, steps, or task expectations changed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Adjusted to change without difficulty",
        "Adjusted after clarification or practice",
        "Needed significant reteaching after change",
        "Struggled or became distressed with change",
        "No change in instruction or expectation occurred",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "learning_support_effectiveness",
      label: "Describe which teaching approaches were effective or ineffective for this client during the observed task.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe what helped the client understand, learn, remember, or adapt to the task. Include any teaching methods that were attempted but did not appear helpful.",
      guidance:
        "Document observed effectiveness only. Avoid making broader support recommendations until supported by additional observations and later sections.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides observed evidence regarding effective or ineffective instructional strategies for later support planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "change_from_prior_observation_learning",
      label: "Compared with a prior observation of this task or similar work, how has the client's learning response changed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Improved learning or retention",
        "Similar learning response",
        "Needed more teaching or reteaching",
        "Needed less teaching or reteaching",
        "Different task - comparison not appropriate",
        "No prior observation available",
        "Unable to determine",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "task_instruction_learning_notes",
      label: "Additional observed evidence about task instruction and learning",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document additional examples, client comments, supervisor input, learning barriers, successful teaching moments, or limits of what could be observed.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Task Performance, Pace, Accuracy, Quality, and Support Progress
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TASK_PERFORMANCE_SUPPORT_PROGRESS = defineSection({
  id: "task_performance_support_progress",
  label: "Task Performance, Pace, Accuracy, Quality & Support Progress",
  description:
    "Document the client's observed performance on the specific work task or activity completed during this dated observation.",
  guidance:
    "This section captures performance evidence from the task or work activity observed during this visit. Use it to document functional vocational evidence for FACTS/VFP and later planning. It is not the reusable ongoing employed-client task-analysis tool. Detailed recurring job-duty plans and step-by-step prompt ratings will be built separately once actual employed job responsibilities are known.",
  questions: [
    defineQuestion({
      id: "primary_task_evaluated",
      label: "What was the primary task or work activity evaluated during this observation?",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder:
        "Example: collecting laundry, stocking shelves, folding towels, cleaning tables, sorting supplies",
      guidance:
        "Enter the main observed task being evaluated in this section.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies the primary work task connected to the task-performance evidence documented in this observation.",
        }),
      ],
    }),

    defineQuestion({
      id: "additional_tasks_evaluated",
      label: "Were any additional tasks observed or evaluated during this visit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "List any additional tasks observed and provide brief context about the client's participation or performance.",
      guidance:
        "Use this field for additional observed activities. The primary rating questions below should focus on the main task unless otherwise explained in notes.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "task_initiation",
      label: "How did the client begin the primary observed task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Initiated task independently after assignment or expected cue",
        "Initiated after a gesture or visual cue",
        "Initiated after an indirect verbal prompt",
        "Initiated after a direct verbal prompt",
        "Initiated after modeling or demonstration",
        "Required physical assistance to begin",
        "Did not initiate task during the observation",
        "Not observed",
      ],
      guidance:
        "Document how the client began the observed task, not how the task was initially taught.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents the level of support required for initiation of the observed work task.",
        }),
      ],
    }),

    defineQuestion({
      id: "overall_prompt_level_for_observed_tasks",
      label: "What was the highest level of prompt or assistance required for the primary observed task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "I - Independent",
        "G - Gesture",
        "IV - Indirect Verbal",
        "V - Verbal",
        "M - Model",
        "PA - Physical Assistance",
        "Unable to determine",
        "Not observed",
      ],
      guidance:
        "Select the highest level of support required during performance of the primary task. Use the next narrative field to identify which part of the task required that support and whether performance varied across steps.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Summarizes the highest observed prompt or assistance level required during performance of the evaluated task.",
        }),
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Provides observed task-support evidence for later vocational planning and support verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "prompt_level_examples",
      label: "Describe where prompting or assistance was required during the observed task.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Client independently located the cart and collected items, but needed a verbal reminder to verify all bins were checked before returning to the laundry area.",
      guidance:
        "Describe the specific part of the task where support was needed. If support level differed across parts of the task, document those differences here.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides specific observed evidence about where task prompting or assistance was needed.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_sequence_completion",
      label: "How well did the client complete the task steps in the expected order?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Completed steps in expected order independently",
        "Completed steps in order with occasional support",
        "Completed steps in order with repeated support",
        "Completed some steps but missed or reordered important steps",
        "Unable to complete the task sequence",
        "Task did not require a sequence of steps",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "task_completion_level",
      label: "What level of task completion was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Completed task independently",
        "Completed task with minimal support",
        "Completed task with moderate support",
        "Completed task with substantial support",
        "Partially completed task",
        "Unable to complete task",
        "Task was started but observation ended before completion",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed task-completion evidence relevant to vocational functioning and future evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "work_pace_observed",
      label: "How did the client's work pace compare with the expectation of the observed task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Met expected pace independently",
        "Met expected pace with support or reminders",
        "Completed task at a slower pace but remained functional",
        "Pace was substantially slower than task expectation",
        "Worked too quickly and quality or safety was affected",
        "Pace expectation was not established",
        "Unable to determine during this observation",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents whether the observed work pace appeared compatible with the task expectation during this observation.",
        }),
      ],
    }),

    defineQuestion({
      id: "accuracy_quality_observed",
      label: "What level of accuracy or work quality was observed on the primary task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Accurate work meeting task expectations",
        "Generally accurate with minor correctable errors",
        "Completed task with repeated quality errors",
        "Quality concerns significantly affected task completion",
        "Unable to assess quality because task was incomplete",
        "Quality standard was not clear",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "error_awareness_and_correction",
      label: "How did the client respond to errors or quality issues during task performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Identified and corrected errors independently",
        "Corrected errors after gesture or visual cue",
        "Corrected errors after indirect verbal prompt",
        "Corrected errors after direct verbal instruction",
        "Corrected errors after modeling or demonstration",
        "Required physical assistance to correct error",
        "Did not recognize or correct error during observation",
        "No errors observed",
        "Not observed",
      ],
      guidance:
        "Document observed response to actual errors or quality issues. Do not assume error awareness when no error occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents the support required for error recognition or correction during observed task performance.",
        }),
      ],
    }),

    defineQuestion({
      id: "persistence_and_follow_through",
      label: "How did the client persist with and follow through on the observed task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Remained engaged and completed the task",
        "Remained engaged with occasional redirection or encouragement",
        "Needed repeated redirection or encouragement to continue",
        "Stopped task and required significant support to resume",
        "Did not resume or complete task after difficulty",
        "Observation was too brief to evaluate",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "support_or_training_needed_from_observation",
      label: "What additional instruction, support, practice, or verification appears needed based on this observed task?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observed needs such as additional task practice, visual supports to evaluate, safety review, task-sequencing instruction, pace monitoring, quality checking, or additional observation before drawing conclusions.",
      guidance:
        "Base this entry only on observed performance evidence. Do not create final employment recommendations from a single observation unless verified through the broader process.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies support or training areas indicated by observed task-performance evidence for later review and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_performance_strengths_observed",
      label: "What work-performance strengths were observed during this task?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as independent task initiation, accurate completion, consistent pace, persistence, safe work habits, response to feedback, or successful use of learned strategies.",
      guidance:
        "Record observed strengths rather than general impressions.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed work-performance strengths relevant to FACTS/VFP and later career planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_performance_concerns_observed",
      label: "What work-performance concerns, difficulties, or barriers were observed during this task?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as missed steps, need for repeated prompts, poor quality, slow pace, safety concerns, difficulty correcting errors, frustration, or incomplete performance.",
      guidance:
        "Document observable functional evidence and avoid conclusions not supported by what occurred during this observation.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed functional work-performance concerns requiring consideration or later verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "task_performance_vocational_implications",
      label: "What are the vocational implications of the task-performance evidence observed during this visit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how the observed task evidence may inform FACTS/VFP, further situational assessment, training needs, job exploration, workplace-support review, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning while identifying any conclusions that still require additional observation or verification.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed task-performance evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Physical Demands, Stamina, Endurance, and Support Needs
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_PHYSICAL_DEMANDS_STAMINA_SUPPORTS = defineSection({
  id: "physical_demands_stamina_supports",
  label: "Physical Demands, Stamina, Endurance & Support Needs",
  description:
    "Document physical work demands actually performed during this observation and the client's observable stamina, endurance, recovery needs, and physical supports used.",
  guidance:
    "Document observed functional performance only. Do not diagnose medical conditions or assume why difficulty occurred. Record what was physically required, what was observed, what supports were used, and what may require further verification.",
  questions: [
    defineQuestion({
      id: "physical_activity_observed",
      label: "Which physical activities did the client actually perform during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Sitting",
        "Standing",
        "Walking",
        "Bending",
        "Stooping",
        "Kneeling or crouching",
        "Reaching",
        "Lifting",
        "Carrying",
        "Pushing or pulling",
        "Climbing stairs",
        "Fine motor work",
        "Repetitive hand or arm motion",
        "Outdoor movement",
        "Position changes",
        "No meaningful physical demand observed",
        "Other",
      ],
      guidance:
        "Select physical activities actually performed by the client, not only demands that existed in the worksite.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies the physical work activities connected to observed stamina, tolerance, and support evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "time_on_task_or_activity_duration",
      label: "Approximately how long was the client engaged in the physically demanding activity or work task?",
      type: QUESTION_TYPES.SHORT_TEXT,
      placeholder:
        "Example: stood for 25 minutes; walked intermittently for 45 minutes; lifted boxes during a 20-minute stocking task",
      guidance:
        "Include duration and relevant activity context when known. This helps interpret observed endurance and recovery needs.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "standing_tolerance_observed",
      label: "What standing tolerance was observed during the work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Standing demand not part of observed task",
        "Tolerated standing demand without observed difficulty",
        "Tolerated standing demand with minor signs of fatigue or discomfort",
        "Needed a brief rest, position change, or support to continue standing task",
        "Standing difficulty reduced pace, quality, or task participation",
        "Unable to continue standing portion of task",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Rate observable response to standing demand only. Do not infer a medical cause.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed standing tolerance relevant to work-task compatibility and further verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "walking_mobility_tolerance_observed",
      label: "What walking or workplace-mobility tolerance was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Walking or mobility demand not part of observed task",
        "Tolerated walking or movement demand without observed difficulty",
        "Tolerated movement demand with minor slowing or fatigue",
        "Needed a brief rest, support, or route adjustment to continue",
        "Mobility difficulty reduced pace, quality, or task participation",
        "Unable to continue movement portion of task",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observed response to workplace movement, walking, or route demands.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed mobility tolerance relevant to task access, endurance, and workplace-demand review.",
        }),
      ],
    }),

    defineQuestion({
      id: "lifting_carrying_tolerance_observed",
      label: "What lifting, carrying, pushing, or pulling tolerance was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Lifting, carrying, pushing, or pulling not part of observed task",
        "Completed physical handling demand safely without observed difficulty",
        "Completed demand with minor slowing, effort, or fatigue",
        "Needed instruction, modification, or support to safely complete demand",
        "Physical handling difficulty reduced pace, quality, or participation",
        "Unable to complete physical handling demand",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document only the physical handling activity actually observed and the client's observable response.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed response to material-handling demands relevant to work-task planning and safety review.",
        }),
      ],
    }),

    defineQuestion({
      id: "bending_reaching_repetitive_motion_tolerance",
      label: "What response was observed to bending, reaching, repetitive movement, or fine motor demands?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "These demands were not part of the observed task",
        "Completed demands without observed difficulty",
        "Completed demands with minor slowing, effort, or fatigue",
        "Needed brief rest, repositioning, modification, or support",
        "Difficulty reduced pace, accuracy, quality, or task participation",
        "Unable to complete the required demand",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Use notes below to clarify which specific demand was present and what was observed.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "fatigue_or_endurance_observed",
      label: "How did fatigue or endurance affect observed work performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No observable fatigue affecting performance",
        "Mild fatigue observed but task performance remained functional",
        "Fatigue appeared to slow pace or reduce efficiency",
        "Fatigue appeared to affect quality, accuracy, or persistence",
        "Fatigue required break, modification, or support to continue",
        "Fatigue prevented continuation or completion of task",
        "Observation was too brief to evaluate endurance",
        "Not observed",
      ],
      guidance:
        "Record observable performance impact only. Do not infer medical cause.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether observable fatigue or endurance needs affected work performance and may require further support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "pain_discomfort_or_physical_distress_observed",
      label: "Was observable pain, discomfort, or physical distress reported or observed during the task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No pain, discomfort, or physical distress reported or observed",
        "Client reported minor discomfort without observable effect on performance",
        "Observable discomfort or client report appeared to slow performance",
        "Discomfort required rest, repositioning, modification, or support",
        "Discomfort significantly limited task participation or completion",
        "Client reported concern but impact on performance was unclear",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Record client report and observable impact when present. Do not make a medical conclusion or identify a cause unless already verified elsewhere.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed or reported physical discomfort affecting work-task participation for later verification and support planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "breaks_or_recovery_needed",
      label: "What break or recovery support was needed during the observed physical activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No break or recovery support needed",
        "Used normally scheduled break only",
        "Needed brief unscheduled rest or position change",
        "Needed multiple breaks or extended recovery time",
        "Needed modified task demand or reduced physical activity",
        "Could not resume task after rest or modification",
        "Observation was too brief to evaluate",
        "Not observed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed break, recovery, or task-modification needs related to physical work demands.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_safety_concerns_observed",
      label: "Document any physical, ergonomic, mobility, or task-safety concerns observed.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: unsafe lifting posture, instability while carrying materials, difficulty navigating stairs, overfilled cart, repeated reaching above shoulder level, fatigue affecting safe task completion, or no concerns observed.",
      guidance:
        "Record specific observed behaviors or conditions. Include when no physical safety concern was observed if safety was evaluated.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies observed physical or ergonomic safety concerns requiring review, modification, training, or further verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_supports_or_modifications_used",
      label: "Which physical supports, modifications, or strategies were used or tried during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "None used or needed",
        "Seated work option",
        "Sit/stand position change",
        "Scheduled break",
        "Additional brief rest break",
        "Reduced lifting or carrying demand",
        "Cart, dolly, or transport aid",
        "Modified work height or reach demand",
        "Reduced repetitive movement",
        "Adjusted work pace",
        "Task rotation",
        "Ergonomic instruction or safe-lifting guidance",
        "Mobility or route modification",
        "Personal protective equipment",
        "Other",
        "Not observed",
      ],
      guidance:
        "Select supports or modifications actually used or tried during the observation, not possibilities that were not tested.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies physical-support strategies tried during observed work activity for later effectiveness review.",
        }),
      ],
    }),

    defineQuestion({
      id: "effectiveness_of_physical_supports",
      label: "Describe the effectiveness of any physical supports, modifications, breaks, or strategies used.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe what was used, why it was used, whether it improved safety, stamina, pace, quality, comfort, or participation, and whether additional verification is needed.",
      guidance:
        "Record observed results only. If no support was used or evaluated, state that clearly.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides observed evidence about whether physical-support strategies appeared effective during the work task.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_demands_strengths_observed",
      label: "What physical-performance or stamina strengths were observed during this task?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as tolerating standing demands, safely carrying materials, maintaining functional stamina, completing repetitive tasks, using safe movement strategies, or recovering appropriately after activity.",
      guidance:
        "Document observed strengths tied to the physical work activity performed.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed physical-work strengths relevant to FACTS/VFP and later vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_demands_concerns_observed",
      label: "What physical-demand, stamina, endurance, or recovery concerns were observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as reduced pace after standing, difficulty carrying items, repeated need for rest, task limitation caused by fatigue, safety concerns, or areas requiring additional observation.",
      guidance:
        "Record functional evidence only and identify what still requires further evaluation or verification.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed physical-demand concerns that may affect vocational planning or require additional evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "physical_demands_vocational_implications",
      label: "What are the vocational implications of the observed physical-demand and stamina evidence?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how the observed evidence may inform FACTS/VFP, additional situational assessment, job exploration, physical-demand matching, support review, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning without making medical conclusions or unsupported job-fit determinations.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed physical-demand and stamina evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Work Environment, Sensory Tolerance, Distraction, and
// Environmental Support Needs
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_ENVIRONMENTAL_SENSORY_SUPPORTS = defineSection({
  id: "environmental_sensory_supports",
  label: "Work Environment, Sensory Tolerance, Distraction & Environmental Support Needs",
  description:
    "Document the environmental conditions the client actually experienced during the observed task and any observable effect on work participation, pace, quality, focus, or support needs.",
  guidance:
    "Section 1 records conditions present in the setting. This section records the client's observable response to environmental demands during the task. Document observed functional evidence and client-reported concerns when available. Do not diagnose sensory conditions or conclude job incompatibility from preference or exposure alone.",
  questions: [
    defineQuestion({
      id: "environmental_conditions_experienced_during_task",
      label: "Which environmental conditions did the client actually experience while performing the observed task?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Quiet setting",
        "Moderate background noise",
        "Loud noise",
        "Sudden or unpredictable sounds",
        "Crowded work area",
        "Close proximity to coworkers",
        "Customer or public interaction",
        "Frequent interruptions",
        "Multiple competing visual activities",
        "Bright or harsh lighting",
        "Dim lighting",
        "Strong smells or cleaning products",
        "Temperature exposure",
        "Outdoor conditions",
        "Machinery or powered equipment",
        "Alarms, buzzers, or operational signals",
        "Material or texture exposure",
        "Repetitive or low-stimulation environment",
        "No meaningful environmental demand observed",
        "Other",
      ],
      guidance:
        "Select only conditions directly experienced by the client during work participation, not all possible conditions at the site.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Identifies environmental demands directly connected to observed task participation and tolerance evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "noise_tolerance_observed",
      label: "What response to noise or unexpected sound was observed during the work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Noise or unexpected sound demand not present during observed task",
        "Tolerated noise demand without observable difficulty",
        "Tolerated noise with mild distraction or discomfort",
        "Needed brief support, redirection, or adjustment due to noise",
        "Noise reduced pace, accuracy, quality, or task participation",
        "Noise caused the client to stop, withdraw, or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document the client's observable response to sound demands that occurred during the task.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Documents observed response to worksite noise or unexpected sound for later environmental-support and job-demand review.",
        }),
      ],
    }),

    defineQuestion({
      id: "visual_lighting_tolerance_observed",
      label: "What response to lighting, visual activity, or visual distraction was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Lighting or visual-distraction demand not present during observed task",
        "Tolerated visual demand without observable difficulty",
        "Tolerated visual demand with mild distraction or discomfort",
        "Needed brief support, redirection, or environmental adjustment",
        "Visual demand reduced pace, accuracy, quality, or task participation",
        "Visual demand caused the client to stop, withdraw, or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable response to lighting conditions, visual movement, clutter, or competing visual activity.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "crowding_proximity_tolerance_observed",
      label: "What response to crowding, close proximity, customer presence, or shared workspace demands was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Crowding or proximity demand not present during observed task",
        "Tolerated proximity demand without observable difficulty",
        "Tolerated demand with mild discomfort or distraction",
        "Needed brief support, redirection, space, or adjustment",
        "Proximity demand reduced pace, accuracy, quality, or task participation",
        "Proximity demand caused the client to stop, withdraw, or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document environmental response to working near others or the public. Communication and social-performance evidence will be captured separately in Section 6.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Documents observed response to shared-space or public-facing environmental demands without independently rating social skill.",
        }),
      ],
    }),

    defineQuestion({
      id: "interruption_distraction_tolerance_observed",
      label: "What response to interruptions, distractions, or task switching was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Interruption, distraction, or task-switching demand not present",
        "Maintained task focus without observable difficulty",
        "Returned to task after mild distraction without significant difficulty",
        "Needed brief redirection, reminder, or adjustment to return to task",
        "Distraction reduced pace, accuracy, quality, or task completion",
        "Distraction or interruption caused the client to stop or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable task-focus response to environmental interruptions or competing demands.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether environmental distraction or interruption created an observable need for support, redirection, or task adjustment.",
        }),
      ],
    }),

    defineQuestion({
      id: "smell_temperature_material_tolerance_observed",
      label: "What response to smells, temperature, material textures, cleaning products, or similar exposure was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "These environmental exposures were not present during observed task",
        "Tolerated exposure without observable difficulty",
        "Tolerated exposure with mild discomfort or hesitation",
        "Needed brief support, protective barrier, or environmental adjustment",
        "Exposure reduced pace, accuracy, quality, or task participation",
        "Exposure caused the client to stop, withdraw, or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Record observable response or client report related to exposure during the task. Do not infer intolerance when no response was observed.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "machinery_equipment_environment_tolerance_observed",
      label: "What response to machinery, powered equipment, alarms, or operational worksite stimulation was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Machinery, equipment, alarm, or operational stimulation not present",
        "Tolerated demand without observable difficulty",
        "Tolerated demand with mild distraction, hesitation, or discomfort",
        "Needed brief support, instruction, redirection, or adjustment",
        "Demand reduced pace, accuracy, quality, or task participation",
        "Demand caused the client to stop, withdraw, or become unable to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document response to the environmental stimulation associated with equipment or operations. Task-safety concerns should also be documented when applicable.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Documents observed response to operational worksite stimulation relevant to environmental-demand and support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_effect_on_task_performance",
      label: "Overall, how did environmental demands affect the client's observed task performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No observable environmental effect on task performance",
        "Environmental demands were present but performance remained functional",
        "Environmental demands caused mild distraction or discomfort without significant performance impact",
        "Environmental demands required brief support or adjustment to maintain performance",
        "Environmental demands reduced pace, accuracy, quality, focus, or participation",
        "Environmental demands significantly interfered with task completion",
        "Observation did not include meaningful environmental demands",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Summarize overall observable performance impact. Use narrative fields to identify which conditions affected performance and how.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the observed effect of environmental demands on work performance for later vocational planning and verification.",
        }),
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies whether environmental supports or modifications may require additional evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_response_examples",
      label: "Describe specific examples of the client's response to environmental conditions during the task.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Client continued stocking with moderate background noise but lost place when a loud cart alarm occurred; returned to task after one verbal redirection.",
      guidance:
        "Document observable behavior, client report when provided, environmental condition present, and any effect on task performance.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.ENVIRONMENTAL,
          description:
            "Provides specific observed evidence linking environmental exposure to functional work response.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_supports_or_modifications_used",
      label: "Which environmental supports, modifications, or strategies were used or tried during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "None used or needed",
        "Quieter work area",
        "Reduced interruptions",
        "Reduced visual stimulation or visual barrier",
        "Adjusted lighting",
        "Increased distance from customers or coworkers",
        "Headphones or hearing protection",
        "Gloves or material barrier",
        "Modified exposure to smells or cleaning products",
        "Temperature adjustment",
        "Advance warning of noise, changes, or transitions",
        "Predictable routine or structured workflow",
        "Break or recovery space",
        "Job-coach redirection or reassurance",
        "Task change or temporary removal from demand",
        "Other",
        "Not observed",
      ],
      guidance:
        "Select only supports or environmental changes actually used or tested during the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies environmental-support strategies tried during observed work participation for later effectiveness review.",
        }),
      ],
    }),

    defineQuestion({
      id: "effectiveness_of_environmental_supports",
      label: "Describe the effectiveness of environmental supports, modifications, or strategies used during the observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe what was tried, what environmental demand it addressed, whether task participation or regulation improved, and what may require additional observation.",
      guidance:
        "Record observed results only. If no environmental support was used or evaluated, state that clearly.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides observed evidence about whether environmental-support strategies appeared effective during work participation.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_environmental_preferences_or_concerns",
      label: "What environmental preferences, concerns, or reactions did the client report during or after this observation?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the client's own report about noise, lighting, people nearby, smells, temperature, equipment, interruptions, or environmental preferences. State if no client report was obtained.",
      guidance:
        "Separate client report from staff observation. Client-reported preference or concern is valuable evidence but should not be treated as observed performance impact unless supported by what occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported environmental preferences and concerns for later vocational exploration and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_strengths_observed",
      label: "What environmental tolerance or coping strengths were observed during the work activity?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as maintaining task focus despite background noise, adapting to normal interruptions, working successfully near others, tolerating materials, or using a support strategy effectively.",
      guidance:
        "Document strengths connected to actual environmental conditions experienced during the task.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed environmental-tolerance strengths relevant to FACTS/VFP and later job-environment planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_concerns_observed",
      label: "What environmental tolerance, distraction, or sensory-response concerns were observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as reduced focus with interruptions, stopping work due to noise, avoidance of smells or materials, difficulty working near others, or environmental demands requiring additional evaluation.",
      guidance:
        "Record functional evidence only and identify what still requires further observation or verification.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed environmental-demand concerns that may affect vocational planning or require additional assessment.",
        }),
      ],
    }),

    defineQuestion({
      id: "environmental_vocational_implications",
      label: "What are the vocational implications of the environmental-response evidence observed during this visit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how observed environmental response may inform FACTS/VFP, additional situational assessment, work-environment exploration, support review, job matching, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning without making diagnoses or unsupported job-fit conclusions.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed environmental-response evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Communication, Social Interaction, Supervision, and Workplace
// Relationship Supports
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_COMMUNICATION_SOCIAL_SUPERVISION_SUPPORTS = defineSection({
  id: "communication_social_supervision_supports",
  label: "Communication, Social Interaction, Supervision & Workplace Relationship Supports",
  description:
    "Document workplace communication and interaction demands actually present during this observation, the client's observable response, and any communication or relationship supports used.",
  guidance:
    "Document interaction demand present, observable response, support tried, effect on work participation, and supported vocational implication. Do not diagnose communication or social conditions. Do not treat a preference for limited interaction as a barrier unless functional impact is observed or separately verified.",
  questions: [
    defineQuestion({
      id: "communication_social_demands_observed",
      label: "Which communication or social interaction demands were actually present during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Receiving task instructions",
        "Receiving correction or feedback",
        "Asking questions or requesting clarification",
        "Requesting help or communicating a need",
        "Reporting task completion or a problem",
        "Working near coworkers",
        "Cooperating on a shared task",
        "Supervisor check-in or monitoring",
        "Customer or public interaction",
        "Responding to unexpected social contact",
        "Break-room or informal workplace interaction",
        "No meaningful communication or social demand observed",
        "Other",
      ],
      guidance:
        "Select only communication or social demands actually experienced by the client during the observed work activity or visit.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies workplace communication and interaction demands directly connected to the observed response evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "understanding_workplace_directions_observed",
      label: "How did the client respond to workplace directions or instructions from staff, a supervisor, or a coworker?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Workplace-direction demand not present during observed task",
        "Received and followed directions appropriately without support",
        "Followed directions after brief cue or clarification",
        "Needed repeated support, coaching, or clarification to follow directions",
        "Difficulty understanding or responding to directions reduced task pace, quality, or participation",
        "Difficulty responding to directions caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable response to ordinary workplace directions. Section 2 records task teaching and learning; this field records workplace communication response.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether workplace directions required communication support, clarification, or repeated coaching during observed performance.",
        }),
      ],
    }),

    defineQuestion({
      id: "expressing_needs_or_asking_for_help_observed",
      label: "How did the client communicate questions, uncertainty, needs, or requests for help during the observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No opportunity or need to ask for help or communicate a need was observed",
        "Communicated questions or needs appropriately without support",
        "Communicated questions or needs after a brief cue or reminder",
        "Needed repeated prompting or coaching to communicate a need",
        "Did not communicate a need, and task participation or safety was affected",
        "Communication difficulty caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable communication of work-related needs, confusion, help requests, or task problems.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed self-advocacy or help-seeking support needs relevant to workplace participation.",
        }),
      ],
    }),

    defineQuestion({
      id: "supervisor_interaction_observed",
      label: "How did the client respond to supervisor or job-coach interaction and oversight?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Supervisor or job-coach interaction demand not present during observed task",
        "Responded appropriately to supervision without support",
        "Responded appropriately with brief cue, reassurance, or clarification",
        "Needed repeated coaching, redirection, or support during supervisory interaction",
        "Supervisory interaction difficulty reduced task pace, quality, or participation",
        "Supervisory interaction difficulty caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document response to interaction or oversight, not the amount of supervision present. Supervision level in the setting was captured in Section 1.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed response to workplace supervision relevant to future support and job-environment planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "coworker_interaction_observed",
      label: "How did the client respond to coworker interaction or shared work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Coworker interaction or shared-task demand not present",
        "Interacted or worked alongside coworkers appropriately without support",
        "Interacted appropriately with brief cue, reassurance, or clarification",
        "Needed repeated coaching, redirection, or support during coworker interaction",
        "Coworker-interaction difficulty reduced task pace, quality, or participation",
        "Coworker-interaction difficulty caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable response to coworker interaction or shared work activity when it occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed coworker-interaction response relevant to workplace environment and support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "customer_public_interaction_observed",
      label: "How did the client respond to customer or public interaction, when applicable?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Customer or public interaction demand not present",
        "Interacted appropriately with customers or the public without support",
        "Interacted appropriately with brief cue, reassurance, or clarification",
        "Needed repeated coaching, redirection, or support during customer interaction",
        "Customer-interaction difficulty reduced task pace, quality, or participation",
        "Customer-interaction difficulty caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observed response only when customer or public interaction occurred during the work activity.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed response to customer-facing work demands relevant to job exploration and support verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "response_to_feedback_or_redirection_observed",
      label: "How did the client respond to workplace feedback, correction, or redirection during task performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Feedback, correction, or redirection was not needed during observed task",
        "Accepted and used feedback appropriately without support",
        "Accepted and used feedback after brief clarification or reassurance",
        "Needed repeated explanation, coaching, or redirection to apply feedback",
        "Response to feedback reduced task pace, quality, or participation",
        "Response to feedback caused distress, withdrawal, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document workplace interaction response to feedback during performance. Section 2 records response to correction while learning a task.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed support needs related to receiving and applying workplace feedback or redirection.",
        }),
      ],
    }),

    defineQuestion({
      id: "social_boundaries_and_workplace_behavior_observed",
      label: "What workplace social-boundary or professional-behavior response was observed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No meaningful workplace-boundary demand observed",
        "Demonstrated appropriate workplace boundaries and behavior without support",
        "Demonstrated appropriate behavior with brief cue or reminder",
        "Needed repeated coaching or redirection regarding workplace boundaries or behavior",
        "Boundary or behavior concern reduced task participation or affected workplace interaction",
        "Boundary or behavior concern created conflict, safety concern, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Consider observable workplace behavior such as personal space, turn-taking, topic appropriateness, professionalism, or respect for roles. Record only what was observed.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "communication_effect_on_task_performance",
      label: "Overall, how did communication or social-interaction demands affect the client's observed work participation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No observable communication or social-interaction effect on work participation",
        "Communication or interaction demands were present but performance remained functional",
        "Communication or interaction demands caused mild discomfort or hesitation without significant performance impact",
        "Communication or interaction demands required brief support or adjustment to maintain performance",
        "Communication or interaction demands reduced pace, accuracy, quality, focus, or participation",
        "Communication or interaction demands significantly interfered with task completion or workplace stability",
        "Observation did not include meaningful communication or social demands",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Summarize overall observable effect on work participation. Use narrative fields to identify which interactions affected performance and how.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the observed effect of workplace communication and interaction demands on work participation for later vocational planning.",
        }),
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies whether communication or relationship-support strategies require additional evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "communication_social_response_examples",
      label: "Describe specific examples of the client's communication or social-interaction response during the observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Client followed supervisor instruction appropriately but did not report that supplies were missing until prompted; after one reminder, client requested replacement materials and resumed the task.",
      guidance:
        "Document the interaction demand, observable response, effect on work participation, and any support provided.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Provides specific observed evidence linking workplace interaction demands to functional work participation.",
        }),
      ],
    }),

    defineQuestion({
      id: "communication_supports_or_strategies_used",
      label: "Which communication, social-interaction, or supervisory supports were used or tried during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "None used or needed",
        "Simple or direct instructions",
        "One-step instructions",
        "Extra processing time",
        "Written directions",
        "Visual cue or checklist",
        "Modeling appropriate workplace communication",
        "Prompting client to ask for clarification",
        "Prompting client to request help or communicate a need",
        "Prompting client to report task completion or a problem",
        "Job-coach mediation",
        "Supervisor education or clarification",
        "Reduced customer or public interaction",
        "Reduced coworker interaction",
        "Predictable supervisor check-in routine",
        "Private feedback instead of public correction",
        "Break or recovery time after interaction",
        "Other",
        "Not observed",
      ],
      guidance:
        "Select only communication or relationship-support strategies actually used or tested during the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies workplace communication or relationship-support strategies tried during observed work participation for later effectiveness review.",
        }),
      ],
    }),

    defineQuestion({
      id: "effectiveness_of_communication_supports",
      label: "Describe the effectiveness of communication, interaction, or supervisory supports used during the observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe what was tried, what interaction demand it addressed, whether communication or work participation improved, and what may require additional observation.",
      guidance:
        "Record observed results only. If no communication support was used or evaluated, state that clearly.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides observed evidence about whether communication or relationship-support strategies appeared effective during work participation.",
        }),
      ],
    }),

    defineQuestion({
      id: "supervisor_or_coworker_input_obtained",
      label: "What supervisor, coworker, or worksite input was obtained during this observation, if any?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document verifiable feedback provided by a supervisor, coworker, or employer representative about communication, interaction, task participation, or support needs. State if no input was obtained.",
      guidance:
        "Identify the source of the input and separate worksite report from staff observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves worksite-reported communication or interaction evidence for later verification and vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_communication_preferences_or_concerns",
      label: "What communication or workplace-interaction preferences, concerns, or reactions did the client report?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the client's own report about supervisor communication, working near others, customer interaction, asking for help, receiving feedback, or preferred communication supports. State if no client report was obtained.",
      guidance:
        "Separate client report from staff observation. Client preference is valuable evidence but should not be treated as observed work-performance impact unless supported by what occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported workplace communication and interaction preferences for later exploration and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "communication_social_strengths_observed",
      label: "What communication, social-interaction, or supervisory-response strengths were observed during the work activity?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as following directions, asking appropriate questions, accepting feedback, communicating a problem, working respectfully near coworkers, or appropriately interacting with supervisors or customers.",
      guidance:
        "Document strengths tied to actual workplace interaction demands observed during this visit.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed workplace communication and interaction strengths relevant to FACTS/VFP and later vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "communication_social_concerns_observed",
      label: "What communication, social-interaction, supervisory-response, or workplace-relationship concerns were observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as not asking for help when needed, difficulty receiving feedback, distress during interaction, repeated need for communication prompts, boundary concerns, or customer/coworker demands requiring additional evaluation.",
      guidance:
        "Record functional evidence only and identify what still requires further observation or verification.",
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed workplace communication or interaction concerns that may affect vocational planning or require additional assessment.",
        }),
      ],
    }),

    defineQuestion({
      id: "communication_social_vocational_implications",
      label: "What are the vocational implications of the communication and workplace-interaction evidence observed during this visit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how observed communication or interaction evidence may inform FACTS/VFP, additional situational assessment, work-environment exploration, support review, job matching, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning without making diagnoses or unsupported job-fit conclusions.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed workplace communication and interaction evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: Safety, Self-Regulation, Stress Response, and Workplace Stability
// Supports
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SAFETY_REGULATION_STABILITY_SUPPORTS = defineSection({
  id: "safety_regulation_stability_supports",
  label: "Safety, Self-Regulation, Stress Response & Workplace Stability Supports",
  description:
    "Document observable safety behavior, hazard awareness, response to stress or unexpected work demands, recovery, and supports used to maintain safe and stable work participation.",
  guidance:
    "Record what actually occurred during this work observation: the safety or stability demand present, the observable response, any risk or performance effect, support used, and observed effectiveness. Do not diagnose mental health or behavioral conditions, and do not label the client as unsafe based only on history or unverified concern.",
  questions: [
    defineQuestion({
      id: "safety_regulation_demands_observed",
      label: "Which safety, self-regulation, stress-response, or workplace-stability demands were actually present during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Following workplace safety rules",
        "Using personal protective equipment",
        "Using equipment, machinery, or tools",
        "Navigating workplace hazards",
        "Handling materials or products safely",
        "Responding to correction or redirection",
        "Working under time pressure",
        "Managing frustration with difficulty or errors",
        "Managing unexpected change or interrupted routine",
        "Managing customer, coworker, or supervisor stress",
        "Returning to task after stress or disruption",
        "No meaningful safety or regulation demand observed",
        "Other",
      ],
      guidance:
        "Select only demands actually present during the client's observed work participation.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies the safety, regulation, or workplace-stability demands connected to observed work participation evidence.",
        }),
      ],
    }),

    defineQuestion({
      id: "following_safety_instructions_observed",
      label: "How did the client respond to workplace safety instructions, precautions, or personal protective equipment expectations?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Safety-instruction or precaution demand not present during observed task",
        "Followed safety instructions and precautions appropriately without support",
        "Followed safety instructions after a brief cue or reminder",
        "Needed repeated instruction, modeling, or redirection to follow safety expectations",
        "Difficulty following safety expectations created a concern but task continued with support",
        "Difficulty following safety expectations required stopping or modifying the task",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable response to safety expectations actually present during the task.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed support needs related to following workplace safety instructions or precautions.",
        }),
      ],
    }),

    defineQuestion({
      id: "hazard_awareness_observed",
      label: "What hazard awareness was observed during the work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No meaningful hazard-recognition opportunity occurred",
        "Recognized and responded to hazards appropriately without support",
        "Recognized or responded to hazards after a brief cue or reminder",
        "Needed repeated prompts, modeling, or coaching to recognize or respond to hazards",
        "Did not recognize a hazard until staff intervened",
        "Hazard-awareness concern required stopping or modifying the task",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Record response to hazards or unsafe situations that were actually observable during the task.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed hazard-awareness support needs requiring later safety, training, or workplace-support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "safe_task_behavior_observed",
      label: "What level of safe task behavior was observed during the work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Completed observed task safely without support",
        "Completed task safely with a brief reminder or cue",
        "Completed task with repeated safety prompting or coaching",
        "Unsafe behavior occurred but task continued after correction or modification",
        "Unsafe behavior required staff intervention or stopping the task",
        "Task did not provide a meaningful opportunity to evaluate safety",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Rate observed safe task behavior, including tool use, movement, materials, work procedures, or risk response when applicable.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed safe-work behavior evidence relevant to vocational planning and support verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "stressors_or_triggers_observed",
      label: "Which work-related stressors, triggers, or challenging demands were observed during this visit?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Task difficulty",
        "Making an error",
        "Correction or redirection",
        "Unexpected task change",
        "Interrupted routine",
        "Time pressure or productivity expectation",
        "Customer interaction",
        "Coworker interaction",
        "Supervisor interaction",
        "Environmental or sensory demand",
        "Physical fatigue or discomfort",
        "Equipment or tool difficulty",
        "Unclear instruction",
        "No observable stressor or trigger",
        "Other",
      ],
      guidance:
        "Select demands that occurred during this observation and were relevant to the client's observable response.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies observed workplace stressors or challenging demands relevant to work participation and future support verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "stress_response_observed",
      label: "What observable response to stress, frustration, pressure, correction, change, or task difficulty occurred?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No observable stress response affecting work participation",
        "Showed mild stress or frustration but continued work independently",
        "Needed brief reassurance, redirection, clarification, or support to continue",
        "Needed repeated support or a break to return to work participation",
        "Stress response reduced pace, accuracy, quality, focus, or participation",
        "Stress response caused withdrawal, escalation, shutdown, conflict, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable work-participation impact. Do not infer a diagnosis or cause beyond what occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether observed workplace stress response required support, recovery time, or further stability review.",
        }),
      ],
    }),

    defineQuestion({
      id: "unexpected_change_transition_response_observed",
      label: "How did the client respond to unexpected changes, transitions, interruptions, or changes in routine?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No meaningful change, transition, interruption, or routine disruption occurred",
        "Adjusted to the change or transition without support",
        "Adjusted after a brief cue, explanation, or reassurance",
        "Needed repeated support, preparation, or redirection to adjust",
        "Change or transition reduced work participation, pace, quality, or focus",
        "Change or transition caused distress, withdrawal, escalation, or inability to continue",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document response only when a change, transition, or interruption actually occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed support needs related to transitions, interrupted routine, or unexpected workplace change.",
        }),
      ],
    }),

    defineQuestion({
      id: "self_regulation_or_recovery_observed",
      label: "How did the client regulate, recover, or return to work participation after stress, frustration, disruption, or difficulty?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No meaningful regulation or recovery demand occurred",
        "Regulated or recovered independently and continued task participation",
        "Recovered after brief reassurance, redirection, or problem-solving support",
        "Recovered after a break, reduced demand, or repeated staff support",
        "Returned to task only partially or with significantly reduced participation",
        "Did not return to task participation during the observation",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observed recovery and return-to-task behavior when stress or disruption occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed recovery or return-to-task support needs relevant to workplace stability planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "workplace_stability_effect_on_participation",
      label: "Overall, how did safety, stress-response, or self-regulation demands affect observed work participation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No observable safety or stability effect on work participation",
        "Demands were present but work participation remained functional",
        "Demands required brief support or adjustment to maintain participation",
        "Demands reduced pace, accuracy, quality, focus, or participation",
        "Demands required significant support, break, modification, or safety intervention",
        "Demands significantly interfered with safe task completion or workplace stability",
        "Observation did not include meaningful safety or regulation demands",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Summarize overall observable effect on work participation and safe workplace functioning.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes observed workplace-stability impact relevant to later vocational planning and job-support verification.",
        }),
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies whether safety or regulation supports may require further evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "safety_or_regulation_incident_details",
      label: "Describe any safety concern, near miss, stress-response event, withdrawal, escalation, shutdown, or workplace-stability concern observed.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document what happened, what demand or event preceded it, observable response, effect on safety or work participation, staff response, and whether the client returned to task.",
      guidance:
        "Record specific factual observations. State clearly if no incident or safety/stability concern occurred during the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Preserves specific observed safety or workplace-stability evidence requiring review, follow-up, or verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "safety_regulation_supports_used",
      label: "Which safety, self-regulation, stress-response, or workplace-stability supports were used or tried during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "None used or needed",
        "Safety instruction or reminder",
        "Demonstration or modeling of safe task behavior",
        "Personal protective equipment",
        "Task modification",
        "Environmental adjustment",
        "Reduced task pace or demand",
        "Predictable routine or advance warning",
        "Break or recovery space",
        "Calm verbal reassurance",
        "Redirection to task",
        "Problem-solving support",
        "Private feedback",
        "Job-coach mediation",
        "Supervisor support",
        "Removal from unsafe situation",
        "Crisis or safety response",
        "Other",
        "Not observed",
      ],
      guidance:
        "Select only supports or risk-reduction strategies actually used or tested during the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies safety or workplace-stability strategies used during observed work participation for later effectiveness review.",
        }),
      ],
    }),

    defineQuestion({
      id: "effectiveness_of_safety_regulation_supports",
      label: "Describe the effectiveness of safety, self-regulation, stress-response, or workplace-stability supports used during the observation.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe what was used, what concern or demand it addressed, whether safety or work participation improved, whether the client recovered or returned to task, and what requires further verification.",
      guidance:
        "Record observed results only. If no support was used or evaluated, state that clearly.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides observed evidence about whether safety, regulation, or workplace-stability supports appeared effective during work participation.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_stressors_or_effective_strategies",
      label: "What stressors, warning signs, coping strategies, or helpful supports did the client report during or after this observation?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the client's own report about stressors, frustration, unexpected change, safety concerns, helpful breaks, preferred support, calming strategies, or what helped them return to work. State if no client report was obtained.",
      guidance:
        "Separate client report from staff observation. Client report is valuable evidence but should not be treated as observed impact unless supported by what occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported workplace stressors and effective strategies for later vocational exploration and support verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "supervisor_or_staff_safety_stability_input",
      label: "What supervisor, worksite, or staff input was obtained regarding safety, stress response, regulation, or workplace stability?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document verifiable input from a supervisor, coworker, employer representative, or supporting staff. Identify the source and state if no input was obtained.",
      guidance:
        "Separate reported input from direct observation and avoid treating unverified concern as confirmed functional evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves worksite- or staff-reported workplace stability information for later review and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "safety_regulation_strengths_observed",
      label: "What safety, self-regulation, recovery, or workplace-stability strengths were observed during this visit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as following safety expectations, identifying hazards, accepting redirection, remaining regulated under demand, using a coping strategy, recovering after frustration, or returning to task appropriately.",
      guidance:
        "Document strengths tied to actual safety or stability demands observed during this visit.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed workplace safety and stability strengths relevant to FACTS/VFP and later vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "safety_regulation_concerns_observed",
      label: "What safety, self-regulation, stress-response, or workplace-stability concerns were observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as missed safety steps, unsafe behavior, difficulty recognizing hazards, significant stress response, inability to recover, leaving task, escalation, or areas requiring further evaluation.",
      guidance:
        "Record observable functional evidence only and identify what remains to be evaluated or verified.",
      evidenceCategory: EVIDENCE_CATEGORY.SAFETY,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observed safety or workplace-stability concerns that may affect vocational planning or require additional assessment.",
        }),
      ],
    }),

    defineQuestion({
      id: "safety_regulation_vocational_implications",
      label: "What are the vocational implications of the observed safety, stress-response, and workplace-stability evidence?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how observed safety or stability evidence may inform FACTS/VFP, additional situational assessment, safety training, environmental review, job exploration, support planning, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning without making diagnostic assumptions or unsupported job-fit conclusions.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed workplace safety and stability evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: Supports, Accommodations, Job Coaching Strategies, and Natural
// Support Effectiveness
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SUPPORTS_ACCOMMODATIONS_EFFECTIVENESS = defineSection({
  id: "supports_accommodations_effectiveness",
  label: "Supports, Accommodations, Job Coaching Strategies & Natural Support Effectiveness",
  description:
    "Document supports, accommodations, job-coaching strategies, and natural workplace supports actually used or tested during this observation, along with their observed effectiveness.",
  guidance:
    "Document observational support evidence only: the observed need, the support or accommodation tried, who provided it, the observable effect, client or worksite input, and the direction for later review. This section must not determine final accommodation plans, final support hours, service discontinuation, or the official WSA Joint VR/CRP Recommendations fields.",
  questions: [
    defineQuestion({
      id: "supports_accommodations_used_during_observation",
      label: "Which supports, accommodations, or job-coaching strategies were actually used or tried during this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "None used or needed",
        "Verbal instruction or reminder",
        "Visual cue or checklist",
        "Written instructions",
        "Demonstration or modeling",
        "Task breakdown into smaller steps",
        "Repetition or additional practice",
        "Extra processing time",
        "Job-coach redirection",
        "Job-coach reassurance",
        "Problem-solving support",
        "Task modification",
        "Adjusted work pace",
        "Break or recovery space",
        "Environmental adjustment",
        "Physical-demand modification",
        "Safety instruction or risk-reduction support",
        "Communication support",
        "Supervisor support",
        "Coworker or natural support",
        "Technology-based reminder or support",
        "Personal protective equipment",
        "Other",
        "Not observed",
      ],
      guidance:
        "Select only supports, accommodations, or strategies actually used, provided, or tested during this observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies supports and accommodations actually used during observed work participation for later effectiveness review and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "primary_support_need_addressed",
      label: "Which observed work-participation needs were the supports or accommodations intended to address?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Learning a new task",
        "Task initiation",
        "Sequencing or remembering steps",
        "Accuracy or quality",
        "Pace or productivity",
        "Error recognition or correction",
        "Physical stamina or endurance",
        "Environmental or sensory tolerance",
        "Communication or asking for help",
        "Coworker or customer interaction",
        "Supervision or feedback response",
        "Safety or hazard awareness",
        "Stress response or self-regulation",
        "Transition or unexpected change",
        "Workplace stability or retention",
        "No specific support need identified",
        "Other",
      ],
      guidance:
        "Select needs supported by evidence from this observation. Do not select a need solely because it may be relevant generally.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Links tested supports to the observed work-participation needs they were intended to address.",
        }),
      ],
    }),

    defineQuestion({
      id: "job_coach_support_intensity_observed",
      label: "What overall level of direct job-coach or staff support was required during the observed task or work activity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No direct job-coach support needed during observed task",
        "Brief check-in or monitoring only",
        "Occasional cue, reminder, or clarification",
        "Repeated prompts, coaching, or redirection",
        "Frequent active support throughout task",
        "Continuous one-to-one support required during task",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Rate the observed intensity of direct job-coach or staff support during this visit only. Do not use this field to establish ongoing service hours.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed direct-support intensity without making a final ongoing-support or service-hour determination.",
        }),
      ],
    }),

    defineQuestion({
      id: "support_delivery_context_notes",
      label: "Describe the support or accommodation provided, who provided it, what task or demand it addressed, and why it was used.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Employment specialist provided a visual checklist after the client missed the final quality-check step during shelf stocking. Supervisor then used the same checklist during a second attempt.",
      guidance:
        "Include enough detail to connect the support to the observed work demand and the performance evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides context needed to interpret support-effectiveness evidence and determine what requires continued evaluation.",
        }),
      ],
    }),

    defineQuestion({
      id: "natural_supports_available_observed",
      label: "Which natural workplace supports were available or observed during this visit?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Supervisor available for routine check-in",
        "Supervisor provided instruction or feedback",
        "Coworker available for questions",
        "Coworker modeled or assisted with task",
        "Written workplace procedure or checklist",
        "Naturally predictable task routine",
        "Worksite equipment or setup supported performance",
        "Scheduled break or routine supported participation",
        "No natural support identified during observation",
        "Natural support availability not evaluated",
        "Other",
      ],
      guidance:
        "Natural supports are ordinary workplace resources or interactions available without relying only on job-coach intervention.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies workplace-based natural supports that may contribute to task participation and later support planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "natural_support_effectiveness_observed",
      label: "What effectiveness of natural workplace supports was observed during this visit?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Natural supports were available and effective without job-coach involvement",
        "Natural supports were effective with brief job-coach facilitation",
        "Natural supports were partially effective but additional support was needed",
        "Natural supports were available but did not adequately address the observed need",
        "Natural support was attempted but created confusion or concern",
        "No natural supports were available or observed",
        "Natural support effectiveness was not evaluated",
        "Unable to determine during this observation",
      ],
      guidance:
        "Rate only natural supports that were actually available, used, or observed during this visit.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether observed natural supports appeared effective or require additional evaluation before relying on them.",
        }),
      ],
    }),

    defineQuestion({
      id: "natural_support_examples_notes",
      label: "Describe specific natural support interactions or workplace resources and the observed outcome.",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: Supervisor gave the routine end-of-task reminder already used with all staff; client responded and completed cleanup without job-coach prompting.",
      guidance:
        "Document who or what provided natural support, what occurred, and what effect was observed on work participation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Provides specific evidence regarding natural-support availability and effectiveness in the observed work context.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_response_to_supports_observed",
      label: "How did the client respond to the supports, accommodations, or job-coaching strategies used during this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No support or accommodation was used during observed task",
        "Accepted and used support effectively without difficulty",
        "Accepted support and improved participation after brief clarification",
        "Used support inconsistently or needed repeated coaching to use it",
        "Support appeared to cause frustration, confusion, discomfort, or reduced participation",
        "Client declined or did not use support when offered",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Document observable response to supports actually offered or used. Client preference may also be recorded in the narrative field below.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents observed client response to tested support strategies for later vocational and support-planning review.",
        }),
      ],
    }),

    defineQuestion({
      id: "overall_support_effectiveness_observed",
      label: "Overall, what effect did the tested supports or accommodations have on observed work participation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No support was used or needed during observed task",
        "Support improved independence or reduced prompt need",
        "Support improved task initiation, sequencing, accuracy, or quality",
        "Support improved pace, endurance, environmental tolerance, communication, safety, or stability",
        "Support helped partially but additional modification or evaluation is needed",
        "Support had no clear observable effect during this visit",
        "Support appeared ineffective or created concern",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Summarize the observed effect of supports tried during this visit only. Use narrative fields to identify which supports led to which effects.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Summarizes observed support effectiveness for later continued-use, modification, fading, or additional-evaluation review.",
        }),
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Provides support-effectiveness evidence relevant to FACTS/VFP and future vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "effective_supports_to_continue_evaluating",
      label: "Which supports or accommodations appeared helpful and should continue to be evaluated?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the support, observed need addressed, evidence of benefit, and whether it should be tried again or verified in another task or observation.",
      guidance:
        "Record supports that appeared helpful based on observed evidence. This is not a final accommodation or service-plan decision.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies support strategies showing observed benefit that warrant continued evaluation or verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "ineffective_or_problematic_supports_observed",
      label: "Which supports or accommodations appeared ineffective, problematic, or in need of adjustment?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document any strategy that did not help, was not used successfully, caused confusion or discomfort, created a concern, or should be modified before being tried again.",
      guidance:
        "Record only strategies actually attempted or offered during the observation.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies tested strategies that may require modification, replacement, or additional verification before further use.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_support_preferences_or_concerns",
      label: "What support, accommodation, or job-coaching preferences or concerns did the client report?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the client's own report about supports that helped, supports they prefer, supports they did not like, privacy concerns, comfort with natural supports, or strategies they want tried again. State if no client report was obtained.",
      guidance:
        "Separate client report from staff observation. Client preference is important but should not be recorded as observed effectiveness unless supported by what occurred.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported support and accommodation preferences for later collaborative vocational planning and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "employer_supervisor_input_on_supports",
      label: "What employer, supervisor, coworker, or worksite input was obtained about support feasibility or effectiveness?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document verifiable worksite input about available natural supports, feasible accommodations, observed support benefit, workplace concerns, or strategies to evaluate further. Identify the source and state if no input was obtained.",
      guidance:
        "Separate reported worksite input from direct observation. Do not treat unverified input as confirmed effectiveness evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves worksite-reported support feasibility and effectiveness information for later review and verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "support_change_compared_with_prior_observation",
      label: "Compared with a prior observation of this task or similar work, how did the client's observed support need change?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Needed less support than previously observed",
        "Needed a similar level of support",
        "Needed more support than previously observed",
        "Different task or setting - comparison not appropriate",
        "No prior comparable observation available",
        "Support need was not evaluated during this observation",
        "Unable to determine",
      ],
      guidance:
        "Compare only when the prior observation involved a comparable task or demand.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents observed change in support need over comparable observations for later support-progress review.",
        }),
      ],
    }),

    defineQuestion({
      id: "support_continuation_fading_increase_review",
      label: "Based on this observation, which support directions should be reviewed later by staff and the client?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Continue current support strategy for further observation",
        "Continue support strategy because it appeared effective",
        "Modify support strategy and reevaluate",
        "Increase support or training for further evaluation",
        "Begin evaluating whether support can be faded",
        "Support appeared unnecessary for this observed task",
        "Evaluate natural support replacement for job-coach support",
        "Additional observation needed before deciding",
        "No support direction identified during this observation",
        "Other",
      ],
      guidance:
        "Select directions for later review only. This field does not finalize accommodations, support hours, service changes, or official WSA recommendations.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies observation-supported directions for later collaborative review of support continuation, change, increase, natural support use, or possible fading.",
        }),
      ],
    }),

    defineQuestion({
      id: "support_follow_up_or_verification_needed",
      label: "What follow-up, additional observation, or verification is needed before support decisions are made?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document follow-up needed, such as trying the support during another task, confirming employer feasibility, reviewing client preference, evaluating natural supports, observing support fading, checking safety, or gathering additional evidence.",
      guidance:
        "State what must still be learned or verified before decisions are made.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies follow-up needed before making longer-term support, accommodation, or job-coaching decisions.",
        }),
      ],
    }),

    defineQuestion({
      id: "support_effectiveness_vocational_implications",
      label: "What are the vocational implications of the observed support and accommodation effectiveness evidence?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how tested-support evidence may inform FACTS/VFP, additional situational assessment, job exploration, workplace-support review, retention planning, natural-support evaluation, or later recommendation decisions.",
      guidance:
        "Connect observed support evidence to vocational planning without finalizing accommodation plans, ongoing support hours, service decisions, or official WSA joint recommendations.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed support and accommodation effectiveness for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 9: Job Fit, Work-Role Sustainability, Retention Indicators, and
// Continued Evaluation Needs
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_JOB_FIT_RETENTION_SUSTAINABILITY = defineSection({
  id: "job_fit_retention_sustainability",
  label: "Job Fit, Work-Role Sustainability, Retention Indicators & Continued Evaluation Needs",
  description:
    "Document observation-supported indicators about possible task or job-direction fit, sustainability of current work participation, retention strengths or concerns, and what requires further evaluation.",
  guidance:
    "This section may be used during exploration, situational assessment, trial work, placement, current employment, retention review, or support fading. Document observed task, environment, support, client-input, and worksite-input evidence. Do not make a final job-fit, placement, employment-continuation, or service decision from a single observation.",
  questions: [
    defineQuestion({
      id: "job_fit_context_at_observation",
      label: "What job-fit or retention context applies to this observation?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Pre-employment exploration or discovery",
        "Situational assessment of possible work direction",
        "Trial work experience",
        "Job-placement fit review",
        "New employment stabilization",
        "Current employment retention review",
        "Ongoing support review",
        "Support-fading review",
        "Unable to determine",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies whether observed fit and sustainability evidence applies to exploration, placement, current employment, retention, or support-fading review.",
        }),
      ],
    }),

    defineQuestion({
      id: "observed_role_or_task_match",
      label: "Based on this observation, what functional match was observed between the client and the role or task demands evaluated?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Observed task demands appeared compatible with demonstrated abilities and supports used",
        "Observed task demands appeared generally compatible but additional observation is needed",
        "Observed task demands may be compatible with specific supports or modifications to evaluate",
        "Mixed evidence - some task demands appeared compatible and others raised concerns",
        "Observed task demands raised significant concerns requiring caution or alternate exploration",
        "Observation was too limited to evaluate role or task match",
        "Not applicable or not observed",
      ],
      guidance:
        "Base this rating on task-performance evidence from this observation only. This is not a final job-fit determination.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes observed task-demand compatibility evidence for later vocational planning, verification, and recommendation review.",
        }),
      ],
    }),

    defineQuestion({
      id: "observed_environment_match",
      label: "Based on this observation, what match was observed between the client and the work-environment conditions experienced?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Observed environment appeared compatible with work participation",
        "Observed environment appeared generally compatible but additional observation is needed",
        "Observed environment may be workable with supports or modifications to evaluate",
        "Mixed evidence - some conditions were tolerated and others raised concerns",
        "Observed environment raised significant concerns requiring caution or alternate exploration",
        "Observation was too limited to evaluate environmental match",
        "Not applicable or not observed",
      ],
      guidance:
        "Base this rating on environmental conditions actually experienced and the client's observable response during this visit.",
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes observation-supported work-environment compatibility evidence for later job exploration and support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "observed_support_feasibility_for_role",
      label: "What does this observation indicate about the feasibility of the supports needed for this role, task, or setting?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No meaningful support need identified during observed task",
        "Observed support need appeared manageable in this setting",
        "Observed support appeared helpful but requires further evaluation",
        "Natural workplace support may be feasible but requires verification",
        "Observed support need may require significant modification or ongoing job-coach involvement",
        "Observed support need raised concern about sustainability in this role or setting",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Rate the observed feasibility of supports only. This field does not establish accommodations, ongoing support hours, or final service decisions.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Documents whether observed support needs appeared manageable, require further evaluation, or raise sustainability concerns in the role or setting.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_interest_engagement_in_observed_work",
      label: "What client engagement or interest in the observed work activity was demonstrated or reported during this visit?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Client showed engagement and reported interest in similar work",
        "Client showed engagement; interest was not discussed or verified",
        "Client participated appropriately but interest was unclear",
        "Client reported limited interest despite functional participation",
        "Client appeared disengaged or reluctant during observed work",
        "Client stated the work, task, or environment was not preferred",
        "Observation was too limited to evaluate",
        "Not observed",
      ],
      guidance:
        "Distinguish observed engagement from client-reported interest. Use the client narrative field below for details.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves observation-supported engagement or interest evidence relevant to collaborative career exploration and retention review.",
        }),
      ],
    }),

    defineQuestion({
      id: "employer_or_worksite_expectation_alignment",
      label: "How did the observed performance align with known employer or worksite expectations for the role or task?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Observed performance appeared aligned with known task or worksite expectations",
        "Observed performance appeared generally aligned but additional observation is needed",
        "Observed performance may align with support, modification, or additional training to evaluate",
        "Mixed evidence - some expectations were met and others raised concerns",
        "Observed performance raised significant concern about meeting known expectations",
        "Employer or worksite expectations were not available or not clear",
        "Observation was not conducted in a real worksite setting",
        "Unable to determine during this observation",
        "Not observed",
      ],
      guidance:
        "Rate only when task or workplace expectations were known or observable. Do not assume employer standards when they were not established.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Documents alignment between observed performance and known workplace expectations for later fit or retention review.",
        }),
      ],
    }),

    defineQuestion({
      id: "job_fit_strength_indicators_observed",
      label: "What specific observed evidence supports further exploration of this work direction or continued sustainability in this role?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable strengths such as successful task performance, effective supports, tolerated work environment, positive supervision response, safe work behavior, client interest, natural supports, or sustained participation.",
      guidance:
        "Tie each strength indicator to what occurred during this observation. Do not make a final fit conclusion.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures specific observation-supported fit or retention strengths for FACTS/VFP and later vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "job_fit_concern_indicators_observed",
      label: "What specific observed evidence requires caution, additional assessment, or support review for this work direction or current role?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document observable concerns such as task-performance difficulty, physical-demand mismatch, environmental response, communication demands, safety or stability concerns, high support need, limited interest, or unclear sustainability.",
      guidance:
        "Record concerns supported by this observation and identify what must be verified before any decision is made.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures observation-supported cautions or sustainability concerns requiring further evaluation before job-fit or retention decisions.",
        }),
      ],
    }),

    defineQuestion({
      id: "retention_risk_or_stability_indicators_observed",
      label: "Which retention or workplace-stability indicators were observed or identified during this visit?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Consistent task participation",
        "Demonstrated ability to use effective supports",
        "Positive response to supervision or feedback",
        "Worksite natural support identified",
        "Client expressed interest in continuing similar work",
        "Physical-demand concern requiring review",
        "Environmental or sensory concern requiring review",
        "Communication or social-demand concern requiring review",
        "Safety or self-regulation concern requiring review",
        "Pace, quality, or productivity concern requiring review",
        "High job-coach support need observed",
        "Employer or supervisor concern reported",
        "Client concern or dissatisfaction reported",
        "Transportation or schedule issue identified during discussion",
        "No meaningful retention indicator evaluated",
        "Other",
      ],
      guidance:
        "Select indicators supported by observation or clearly identified report during this visit. Do not infer long-term risk without evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies observation-supported strengths or concerns relevant to retention monitoring and continued-support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "retention_supports_to_evaluate",
      label: "What supports or strategies may need continued evaluation to support retention or sustainability in this role or work direction?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document supports to evaluate further, such as job-coach strategy, natural support, task instruction, pace adjustment, environmental modification, stamina support, communication routine, safety strategy, schedule review, or additional observation.",
      guidance:
        "Identify supports requiring continued testing or review. Do not finalize a long-term support plan here.",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies retention-related support strategies that require continued observation or verification before longer-term decisions.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_job_fit_or_retention_perspective",
      label: "What did the client report about the role, tasks, work environment, supports, or desire to continue similar work?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the client's own perspective about interest, satisfaction, concerns, preferred tasks, difficult demands, helpful supports, willingness to continue, or desire to explore alternatives. State if no client input was obtained.",
      guidance:
        "Separate client report from staff observation. Client perspective is important for planning but is not by itself an observed performance conclusion.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported job-fit and retention perspective for collaborative vocational decision-making and later verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "employer_supervisor_job_fit_or_retention_input",
      label: "What employer, supervisor, coworker, or worksite input was obtained about task match, performance, sustainability, or retention concerns?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document verifiable worksite input about performance, expectations, strengths, concerns, support feasibility, attendance, retention, or sustainability. Identify the source and state if no input was obtained.",
      guidance:
        "Separate reported worksite input from direct observation and do not treat unverified statements as confirmed functional evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves worksite-reported fit or retention information for later review, corroboration, and vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "recommended_next_vocational_direction_from_observation",
      label: "Which next vocational directions are supported for later review based on this observation?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Continue exploring similar tasks or occupational areas",
        "Repeat observation in a similar setting for more evidence",
        "Observe in a different environment or task demand",
        "Evaluate specific support or accommodation strategy further",
        "Gather client preference and interest information",
        "Gather employer or supervisor input",
        "Use evidence in FACTS/VFP and recommendation review",
        "Use evidence for current-job retention or support review",
        "Consider alternate task or work-environment exploration",
        "Insufficient evidence to identify a direction",
        "Other",
      ],
      guidance:
        "Select evidence-supported directions for later staff/client review. This does not finalize placement, employment continuation, or recommendation decisions.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies observation-supported next directions for vocational exploration, retention review, or additional evidence gathering.",
        }),
      ],
    }),

    defineQuestion({
      id: "job_fit_retention_verification_needed",
      label: "What additional evidence or verification is needed before job-fit, sustainability, or retention decisions are made?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document what needs to be verified, such as additional observation, different tasks, support effectiveness, natural support availability, client preference, worksite expectation, schedule, transportation, safety, stamina, environmental tolerance, or supervisor feedback.",
      guidance:
        "State clearly what remains unknown or requires corroboration before decisions are made.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies verification needed before making job-fit, retention, or longer-term support decisions.",
        }),
      ],
    }),

    defineQuestion({
      id: "job_fit_retention_vocational_implications",
      label: "What are the vocational implications of the observed job-fit, sustainability, and retention evidence?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Describe how the observation-supported fit and retention evidence may inform FACTS/VFP, further situational assessment, career exploration, current-job support review, retention planning, or later recommendation decisions.",
      guidance:
        "Connect observed evidence to vocational planning while preserving staff/client decision-making and identifying conclusions that still require verification.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Summarizes the vocational relevance of observed job-fit, sustainability, and retention evidence for later planning and recommendation review.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition — Phase C currently includes Sections 7, 8, and 9
// Sections 1–8 remain verified and unchanged.
// Future Section 10 will add observation summary, follow-up, and evidence
// disposition fields.
// ─────────────────────────────────────────────────────────────────────────────

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS = [
  SECTION_OBSERVATION_CONTEXT,
  SECTION_TASK_INSTRUCTIONS_LEARNING,
  SECTION_TASK_PERFORMANCE_SUPPORT_PROGRESS,
  SECTION_PHYSICAL_DEMANDS_STAMINA_SUPPORTS,
  SECTION_ENVIRONMENTAL_SENSORY_SUPPORTS,
  SECTION_COMMUNICATION_SOCIAL_SUPERVISION_SUPPORTS,
  SECTION_SAFETY_REGULATION_STABILITY_SUPPORTS,
  SECTION_SUPPORTS_ACCOMMODATIONS_EFFECTIVENESS,
  SECTION_JOB_FIT_RETENTION_SUSTAINABILITY,
];

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_META = {
  assessment_type: "work_performance_support_observation",
  label: "Work Performance & Support Observation",
  description:
    "Repeatable structured observation tool for work performance, support needs, job coaching, retention monitoring, and support fading review.",
  version: 1,
  repeatable: true,
};
