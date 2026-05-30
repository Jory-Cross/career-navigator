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
// Exported Definition — Phase B currently includes Sections 4, 5, and 6
// Sections 1–5 remain verified and unchanged.
// Future Phase C sections will add safety/self-regulation, supports and
// accommodations, job-fit/retention, and summary/follow-up evidence.
// ─────────────────────────────────────────────────────────────────────────────

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS = [
  SECTION_OBSERVATION_CONTEXT,
  SECTION_TASK_INSTRUCTIONS_LEARNING,
  SECTION_TASK_PERFORMANCE_SUPPORT_PROGRESS,
  SECTION_PHYSICAL_DEMANDS_STAMINA_SUPPORTS,
  SECTION_ENVIRONMENTAL_SENSORY_SUPPORTS,
  SECTION_COMMUNICATION_SOCIAL_SUPERVISION_SUPPORTS,
];

export const WORK_PERFORMANCE_SUPPORT_OBSERVATION_META = {
  assessment_type: "work_performance_support_observation",
  label: "Work Performance & Support Observation",
  description:
    "Repeatable structured observation tool for work performance, support needs, job coaching, retention monitoring, and support fading review.",
  version: 1,
  repeatable: true,
};
