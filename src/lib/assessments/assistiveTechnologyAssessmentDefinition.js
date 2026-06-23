/**
 * Assistive Technology Assessment
 *
 * Customized Employment / DSR Stage One
 *
 * Captures:
 * - Current technology use
 * - Technology skills
 * - Technology supports
 * - Technology barriers
 * - Workplace technology
 * - Assistive technology needs
 * - Technology referrals
 */

export const ASSISTIVE_TECHNOLOGY_SECTIONS = [
  {
    id: "current_technology",
    label: "Section 1: Current Technology Use",
    description: "Document technology currently used by the client.",
    questions: [
      {
        id: "technology_devices",
        label: "Technology Currently Used (select all that apply)",
        type: "select_all",
        options: [
          "Smartphone",
          "Tablet",
          "Laptop",
          "Desktop Computer",
          "Smartwatch",
          "Gaming System",
          "AAC Device",
          "Voice Assistant",
          "Public Computer",
          "No Regular Technology Use",
        ],
      },
      {
        id: "internet_access",
        label: "Internet Access",
        type: "multiple_choice",
        options: [
          "Reliable Home Internet",
          "Mobile Data Only",
          "Public Access Only",
          "Limited Access",
          "No Access",
        ],
      },
      {
        id: "technology_use_notes",
        label: "Technology Use Notes",
        type: "narrative",
      },
    ],
  },

  {
    id: "technology_skills",
    label: "Section 2: Technology Skills",
    description: "Document technology skills and level of independence.",
    questions: [
      {
        id: "technology_skills_present",
        label: "Technology Skills Present",
        type: "select_all",
        options: [
          "Email",
          "Text Messaging",
          "Internet Search",
          "Online Applications",
          "Video Calls",
          "Calendar/Scheduling",
          "Navigation Apps",
          "Word Processing",
          "Social Media",
          "Online Shopping",
        ],
      },
      {
        id: "technology_skill_strengths",
        label: "Technology Skill Strengths",
        type: "narrative",
      },
      {
        id: "technology_training_needs",
        label: "Technology Training Needs",
        type: "narrative",
      },
    ],
  },

  {
    id: "technology_supports",
    label: "Section 3: Technology Supports",
    description: "Document how technology improves independence.",
    questions: [
      {
        id: "communication_supports",
        label: "Technology Supporting Communication",
        type: "narrative",
      },
      {
        id: "organization_supports",
        label: "Technology Supporting Organization",
        type: "narrative",
      },
      {
        id: "transportation_supports",
        label: "Technology Supporting Transportation",
        type: "narrative",
      },
      {
        id: "employment_supports",
        label: "Technology Supporting Employment",
        type: "narrative",
      },
      {
        id: "independence_supports",
        label: "Technology Supporting Independence",
        type: "narrative",
      },
    ],
  },

  {
    id: "technology_barriers",
    label: "Section 4: Technology Barriers",
    description: "Document technology challenges and barriers.",
    questions: [
      {
        id: "technology_barriers_present",
        label: "Technology Barriers Present",
        type: "select_all",
        options: [
          "Reading",
          "Writing",
          "Vision",
          "Hearing",
          "Motor Access",
          "Password Management",
          "Memory",
          "Attention",
          "Complex Interfaces",
          "No Significant Barriers",
        ],
      },
      {
        id: "technology_barrier_notes",
        label: "Technology Barrier Notes",
        type: "narrative",
      },
      {
        id: "technology_support_needed_for_access",
        label: "Support Needed to Access or Use Technology",
        type: "narrative",
      },
    ],
  },

  {
    id: "workplace_technology",
    label: "Section 5: Workplace Technology",
    description: "Document workplace technology experience and interests.",
    questions: [
      {
        id: "workplace_technology_experience",
        label: "Workplace Technology Experience",
        type: "narrative",
      },
      {
        id: "technology_interests",
        label: "Technology Interests",
        type: "narrative",
      },
      {
        id: "technology_accommodations_needed",
        label: "Technology Accommodations Needed",
        type: "narrative",
      },
      {
        id: "workplace_technology_training_needed",
        label: "Workplace Technology Training Needed",
        type: "narrative",
      },
    ],
  },

  {
    id: "assistive_technology",
    label: "Section 6: Assistive Technology Review",
    description: "Review assistive technology currently used or potentially needed.",
    questions: [
      {
        id: "current_assistive_technology",
        label: "Current Assistive Technology",
        type: "narrative",
      },
      {
        id: "potential_assistive_technology",
        label: "Potential Assistive Technology",
        type: "narrative",
      },
      {
        id: "assistive_technology_referral",
        label: "Assistive Technology Referral Recommended",
        type: "multiple_choice",
        options: ["Yes", "No", "Possibly"],
      },
      {
        id: "assistive_technology_referral_notes",
        label: "Referral Notes",
        type: "narrative",
      },
    ],
  },

  {
    id: "technology_summary",
    label: "Section 7: Staff Summary",
    description: "Summarize technology findings and recommendations.",
    questions: [
      {
        id: "technology_strengths_summary",
        label: "Technology Strengths",
        type: "narrative",
      },
      {
        id: "technology_barriers_summary",
        label: "Technology Barriers",
        type: "narrative",
      },
      {
        id: "employment_implications",
        label: "Employment Implications",
        type: "narrative",
      },
      {
        id: "technology_recommendations",
        label: "Recommendations",
        type: "narrative",
      },
    ],
  },
];

export const ASSISTIVE_TECHNOLOGY_META = {
  assessment_type: "assistive_technology_assessment",
  label: "Assistive Technology Assessment",
  description:
    "Customized Employment assistive technology, technology skills, supports, barriers, and referral assessment.",
  version: 1,
  is_repeatable: false,
  one_per_client: true,
  client_category: "customized_employment",
};
