/**
 * Barriers to Employment Assessment — Definition
 *
 * Uses the Structured Assessment Framework to define all sections and questions.
 * Produces structured vocational evidence for VFP / recommendation integration.
 *
 * Focus: Functional vocational impact, NOT diagnostic labels.
 * Questions ask about workplace consequences and patterns, not conditions.
 *
 * assessment_type: "barriers_to_employment"
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
// Section 1: Sensory and Environmental Barriers
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SENSORY = defineSection({
  id: "sensory_environmental_barriers",
  label: "Sensory & Environmental Barriers",
  description: "Identify sensory or environmental conditions that limit or prevent the client from functioning in specific work settings.",
  guidance: "Ask about workplace consequences, not diagnoses. Focus on what the client cannot tolerate and what has happened when exposed.",
  questions: [
    defineQuestion({
      id: "sensory_barrier_present",
      label: "Does the client have sensory or environmental conditions that have affected their ability to work?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Presence of sensory barriers gates environmental constraint filtering" }),
      ],
           conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "sensory_barrier_types",
            label: "Which sensory/environmental conditions have caused problems at work? (check all that apply)",
            type: QUESTION_TYPES.SELECT_ALL,
            options: [
              "Noise levels — constant, sudden, or loud sounds",
              "Lighting — fluorescent, bright, or flickering lights",
              "Strong smells or chemical odors",
              "Temperature extremes — heat or cold",
              "Crowded spaces or close physical proximity to others",
              "Physical contact or being touched unexpectedly",
              "Vibration or physical sensations from equipment",
              "Visually busy or cluttered environments",
            ],
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Specific sensory triggers for hard constraint filtering in recommendation engine" }),
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Eliminates job settings that include identified triggers" }),
            ],
          }),
        }),

        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "sensory_barrier_severity",
            label: "How severely do sensory/environmental conditions limit the client's ability to work? (1 = minor inconvenience, 5 = cannot sustain work in affected settings)",
            type: QUESTION_TYPES.SCALE,
            scaleConfig: { min: 1, max: 5, minLabel: "Minor inconvenience", maxLabel: "Cannot sustain work" },
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Severity score weights how restrictive environmental constraints should be in job matching" }),
            ],
          }),
        }),

        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "sensory_barrier_history",
            label: "Describe specific work situations where sensory or environmental conditions caused problems, absences, or job loss",
            type: QUESTION_TYPES.EXAMPLES,
            placeholder: "Be specific — what the trigger was, what happened, and the outcome for employment",
            examplePrompts: [
              "left a warehouse job due to forklift noise",
              "fired from restaurant — could not tolerate food smells",
              "performance declined in open-plan office due to noise",
              "had to quit outdoor job due to heat sensitivity",
            ],
            evidenceCategory: EVIDENCE_CATEGORY.ENVIRONMENTAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Historical sensory job loss is strongest evidence for eliminating those environments", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),

        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "sensory_accommodation_tried",
            label: "Has the client tried any accommodations for sensory issues at work? (e.g. headphones, sunglasses, reassignment)",
            type: QUESTION_TYPES.YES_NO,
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "medium",
            conditionals: [
              defineConditional({
                showWhen: ["yes"],
                question: defineQuestion({
                  id: "sensory_accommodation_outcome",
                  label: "Describe what was tried and whether it helped",
                  type: QUESTION_TYPES.NARRATIVE,
                  placeholder: "e.g. Noise-canceling headphones reduced issues enough to sustain retail work, but manager would not allow consistent use. Reassignment to back-stocking removed noise trigger entirely and client thrived…",
                  evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
                  evidenceWeight: "high",
                  implications: [
                    defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Accommodation history informs what to request from next employer", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
                  ],
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Social Tolerance and Workplace Interaction
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SOCIAL = defineSection({
  id: "social_tolerance_barriers",
  label: "Social Tolerance & Workplace Interaction",
  description: "Understand how workplace relationships, communication, and social demands function as barriers for this client.",
  guidance: "Focus on functional impact — what has happened in real jobs, not on social preferences alone.",
  questions: [
    defineQuestion({
      id: "social_barrier_level",
      label: "How significantly do social demands at work (coworkers, customers, supervisors) create barriers for this client?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No significant social barriers",
        "Mild — manageable with some adjustment",
        "Moderate — limits role types significantly",
        "Severe — has caused job loss or inability to sustain employment",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Social barrier severity filters public-facing and team-intensive roles" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Moderate — limits role types significantly", "Severe — has caused job loss or inability to sustain employment"],
          question: defineQuestion({
            id: "social_barrier_detail",
            label: "Describe the specific social situations that create barriers and what the impact has been",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Cannot manage unpredictable customer interactions — scripted interactions are okay. Has been fired twice for reacting poorly to supervisor correction. Withdraws when coworkers tease or exclude…",
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Specific social barriers narrow role types and inform employer communication strategy", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "authority_response",
      label: "How does the client typically respond when corrected or redirected by a supervisor?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Accepts correction — no significant issues",
        "Needs correction delivered patiently and clearly",
        "Reacts defensively but recovers",
        "Shuts down or disengages after criticism",
        "Has escalated or argued with supervisors in past jobs",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Supervision compatibility is critical — management style must match client response pattern" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Reacts defensively but recovers", "Shuts down or disengages after criticism", "Has escalated or argued with supervisors in past jobs"],
          question: defineQuestion({
            id: "authority_response_narrative",
            label: "Describe past incidents and what management approaches have worked or failed",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Had altercation with manager who raised voice — client walked off. Responds well to written feedback vs. verbal. Previous supervisor at stock room gave 1:1 check-ins and client thrived…",
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Supervision issues require employer vetting and disclosure planning", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Job coach should brief employer on effective communication approach" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "workplace_conflict_pattern",
      label: "Has the client had repeated conflicts with coworkers or customers that affected employment?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "conflict_pattern_narrative",
            label: "Describe the pattern — types of conflict, triggers, outcomes, and any pattern across jobs",
            type: QUESTION_TYPES.EXAMPLES,
            placeholder: "Describe the recurring pattern, not just a single incident",
            examplePrompts: [
              "conflict when asked to change tasks mid-shift",
              "misread social cues and offended coworkers",
              "escalated when coworkers were loud",
              "conflict over perceived unfairness",
            ],
            evidenceCategory: EVIDENCE_CATEGORY.SOCIAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Recurring conflict patterns require proactive employer communication and coaching plan", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Social navigation coaching likely needed" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "communication_modality_issues",
      label: "Which communication modalities create barriers at work? (check all that apply)",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Phone — cannot process or initiate calls effectively",
        "In-person verbal — struggles with face-to-face conversation",
        "Reading written instructions — difficulty comprehending",
        "Writing — difficulty producing written communication",
        "Email / digital — unfamiliar or difficult to use",
        "None — no communication barriers",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Communication modality barriers filter roles requiring those skills" }),
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Identifies communication accommodations needed from employer" }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Executive Function and Task Management
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_EXECUTIVE = defineSection({
  id: "executive_function_barriers",
  label: "Executive Function & Task Management",
  description: "Understand how difficulties with organization, planning, memory, and task management affect the client's ability to sustain employment.",
  guidance: "Avoid diagnostic framing. Ask about what happens at work — missed steps, errors, difficulty starting, time blindness, etc.",
  questions: [
    defineQuestion({
      id: "task_initiation_difficulty",
      label: "Does the client have difficulty starting tasks independently without a prompt or trigger?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Task initiation difficulty requires structured starts and possibly job coaching during initial weeks" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "task_initiation_narrative",
            label: "Describe what happens — how long delays are, what helps, and any work impact",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Knows what to do but cannot start without being told. Spends 30+ minutes 'getting ready' before beginning. Needs supervisor to check in to trigger start. Has been written up for this at two jobs…",
            evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Structured start-of-shift routine or job coach check-in may be required", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "working_memory_impact",
      label: "How much does difficulty remembering multi-step instructions or recent directions affect the client's work performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Not a significant barrier",
        "Mild — needs reminders occasionally",
        "Moderate — frequently forgets steps or directions",
        "Severe — cannot retain verbal instructions reliably",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Working memory limitations require written procedures, checklists, or job coaching" }),
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Filters out roles requiring complex verbal instruction retention" }),
      ],
    }),

    defineQuestion({
      id: "time_management_barrier",
      label: "Has difficulty with time awareness or time management caused problems at work?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "time_management_narrative",
            label: "Describe specific patterns — lateness, losing track of time, missing deadlines, underestimating task duration",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Consistently late to shift even when alarm is set — loses track of time preparing. Takes 3x as long as expected on tasks. Has been fired for chronic tardiness at two jobs…",
            evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Time management support needed — alarms, schedules, accountability check-ins", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
              defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Chronic lateness history may require employer disclosure planning" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "error_pattern",
      label: "Does the client make repeated errors on tasks that others typically complete without mistakes?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No — error rate is typical",
        "Slightly higher error rate than typical",
        "Frequent errors despite understanding requirements",
        "Errors have caused disciplinary action or job loss",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["Frequent errors despite understanding requirements", "Errors have caused disciplinary action or job loss"],
          question: defineQuestion({
            id: "error_pattern_narrative",
            label: "Describe the pattern — what types of errors, when they occur, and the work impact",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Makes errors when multi-tasking but not on single tasks. Skips steps when rushed. Has been written up for accuracy issues at assembly-line job despite knowing the correct steps…",
            evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Accuracy-sensitive or quality-critical roles may be problematic", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Checklists, reduced pace, or task simplification accommodations likely needed" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "organization_supports_needed",
      label: "What organizational supports have helped or would help this client perform tasks reliably?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Written step-by-step task lists",
        "Visual schedules or timers",
        "Job coach modeling tasks during training",
        "Reminder alarms or phone prompts",
        "Consistent task assignment (not rotating duties)",
        "Shorter task sequences before moving on",
        "Regular supervisor check-ins",
        "None — manages independently",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Organizational supports needed for stable job performance" }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Transportation and Attendance Barriers
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TRANSPORTATION = defineSection({
  id: "transportation_attendance_barriers",
  label: "Transportation & Attendance Barriers",
  description: "Assess transportation access, reliability, and attendance patterns that may limit viable job locations or shift times.",
  questions: [
    defineQuestion({
      id: "transportation_method",
      label: "How does the client currently or plan to get to work?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Drives own vehicle — reliable",
        "Drives own vehicle — unreliable (maintenance issues, no license, etc.)",
        "Family / guardian provides transportation",
        "Public transit — available and manageable",
        "Public transit — available but unreliable or difficult to use",
        "Ride share (Uber/Lyft)",
        "Walking / biking — limited to close proximity",
        "No current transportation — significant barrier",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.TRANSPORTATION,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Transportation method constrains viable job locations and commute radius" }),
      ],
    }),

    defineQuestion({
      id: "transportation_reliability",
      label: "How reliable is the client's primary transportation? (1 = very unreliable, 5 = very reliable)",
      type: QUESTION_TYPES.SCALE,
      scaleConfig: { min: 1, max: 5, minLabel: "Very unreliable", maxLabel: "Very reliable" },
      evidenceCategory: EVIDENCE_CATEGORY.TRANSPORTATION,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Low reliability score flags transportation as active employment risk" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: [1, 2],
          question: defineQuestion({
            id: "transportation_unreliable_narrative",
            label: "Describe the transportation challenges and how they have affected attendance or job retention",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Bus only runs until 6pm — cannot take evening shifts. Car breaks down frequently — missed 8 days last quarter. Relies on family member who is unreliable…",
            evidenceCategory: EVIDENCE_CATEGORY.TRANSPORTATION,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Transportation barrier must be resolved before job placement — flag for planning", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Transportation planning or support may be required" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "commute_radius",
      label: "What is the realistic commute distance the client can sustain?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Within 2 miles — walking/biking only",
        "Within 5 miles — very limited",
        "Within 10 miles",
        "Within 20 miles",
        "30+ miles — no geographic restriction",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.TRANSPORTATION,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Commute radius limits geographic scope of job search" }),
      ],
    }),

    defineQuestion({
      id: "attendance_history",
      label: "Has attendance or punctuality been an issue in past employment?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "attendance_pattern_narrative",
            label: "Describe the attendance pattern — frequency, causes, and work consequences",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Averaged 2–3 absences per month at last job — primarily due to unreliable bus and health appointments. Received final warning. Has chronic lateness at morning shifts but not afternoon…",
            evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Attendance history must be addressed in job placement strategy", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Informs shift timing and flexibility requirements for job matching" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "shift_constraints",
      label: "Are there shift times or days the client cannot work due to transportation, health, or family obligations?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SCHEDULE,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "shift_constraints_detail",
            label: "Describe the constraints and the reason",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Cannot work before 9am due to morning medication routine. No evening shifts after 7pm — no transportation. Cannot work weekends — family caretaking obligation…",
            evidenceCategory: EVIDENCE_CATEGORY.SCHEDULE,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Shift constraints filter job listings by available hours and days" }),
              defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Limits pool of viable employers by schedule flexibility required" }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Physical Stamina and Work Endurance
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_PHYSICAL = defineSection({
  id: "physical_stamina_barriers",
  label: "Physical Stamina & Work Endurance",
  description: "Identify physical limitations that affect the type, pace, or duration of work the client can sustain.",
  guidance: "Avoid medical diagnoses. Focus on functional workplace limits — what the client can and cannot do physically for sustained periods.",
  questions: [
    defineQuestion({
      id: "standing_tolerance",
      label: "How long can the client stand or walk continuously without significant discomfort or needing to sit?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No limitation — can stand/walk for a full shift",
        "1–2 hours before needing a seated break",
        "30 minutes or less",
        "Requires seated work — cannot sustain standing",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Standing tolerance filters retail, warehouse, food service, and outdoor physical roles" }),
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Seated-work requirement is a hard constraint for some environments" }),
      ],
    }),

    defineQuestion({
      id: "lifting_capacity",
      label: "What is the client's safe lifting capacity?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "No lifting restrictions",
        "Light lifting only — up to 10 lbs",
        "Moderate — up to 25 lbs",
        "Cannot lift — lifting is contraindicated",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Lifting capacity filters physical labor, stocking, and manual handling roles" }),
      ],
    }),

    defineQuestion({
      id: "shift_duration_tolerance",
      label: "What shift length can the client reliably sustain?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Full-time (8+ hours)",
        "Up to 6 hours",
        "Up to 4 hours",
        "Up to 2–3 hours — part-time/supported only",
        "Varies significantly depending on the day",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Shift duration limits are a primary job-matching filter" }),
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Part-time may be required — affects authorization planning" }),
      ],
    }),

    defineQuestion({
      id: "physical_fatigue_pattern",
      label: "Does the client experience significant fatigue that affects work performance or attendance?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "fatigue_narrative",
            label: "Describe the fatigue pattern — when it occurs, how severe, and how it has affected past jobs",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Fatigues significantly after 3 hours — performance and accuracy decline. Has needed to leave jobs early due to exhaustion. Mornings are hardest — improves by mid-afternoon. Sleep issues compound this…",
            evidenceCategory: EVIDENCE_CATEGORY.FUNCTIONAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Fatigue pattern affects shift timing, duration, and job type planning", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Filters out high-demand physical roles and informs optimal shift timing" }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "physical_accommodation_needed",
      label: "Does the client require any physical accommodations to perform work tasks?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "physical_accommodation_detail",
            label: "Describe what accommodations are needed and whether they have been provided in past jobs",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Needs anti-fatigue mat and sit/stand option at workstation. Requires ergonomic keyboard. Cannot operate machinery due to tremor. Was provided stool at previous retail job — helped significantly…",
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Physical accommodations must be confirmed with employer before placement", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Emotional Regulation and Stress Response
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_EMOTIONAL = defineSection({
  id: "emotional_regulation_barriers",
  label: "Emotional Regulation & Stress Response",
  description: "Understand how emotional responses under pressure affect the client's ability to sustain employment and navigate the workplace.",
  guidance: "Focus on observed patterns and workplace outcomes. Do not label — ask about what happens, not why.",
  questions: [
    defineQuestion({
      id: "stress_tolerance_scale",
      label: "How well does the client manage stress and pressure in a work environment? (1 = extremely difficult, 5 = manages well)",
      type: QUESTION_TYPES.SCALE,
      scaleConfig: { min: 1, max: 5, minLabel: "Extremely difficult", maxLabel: "Manages well" },
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Low stress tolerance narrows viable work environments and role types" }),
      ],
    }),

    defineQuestion({
      id: "emotional_regulation_triggers",
      label: "What workplace situations most reliably trigger emotional dysregulation or distress in this client?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Being corrected or criticized",
        "Perceived unfairness or being treated differently",
        "Unexpected changes to tasks or schedule",
        "Interpersonal conflict with coworkers",
        "Time pressure or rushing",
        "Feeling observed or watched while working",
        "Sensory overload",
        "Being asked to do something unclear or ambiguous",
        "Work performance expectations feeling unachievable",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Specific triggers inform job coaching priorities and employer communication plan" }),
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Trigger inventory is primary input for stress management accommodation planning" }),
      ],
    }),

    defineQuestion({
      id: "emotional_response_pattern",
      label: "How does the client typically respond when triggered? (check all that apply)",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Withdraws — goes quiet, disengages",
        "Verbal escalation — argues, raises voice",
        "Physical tension — visible agitation",
        "Crying",
        "Leaves the area without authorization",
        "Shuts down — unable to continue working",
        "Self-harms or has safety concerns — describe below",
        "Generally manages without visible dysregulation",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Observable responses allow employer/job coach to recognize and intervene early" }),
      ],
      conditionals: [
        defineConditional({
          showWhen: ["Self-harms or has safety concerns — describe below", "Verbal escalation — argues, raises voice", "Leaves the area without authorization"],
          question: defineQuestion({
            id: "emotional_response_safety_narrative",
            label: "Describe the specific behaviors, their frequency, and any work outcomes",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. Has walked off the floor three times across two jobs. Both incidents followed supervisor correction in front of coworkers. No incidents when corrected privately…",
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Behavioral patterns with safety or job-loss risk require disclosure planning and proactive employer coaching", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "recovery_time",
      label: "After a stressful incident at work, how long does it typically take for the client to re-stabilize and return to effective performance?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Recovers quickly — within minutes",
        "20–30 minutes with space or break",
        "1–2 hours — significantly disrupts the shift",
        "Cannot return to work that day",
        "Recovery varies widely and is unpredictable",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Recovery time informs whether a break protocol or early exit plan is needed for acute incidents" }),
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Long recovery time limits suitability for high-demand or inflexible environments" }),
      ],
    }),

    defineQuestion({
      id: "emotional_job_loss_history",
      label: "Has emotional dysregulation directly contributed to job loss, termination, or resignation in the past?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
      evidenceWeight: "high",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "emotional_job_loss_narrative",
            label: "Describe what happened — what the trigger was, what the client did, and the employment outcome",
            type: QUESTION_TYPES.EXAMPLES,
            placeholder: "Be specific about each incident if there are multiple",
            examplePrompts: [
              "terminated after verbal argument with manager",
              "quit without notice when overwhelmed",
              "written up and eventually resigned due to emotional incidents",
            ],
            evidenceCategory: EVIDENCE_CATEGORY.BEHAVIORAL,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Emotional job loss history is highest-weight evidence for environment and support planning", flag: REVIEW_FLAG_PRIORITY.HIGH }),
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Consider whether employer disclosure is appropriate and build proactive intervention plan" }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: Work History Failure Patterns
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_HISTORY = defineSection({
  id: "work_history_patterns",
  label: "Work History Failure Patterns",
  description: "Analyze patterns across the client's employment history to identify recurring barriers and conditions that predict job loss.",
  guidance: "This section extracts the most actionable evidence. Look for patterns across multiple jobs, not single incidents.",
  questions: [
    defineQuestion({
      id: "job_retention_history",
      label: "What is the client's typical job tenure before leaving, being fired, or moving on?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Has sustained 1+ year in at least one job",
        "Typically 6–12 months",
        "Typically 1–6 months",
        "Typically less than 1 month",
        "Has never held a job for more than a few days",
        "No work history to reference",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Job retention history sets expectations and informs support intensity during placement" }),
      ],
    }),

    defineQuestion({
      id: "primary_exit_reasons",
      label: "Across past jobs, what have been the primary reasons for leaving or losing employment? (check all that apply)",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Fired for attendance / tardiness",
        "Fired for performance / errors",
        "Fired after conflict with supervisor or management",
        "Fired after conflict with coworkers",
        "Quit due to stress or sensory overload",
        "Quit due to transportation problems",
        "Quit because of physical inability to continue",
        "Quit due to emotional distress or mental health crisis",
        "Job ended — seasonal, temporary, or layoff",
        "Left for better opportunity",
        "No work history",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Exit pattern analysis identifies primary active barriers to retention" }),
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Exit reasons drive constraint filtering and support planning priorities" }),
      ],
    }),

    defineQuestion({
      id: "successful_job_conditions",
      label: "What conditions were present in jobs where the client performed best or lasted longest?",
      type: QUESTION_TYPES.EXAMPLES,
      placeholder: "Describe the setting, tasks, supervision, coworkers, hours — what made it work",
      examplePrompts: [
        "small team, consistent supervisor, clear tasks",
        "outdoor setting with physical activity",
        "minimal customer interaction, back-of-house",
        "flexible schedule and understanding management",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Positive job conditions are strongest positive evidence for what environments to target" }),
        defineImplication({ type: IMPLICATION_TYPE.ENVIRONMENTAL, description: "Informs best-fit work environment profile" }),
      ],
    }),

    defineQuestion({
      id: "jobs_that_failed_pattern",
      label: "Is there a pattern in the types of jobs that have consistently not worked for this client?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. Has failed in every retail position — customer interaction and noise are consistent factors. Has never lasted more than 6 weeks in fast-food. Thrived in back-office filing role for 14 months…",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Identifies job types to eliminate from recommendations as hard constraints", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
      ],
    }),

    defineQuestion({
      id: "employment_gap_causes",
      label: "Are there significant employment gaps? If yes, what caused them?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "gap_causes_narrative",
            label: "Describe the gaps — how long, what caused them, and what the client was doing during that time",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. 18-month gap after hospitalization. 2-year gap as primary caregiver for parent. Multiple 3–6 month gaps between failed placements with no support…",
            evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
            evidenceWeight: "medium",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.VOCATIONAL, description: "Gap narrative is context for employer vetting and resume strategy" }),
            ],
          }),
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: Support Needs and Accommodations
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SUPPORT = defineSection({
  id: "support_accommodation_needs",
  label: "Support Needs & Accommodations",
  description: "Identify specific supports and accommodations needed for the client to sustain employment.",
  questions: [
    defineQuestion({
      id: "job_coaching_intensity",
      label: "What level of job coaching intensity does this client likely need during job placement?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Minimal — occasional check-ins",
        "Moderate — regular weekly contact",
        "Intensive — on-site support during initial weeks",
        "Extended intensive — ongoing on-site presence needed",
        "Natural supports only — no professional coaching needed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Job coaching level informs authorization planning and service hours" }),
      ],
    }),

    defineQuestion({
      id: "workplace_accommodations_needed",
      label: "What workplace accommodations does this client need or would significantly benefit from? (check all that apply)",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Written task lists or visual schedules",
        "Quiet workspace or sensory accommodation",
        "Flexible break schedule",
        "Modified hours or reduced schedule",
        "Sit/stand workstation or physical accommodation",
        "Permission to use noise-canceling headphones",
        "Employer communication support from job coach",
        "Gradual onboarding / extended training period",
        "Peer mentor or workplace buddy",
        "Check-in routine with supervisor",
        "Transportation assistance",
        "No accommodations needed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Accommodation checklist drives employer negotiation and job development priorities" }),
      ],
    }),

    defineQuestion({
      id: "natural_supports_available",
      label: "Are natural supports (family, guardian, community) available and willing to assist during employment?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Yes — active and available",
        "Yes — limited involvement",
        "Unclear — not yet engaged",
        "No — client is on their own",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "past_accommodation_effectiveness",
      label: "Have workplace accommodations been provided in past jobs? Were they effective?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "past_accommodation_detail",
            label: "Describe what was provided, whether it was followed through by the employer, and the outcome",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. ADA accommodation for flexible breaks approved but supervisors did not honor it in practice — client eventually quit. Headphone use was informally allowed at library job — worked well for 14 months…",
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "high",
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Accommodation implementation history informs employer vetting strategy", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "benefit_risk_awareness",
      label: "Is the client aware of how employment may affect their benefits? Has benefits planning been completed?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Yes — benefits planning completed, client understands impact",
        "Partially aware — needs follow-up",
        "Not aware — benefits planning not started",
        "Not applicable — no benefits to consider",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Benefits awareness gaps require follow-up before employment to avoid loss of income", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 9: Best-Fit Work Conditions
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_BEST_FIT = defineSection({
  id: "best_fit_conditions",
  label: "Best-Fit Work Conditions",
  description: "Staff synthesis of the optimal work environment based on the assessment above. This directly feeds recommendation constraint logic.",
  guidance: "Synthesize what you have learned across all sections. Be specific — generic answers produce weak VFP evidence.",
  questions: [
    defineQuestion({
      id: "ideal_job_profile",
      label: "Describe the ideal job profile for this client based on this assessment",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. Part-time, 4–6 hours, afternoon shifts. Quiet back-of-house environment. Consistent, predictable tasks with written checklists. Minimal customer contact. Supportive supervisor who gives clear written feedback. Small team or solo work. No lifting over 15 lbs…",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      narrativeRequired: false,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Primary positive constraint narrative for recommendation and job development" }),
      ],
    }),

    defineQuestion({
      id: "environments_to_eliminate",
      label: "List specific job types, settings, or conditions this client should NOT be placed in",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. No food service — cannot tolerate smells or pace. No retail — customer interaction has caused multiple job losses. No overnight or early morning shifts — fatigue and transportation. No open-floor offices — noise sensitivity…",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Hard negative constraints — eliminate these environments from all recommendations", flag: REVIEW_FLAG_PRIORITY.HIGH }),
      ],
    }),

    defineQuestion({
      id: "barrier_priority_ranking",
      label: "Which barriers identified in this assessment are the highest priority to address before or during job placement?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Transportation / attendance reliability",
        "Emotional regulation and conflict response",
        "Sensory environment compatibility",
        "Supervisor relationship and authority tolerance",
        "Physical endurance and stamina",
        "Executive function and task management",
        "Social tolerance and coworker dynamics",
        "Benefits planning and work incentives",
        "Communication skill gaps",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.SUPPORT, description: "Priority barrier list drives pre-placement support planning sequencing" }),
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Highest-priority barriers should have explicit mitigation in job placement plan" }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 10: Staff Review Notes and Concerns
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_STAFF_REVIEW = defineSection({
  id: "staff_review_notes",
  label: "Staff Review Notes & Concerns",
  description: "Document any items from this assessment that require follow-up, verification, or discussion before job placement.",
  guidance: "This section produces staff_review_flags for the VFP. Be specific — vague flags are not actionable.",
  questions: [
    defineQuestion({
      id: "disclosure_considerations",
      label: "Are there behaviors or patterns in this assessment that require employer disclosure planning?",
      type: QUESTION_TYPES.YES_NO,
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
      conditionals: [
        defineConditional({
          showWhen: ["yes"],
          question: defineQuestion({
            id: "disclosure_narrative",
            label: "Describe what needs to be disclosed or prepared for, and the recommended approach",
            type: QUESTION_TYPES.NARRATIVE,
            placeholder: "e.g. History of walking off floor needs to be addressed with employer proactively — recommend job coach mediated disclosure meeting. Emotional triggers should be documented in accommodation plan…",
            evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
            evidenceWeight: "high",
            evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
            implications: [
              defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Disclosure planning required before employer engagement", flag: REVIEW_FLAG_PRIORITY.HIGH }),
            ],
          }),
        }),
      ],
    }),

    defineQuestion({
      id: "unresolved_barriers",
      label: "Are there barriers identified in this assessment that are NOT yet resolved and could prevent successful job placement?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "e.g. Transportation gap is unresolved — bus route does not reach main employment corridor. Benefits planning not completed. Client has outstanding legal issue that may affect background check…",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "high",
      evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Unresolved barriers that block placement must be addressed before job search begins", flag: REVIEW_FLAG_PRIORITY.HIGH }),
      ],
    }),

    defineQuestion({
      id: "additional_assessment_needs",
      label: "Does this assessment reveal a need for additional assessments or evaluations before job placement?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Vocational evaluation for specific skill assessment",
        "Situational assessment in a real work setting",
        "Medical clearance for physical demands",
        "Benefits planning consultation",
        "Mental health or behavioral support consultation",
        "Transportation assessment",
        "No additional assessments needed",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "Additional assessment needs must be actioned before job placement", flag: REVIEW_FLAG_PRIORITY.MEDIUM }),
      ],
    }),

    defineQuestion({
      id: "overall_placement_readiness",
      label: "Based on this assessment, what is the client's current readiness for job placement?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Ready for immediate job search — barriers are manageable",
        "Ready with supports in place — placement can begin with active coaching",
        "Partially ready — some barriers must be resolved first",
        "Not ready for placement — significant barriers require pre-employment work",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
      implications: [
        defineImplication({ type: IMPLICATION_TYPE.RECOMMENDATION, description: "Placement readiness gates the timing of job search and recommendation generation" }),
        defineImplication({ type: IMPLICATION_TYPE.STAFF_REVIEW, description: "If not ready, flag for pre-employment planning before VFP recommendation run" }),
      ],
    }),

    defineQuestion({
      id: "staff_overall_notes",
      label: "Additional staff notes or concerns not captured above",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder: "Any additional context, clinical observations, family concerns, or items relevant to job placement planning that were not captured in the sections above…",
      evidenceCategory: EVIDENCE_CATEGORY.SUPPORT,
      evidenceWeight: "medium",
      evidenceSource: EVIDENCE_SOURCE.STAFF_OBSERVED,
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition
// ─────────────────────────────────────────────────────────────────────────────

export const BARRIERS_TO_EMPLOYMENT_SECTIONS = [
  SECTION_SENSORY,
  SECTION_SOCIAL,
  SECTION_EXECUTIVE,
  SECTION_TRANSPORTATION,
  SECTION_PHYSICAL,
  SECTION_EMOTIONAL,
  SECTION_HISTORY,
  SECTION_SUPPORT,
  SECTION_BEST_FIT,
  SECTION_STAFF_REVIEW,
];

export const BARRIERS_TO_EMPLOYMENT_META = {
  assessment_type: "barriers_to_employment",
  label: "Barriers to Employment Assessment",
  description: "Structured vocational assessment capturing functional barriers across sensory, social, cognitive, physical, emotional, and logistical domains. Produces evidence for VFP and job placement planning.",
  version: 1,
};
