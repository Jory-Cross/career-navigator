/**
 * Informational Interview — Definition
 *
 * Customized Employment / Discovery Stage Three
 *
 * Repeatable interview record for gathering business-based Discovery information from:
 * - Employers
 * - Business owners
 * - Managers
 * - Supervisors
 * - Employees
 * - Community organization contacts
 * - Industry contacts
 *
 * Feeds the CE Discovery Staging Record, vocational themes, employer needs,
 * and later customized job development planning.
 * assessment_type: "informational_interview"
 */

export const INFORMATIONAL_INTERVIEW_SECTIONS = [
  {
    id: "interview_information",
    label: "Section 1: Interview Information",
    description: "Document the basic details of the informational interview.",
    questions: [
      {
        id: "interview_date",
        label: "Interview Date",
        type: "date",
      },
      {
        id: "business_organization",
        label: "Business / Organization",
        type: "short_text",
      },
      {
        id: "person_interviewed",
        label: "Person Interviewed",
        type: "short_text",
      },
      {
        id: "person_job_title",
        label: "Person's Job Title / Role",
        type: "short_text",
      },
      {
        id: "contact_information",
        label: "Contact Information",
        type: "short_text",
        placeholder: "Phone, email, website, or preferred contact method...",
      },
      {
        id: "how_contact_identified",
        label: "How This Contact Was Identified",
        type: "textarea",
        placeholder: "Referral, client/family connection, neighborhood mapping, employer lead, staff contact, community contact...",
      },
      {
        id: "time_spent",
        label: "Time Spent",
        type: "short_text",
        placeholder: "Example: 45 minutes",
      },
    ],
  },

  {
    id: "business_information",
    label: "Section 2: Business Information",
    description: "Document what the business does and what was learned about the work setting.",
    questions: [
      {
        id: "business_description",
        label: "What does this business or organization do?",
        type: "textarea",
      },
      {
        id: "products_services",
        label: "Products / Services",
        type: "textarea",
      },
      {
        id: "departments_or_areas",
        label: "Departments, Areas, or Work Units Discussed or Observed",
        type: "textarea",
      },
      {
        id: "work_environment",
        label: "Work Environment",
        type: "textarea",
        placeholder: "Noise, pace, lighting, layout, team size, public contact, physical demands, sensory factors, accessibility...",
      },
      {
        id: "business_hours_schedule",
        label: "Business Hours / Scheduling Patterns",
        type: "textarea",
      },
    ],
  },

  {
    id: "job_duties_tasks",
    label: "Section 3: Job Duties & Tasks",
    description: "Capture tasks, tools, expectations, and job demands discussed during the interview.",
    questions: [
      {
        id: "tasks_performed",
        label: "Tasks Performed in This Business / Role",
        type: "textarea",
      },
      {
        id: "tools_equipment_used",
        label: "Tools, Equipment, Technology, or Materials Used",
        type: "textarea",
      },
      {
        id: "physical_requirements",
        label: "Physical Requirements",
        type: "textarea",
        placeholder: "Standing, sitting, lifting, walking, reaching, fine motor, stamina, transportation within site...",
      },
      {
        id: "social_requirements",
        label: "Social / Communication Requirements",
        type: "textarea",
        placeholder: "Customer contact, coworker interaction, supervisor communication, teamwork, phone use, written communication...",
      },
      {
        id: "pace_productivity_expectations",
        label: "Pace / Productivity Expectations",
        type: "textarea",
      },
    ],
  },

  {
    id: "skills_qualifications",
    label: "Section 4: Skills & Qualifications",
    description: "Document skills, traits, experience, and preparation needed for success.",
    questions: [
      {
        id: "important_skills",
        label: "Important Skills",
        type: "textarea",
      },
      {
        id: "preferred_experience",
        label: "Preferred Experience",
        type: "textarea",
      },
      {
        id: "education_certifications",
        label: "Education, Certifications, Licenses, or Training",
        type: "textarea",
      },
      {
        id: "traits_successful_employees",
        label: "Traits Associated With Successful Employees",
        type: "textarea",
      },
      {
        id: "skills_that_can_be_trained",
        label: "Skills That Can Be Trained On the Job",
        type: "textarea",
      },
    ],
  },

  {
    id: "conditions_for_success",
    label: "Section 5: Conditions for Success",
    description: "Identify supports, supervision, training, and environmental factors connected to success.",
    questions: [
      {
        id: "what_makes_employees_successful",
        label: "What makes employees successful here?",
        type: "textarea",
      },
      {
        id: "common_reasons_employees_struggle",
        label: "Common Reasons Employees Struggle",
        type: "textarea",
      },
      {
        id: "supervision_style",
        label: "Supervision Style / Management Approach",
        type: "textarea",
      },
      {
        id: "training_methods",
        label: "Training Methods Used",
        type: "textarea",
        placeholder: "Modeling, shadowing, written instructions, videos, checklists, hands-on practice, verbal coaching...",
      },
      {
        id: "support_accommodation_openness",
        label: "Openness to Supports, Accommodations, or Job Coaching",
        type: "textarea",
      },
    ],
  },

  {
    id: "customized_employment_opportunities",
    label: "Section 6: Customized Employment Opportunities",
    description: "Identify unmet business needs, bottlenecks, and possible customized employment opportunities.",
    questions: [
      {
        id: "unmet_business_needs",
        label: "Unmet Business Needs",
        type: "textarea",
        placeholder: "Tasks needing attention, work falling behind, customer service gaps, quality issues, workflow needs...",
      },
      {
        id: "tasks_not_getting_done",
        label: "Tasks Not Getting Completed or Completed Consistently",
        type: "textarea",
      },
      {
        id: "bottlenecks_or_pain_points",
        label: "Bottlenecks, Pain Points, or Inefficiencies",
        type: "textarea",
      },
      {
        id: "job_carving_opportunities",
        label: "Job Carving / Task Reassignment Opportunities",
        type: "textarea",
      },
      {
        id: "customized_employment_possibilities",
        label: "Possible Customized Employment Opportunities",
        type: "textarea",
      },
    ],
  },

  {
    id: "discovery_relevance",
    label: "Section 7: Discovery Relevance",
    description: "Connect the informational interview to the client's emerging themes, strengths, and support needs.",
    questions: [
      {
        id: "connection_to_vocational_themes",
        label: "Connection to Emerging Vocational Themes",
        type: "textarea",
      },
      {
        id: "client_strengths_that_align",
        label: "Client Strengths, Interests, or Skills That May Align",
        type: "textarea",
      },
      {
        id: "concerns_or_barriers",
        label: "Concerns or Barriers for This Client",
        type: "textarea",
      },
      {
        id: "conditions_needed_for_client_success",
        label: "Conditions Needed for Client Success in This Setting",
        type: "textarea",
      },
      {
        id: "follow_up_opportunities",
        label: "Follow-Up Opportunities",
        type: "textarea",
        placeholder: "Tour, observation, job shadow, introduction, work experience, additional contact, employer meeting...",
      },
    ],
  },

  {
    id: "summary",
    label: "Section 8: Summary",
    description: "Summarize the most important information learned and recommended next steps.",
    questions: [
      {
        id: "key_takeaways",
        label: "Key Takeaways",
        type: "textarea",
      },
      {
        id: "recommended_next_steps",
        label: "Recommended Next Steps",
        type: "textarea",
      },
      {
        id: "business_target_status",
        label: "Should this business remain a Discovery or employment target?",
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

export const INFORMATIONAL_INTERVIEW_META = {
  assessment_type: "informational_interview",
  label: "Informational Interview",
  description:
    "Repeatable Customized Employment informational interview record for learning from employers, businesses, workers, and community contacts.",
  version: 1,
  is_repeatable: true,
  one_per_client: false,
  client_category: "customized_employment",
};
