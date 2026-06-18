/**
 * Discovery Activity — Definition
 *
 * Customized Employment / Discovery Stage Four
 *
 * Repeatable activity observation record for gathering Discovery information from:
 * - Community activities
 * - Familiar settings
 * - Unfamiliar settings
 * - Task-based activities
 * - Volunteer activities
 * - Business visits
 * - Job shadows
 * - Hands-on exploration
 *
 * Feeds the CE Discovery Staging Record, vocational themes,
 * conditions for success, and customized job development planning.
 * assessment_type: "discovery_activity"
 */

export const DISCOVERY_ACTIVITY_SECTIONS = [
  {
    id: "activity_information",
    label: "Section 1: Activity Information",
    description: "Document the basic details of the Discovery activity.",
    questions: [
      {
        id: "activity_date",
        label: "Activity Date",
        type: "date",
      },
      {
        id: "activity_location",
        label: "Activity Location",
        type: "short_text",
      },
      {
        id: "activity_name",
        label: "Activity / Task / Setting",
        type: "short_text",
      },
      {
        id: "people_present",
        label: "People Present",
        type: "textarea",
      },
      {
        id: "time_spent",
        label: "Time Spent",
        type: "short_text",
        placeholder: "Example: 1 hour, 45 minutes...",
      },
    ],
  },

  {
    id: "activity_observation",
    label: "Section 2: Activity Observation",
    description: "Describe what occurred during the activity and what the client chose, avoided, or responded to.",
    questions: [
      {
        id: "what_was_done",
        label: "What Was Done During the Activity",
        type: "textarea",
      },
      {
        id: "client_chose_to_do",
        label: "What the Client Chose to Do",
        type: "textarea",
      },
      {
        id: "client_avoided_or_declined",
        label: "What the Client Avoided, Declined, or Disengaged From",
        type: "textarea",
      },
      {
        id: "engagement_observed",
        label: "Engagement Observed",
        type: "textarea",
        placeholder: "Describe attention, energy, persistence, enjoyment, curiosity, initiation, questions, or participation.",
      },
    ],
  },

  {
    id: "skills_observed",
    label: "Section 3: Skills Observed",
    description: "Document tasks performed, skills demonstrated, and support level needed.",
    questions: [
      {
        id: "tasks_performed",
        label: "Tasks Performed",
        type: "textarea",
      },
      {
        id: "skills_demonstrated",
        label: "Skills Demonstrated",
        type: "textarea",
      },
      {
        id: "support_level_needed",
        label: "Support Level Needed",
        type: "select_single",
        options: [
          "Independent",
          "Gesture prompt",
          "Indirect verbal prompt",
          "Direct verbal prompt",
          "Modeling",
          "Partial physical assistance",
          "Full physical assistance",
          "Not observed",
        ],
      },
      {
        id: "support_details",
        label: "Support Details",
        type: "textarea",
        placeholder: "Describe prompts, modeling, coaching, accommodations, reminders, or assistance used.",
      },
      {
        id: "task_performance_notes",
        label: "Task Performance Notes",
        type: "textarea",
        placeholder: "Describe pace, accuracy, stamina, attention, sequencing, problem solving, quality, and follow-through.",
      },
    ],
  },

  {
    id: "interests_observed",
    label: "Section 4: Interests Observed",
    description: "Identify signs of interest, preference, motivation, or repeated engagement.",
    questions: [
      {
        id: "signs_of_interest",
        label: "Signs of Interest or Motivation",
        type: "textarea",
      },
      {
        id: "preferred_activities_tools_materials",
        label: "Preferred Activities, Tools, Materials, or Topics",
        type: "textarea",
      },
      {
        id: "repeated_patterns",
        label: "Repeated Patterns Observed",
        type: "textarea",
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting Interest",
        type: "textarea",
        placeholder: "Include quotes, actions, repeated choices, body language, questions asked, or time spent.",
      },
    ],
  },

  {
    id: "conditions_for_success",
    label: "Section 5: Conditions for Success",
    description: "Document the environment, people, supports, and instruction style connected to success.",
    questions: [
      {
        id: "environmental_conditions",
        label: "Environmental Conditions",
        type: "textarea",
        placeholder: "Noise, pace, lighting, crowding, layout, predictability, temperature, sensory factors, accessibility...",
      },
      {
        id: "people_social_conditions",
        label: "People / Social Conditions",
        type: "textarea",
        placeholder: "Group size, familiar people, unfamiliar people, public contact, supervisor style, coworker interaction...",
      },
      {
        id: "instruction_style",
        label: "Instruction Style That Worked Best",
        type: "textarea",
        placeholder: "Hands-on practice, modeling, written steps, visual supports, demonstration, verbal explanation, repetition...",
      },
      {
        id: "supports_or_accommodations_used",
        label: "Supports or Accommodations Used",
        type: "textarea",
      },
      {
        id: "conditions_associated_with_success",
        label: "Conditions Associated With Success",
        type: "textarea",
      },
    ],
  },

  {
    id: "challenges_barriers",
    label: "Section 6: Challenges / Barriers",
    description: "Document difficulties observed and conditions associated with reduced success.",
    questions: [
      {
        id: "difficulties_observed",
        label: "Difficulties Observed",
        type: "textarea",
      },
      {
        id: "conditions_associated_with_difficulty",
        label: "Conditions Associated With Difficulty",
        type: "textarea",
      },
      {
        id: "barriers_to_repeat_or_employment",
        label: "Barriers to Repeating This Activity or Connecting It to Employment",
        type: "textarea",
      },
      {
        id: "supports_needed_to_reduce_barriers",
        label: "Supports Needed to Reduce Barriers",
        type: "textarea",
      },
    ],
  },

  {
    id: "vocational_relevance",
    label: "Section 7: Vocational Relevance",
    description: "Connect the activity to possible work tasks, business settings, and emerging vocational themes.",
    questions: [
      {
        id: "possible_work_tasks",
        label: "Possible Work Tasks Connected to This Activity",
        type: "textarea",
      },
      {
        id: "possible_business_settings",
        label: "Possible Business or Community Settings to Explore",
        type: "textarea",
      },
      {
        id: "emerging_vocational_themes_supported",
        label: "Emerging Vocational Themes Supported",
        type: "textarea",
      },
      {
        id: "themes_or_hypotheses_refuted",
        label: "Themes or Hypotheses Refuted / Weakened",
        type: "textarea",
      },
      {
        id: "customized_employment_possibilities",
        label: "Customized Employment Possibilities",
        type: "textarea",
      },
    ],
  },

  {
    id: "summary",
    label: "Section 8: Summary",
    description: "Summarize key takeaways and next Discovery steps.",
    questions: [
      {
        id: "key_takeaways",
        label: "Key Takeaways",
        type: "textarea",
      },
      {
        id: "recommended_next_activities",
        label: "Recommended Next Activities to Try",
        type: "textarea",
      },
      {
        id: "discovery_hypotheses_confirmed",
        label: "Discovery Hypotheses Confirmed",
        type: "textarea",
      },
      {
        id: "discovery_hypotheses_to_continue_testing",
        label: "Discovery Hypotheses to Continue Testing",
        type: "textarea",
      },
      {
        id: "activity_target_status",
        label: "Should this activity or setting remain a Discovery target?",
        type: "select_single",
        options: [
          "Yes - strong target",
          "Maybe - needs more exploration",
          "No - poor fit at this time",
          "Unknown",
        ],
      },
      {
        id: "additional_notes",
        label: "Additional Notes",
        type: "textarea",
      },
    ],
  },
];

export const DISCOVERY_ACTIVITY_META = {
  assessment_type: "discovery_activity",
  label: "Discovery Activity",
  description:
    "Repeatable Customized Employment activity observation record for documenting task-based discovery, community exploration, observed skills, interests, supports, barriers, and vocational relevance.",
  version: 1,
  is_repeatable: true,
  one_per_client: false,
  client_category: "customized_employment",
};
