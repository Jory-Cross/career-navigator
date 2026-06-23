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
        guidance: {
          purpose: "Document when the home and community discovery visit occurred to establish context and timeline for observations.",
          include: [
            "The actual date the visit took place",
            "The specific date of the observation period",
          ],
          exclude: [
            "Vague dates like 'last week' or 'sometime in June'",
            "Multiple dates if this is a single visit record",
          ],
          usedFor: [
            "Discovery Staging Record timeline and chronology",
            "Documenting observation recency for evidence sourcing",
          ],
        },
      },
      {
        id: "observation_location",
        label: "Observation Location",
        type: "text",
        placeholder: "Home, family home, apartment, neighborhood, community location...",
        guidance: {
          purpose: "Identify where the observation took place to frame all subsequent discoveries in the correct environmental context.",
          include: [
            "Primary residence (e.g., 'family home in residential neighborhood')",
            "Community locations visited (e.g., 'local grocery store, library branch')",
            "Specific addresses or landmarks if helpful",
          ],
          exclude: [
            "Staff office or meeting room where client was interviewed but not observed",
            "Generic descriptions without location context",
          ],
          usedFor: [
            "Contextualizing home environment observations",
            "Neighborhood mapping for Discovery Staging Record",
            "Identifying community resources and accessibility",
          ],
        },
      },
      {
        id: "people_present",
        label: "People Present",
        type: "textarea",
        placeholder: "List people present and their relationship to the client.",
        guidance: {
          purpose: "Document who was physically present during the observation to inform interpretation of the client's behavior and environment.",
          include: [
            "Family members in the home (parent, sibling, guardian)",
            "Paid support staff or roommates present",
            "Community members encountered (neighbors, faith leaders)",
            "How each person relates to the client",
          ],
          exclude: [
            "People mentioned in conversation but not physically present",
            "Staff who only conducted the interview",
          ],
          usedFor: [
            "Understanding social context of observations",
            "Identifying natural supports and community connections",
            "Informing relationship and social preference patterns",
          ],
        },
      },
      {
        id: "people_interviewed",
        label: "People Interviewed & Relationship to Client",
        type: "textarea",
        placeholder: "Example: parent, roommate, staff, sibling, neighbor...",
        guidance: {
          purpose: "Record who provided information about the client to establish source reliability and perspective in discovery findings.",
          include: [
            "Family members interviewed",
            "Paid caregivers or support staff",
            "Roommates or housemates",
            "Close neighbors or community members",
            "Their relationship to and knowledge of the client",
          ],
          exclude: [
            "People mentioned but not actually interviewed",
            "General community (e.g., 'the neighborhood')",
          ],
          usedFor: [
            "Sourcing evidence in discovery findings",
            "Natural supports assessment",
            "Understanding observer perspective and potential bias",
          ],
        },
      },
      {
        id: "observation_length",
        label: "Observation Length",
        type: "text",
        placeholder: "Example: 1.5 hours",
        guidance: {
          purpose: "Document how much time was spent in observation to calibrate confidence in the findings and completeness of the discovery.",
          include: [
            "Total time spent observing (e.g., '2.5 hours', '3 hours')",
            "Actual observation time, not travel time",
          ],
          exclude: [
            "Time spent writing up notes",
            "Travel or setup time",
          ],
          usedFor: [
            "Assessing discovery fidelity and completeness",
            "Determining need for follow-up observations",
          ],
        },
      },
      {
        id: "recap_of_information",
        label: "Recap of Information Learned",
        type: "textarea",
        placeholder: "Summarize key information learned. Include quotes, field notes, and concrete observations when possible.",
        guidance: {
          purpose: "Capture the most important takeaways from the visit to set up all subsequent detailed observations and assessments.",
          include: [
            "Key surprises or discoveries about the client",
            "Major themes that emerged from conversations",
            "Observations that contradicted prior assumptions",
            "Direct quotes that illustrate important points",
            "Notable strengths or barriers observed",
          ],
          exclude: [
            "Duplicate information from detailed sections below",
            "Speculation without observational support",
          ],
          usedFor: [
            "Overall discovery narrative in DSR",
            "Setting context for detailed observations",
          ],
        },
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
        guidance: {
          purpose: "Establish the client's primary living situation to contextualize independence, support availability, and environmental influences.",
          include: [
            "The client's actual current living arrangement",
            "Choose the option that best describes the setup",
          ],
          exclude: [
            "Desired or planned future arrangements",
            "Previous living situations",
          ],
          usedFor: [
            "Understanding support network and accessibility",
            "Informing natural supports and relationships findings",
            "Contextualizing home environment observations",
          ],
        },
      },
      {
        id: "home_observations",
        label: "Observations of Home, Bedroom, Property, and Belongings",
        type: "textarea",
        placeholder: "Describe what was observed. Focus on objects, routines, organization, tools, collections, equipment, and clues about interests or skills.",
        guidance: {
          purpose: "Document the physical environment and what it reveals about the client's interests, preferences, skills, and daily routines.",
          include: [
            "Physical layout and condition of key spaces",
            "Objects, tools, equipment, or collections visible",
            "How space is organized and maintained",
            "Evidence of hobbies, activities, or interests",
            "Safety, accessibility, or environmental concerns",
            "Sensory environment (lighting, noise, temperature, etc.)",
          ],
          exclude: [
            "Judgmental language about cleanliness or condition",
            "Assumptions not grounded in what was actually observed",
            "Information from interviews only (use other fields for that)",
          ],
          usedFor: [
            "Home environment strengths and concerns sections",
            "Observable talents and interests in DSR",
            "Identifying workplace relevance from daily activities",
          ],
        },
      },
      {
        id: "personal_belongings",
        label: "Relevant Personal Belongings, Collections, Tools, or Equipment",
        type: "textarea",
        placeholder: "Document items that reveal interests, talents, habits, preferences, or skills.",
        guidance: {
          purpose: "Identify specific objects, tools, and collections that reveal the client's talents, interests, and potential workplace relevance.",
          include: [
            "Tools the client uses or maintains",
            "Collections (games, movies, sports gear, art supplies)",
            "Equipment for hobbies or interests",
            "Books, magazines, or materials that indicate preferences",
            "Items the client owns and cares for",
          ],
          exclude: [
            "Generic household items without significance",
            "Items that belong to others in the home",
            "Furniture or appliances not specific to the client",
          ],
          usedFor: [
            "Observable interests and talents in DSR",
            "Identifying skills connected to interests",
            "Determining workplace relevance and vocational themes",
          ],
        },
      },
      {
        id: "organization_patterns",
        label: "Organization Patterns Observed",
        type: "textarea",
        placeholder: "Describe how the person organizes belongings, space, routines, supplies, or personal items.",
        guidance: {
          purpose: "Document how the client organizes their environment and materials, revealing work habits, preferences, and potential workplace fit.",
          include: [
            "How belongings are grouped or stored",
            "Systems or methods the client uses to organize",
            "Daily routines and how they're structured",
            "Evidence of planning, sequencing, or systematizing",
            "Preferences for tidiness, order, or randomness",
          ],
          exclude: [
            "Standards of organization that aren't the client's own",
            "Assuming someone else manages organization",
          ],
          usedFor: [
            "Understanding task performance and work habits",
            "Identifying conditions for success",
            "Workplace organizational fit and accommodation needs",
          ],
        },
      },
      {
        id: "home_environment_strengths",
        label: "Home Environment Strengths",
        type: "textarea",
        placeholder: "Document strengths observed in the home environment.",
        guidance: {
          purpose: "Highlight positive aspects of the home environment that support the client's success and could inform workplace accommodations.",
          include: [
            "Accessibility features that work well for the client",
            "Supportive people in the home",
            "Environment features that enhance engagement or focus",
            "Support systems or routines that function well",
            "Resources available to the client",
          ],
          exclude: [
            "Generic statements like 'supportive family' without specifics",
            "Repeating information from other sections",
          ],
          usedFor: [
            "Identifying conditions for success",
            "Informing workplace accommodation recommendations",
            "Building on existing strengths in employment planning",
          ],
        },
      },
      {
        id: "home_environment_concerns",
        label: "Home Environment Concerns or Barriers",
        type: "textarea",
        placeholder: "Document concerns that may affect employment planning, support needs, or environmental fit.",
        guidance: {
          purpose: "Record environmental barriers or concerns that may need to be addressed or accommodated in employment settings.",
          include: [
            "Accessibility barriers (stairs, narrow doorways, poor lighting)",
            "Safety concerns relevant to work environments",
            "Environmental sensory triggers (noise, lighting, temperature)",
            "Lack of resources or supports in the home",
            "Barriers that might transfer to workplace concerns",
          ],
          exclude: [
            "Judgmental statements about the client or family",
            "Concerns not grounded in environmental factors",
            "Repetition of issues addressed in strengths section",
          ],
          usedFor: [
            "Identifying workplace accommodation needs",
            "Planning environmental supports and modifications",
            "Avoidance conditions and workplace fit assessment",
          ],
        },
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
        guidance: {
          purpose: "Document all tasks and chores the client performs, using observable, specific language to reveal work-relevant capabilities.",
          include: [
            "Tasks the client initiates or completes",
            "Use action verbs (e.g., 'washes dishes', 'organizes items', 'sweeps floor')",
            "How the task is done and level of completion",
            "Frequency and pattern of task performance",
            "Tasks done with different types of support",
          ],
          exclude: [
            "Tasks the client doesn't do (see 'supported_tasks' field instead)",
            "Vague descriptions like 'helps around the house'",
            "Information about how well tasks are done (use 'task_performance_observations')",
          ],
          usedFor: [
            "Identifying work-relevant daily skills",
            "Observable talents and skills in DSR",
            "Determining independent and supported capability levels",
          ],
        },
      },
      {
        id: "daily_routines",
        label: "Daily Routines",
        type: "textarea",
        placeholder: "Describe morning, afternoon, evening, and weekly routines when known.",
        guidance: {
          purpose: "Capture the client's typical daily patterns and schedules to reveal consistency, preferences, and capacity for structured work routines.",
          include: [
            "Typical wake time and morning activities",
            "Daytime activities and when they occur",
            "Evening and bedtime routines",
            "Weekly patterns and recurring activities",
            "Meal times, breaks, and rest periods",
            "Consistency or variation in routines",
          ],
          exclude: [
            "Assumptions about what the client 'should' do",
            "Desired future routines (document as preferences elsewhere)",
          ],
          usedFor: [
            "Understanding conditions for success and structure preference",
            "Informing work schedule and break accommodation recommendations",
            "Determining stamina and consistency patterns",
          ],
        },
      },
      {
        id: "independent_tasks",
        label: "Tasks Completed Independently",
        type: "textarea",
        placeholder: "List tasks the client completes without support.",
        guidance: {
          purpose: "Document tasks the client performs without prompts, reminders, or assistance to establish capability baselines and independent work potential.",
          include: [
            "Tasks completed without reminders or help",
            "Tasks completed without needing someone present",
            "Tasks completed from start to finish without intervention",
          ],
          exclude: [
            "Tasks requiring even minimal prompting",
            "Tasks requiring setup or cleanup help",
            "Repetition of tasks from 'chores_tasks_observed'",
          ],
          usedFor: [
            "Establishing independent skill baseline",
            "Identifying work tasks requiring minimal support",
            "Building confidence in employment planning",
          ],
        },
      },
      {
        id: "supported_tasks",
        label: "Tasks Requiring Support, Prompts, or Assistance",
        type: "textarea",
        placeholder: "Describe the task, support needed, and who provides the support.",
        guidance: {
          purpose: "Document tasks requiring support to understand accommodation needs and job coaching intensity for employment planning.",
          include: [
            "Task description and what makes it difficult",
            "Type of support needed (verbal prompt, physical assistance, etc.)",
            "Who provides the support and how often needed",
            "Whether support decreases with practice",
            "Effectiveness of different support strategies",
          ],
          exclude: [
            "Tasks the client can do independently (see 'independent_tasks')",
            "Speculation about what support 'might' be needed",
          ],
          usedFor: [
            "Job coaching and support planning in DSR",
            "Determining accommodation and assistance type/intensity",
            "Informing workplace support strategy",
          ],
        },
      },
      {
        id: "task_performance_observations",
        label: "Task Performance Observations",
        type: "textarea",
        placeholder: "Describe pace, accuracy, stamina, attention, sequencing, problem solving, and follow-through.",
        guidance: {
          purpose: "Analyze HOW the client performs tasks to identify work style preferences, strengths, and challenges relevant to job matching.",
          include: [
            "Speed or pace (fast, slow, inconsistent)",
            "Accuracy and quality of work",
            "Ability to sustain effort (stamina, persistence)",
            "Attention to detail and focus",
            "Sequencing and organization of steps",
            "Problem-solving ability when things go wrong",
            "Ability to complete tasks without prompting",
            "Variability in performance based on context",
          ],
          exclude: [
            "Lists of specific tasks (use 'chores_tasks_observed')",
            "Diagnostic labels or judgments about ability",
          ],
          usedFor: [
            "Work performance profile in DSR",
            "Identifying workplace conditions for success",
            "Job matching to suitable tasks and pace",
            "Accommodation and learning approach recommendations",
          ],
        },
      },
      {
        id: "work_relevant_daily_skills",
        label: "Daily Life Skills With Possible Workplace Relevance",
        type: "textarea",
        placeholder: "Identify daily tasks or routines that may transfer to work tasks.",
        guidance: {
          purpose: "Connect daily life tasks to potential workplace applications to identify transferable skills and job match opportunities.",
          include: [
            "Daily tasks that use work-relevant skills",
            "The workplace equivalent or how it transfers",
            "Examples: organizing (warehouse work), following sequences (assembly), attention to detail (quality control)",
          ],
          exclude: [
            "All tasks from 'chores_tasks_observed' (focus on most relevant)",
            "Generic statements without specific skill connections",
          ],
          usedFor: [
            "Workplace relevance analysis in DSR",
            "Job matching based on demonstrated skills",
            "Building confidence in employment readiness",
          ],
        },
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
        guidance: {
          purpose: "Capture all hobbies, interests, and collections to identify themes and potential vocational directions for employment exploration.",
          include: [
            "Hobbies the client participates in",
            "Sports or athletic activities",
            "Collections the client maintains",
            "Interests expressed through behavior or discussion",
            "Frequency and intensity of participation",
          ],
          exclude: [
            "Assumed interests without observable evidence",
            "Interests from reports only (use 'preferred_activities' for those)",
          ],
          usedFor: [
            "Observable interests in DSR",
            "Emerging vocational themes",
            "Discovery leads for Stage Two exploration",
          ],
        },
      },
      {
        id: "preferred_activities",
        label: "Preferred Activities",
        type: "textarea",
        placeholder: "List activities the client chooses, requests, initiates, or talks about positively.",
        guidance: {
          purpose: "Document activities the client prefers or seeks out, showing motivation and engagement patterns essential for job satisfaction.",
          include: [
            "Activities the client chooses when given options",
            "Activities the client initiates without prompting",
            "Things the client requests or talks about positively",
            "Frequency and consistency of preferences",
          ],
          exclude: [
            "Activities staff think the client 'should' like",
            "Activities observed but not clearly preferred by the client",
          ],
          usedFor: [
            "Understanding motivation and engagement",
            "Job matching for satisfaction and commitment",
            "Preferred activities connections to work",
          ],
        },
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting These Interests",
        type: "textarea",
        placeholder: "Include observed behavior, objects, routines, quotes, photos, examples, or repeated patterns.",
        guidance: {
          purpose: "Ground stated interests in concrete evidence to build credible, evidence-based vocational themes for discovery planning.",
          include: [
            "Specific observed behaviors showing interest",
            "Objects or collections owned and maintained",
            "Time spent on the interest",
            "Direct quotes expressing interest",
            "Repeated patterns across multiple visits",
            "Photos or field notes documenting evidence",
          ],
          exclude: [
            "Speculation about interests",
            "Interests without supporting details",
          ],
          usedFor: [
            "Discovery Staging Record evidence sourcing",
            "Building credible vocational themes",
            "Informational interviews and discovery leads",
          ],
        },
      },
      {
        id: "skills_connected_to_interests",
        label: "Skills Connected to Interests",
        type: "textarea",
        placeholder: "Describe any skills demonstrated through hobbies, collections, sports, technology, gaming, art, music, outdoor activities, etc.",
        guidance: {
          purpose: "Analyze what skills the client demonstrates through interests to match talents with suitable employment opportunities.",
          include: [
            "Skills shown through hobbies",
            "Technical or creative abilities",
            "Problem-solving or planning skills",
            "Physical capabilities or coordination",
            "Social or communication skills through activities",
            "Patience, persistence, or focus demonstrated",
          ],
          exclude: [
            "Generic skill lists without interest connections",
            "Skills assumed but not demonstrated",
          ],
          usedFor: [
            "Observable skills and talents in DSR",
            "Vocational theme development",
            "Job matching to skills demonstrated",
          ],
        },
      },
      {
        id: "possible_discovery_leads",
        label: "Possible Discovery Leads From Interests",
        type: "textarea",
        placeholder: "List places, people, activities, businesses, or community settings that should be explored later.",
        guidance: {
          purpose: "Identify specific people, places, and opportunities to explore in Stage Two based on Stage One interests and themes.",
          include: [
            "Businesses or employers connected to interests",
            "Community organizations or groups",
            "People with expertise in areas of interest",
            "Volunteer opportunities aligned with interests",
            "Places the client could visit or explore",
            "Activities or events to observe",
          ],
          exclude: [
            "Generic suggestions not grounded in client interests",
            "Leads already explored in Stage One",
          ],
          usedFor: [
            "Stage Two discovery hypotheses and planning",
            "Informational interviews and activity scheduling",
            "Narrowing vocational exploration focus",
          ],
        },
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
        guidance: {
          purpose: "Document community participation patterns to understand social capacity, consistency, and opportunities for relationship building relevant to employment.",
          include: [
            "Activities with family members",
            "Social activities with friends",
            "Community events or organizations",
            "Faith or spiritual activities",
            "Frequency and consistency of participation",
            "Who participates with the client",
          ],
          exclude: [
            "Activities the client doesn't participate in",
            "Speculated about activities without evidence",
          ],
          usedFor: [
            "Community participation strengths and barriers",
            "Understanding social patterns and preferences",
            "Identifying natural supports and community connections",
          ],
        },
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
        guidance: {
          purpose: "Document social preferences and interaction patterns to inform workplace culture fit and team configuration recommendations.",
          include: [
            "Preferred group size (one-on-one, small group, large group)",
            "Types of people the client enjoys being around",
            "Interaction style preferences (quiet, social, structured, informal)",
            "Comfort level in different social situations",
            "Communication style preferences",
            "Social strengths demonstrated",
          ],
          exclude: [
            "Diagnostic labels about social ability",
            "Judging social preferences as 'right' or 'wrong'",
          ],
          usedFor: [
            "Emerging vocational themes and conditions for success",
            "Workplace culture and team fit recommendations",
            "Job coaching social integration strategies",
          ],
        },
      },
      {
        id: "community_strengths",
        label: "Community Participation Strengths",
        type: "textarea",
        placeholder: "Document strengths shown in community participation or relationships.",
        guidance: {
          purpose: "Highlight community engagement strengths to identify assets for employment integration and social support building.",
          include: [
            "Relationships the client maintains",
            "Community involvement or connections",
            "Communication strengths in social settings",
            "Leadership or helpful behaviors shown",
            "Reputation or positive standing in community",
          ],
          exclude: [
            "Repeating information from other sections",
            "Generic statements without specific examples",
          ],
          usedFor: [
            "Community participation and relationships in DSR",
            "Building on natural supports and connections",
            "Employment integration planning",
          ],
        },
      },
      {
        id: "community_barriers",
        label: "Community Participation Barriers",
        type: "textarea",
        placeholder: "Document barriers such as transportation, anxiety, access, cost, support needs, scheduling, or safety.",
        guidance: {
          purpose: "Identify community barriers to inform accommodation needs and support planning for workplace integration.",
          include: [
            "Transportation barriers or lack of access",
            "Anxiety or social discomfort in certain settings",
            "Cost or financial barriers",
            "Scheduling or availability constraints",
            "Support needs to participate",
            "Safety or health concerns",
            "Communication or access barriers",
          ],
          exclude: [
            "Judgmental language about the client or barriers",
            "Barriers not grounded in actual observation",
          ],
          usedFor: [
            "Accommodation and support planning",
            "Workplace barrier mitigation strategies",
            "Community participation conditions for success",
          ],
        },
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
        guidance: {
          purpose: "Map accessible community resources to support employment planning and identify potential community-based work or volunteer opportunities.",
          include: [
            "Stores and shopping locations",
            "Libraries, parks, and recreation facilities",
            "Service providers and community centers",
            "Schools and educational institutions",
            "Healthcare, transportation, and utility services",
            "Distance and accessibility from client's home",
          ],
          exclude: [
            "Resources located outside the reasonable neighborhood",
            "Speculated resources without local knowledge",
          ],
          usedFor: [
            "Neighborhood mapping in Discovery Staging Record",
            "Identifying accessible community-based opportunities",
            "Job development leads and local employers",
          ],
        },
      },
      {
        id: "nearby_employers",
        label: "Nearby Employers or Businesses of Interest",
        type: "textarea",
        placeholder: "List businesses close to the client that may connect to interests, skills, or themes.",
        guidance: {
          purpose: "Identify local employment opportunities that connect to client interests and themes for Stage Two exploration.",
          include: [
            "Employers within reasonable distance",
            "Businesses matching client interests or skills",
            "Variety of employment types and industries",
            "Accessibility and transportation considerations",
            "Why each business might be a good fit",
          ],
          exclude: [
            "Distant employers not reachable by client",
            "Suggested employers unrelated to interests",
          ],
          usedFor: [
            "Neighborhood employer mapping in DSR",
            "Stage Two informational interview leads",
            "Job development and discovery exploration",
          ],
        },
      },
      {
        id: "transportation_options_observed",
        label: "Transportation Options Observed or Identified",
        type: "textarea",
        placeholder: "List bus routes, paratransit, family rides, walking/wheelchair access, rideshare, community transportation, etc.",
        guidance: {
          purpose: "Document transportation access and options available to the client to inform job location and support requirements.",
          include: [
            "Public transportation routes near home",
            "Paratransit or dial-a-ride services available",
            "Walking distance and accessibility",
            "Family or friend rides available",
            "Rideshare or community transportation options",
            "Driver's license status and vehicle access",
            "Any transportation barriers or challenges",
          ],
          exclude: [
            "Speculation about transportation 'if' the client tries it",
            "Options observed but not accessible to the client",
          ],
          usedFor: [
            "Neighborhood transportation mapping in DSR",
            "Job location feasibility assessment",
            "Transportation support planning for employment",
          ],
        },
      },
      {
        id: "neighbors_connections",
        label: "Neighbors or Community Connections of Interest",
        type: "textarea",
        placeholder: "List people, relationships, or community connections that may support discovery or employment.",
        guidance: {
          purpose: "Identify community connections and relationships that could support employment discovery, informational interviews, or ongoing workplace support.",
          include: [
            "Neighbors with positive relationships",
            "Community leaders or engaged members",
            "People with expertise in areas of interest",
            "Previous mentors, coaches, or teachers",
            "Faith or community group members",
            "Potential informational interview sources",
          ],
          exclude: [
            "Speculated connections without actual relationships",
            "People the client hasn't had contact with recently",
          ],
          usedFor: [
            "Informational interviews and Stage Two discovery leads",
            "Natural supports and community resources",
            "Building employment support network",
          ],
        },
      },
      {
        id: "activities_civic_engagement",
        label: "Activities or Civic Engagement Opportunities",
        type: "textarea",
        placeholder: "List clubs, volunteering, events, faith/community groups, recreation, or civic opportunities.",
        guidance: {
          purpose: "Map accessible community activities and volunteering opportunities that match client interests and enable skill development.",
          include: [
            "Clubs and group activities in the neighborhood",
            "Volunteering opportunities aligned with interests",
            "Events, festivals, or seasonal activities",
            "Faith communities and spiritual opportunities",
            "Recreation, sports, or hobby groups",
            "Accessibility and how to participate",
          ],
          exclude: [
            "Activities not actually available in the neighborhood",
            "Activities the client has shown no interest in",
          ],
          usedFor: [
            "Discovery Staging Record civic and community opportunity mapping",
            "Stage Two exploration activities and leads",
            "Community-based work or volunteer placements",
          ],
        },
      },
      {
        id: "places_visited",
        label: "Places Visited During Neighborhood Mapping",
        type: "textarea",
        placeholder: "Document places actually visited and what was observed or learned.",
        guidance: {
          purpose: "Record where the staff actually walked or visited to document direct observation and establish discovery feasibility.",
          include: [
            "Specific places visited during the neighborhood walk",
            "What was observed at each location",
            "How accessible each place was",
            "Unexpected discoveries or opportunities found",
            "Confirmation or contradiction of prior assumptions",
          ],
          exclude: [
            "Places mentioned but not visited",
            "Places visited prior to this discovery visit",
          ],
          usedFor: [
            "Documenting discovery visit thoroughness",
            "Identifying places for follow-up Stage Two visits",
            "Neighborhood mapping evidence in DSR",
          ],
        },
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
        guidance: {
          purpose: "Document natural abilities and gifts demonstrated by the client to build confidence and identify employment potential.",
          include: [
            "Natural abilities the client demonstrates",
            "Things the client does well without training",
            "Unique strengths or gifts",
            "Specific examples of talent in action",
            "How the talent appeared or was revealed",
          ],
          exclude: [
            "Skills that had to be taught (use 'observable_skills')",
            "Assumed talents without evidence",
            "Talents mentioned in reports but not observed",
          ],
          usedFor: [
            "Observable talents in DSR",
            "Vocational theme development",
            "Strength-based employment planning",
          ],
        },
      },
      {
        id: "observable_skills",
        label: "Skills Observable or Revealed",
        type: "textarea",
        placeholder: "Describe what the client did, how they did it, and what support was or was not needed.",
        guidance: {
          purpose: "Document demonstrated skills and competencies with specific observational detail to establish work readiness and capability.",
          include: [
            "Specific skills observed in action",
            "How the skill was demonstrated",
            "Context where the skill was shown",
            "Quality or accuracy of execution",
            "Whether support was needed",
            "Transferability to work tasks",
          ],
          exclude: [
            "Natural talents (use 'observable_talents')",
            "Assumed skills not actually observed",
            "Skills mentioned in reports only",
          ],
          usedFor: [
            "Observable skills in DSR",
            "Job matching to demonstrated capabilities",
            "Workplace readiness assessment",
          ],
        },
      },
      {
        id: "observable_interests",
        label: "Interests Observable or Revealed",
        type: "textarea",
        placeholder: "Describe interests supported by observation, repeated behavior, or reliable reports.",
        guidance: {
          purpose: "Document confirmed interests grounded in direct observation to ensure vocational themes match actual client preferences.",
          include: [
            "Interests directly observed",
            "Repeated patterns showing sustained interest",
            "Evidence from multiple visits or sources",
            "How the interest was demonstrated",
            "Intensity or enthusiasm level",
          ],
          exclude: [
            "Interests mentioned once or in reports only",
            "Assumed interests without evidence",
            "Interests contradicted by observed behavior",
          ],
          usedFor: [
            "Observable interests in DSR",
            "Emerging vocational themes",
            "Confidence in interest-based job recommendations",
          ],
        },
      },
      {
        id: "best_observed_tasks",
        label: "Best Observed Tasks or Activities",
        type: "textarea",
        placeholder: "List tasks where the client appeared engaged, capable, comfortable, persistent, or skilled.",
        guidance: {
          purpose: "Highlight tasks where the client showed peak performance, comfort, and engagement to identify ideal work conditions.",
          include: [
            "Tasks completed with visible engagement",
            "Activities where the client seemed confident",
            "Tasks completed without prompting or difficulty",
            "Activities the client wanted to continue",
            "Tasks done with accuracy and care",
          ],
          exclude: [
            "Tasks the client struggled with (document elsewhere)",
            "Tasks completed only with significant support",
          ],
          usedFor: [
            "Conditions for success in DSR",
            "Job matching to optimal task types",
            "Identifying work satisfaction factors",
          ],
        },
      },
      {
        id: "workplace_relevance",
        label: "Possible Workplace Relevance",
        type: "textarea",
        placeholder: "Describe how observed talents, interests, or skills may connect to work tasks or environments.",
        guidance: {
          purpose: "Translate home and community observations into workplace potential to bridge discovery to employment planning.",
          include: [
            "How observed talents connect to work tasks",
            "How interests translate to job types",
            "How daily skills transfer to work",
            "Workplace environments that match preferences",
            "Industries or roles that align with themes",
          ],
          exclude: [
            "Generic job suggestions unrelated to observations",
            "Assumptions about workplace fit without evidence",
          ],
          usedFor: [
            "Workplace relevance in DSR",
            "Job matching and recommendations",
            "Vocational theme to employment translation",
          ],
        },
      },
      {
        id: "evidence_notes",
        label: "Evidence Notes",
        type: "textarea",
        placeholder: "Include concrete examples, quotes, observed actions, photos taken, or field note references.",
        guidance: {
          purpose: "Ground all section conclusions in concrete evidence to build credibility and ensure findings are defensible.",
          include: [
            "Direct quotes from conversations",
            "Specific observed examples",
            "Reference to photos or field notes taken",
            "Date and context of observations",
            "Names of people who witnessed events",
          ],
          exclude: [
            "Repeating information documented elsewhere",
            "Vague references without specifics",
          ],
          usedFor: [
            "Discovery Staging Record evidence sourcing",
            "Supporting vocational themes and recommendations",
            "Documentation completeness and credibility",
          ],
        },
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
        guidance: {
          purpose: "Document activities that cause distress or poor fit to inform workplace accommodations and job matching to suitable tasks.",
          include: [
            "Activities the client refuses or strongly avoids",
            "Activities that cause visible distress or anxiety",
            "Activities where the client disengages",
            "Activities that create risk or safety concerns",
            "What signals the avoidance (refusing, shutting down, etc.)",
            "Why the activity appears unsuitable",
          ],
          exclude: [
            "Activities the client dislikes but can do",
            "Speculation about what the client 'might' avoid",
          ],
          usedFor: [
            "Avoidance conditions in DSR",
            "Workplace fit and accommodation planning",
            "Job task exclusions and modifications",
          ],
        },
      },
      {
        id: "situations_to_avoid",
        label: "Situations to Avoid",
        type: "textarea",
        placeholder: "Describe situations such as crowds, noise, pace, conflict, isolation, unclear expectations, etc.",
        guidance: {
          purpose: "Identify situational triggers and conditions that reduce client performance or comfort to design supportive work environments.",
          include: [
            "Crowd size or social situations that trigger anxiety",
            "Noise levels, lighting, or sensory triggers",
            "Pace of work or tempo expectations",
            "Conflict, criticism, or high-pressure situations",
            "Isolation or excessive independence",
            "Unstructured or unclear expectations",
            "What happens when these situations occur",
          ],
          exclude: [
            "Preferences (use 'social_preferences' or elsewhere)",
            "Assumptions without supporting observations",
          ],
          usedFor: [
            "Workplace environment design for success",
            "Accommodation and support type selection",
            "Job coach support and supervision approach",
          ],
        },
      },
      {
        id: "locations_to_avoid",
        label: "Locations to Avoid",
        type: "textarea",
        placeholder: "Describe locations or environments that appear unsuitable and why.",
        guidance: {
          purpose: "Document physical environments that don't support the client's success to exclude unsuitable job sites.",
          include: [
            "Types of environments where the client struggled",
            "Physical characteristics that create barriers",
            "Settings the client avoids or becomes anxious in",
            "Why the location is unsuitable",
            "What happens when the client is in these settings",
          ],
          exclude: [
            "Locations the client dislikes but can function in",
            "Speculation about future unsuitable locations",
          ],
          usedFor: [
            "Job site selection criteria in DSR",
            "Exclusion of unsuitable work environments",
            "Environmental accommodation planning",
          ],
        },
      },
      {
        id: "sensory_environmental_concerns",
        label: "Sensory or Environmental Concerns",
        type: "textarea",
        placeholder: "Document noise, lighting, temperature, smell, physical layout, accessibility, safety, or other concerns.",
        guidance: {
          purpose: "Specify sensory and physical environmental factors that impact performance to design accessible, supportive work settings.",
          include: [
            "Noise sensitivity or preferences",
            "Lighting needs or sensitivities",
            "Temperature preferences or sensitivities",
            "Smell or air quality sensitivity",
            "Physical layout and accessibility concerns",
            "Safety risks in certain environments",
            "How these factors affect the client's functioning",
          ],
          exclude: [
            "Generic complaints not linked to the client",
            "Speculation about sensory needs without evidence",
          ],
          usedFor: [
            "Workplace accommodations and accessibility planning",
            "Job site environmental requirements",
            "Sensory support and environmental modifications",
          ],
        },
      },
      {
        id: "support_needed_to_reduce_barriers",
        label: "Supports Needed to Reduce Barriers",
        type: "textarea",
        placeholder: "Describe supports, accommodations, modifications, or strategies that may reduce barriers.",
        guidance: {
          purpose: "Propose proactive accommodations and supports to overcome identified barriers and enable client success.",
          include: [
            "Accommodations that could reduce barriers",
            "Environmental modifications or alternatives",
            "Support strategies (coaching, structure, prompts, etc.)",
            "Modifications to tasks or pace",
            "Accessibility features or technology",
            "Whether any supports were tried and effective",
          ],
          exclude: [
            "Supports not feasible in work settings",
            "Supports that haven't been tested with the client",
          ],
          usedFor: [
            "Accommodation and support strategy planning",
            "Job coach support approach and intensity",
            "Conditions for success in employment settings",
          ],
        },
      },
      {
        id: "avoidance_evidence",
        label: "Evidence Supporting Avoidance Conditions",
        type: "textarea",
        placeholder: "Include observed behaviors, reports, examples, or prior history supporting the concern.",
        guidance: {
          purpose: "Ground avoidance findings in concrete evidence to support credible recommendations and workplace accommodations.",
          include: [
            "Specific observed behaviors when triggered",
            "Examples from multiple times or contexts",
            "Prior work history or incidents supporting the concern",
            "Family or staff reports with details",
            "Consistency and severity of response",
          ],
          exclude: [
            "Repeating information from avoidance sections above",
            "Assumptions without supporting evidence",
          ],
          usedFor: [
            "Supporting avoidance conditions recommendations in DSR",
            "Job site exclusion justification",
            "Employer education about accommodation needs",
          ],
        },
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
      guidance: {
        purpose: "Identify consistent, repeated patterns of choice and engagement to develop reliable vocational themes and employment direction.",
        include: [
          "Activities chosen when given options",
          "Topics the client initiates or talks about repeatedly",
          "Things the client requests or asks for",
          "Patterns across multiple observations or visits",
          "Why these activities appeal to the client",
        ],
        exclude: [
          "One-time interests or activities",
          "Activities mentioned once in reports",
          "Things the client 'should' like",
        ],
        usedFor: [
          "Emerging vocational themes in DSR",
          "Reliable job matching and employment direction",
          "Client motivation and satisfaction planning",
        ],
      },
    },
    {
      id: "preferred_people_patterns",
      label: "People the Client Appears to Prefer Being Around",
      type: "textarea",
      placeholder: "Describe preferred social patterns, relationships, interaction styles, and group sizes.",
      guidance: {
        purpose: "Document social preferences and relational patterns to inform workplace culture and team configuration for success.",
        include: [
          "Types of people the client gravitation toward",
          "Preferred group size or social configuration",
          "Interaction style the client seems most comfortable with",
          "Leaders or mentors the client responds well to",
          "Communication styles that work best",
        ],
        exclude: [
          "How the client 'should' interact socially",
          "Judgments about social skill level",
        ],
        usedFor: [
          "Conditions for success and workplace culture fit",
          "Job coach and supervisor style recommendations",
          "Team and work environment design",
        ],
      },
    },
    {
      id: "best_environments_observed",
      label: "Environments Where the Client Appears Most Successful",
      type: "textarea",
      placeholder: "Describe settings where engagement, comfort, participation, confidence, and success were strongest.",
      guidance: {
        purpose: "Document environments where the client thrives to identify replicable conditions for workplace success.",
        include: [
          "Physical settings where the client appeared engaged",
          "Characteristics of successful environments",
          "Social setup that supported success",
          "Structure, pace, or support level that worked well",
          "How the client behaved differently in these settings",
        ],
        exclude: [
          "Hypothetical ideal environments not observed",
          "Repetition from other sections",
        ],
        usedFor: [
          "Conditions for success in DSR",
          "Workplace environment matching and design",
          "Employment fit and accommodation planning",
        ],
      },
    },
    {
      id: "challenging_environments_observed",
      label: "Environments Where the Client Appears to Struggle",
      type: "textarea",
      placeholder: "Describe settings that appear to reduce engagement, participation, comfort, or success.",
      guidance: {
        purpose: "Identify environmental factors that reduce client performance to guide workplace exclusions and accommodations.",
        include: [
          "Physical settings where the client struggled",
          "Why these environments were challenging",
          "Social or structural factors that created difficulty",
          "How the client's behavior or engagement changed",
          "Whether support helped in these settings",
        ],
        exclude: [
          "Hypothetical challenging environments",
          "Repeating avoidance information from earlier sections",
        ],
        usedFor: [
          "Avoidance conditions and environment exclusions in DSR",
          "Job site exclusion criteria",
          "Workplace accommodation and design needs",
        ],
      },
    },
    {
      id: "conditions_for_success_observed",
      label: "Conditions for Success Observed",
      type: "textarea",
      placeholder: "Describe supports, routines, environmental factors, supervision styles, learning approaches, social conditions, or accommodations associated with success.",
      guidance: {
        purpose: "Synthesize all observed success factors into actionable conditions to replicate in employment planning.",
        include: [
          "Supports that enabled success (coaching, structure, reminders)",
          "Routines or predictability that worked",
          "Environmental factors supporting performance",
          "Supervision or feedback style that was effective",
          "Social or relational conditions for success",
          "Accommodations that made a difference",
        ],
        exclude: [
          "Repetition of best environments or activities",
          "Supports never actually tried or observed",
        ],
        usedFor: [
          "Conditions for success in DSR",
          "Job coaching plan and support strategy",
          "Workplace accommodation and support design",
        ],
      },
    },
    {
      id: "emerging_vocational_themes",
      label: "Emerging Vocational Themes",
      type: "textarea",
      placeholder: "Identify possible vocational themes emerging from interests, skills, environments, relationships, routines, and observations.",
      guidance: {
        purpose: "Synthesize all discovery data into clear vocational themes to guide Stage Two exploration and employment direction.",
        include: [
          "Patterns across interests, skills, and preferences",
          "Common threads from activities, environments, relationships",
          "Themes supported by multiple pieces of evidence",
          "Possible employment directions aligned with themes",
          "What makes these themes credible based on observation",
        ],
        exclude: [
          "Single interests without supporting patterns",
          "Unrealistic vocational directions",
          "Themes contradicted by observed behavior",
        ],
        usedFor: [
          "Emerging vocational themes in DSR",
          "Stage Two discovery hypotheses",
          "Employment exploration direction and job recommendations",
        ],
      },
    },
    {
      id: "potential_businesses_or_settings",
      label: "Potential Businesses, Industries, or Community Settings to Explore",
      type: "textarea",
      placeholder: "List employers, industries, organizations, businesses, or community settings that may align with emerging themes.",
      guidance: {
        purpose: "Identify specific, accessible employment opportunities grounded in client themes for Stage Two informational interviews.",
        include: [
          "Specific employers or businesses in the neighborhood",
          "Industries connected to client themes",
          "Community organizations or volunteer opportunities",
          "Why each business aligns with emerging themes",
          "Accessibility and how client could access the setting",
        ],
        exclude: [
          "Distant or inaccessible employers",
          "Jobs unrelated to documented themes",
          "Speculated opportunities not researched or observed",
        ],
        usedFor: [
          "Stage Two informational interview and discovery leads",
          "Neighborhood employer mapping in DSR",
          "Targeted job development and exploration",
        ],
      },
    },
    {
      id: "discovery_hypotheses",
      label: "Discovery Hypotheses to Test During Stage Two",
      type: "textarea",
      placeholder: "Describe hypotheses that should be tested through interviews, observations, informational interviews, work experiences, or community exploration.",
      guidance: {
        purpose: "Create testable questions and assumptions to drive focused Stage Two exploration and narrow vocational direction.",
        include: [
          "Specific hypotheses about emerging vocational themes",
          "Questions to answer through informational interviews",
          "Observations to test in Stage Two activities",
          "Skill or interest assumptions to verify",
          "How each hypothesis could be tested",
        ],
        exclude: [
          "Vague assumptions about employment potential",
          "Hypotheses not connected to Stage One data",
        ],
        usedFor: [
          "Stage Two discovery hypotheses in DSR",
          "Directing informational interviews and exploration",
          "Measuring discovery readiness and Stage One completion",
        ],
      },
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
      guidance: {
        purpose: "Create a concise narrative that captures key discoveries to frame the entire Stage One assessment.",
        include: [
          "Most significant discoveries about the client",
          "Key themes emerging across observations",
          "Notable strengths and capabilities",
          "Important barriers or considerations",
          "What is most important for others to know",
        ],
        exclude: [
          "Repeating information documented in detail sections",
          "Speculations not supported by evidence",
        ],
        usedFor: [
          "Discovery Staging Record overview narrative",
          "Executive summary of Stage One findings",
          "Contextual framing for Stage Two planning",
        ],
      },
    },
    {
      id: "emerging_patterns",
      label: "Emerging Patterns",
      type: "textarea",
      placeholder: "Describe emerging patterns in interests, talents, skills, supports, settings, and conditions.",
      guidance: {
        purpose: "Identify cross-cutting patterns across all discovery data to support credible vocational theme development.",
        include: [
          "Patterns in interests and what the client gravitates toward",
          "Consistent skill demonstrations or capabilities",
          "Recurring conditions associated with success",
          "Patterns in social preferences and relationships",
          "Environmental patterns (what works, what doesn't)",
        ],
        exclude: [
          "One-time observations treated as patterns",
          "Contradictory patterns without reconciliation",
        ],
        usedFor: [
          "Emerging patterns section of DSR",
          "Building confidence in vocational themes",
          "Directing Stage Two focused exploration",
        ],
      },
    },
    {
      id: "recommended_next_discovery_steps",
      label: "Recommended Next Discovery Steps",
      type: "textarea",
      placeholder: "List people to interview, places to visit, activities to observe, or records to review next.",
      guidance: {
        purpose: "Provide clear next steps to transition into Stage Two exploration grounded in Stage One findings.",
        include: [
          "People to conduct informational interviews with",
          "Employers or businesses to visit or research",
          "Activities or work experiences to observe or try",
          "Community settings or events to explore",
          "Records to review (school, prior work, etc.)",
          "Why each step is recommended based on findings",
        ],
        exclude: [
          "Next steps unrelated to Stage One discoveries",
          "Steps not feasible given client circumstances",
        ],
        usedFor: [
          "Recommended next discovery steps in DSR",
          "Stage Two planning and activity scheduling",
          "Seamless transition from Stage One to Stage Two",
        ],
      },
    },
    {
      id: "time_to_complete_stage_one",
      label: "Time to Complete Stage One",
      type: "text",
      placeholder: "Example: 3.5 hours",
      guidance: {
        purpose: "Document total discovery effort to calibrate resource allocation and assess discovery fidelity.",
        include: [
          "Total hours spent on Stage One discovery",
          "Includes observations, interviews, visits, and documentation",
        ],
        exclude: [
          "Time spent writing reports or analysis",
          "Administrative or scheduling time",
        ],
        usedFor: [
          "Discovery fidelity assessment in DSR",
          "Resource planning for future clients",
          "Measuring discovery comprehensiveness",
        ],
      },
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