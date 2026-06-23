/**
 * Home & Community Discovery — Definition
 *
 * Customized Employment / Discovering Personal Genius Stage One assessment.
 *
 * Captures:
 * - Home and neighborhood observation
 * - Home environment and belongings
 * - Daily routines and chores
 * - Hobbies, interests, collections, and activities
 * - Community participation
 * - Neighborhood mapping
 * - Observable talents, interests, and skills
 * - Conditions, activities, and locations to avoid
 *
 * Feeds the CE Discovery Staging Record Stage One.
 * assessment_type: "home_community_discovery"
 */

export const HOME_COMMUNITY_DISCOVERY_SECTIONS = [
  {
    id: "visit_information",
    label: "Section 1: Visit Information",
    description: "Document the basic details of the home and community discovery visit.",
    questions: [
      {
        id: "observation_date",
        label: "Date of Observation",
        type: "date",
      },
      {
        id: "observation_location",
        label: "Observation Location",
        type: "text",
        placeholder: "Home, family home, apartment, neighborhood, community location...",
      },
      {
        id: "people_present",
        label: "People Present",
        type: "textarea",
        placeholder: "List people present and their relationship to the client.",
      },
      {
        id: "people_interviewed",
        label: "People Interviewed & Relationship to Client",
        type: "textarea",
        placeholder: "Example: parent, roommate, staff, sibling, neighbor...",
      },
      {
        id: "observation_length",
        label: "Observation Length",
        type: "text",
        placeholder: "Example: 1.5 hours",
      },
      {
        id: "recap_of_information",
        label: "Recap of Information Learned",
        type: "textarea",
        placeholder: "Summarize key information learned. Include quotes, field notes, and concrete observations when possible.",
      },
    ],
  },

  {
    id: "home_environment",
    label: "Section 2: Home Environment Observations",
    description: "Document observations of home, bedroom, property, belongings, and personal environment.",
    questions: [
      {
        id: "living_arrangement",
        label: "Living Arrangement",
        type: "select_single",
        options: [
          "Lives alone",
          "Lives with family",
          "Lives with roommate(s)",
          "Supported living",
          "Group home",
          "Residential setting",
          "Other",
          "Unknown",
        ],
      },
      {
        id: "home_observations",
        label: "Observations of Home, Bedroom, Property, and Belongings",
        type: "textarea",
        placeholder: "Describe what was observed. Focus on objects, routines, organization, tools, collections, equipment, and clues about interests or skills.",
      },
      {
        id: "personal_belongings",
        label: "Relevant Personal Belongings, Collections, Tools, or Equipment",
        type: "textarea",
        placeholder: "Document items that reveal interests, talents, habits, preferences, or skills.",
      },
      {
        id: "organization_patterns",
        label: "Organization Patterns Observed",
        type: "textarea",
        placeholder: "Describe how the person organizes belongings, space, routines, supplies, or personal items.",
      },
      {
        id: "home_environment_strengths",
        label: "Home Environment Strengths",
        type: "textarea",
        placeholder: "Document strengths observed in the home environment.",
      },
      {
        id: "home_environment_concerns",
        label: "Home Environment Concerns or Barriers",
        type: "textarea",
        placeholder: "Document concerns that may affect employment planning, support needs, or environmental fit.",
      },
    ],
  },

  {
    id: "daily_life_tasks",
    label: "Section 3: Daily Life, Chores, and Responsibilities",
    description: "Capture chores and tasks performed at home and in daily life.",
    questions: [
      {
        id: "chores_tasks_observed",
        label: "Chores & Tasks Performed at Home and Daily Life",
        type: "textarea",
        placeholder: "Describe tasks the client performs. Use action verbs and describe how tasks are completed.",
      },
      {
        id: "daily_routines",
        label: "Daily Routines",
        type: "textarea",
        placeholder: "Describe morning, afternoon, evening, and weekly routines when known.",
      },
      {
        id: "independent_tasks",
        label: "Tasks Completed Independently",
        type: "textarea",
        placeholder: "List tasks the client completes without support.",
      },
      {
        id: "supported_tasks",
        label: "Tasks Requiring Support, Prompts, or Assistance",
        type: "textarea",
        placeholder: "Describe the task, support needed, and who provides the support.",
      },
      {
        id: "task_performance_observations",
        label: "Task Performance Observations",
        type: "textarea",
        placeholder: "Describe pace, accuracy, stamina, attention, sequencing, problem solving, and follow-through.",
      },
      {
        id: "work_relevant_daily_skills",
        label: "Daily Life Skills With Possible Workplace Relevance",
        type: "textarea",
        placeholder: "Identify daily tasks or routines that may transfer to work tasks.",
      },
    ],
  },

  {
    id: "interests_activities",
    label: "Section 4: Hobbies, Interests, Collections, and Activities",
    description: "Document hobbies, sports, collections, interests, and activities noticed during the home visit.",
    questions: [
      {
        id: "hobbies_interests_collections",
        label: "Hobbies, Sports, Collections, and Interests Noticed",
        type: "textarea",
        placeholder: "Describe hobbies, interests, collections, preferred activities, and how often they occur.",
      },
      {
        id: "preferred_activities",
        label: "Preferred Activities",
        type: "textarea",
        placeholder: "List activities the client chooses, requests, initiates, or talks about positively.",
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting These Interests",
        type: "textarea",
        placeholder: "Include observed behavior, objects, routines, quotes, photos, examples, or repeated patterns.",
      },
      {
        id: "skills_connected_to_interests",
        label: "Skills Connected to Interests",
        type: "textarea",
        placeholder: "Describe any skills demonstrated through hobbies, collections, sports, technology, gaming, art, music, outdoor activities, etc.",
      },
      {
        id: "possible_discovery_leads",
        label: "Possible Discovery Leads From Interests",
        type: "textarea",
        placeholder: "List places, people, activities, businesses, or community settings that should be explored later.",
      },
    ],
  },

  {
    id: "community_participation",
    label: "Section 5: Family, Friends, and Community Participation",
    description: "Document family, friend, and community activities and regularity.",
    questions: [
      {
        id: "family_friend_community_activities",
        label: "Family/Friend/Community Activities and Regularity",
        type: "textarea",
        placeholder: "Describe activities the client participates in and how often.",
      },
      {
        id: "natural_supports",
        label: "Natural Supports",
        type: "textarea",
        placeholder: "List family, friends, neighbors, community members, staff, or others who provide support or connection.",
        guidance: {
          purpose: "Natural supports are people who exist in the client's life and can provide assistance, connection, or reinforcement in a workplace setting — without being paid staff. Identifying them early helps build an employment support network grounded in real relationships.",
          include: [
            "Family members who actively assist or encourage",
            "Friends, neighbors, or roommates who provide help",
            "Faith community members or mentors",
            "Coaches, teachers, or community volunteers",
            "Coworkers or employers from past jobs who had a positive relationship",
          ],
          exclude: [
            "Paid support staff or job coaches (document separately)",
            "General descriptions like 'has a supportive family' without specifics",
            "People the client has not had contact with in over a year",
          ],
          usedFor: [
            "Identifying who can support job-site integration without formal supports",
            "Informing the Natural Supports section of the Discovery Staging Record",
            "Building the employer negotiation strategy for natural workplace integration",
          ],
        },
      },
      {
        id: "social_preferences",
        label: "Social Preferences Observed or Reported",
        type: "textarea",
        placeholder: "Describe preferred people, group size, interaction style, comfort level, and social strengths.",
      },
      {
        id: "community_strengths",
        label: "Community Participation Strengths",
        type: "textarea",
        placeholder: "Document strengths shown in community participation or relationships.",
      },
      {
        id: "community_barriers",
        label: "Community Participation Barriers",
        type: "textarea",
        placeholder: "Document barriers such as transportation, anxiety, access, cost, support needs, scheduling, or safety.",
      },
    ],
  },

  {
    id: "neighborhood_mapping",
    label: "Section 6: Neighborhood Mapping",
    description: "List resources, employers, transportation options, neighbors, activities, and civic engagement opportunities.",
    questions: [
      {
        id: "nearby_resources",
        label: "Nearby Resources",
        type: "textarea",
        placeholder: "List nearby stores, libraries, parks, recreation sites, service providers, community centers, schools, etc.",
      },
      {
        id: "nearby_employers",
        label: "Nearby Employers or Businesses of Interest",
        type: "textarea",
        placeholder: "List businesses close to the client that may connect to interests, skills, or themes.",
      },
      {
        id: "transportation_options_observed",
        label: "Transportation Options Observed or Identified",
        type: "textarea",
        placeholder: "List bus routes, paratransit, family rides, walking/wheelchair access, rideshare, community transportation, etc.",
      },
      {
        id: "neighbors_connections",
        label: "Neighbors or Community Connections of Interest",
        type: "textarea",
        placeholder: "List people, relationships, or community connections that may support discovery or employment.",
      },
      {
        id: "activities_civic_engagement",
        label: "Activities or Civic Engagement Opportunities",
        type: "textarea",
        placeholder: "List clubs, volunteering, events, faith/community groups, recreation, or civic opportunities.",
      },
      {
        id: "places_visited",
        label: "Places Visited During Neighborhood Mapping",
        type: "textarea",
        placeholder: "Document places actually visited and what was observed or learned.",
      },
    ],
  },

  {
    id: "observable_talents_skills",
    label: "Section 7: Observable Talents, Interests, and Skills",
    description: "Document observable talents, interests, and skills revealed during discovery.",
    questions: [
      {
        id: "observable_talents",
        label: "Talents Observable or Revealed",
        type: "textarea",
        placeholder: "Describe talents using concrete examples and observed evidence.",
      },
      {
        id: "observable_skills",
        label: "Skills Observable or Revealed",
        type: "textarea",
        placeholder: "Describe what the client did, how they did it, and what support was or was not needed.",
      },
      {
        id: "observable_interests",
        label: "Interests Observable or Revealed",
        type: "textarea",
        placeholder: "Describe interests supported by observation, repeated behavior, or reliable reports.",
      },
      {
        id: "best_observed_tasks",
        label: "Best Observed Tasks or Activities",
        type: "textarea",
        placeholder: "List tasks where the client appeared engaged, capable, comfortable, persistent, or skilled.",
      },
      {
        id: "workplace_relevance",
        label: "Possible Workplace Relevance",
        type: "textarea",
        placeholder: "Describe how observed talents, interests, or skills may connect to work tasks or environments.",
      },
      {
        id: "evidence_notes",
        label: "Evidence Notes",
        type: "textarea",
        placeholder: "Include concrete examples, quotes, observed actions, photos taken, or field note references.",
      },
    ],
  },

  {
    id: "avoidance_conditions",
    label: "Section 8: Activities, Situations, and Locations to Avoid",
    description: "Document activities, situations, and locations that may need to be avoided and why.",
    questions: [
      {
        id: "activities_to_avoid",
        label: "Activities to Avoid",
        type: "textarea",
        placeholder: "Describe activities that appear to cause distress, disengagement, risk, refusal, or poor fit.",
      },
      {
        id: "situations_to_avoid",
        label: "Situations to Avoid",
        type: "textarea",
        placeholder: "Describe situations such as crowds, noise, pace, conflict, isolation, unclear expectations, etc.",
      },
      {
        id: "locations_to_avoid",
        label: "Locations to Avoid",
        type: "textarea",
        placeholder: "Describe locations or environments that appear unsuitable and why.",
      },
      {
        id: "sensory_environmental_concerns",
        label: "Sensory or Environmental Concerns",
        type: "textarea",
        placeholder: "Document noise, lighting, temperature, smell, physical layout, accessibility, safety, or other concerns.",
      },
      {
        id: "support_needed_to_reduce_barriers",
        label: "Supports Needed to Reduce Barriers",
        type: "textarea",
        placeholder: "Describe supports, accommodations, modifications, or strategies that may reduce barriers.",
      },
      {
        id: "avoidance_evidence",
        label: "Evidence Supporting Avoidance Conditions",
        type: "textarea",
        placeholder: "Include observed behaviors, reports, examples, or prior history supporting the concern.",
      },
    ],
  },

 {
  id: "emerging_vocational_themes",
  label: "Section 9: Emerging Vocational Themes & Conditions for Success",
  description: "Identify emerging vocational themes, conditions for success, and discovery hypotheses revealed during Stage One.",
  questions: [
    {
      id: "activities_consistently_drawn_to",
      label: "Activities the Client is Consistently Drawn Toward",
      type: "textarea",
      placeholder: "Describe activities, topics, tasks, objects, places, or routines repeatedly chosen, discussed, requested, or observed.",
    },
    {
      id: "preferred_people_patterns",
      label: "People the Client Appears to Prefer Being Around",
      type: "textarea",
      placeholder: "Describe preferred social patterns, relationships, interaction styles, and group sizes.",
    },
    {
      id: "best_environments_observed",
      label: "Environments Where the Client Appears Most Successful",
      type: "textarea",
      placeholder: "Describe settings where engagement, comfort, participation, confidence, and success were strongest.",
    },
    {
      id: "challenging_environments_observed",
      label: "Environments Where the Client Appears to Struggle",
      type: "textarea",
      placeholder: "Describe settings that appear to reduce engagement, participation, comfort, or success.",
    },
    {
      id: "conditions_for_success_observed",
      label: "Conditions for Success Observed",
      type: "textarea",
      placeholder: "Describe supports, routines, environmental factors, supervision styles, learning approaches, social conditions, or accommodations associated with success.",
    },
    {
      id: "emerging_vocational_themes",
      label: "Emerging Vocational Themes",
      type: "textarea",
      placeholder: "Identify possible vocational themes emerging from interests, skills, environments, relationships, routines, and observations.",
    },
    {
      id: "potential_businesses_or_settings",
      label: "Potential Businesses, Industries, or Community Settings to Explore",
      type: "textarea",
      placeholder: "List employers, industries, organizations, businesses, or community settings that may align with emerging themes.",
    },
    {
      id: "discovery_hypotheses",
      label: "Discovery Hypotheses to Test During Stage Two",
      type: "textarea",
      placeholder: "Describe hypotheses that should be tested through interviews, observations, informational interviews, work experiences, or community exploration.",
    },
  ],
},

{
  id: "stage_one_summary",
  label: "Section 10: Stage One Summary",
  description: "Summarize Stage One findings for the Discovery Staging Record.",
  questions: [
    {
      id: "stage_one_summary_narrative",
      label: "Stage One Summary Narrative",
      type: "textarea",
      placeholder: "Summarize the most important findings from home and community discovery.",
    },
    {
      id: "emerging_patterns",
      label: "Emerging Patterns",
      type: "textarea",
      placeholder: "Describe emerging patterns in interests, talents, skills, supports, settings, and conditions.",
    },
    {
      id: "recommended_next_discovery_steps",
      label: "Recommended Next Discovery Steps",
      type: "textarea",
      placeholder: "List people to interview, places to visit, activities to observe, or records to review next.",
    },
    {
      id: "time_to_complete_stage_one",
      label: "Time to Complete Stage One",
      type: "text",
      placeholder: "Example: 3.5 hours",
    },
  ],
},
];

export const HOME_COMMUNITY_DISCOVERY_META = {
  assessment_type: "home_community_discovery",
  label: "Home & Community Discovery",
  description:
    "Stage One Customized Employment discovery assessment covering home observations, daily routines, interests, community participation, neighborhood mapping, observable talents and skills, and conditions to avoid.",
  version: 1,
  is_repeatable: false,
  one_per_client: true,
  client_category: "customized_employment",
};