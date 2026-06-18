/**
 * Discovery Interview — Definition
 *
 * Customized Employment / DSR Stage Two
 *
 * Repeatable interview record for gathering Discovery information from:
 * - Family
 * - Friends
 * - Roommates
 * - Teachers
 * - DSPD staff
 * - Providers
 * - Former employers
 * - Current employers
 * - Job coaches
 * - Other people who know the client well
 *
 * Feeds the CE Discovery Staging Record Stage Two and later vocational themes.
 * assessment_type: "discovery_interview"
 */

export const DISCOVERY_INTERVIEW_SECTIONS = [
  {
    id: "interview_information",
    label: "Section 1: Interview Information",
    description: "Document who was interviewed and the context for the interview.",
    questions: [
      {
        id: "interview_date",
        label: "Interview Date",
        type: "date",
      },
     {
  id: "interviewer_name",
  label: "Interviewer",
  type: "short_text",
},
{
  id: "person_interviewed",
  label: "Person Interviewed",
  type: "short_text",
},
      {
        id: "length_known",
        label: "How long has this person known the client?",
        type: "text",
        placeholder: "Example: 5 years, since childhood, 6 months...",
      },
      {
        id: "primary_context",
        label: "Primary Context Where This Person Knows the Client",
        type: "textarea",
        placeholder: "Home, school, work, community, services, recreation, family setting...",
      },
    ],
  },

  {
    id: "strengths_contributions",
    label: "Section 2: Strengths & Contributions",
    description: "Capture strengths, contributions, and positive qualities reported by the interviewee.",
    questions: [
      {
        id: "what_client_does_well",
        label: "What does the client do well?",
        type: "textarea",
      },
      {
        id: "known_for",
        label: "What is the client known for?",
        type: "textarea",
        placeholder: "Skills, personality traits, habits, interests, routines, talents, helpfulness, persistence...",
      },
      {
        id: "contributions",
        label: "What contributions does the client make at home, school, work, or in the community?",
        type: "textarea",
      },
      {
        id: "positive_qualities",
        label: "Most Endearing or Engaging Qualities",
        type: "textarea",
      },
    ],
  },

  {
    id: "interests_preferences",
    label: "Section 3: Interests & Preferences",
    description: "Capture interests, preferred activities, places, people, and topics.",
    questions: [
      {
        id: "favorite_activities",
        label: "Favorite Activities",
        type: "textarea",
      },
      {
        id: "topics_of_interest",
        label: "Topics of Interest",
        type: "textarea",
      },
      {
        id: "preferred_people",
        label: "People the Client Enjoys Being Around",
        type: "textarea",
      },
      {
        id: "preferred_places",
        label: "Places the Client Enjoys",
        type: "textarea",
      },
      {
        id: "activities_or_places_avoided",
        label: "Activities, Situations, or Places the Client Avoids",
        type: "textarea",
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting These Interests",
        type: "textarea",
        placeholder: "Quotes, examples, repeated patterns, observed activities, stories, belongings, routines...",
      },
    ],
  },

  {
    id: "skills_competencies",
    label: "Section 4: Skills & Competencies",
    description: "Document skills and competencies reported or observed by the interviewee.",
    questions: [
      {
        id: "home_skills",
        label: "Home or Daily Living Skills",
        type: "textarea",
      },
      {
        id: "community_skills",
        label: "Community Skills",
        type: "textarea",
      },
      {
        id: "work_skills",
        label: "Work or Task Skills",
        type: "textarea",
      },
      {
        id: "technology_skills",
        label: "Technology Skills",
        type: "textarea",
      },
      {
        id: "independent_living_skills",
        label: "Independent Living Skills",
        type: "textarea",
      },
      {
        id: "observed_talents",
        label: "Observed Talents",
        type: "textarea",
      },
    ],
  },

  {
    id: "conditions_for_success",
    label: "Section 5: Conditions for Success",
    description: "Document environments, supports, schedules, and learning approaches that help the client succeed.",
    questions: [
      {
        id: "best_environments",
        label: "Best Environments",
        type: "textarea",
        placeholder: "Quiet, structured, active, outdoors, familiar, small team, predictable, flexible...",
      },
      {
        id: "best_supports",
        label: "Best Supports",
        type: "textarea",
      },
      {
        id: "best_schedule",
        label: "Best Schedule or Time of Day",
        type: "textarea",
      },
      {
        id: "best_supervision_style",
        label: "Best Supervision or Coaching Style",
        type: "textarea",
      },
      {
        id: "best_learning_style",
        label: "Best Learning Style",
        type: "textarea",
        placeholder: "Modeling, hands-on practice, written steps, visual supports, repetition, verbal explanation...",
      },
    ],
  },

  {
    id: "challenges_barriers",
    label: "Section 6: Challenges & Barriers",
    description: "Capture barriers, concerns, situations to avoid, and support needs.",
    questions: [
      {
        id: "barriers_observed",
        label: "Barriers Observed or Reported",
        type: "textarea",
      },
      {
        id: "situations_to_avoid",
        label: "Situations to Avoid",
        type: "textarea",
      },
      {
        id: "support_needs",
        label: "Support Needs",
        type: "textarea",
      },
      {
        id: "safety_concerns",
        label: "Safety Concerns",
        type: "textarea",
      },
      {
        id: "other_concerns",
        label: "Other Concerns",
        type: "textarea",
      },
    ],
  },

  {
    id: "employment_ideas",
    label: "Section 7: Employment Ideas & Community Leads",
    description: "Capture job ideas, businesses, community roles, and possible vocational themes.",
    questions: [
      {
        id: "jobs_client_might_enjoy",
        label: "Jobs or Tasks the Client Might Enjoy",
        type: "textarea",
      },
      {
        id: "businesses_or_places_to_explore",
        label: "Businesses or Places to Explore",
        type: "textarea",
      },
      {
        id: "community_roles",
        label: "Community Roles or Volunteer Experiences",
        type: "textarea",
      },
      {
        id: "people_or_connections",
        label: "People or Community Connections to Contact",
        type: "textarea",
      },
      {
        id: "possible_vocational_themes",
        label: "Possible Vocational Themes",
        type: "textarea",
      },
    ],
  },

  {
    id: "key_takeaways",
    label: "Section 8: Key Takeaways",
    description: "Summarize the most important Discovery information from this interview.",
    questions: [
      {
        id: "most_important_information",
        label: "Most Important Information Learned",
        type: "textarea",
      },
      {
        id: "patterns_revealed",
        label: "Patterns Revealed",
        type: "textarea",
      },
      {
        id: "recommended_next_steps",
        label: "Recommended Next Discovery Steps",
        type: "textarea",
      },
      {
        id: "time_to_complete_interview",
        label: "Time to Complete Interview",
        type: "text",
        placeholder: "Example: 45 minutes",
      },
    ],
  },
];

export const DISCOVERY_INTERVIEW_META = {
  assessment_type: "discovery_interview",
  label: "Discovery Interview",
  description:
    "Repeatable Customized Employment interview record for gathering Discovery information from people who know the client well.",
  version: 1,
  is_repeatable: true,
  one_per_client: false,
  client_category: "customized_employment",
};
