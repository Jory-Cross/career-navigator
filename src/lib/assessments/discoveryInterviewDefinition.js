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
        guidance: {
          purpose: "Establish the context and relationship foundation to interpret the interviewee's perspective and observations.",
          include: [
            "Home environment (family member)",
            "School setting (teacher, counselor)",
            "Work or job coaching context",
            "Community or volunteer setting",
            "Service provider relationship",
            "Social or recreational context",
          ],
          exclude: [
            "Unrelated information",
            "Personal opinions unrelated to the client",
          ],
          usedFor: [
            "Understanding the perspective and knowledge base",
            "Weighting the credibility of observations",
            "Interview source documentation in DSR",
          ],
        },
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
        guidance: {
          purpose: "Capture positive abilities and demonstrated competencies—what the interviewee has observed the client performing successfully.",
          include: [
            "Specific tasks completed well (e.g., 'Organizes materials accurately')",
            "Demonstrated abilities in various contexts (home, work, community)",
            "Work-related capabilities",
            "Daily living or self-care competencies",
            "How well the task or skill is performed",
          ],
          exclude: [
            "Personality traits without task context (use 'positive_qualities')",
            "Interests or preferences (use 'favorite_activities')",
            "Support needs (use 'support_needs')",
            "Environmental conditions (use 'best_environments')",
          ],
          usedFor: [
            "Observable skills and competencies in DSR",
            "Building job match profiles",
            "Establishing baseline capabilities",
          ],
        },
      },
      {
        id: "known_for",
        label: "What is the client known for?",
        type: "textarea",
        placeholder: "Skills, personality traits, habits, interests, routines, talents, helpfulness, persistence...",
        guidance: {
          purpose: "Capture what the client is recognized for in their community—their reputation, signature strengths, and distinctive qualities.",
          include: [
            "What people consistently notice about the client",
            "Reputation in family, work, or community (e.g., 'Known for being reliable')",
            "Distinctive talents or strengths (e.g., 'Great at organizing')",
            "Characteristic behaviors or habits (e.g., 'Always helpful')",
          ],
          exclude: [
            "Support needs or challenges (use 'barriers_observed')",
            "What the client does poorly (use 'challenges_barriers')",
            "Environmental preferences (use 'best_environments')",
          ],
          usedFor: [
            "Identifying signature strengths for DSR",
            "Building reputation-based job match",
            "Understanding public perception of the client",
          ],
        },
      },
      {
        id: "contributions",
        label: "What contributions does the client make at home, school, work, or in the community?",
        type: "textarea",
        guidance: {
          purpose: "Document how the client adds value—what they do for others and their roles in their environments.",
          include: [
            "Tasks the client performs for the household or workplace (e.g., 'Organizes supply closet')",
            "How the client helps others (e.g., 'Assists with inventory')",
            "Roles the client fills (e.g., 'Helper in the community garden')",
            "Services the client provides (e.g., 'Sorts donations at food bank')",
          ],
          exclude: [
            "Personal skills without contribution context (use 'what_client_does_well')",
            "Personality traits (use 'positive_qualities')",
            "Interests the client pursues (use 'favorite_activities')",
          ],
          usedFor: [
            "Understanding the client's value to community in DSR",
            "Job match to roles where client can contribute",
            "Identifying meaningful work opportunities",
          ],
        },
      },
      {
        id: "positive_qualities",
        label: "Most Endearing or Engaging Qualities",
        type: "textarea",
        guidance: {
          purpose: "Capture personality, character, and relational strengths—what makes the client valued by others.",
          include: [
            "Personality traits (e.g., 'Kind', 'Thoughtful')",
            "Interpersonal qualities (e.g., 'Easy to work with', 'Loyal')",
            "Emotional strengths (e.g., 'Resilient', 'Optimistic')",
            "Values or principles observed (e.g., 'Honest', 'Dependable')",
            "Why people enjoy being around the client",
          ],
          exclude: [
            "Skills or abilities (use 'what_client_does_well')",
            "Tasks performed (use 'contributions')",
            "Interests (use 'favorite_activities')",
          ],
          usedFor: [
            "Soft skills and interpersonal strengths in DSR",
            "Workplace culture and team fit",
            "Job coach and supervisor relationship planning",
          ],
        },
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
        guidance: {
          purpose: "Document what actions and tasks the client chooses and enjoys—the THINGS they prefer doing.",
          include: [
            "Activities the client chooses to do (e.g., 'Organizing, sorting, labeling')",
            "Tasks the client requests or initiates",
            "Things the client does in free time",
            "How often and with what intensity engaged",
          ],
          exclude: [
            "Places the client likes (use 'preferred_places')",
            "Personality traits (use 'positive_qualities')",
            "Skills demonstrated through activities (use 'observed_talents')",
            "Environmental preferences (use 'best_environments')",
          ],
          usedFor: [
            "Observable interests and preferred activities in DSR",
            "Job task and activity matching",
            "Building engagement and motivation in employment",
          ],
        },
      },
      {
        id: "topics_of_interest",
        label: "Topics of Interest",
        type: "textarea",
        guidance: {
          purpose: "Capture subjects and areas the client is fascinated by or talks about—what captures their attention and curiosity.",
          include: [
            "Subjects the client discusses or asks about",
            "Areas of fascination or passion",
            "Topics the client brings up repeatedly",
            "Things the client reads, watches, or learns about",
          ],
          exclude: [
            "Activities related to topics (use 'favorite_activities')",
            "Places associated with interests (use 'preferred_places')",
            "Skills developed around interests (use 'observed_talents')",
          ],
          usedFor: [
            "Observable interests in DSR for vocational theme development",
            "Information for informational interviews",
            "Job matching to industries aligned with interests",
          ],
        },
      },
      {
        id: "preferred_people",
        label: "People the Client Enjoys Being Around",
        type: "textarea",
        guidance: {
          purpose: "Identify social preferences and relational strengths—who brings out the best in the client.",
          include: [
            "Types of people the client gravitates toward",
            "People the client feels comfortable with",
            "Supervision or coaching styles the client responds to",
            "Group size preferences (one-on-one, small group, large group)",
            "Communication or interaction styles that work best",
          ],
          exclude: [
            "Support providers or role (use 'best_supports')",
            "Places where people gather (use 'preferred_places')",
            "Personality traits of the client (use 'positive_qualities')",
          ],
          usedFor: [
            "Social preferences and natural supports in DSR",
            "Job coach and supervisor matching",
            "Workplace team configuration and culture fit",
          ],
        },
      },
      {
        id: "preferred_places",
        label: "Places the Client Enjoys",
        type: "textarea",
        guidance: {
          purpose: "Document environments where the client feels comfortable and engaged—physical settings aligned with preferences.",
          include: [
            "Locations the client chooses to spend time in",
            "Environments where the client appears happy or engaged",
            "Characteristics of preferred settings (quiet, active, familiar, outdoors, etc.)",
            "Places the client requests to visit",
          ],
          exclude: [
            "Activities that occur in places (use 'favorite_activities')",
            "People at those places (use 'preferred_people')",
            "Environmental supports needed (use 'best_supports')",
            "Environments to avoid (use 'activities_or_places_avoided')",
          ],
          usedFor: [
            "Understanding environmental preferences for job site selection",
            "Workplace environment and location matching",
            "Community connection and leisure planning",
          ],
        },
      },
      {
        id: "activities_or_places_avoided",
        label: "Activities, Situations, or Places the Client Avoids",
        type: "textarea",
        guidance: {
          purpose: "Identify aversions and avoidance patterns to inform job exclusions, accommodations, and environmental design.",
          include: [
            "Activities the client refuses or strongly dislikes",
            "Situations the client finds uncomfortable or distressing",
            "Places the client avoids",
            "Why the client avoids these (safety, sensory, anxiety, etc.)",
            "What happens when the client is in these situations",
          ],
          exclude: [
            "General preferences (use 'preferred_places' for what client likes)",
            "Skills or abilities (use relevant skill sections)",
            "Support strategies to address (use 'support_needs')",
          ],
          usedFor: [
            "Avoidance conditions and job exclusions in DSR",
            "Job site and task matching to suitable opportunities",
            "Accommodation and workplace design planning",
          ],
        },
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting These Interests",
        type: "textarea",
        placeholder: "Quotes, examples, repeated patterns, observed activities, stories, belongings, routines...",
        guidance: {
          purpose: "Provide concrete proof that interests are real and sustained—not speculation based on single conversations.",
          include: [
            "Direct quotes from the client or interviewee about interests",
            "Specific examples of engagement (e.g., 'She talked about organizing for 30 minutes')",
            "Repeated patterns across multiple contexts (e.g., 'Always chooses organizing tasks')",
            "Observed behaviors demonstrating interest",
            "Stories or anecdotes illustrating sustained interest",
            "Objects or collections owned related to interests",
          ],
          exclude: [
            "Speculation ('She might like organizing')",
            "Single mentions without pattern",
            "Assumed interests not confirmed by the interviewee",
            "Interests contradicted by observed behavior",
          ],
          usedFor: [
            "Discovery Staging Record evidence sourcing for interests",
            "Building credible vocational themes",
            "Narrowing Stage Two exploration focus",
          ],
        },
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
        guidance: {
          purpose: "Document abilities the client demonstrates in daily life—self-care, household, and personal management competencies.",
          include: [
            "Daily living competencies (hygiene, meal prep, laundry, etc.)",
            "Household tasks performed (e.g., 'Does own laundry', 'Cooks simple meals')",
            "Money or time management abilities",
            "Self-care independence level",
            "How well tasks are performed",
          ],
          exclude: [
            "Interests or preferences (use 'favorite_activities')",
            "Support strategies (use 'best_supports')",
            "Personality traits (use 'positive_qualities')",
          ],
          usedFor: [
            "Establishing daily living and self-care capability baseline",
            "Supporting employment readiness assessment",
            "Informing workplace accommodation needs related to self-care",
          ],
        },
      },
      {
        id: "community_skills",
        label: "Community Skills",
        type: "textarea",
        guidance: {
          purpose: "Document the client's ability to navigate community environments and participate in community activities.",
          include: [
            "Navigation and independence in community settings",
            "Participation in community activities or groups",
            "Money management or financial independence",
            "Transportation independence or needs",
            "Communication with strangers or in public",
            "Community awareness and safety judgment",
          ],
          exclude: [
            "Community interests or places (use 'preferred_places')",
            "Support structures needed (use 'best_supports')",
            "Social preferences (use 'preferred_people')",
          ],
          usedFor: [
            "Community living and integration capability in DSR",
            "Job accessibility and independence assessment",
            "Planning for community-based work environments",
          ],
        },
      },
      {
        id: "work_skills",
        label: "Work or Task Skills",
        type: "textarea",
        guidance: {
          purpose: "Capture abilities directly relevant to employment—task completion, reliability, quality, and work habits.",
          include: [
            "Task completion abilities (e.g., 'Completes projects', 'Follows through')",
            "Work quality and accuracy (e.g., 'Careful attention to detail')",
            "Reliability and consistency (e.g., 'Never misses work', 'On time')",
            "Work pace and stamina (e.g., 'Can work 4-hour shifts without fatigue')",
            "Problem-solving on tasks",
            "Ability to work independently vs. with support",
          ],
          exclude: [
            "Communication or social skills (use relevant sections)",
            "Support strategies needed (use 'best_supports')",
            "Interests or preferences (use 'favorite_activities')",
          ],
          usedFor: [
            "Work-specific skills profile in DSR",
            "Job matching to suitable task types",
            "Establishing employment readiness",
          ],
        },
      },
      {
        id: "technology_skills",
        label: "Technology Skills",
        type: "textarea",
        guidance: {
          purpose: "Document competency with technology and digital tools relevant to employment.",
          include: [
            "Computer or smartphone competency",
            "Apps or software the client uses",
            "Technology the client learns quickly",
            "Digital communication ability (email, text, etc.)",
            "Ability to use workplace technology",
          ],
          exclude: [
            "Interests in technology (use 'topics_of_interest')",
            "Tech support needs (use 'support_needs')",
          ],
          usedFor: [
            "Technology skill profile in DSR",
            "Job matching to technology-intensive roles",
            "Accommodation planning for tech-based work",
          ],
        },
      },
      {
        id: "independent_living_skills",
        label: "Independent Living Skills",
        type: "textarea",
        guidance: {
          purpose: "Document capability for autonomous functioning in daily life—decision-making, problem-solving, and self-direction.",
          include: [
            "Ability to make decisions independently",
            "Problem-solving when issues arise",
            "Ability to follow routines without reminders",
            "Self-direction and initiation",
            "Safety awareness and judgment",
            "Help-seeking ability when needed",
          ],
          exclude: [
            "Support structures available (use 'best_supports')",
            "Specific daily living tasks (use 'home_skills')",
            "Learning preferences (use 'best_learning_style')",
          ],
          usedFor: [
            "Independent living and self-direction capability in DSR",
            "Job coaching and support intensity planning",
            "Employment readiness assessment",
          ],
        },
      },
      {
        id: "observed_talents",
        label: "Observed Talents",
        type: "textarea",
        guidance: {
          purpose: "Capture natural abilities and gifts—things the client does well without formal training or instruction.",
          include: [
            "Natural abilities demonstrated (e.g., 'Naturally organized')",
            "Things the client does well without training",
            "Unique gifts or strengths",
            "Examples of talent in action",
            "How the talent emerged or was discovered",
          ],
          exclude: [
            "Learned skills (use 'work_skills' or relevant skill sections)",
            "Interests without demonstrated ability (use 'topics_of_interest')",
            "Personality traits (use 'positive_qualities')",
          ],
          usedFor: [
            "Observable talents and gifts in DSR",
            "Strength-based vocational theme development",
            "Identifying natural work fit and satisfaction",
          ],
        },
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
        guidance: {
          purpose: "Identify the physical, social, and structural environments where the client thrives—conditions the workplace must provide.",
          include: [
            "Physical environment characteristics (quiet vs. active, outdoors vs. indoors, etc.)",
            "Social environment (small team vs. large, one-on-one vs. group, etc.)",
            "Structure level (highly structured vs. flexible, predictable vs. varied, etc.)",
            "Familiarity (familiar environments vs. new challenges)",
            "Pace and tempo preferences",
          ],
          exclude: [
            "Specific activities or tasks (use 'favorite_activities')",
            "Support strategies or accommodations (use 'best_supports')",
            "People and social preferences (use 'preferred_people')",
            "Things to avoid (use 'situations_to_avoid')",
          ],
          usedFor: [
            "Conditions for success—workplace environment design in DSR",
            "Job site and workplace culture matching",
            "Physical environment and sensory accommodation planning",
          ],
        },
      },
      {
        id: "best_supports",
        label: "Best Supports",
        type: "textarea",
        guidance: {
          purpose: "Document what types and intensity of support enable the client to succeed—coaching, structure, reminders, tools, accommodations.",
          include: [
            "Types of support that help (verbal prompts, written lists, visual supports, etc.)",
            "Support intensity (minimal checking, frequent check-ins, constant supervision, etc.)",
            "Effective coaching or communication strategies",
            "Assistive technology or tools that help",
            "How much support is needed vs. independence",
          ],
          exclude: [
            "Skills or abilities (use relevant skill sections)",
            "Environmental conditions (use 'best_environments')",
            "Communication styles (use 'preferred_people')",
            "Support barriers (use 'support_needs')",
          ],
          usedFor: [
            "Job coaching and support strategy planning in DSR",
            "Support intensity and type selection",
            "Workplace accommodation and assistance design",
          ],
        },
      },
      {
        id: "best_schedule",
        label: "Best Schedule or Time of Day",
        type: "textarea",
        guidance: {
          purpose: "Identify optimal work times, schedules, and rhythm—when the client performs best and is most engaged.",
          include: [
            "Best time of day (morning, afternoon, evening)",
            "Optimal work schedule (full-time, part-time, hours per day)",
            "Break and rest needs",
            "Best days of the week",
            "Seasonal or weather impacts on performance",
          ],
          exclude: [
            "Support needed (use 'best_supports')",
            "Environmental preferences (use 'best_environments')",
            "Interests and activities (use relevant sections)",
          ],
          usedFor: [
            "Work schedule and timing design in DSR",
            "Job matching to schedule compatibility",
            "Break and rest accommodation planning",
          ],
        },
      },
      {
        id: "best_supervision_style",
        label: "Best Supervision or Coaching Style",
        type: "textarea",
        guidance: {
          purpose: "Document the supervision, coaching, and feedback approaches that bring out the client's best performance.",
          include: [
            "Leadership or coaching style the client responds to well",
            "Communication style that works best (direct, gentle, encouraging, etc.)",
            "Feedback preferences (immediate vs. delayed, public vs. private, etc.)",
            "Whether client prefers autonomy or structure",
            "How to motivate or encourage the client",
            "Correction or redirection approaches that work",
          ],
          exclude: [
            "Types of people (use 'preferred_people')",
            "Work environment (use 'best_environments')",
            "Supports or tools needed (use 'best_supports')",
          ],
          usedFor: [
            "Job coach and supervisor matching in DSR",
            "Management and supervision approach planning",
            "Support and coaching intensity calibration",
          ],
        },
      },
      {
        id: "best_learning_style",
        label: "Best Learning Style",
        type: "textarea",
        placeholder: "Modeling, hands-on practice, written steps, visual supports, repetition, verbal explanation...",
        guidance: {
          purpose: "Identify how the client learns best—instructional methods and approaches that enable quick skill acquisition.",
          include: [
            "How the client learns most effectively (by doing, watching, reading, listening, etc.)",
            "Visual supports vs. verbal instructions preference",
            "Need for practice, repetition, or training time",
            "Pace of learning (quick learner vs. needs time)",
            "Best way to introduce new tasks",
            "Tools or supports that aid learning",
          ],
          exclude: [
            "Supervision or feedback styles (use 'best_supervision_style')",
            "Supports available (use 'best_supports')",
            "Task performance (use 'work_skills')",
          ],
          usedFor: [
            "Job coaching and training approach in DSR",
            "Initial job training and skill development planning",
            "Support strategy for learning new tasks",
          ],
        },
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
        guidance: {
          purpose: "Document challenges, limitations, and obstacles the client faces—not skills or support, but actual barriers.",
          include: [
            "Barriers to employment or task completion",
            "Health, mobility, or accessibility challenges",
            "Cognitive or processing challenges",
            "Communication barriers",
            "Sensory or processing sensitivities that create difficulty",
            "Why these are barriers (impact on performance or participation)",
          ],
          exclude: [
            "Support needs or solutions (use 'support_needs')",
            "Activities to avoid (use 'situations_to_avoid')",
            "Skills or abilities (use relevant skill sections)",
          ],
          usedFor: [
            "Barriers and challenges documentation in DSR",
            "Job site exclusion and accommodation planning",
            "Support strategy development",
          ],
        },
      },
      {
        id: "situations_to_avoid",
        label: "Situations to Avoid",
        type: "textarea",
        guidance: {
          purpose: "Identify situational triggers and conditions that reduce client performance or well-being—what workplace must NOT provide.",
          include: [
            "Situations that trigger anxiety, distress, or avoidance",
            "Contexts where the client struggles or refuses",
            "Conditions that lead to poor performance or behavior",
            "Environmental triggers (crowds, noise, pace, etc.)",
            "Social or relational contexts to avoid",
            "What happens when client is in these situations",
          ],
          exclude: [
            "General barriers (use 'barriers_observed')",
            "Support solutions (use 'support_needs')",
            "Preferences for different situations (use 'best_environments')",
          ],
          usedFor: [
            "Avoidance conditions and job exclusions in DSR",
            "Job site and task configuration avoiding triggering situations",
            "Accommodation and environmental design to prevent problems",
          ],
        },
      },
      {
        id: "support_needs",
        label: "Support Needs",
        type: "textarea",
        guidance: {
          purpose: "Specify required supports, accommodations, and strategies to overcome barriers and enable success.",
          include: [
            "Specific supports that would help (job coaching, visual supports, accommodations, etc.)",
            "Support intensity needed (occasional check-ins vs. constant supervision)",
            "Accommodations required for participation",
            "Assistive technology or tools needed",
            "How to address specific barriers identified",
          ],
          exclude: [
            "Skills the client has (use relevant skill sections)",
            "Best conditions already available (use 'best_supports' or 'best_environments')",
            "Barriers without solutions (use 'barriers_observed')",
          ],
          usedFor: [
            "Support and accommodation planning in DSR",
            "Job coaching and assistance intensity determination",
            "Accessibility and accommodation design",
          ],
        },
      },
      {
        id: "safety_concerns",
        label: "Safety Concerns",
        type: "textarea",
        guidance: {
          purpose: "Document specific safety risks and concerns—situations where the client or others could be at risk.",
          include: [
            "Risk behaviors observed",
            "Safety judgment concerns",
            "Health or medical risks relevant to employment",
            "Environmental or equipment safety concerns",
            "Self-harm or harm-to-others risks",
            "Supervision or safety accommodation needed",
          ],
          exclude: [
            "General barriers (use 'barriers_observed')",
            "Environmental preferences (use 'best_environments')",
            "Support strategies (use 'support_needs')",
          ],
          usedFor: [
            "Safety planning and risk mitigation in DSR",
            "Job site and task safety assessment",
            "Supervision and monitoring needs determination",
          ],
        },
      },
      {
        id: "other_concerns",
        label: "Other Concerns",
        type: "textarea",
        guidance: {
          purpose: "Capture additional relevant information not covered in other sections—anything the interviewee thinks is important.",
          include: [
            "Any information not captured elsewhere",
            "Additional context or insights",
            "Family, provider, or medical considerations",
            "Past experiences or patterns",
            "Anything the interviewee emphasized as important",
          ],
          exclude: [
            "Information belonging in other sections (place in appropriate questions)",
          ],
          usedFor: [
            "Comprehensive understanding of the client",
            "Context for all other Discovery information",
            "DSR background and narrative sections",
          ],
        },
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
        guidance: {
          purpose: "Capture job and task ideas grounded in client interests, skills, and preferences—informed suggestions for exploration.",
          include: [
            "Jobs aligned with client interests (e.g., 'Organizational roles')",
            "Tasks matching demonstrated skills",
            "Work roles that use client strengths and talents",
            "Why each job is a good fit based on observations",
            "Realistic options considering barriers and supports",
          ],
          exclude: [
            "Interests without job connection (use 'topics_of_interest')",
            "Skills without context (use 'work_skills')",
            "Jobs unrelated to documented interests or abilities",
            "Speculative ideas without evidence",
          ],
          usedFor: [
            "Employment ideas and job recommendations in DSR",
            "Stage Two informational interview and exploration direction",
            "Vocational theme validation",
          ],
        },
      },
      {
        id: "businesses_or_places_to_explore",
        label: "Businesses or Places to Explore",
        type: "textarea",
        guidance: {
          purpose: "Identify specific, accessible employers and community settings that align with client themes and opportunities.",
          include: [
            "Specific businesses or employers (not just industries)",
            "Community organizations or volunteer opportunities",
            "Why each is a good fit for the client",
            "Location and accessibility",
            "Contact information if available",
          ],
          exclude: [
            "Generic industries without specific businesses",
            "Places the client won't have access to",
            "Businesses unrelated to interests or skills",
          ],
          usedFor: [
            "Employer and business leads in DSR",
            "Stage Two informational interview planning",
            "Targeted job development exploration",
          ],
        },
      },
      {
        id: "community_roles",
        label: "Community Roles or Volunteer Experiences",
        type: "textarea",
        guidance: {
          purpose: "Identify unpaid community roles and volunteer opportunities where the client can contribute and learn.",
          include: [
            "Volunteer positions aligned with interests and skills",
            "Community roles or leadership opportunities",
            "Service roles matching client talents",
            "Organizations or groups to approach",
            "Why each opportunity is a good fit",
          ],
          exclude: [
            "Personal interests without volunteer context (use 'favorite_activities')",
            "Paid employment (use 'jobs_client_might_enjoy')",
            "Opportunities not accessible or realistic",
          ],
          usedFor: [
            "Community role and volunteer opportunity ideas in DSR",
            "Stage Two experiential learning planning",
            "Community integration and contribution",
          ],
        },
      },
      {
        id: "people_or_connections",
        label: "People or Community Connections to Contact",
        type: "textarea",
        guidance: {
          purpose: "Identify people who can support discovery through informational interviews, networking, or community connection.",
          include: [
            "People with expertise in client's interest areas (for informational interviews)",
            "Community members who could mentor or connect the client",
            "Natural supports and community resources",
            "Contact information if available",
            "Why this person should be contacted and what they can share",
          ],
          exclude: [
            "General preferences for people (use 'preferred_people')",
            "People for employment only (use 'businesses_or_places_to_explore')",
            "People the client is already connected to without new value",
          ],
          usedFor: [
            "Community connections and informational interview sources in DSR",
            "Stage Two networking and discovery interview planning",
            "Building employment support network",
          ],
        },
      },
      {
        id: "possible_vocational_themes",
        label: "Possible Vocational Themes",
        type: "textarea",
        guidance: {
          purpose: "Synthesize interests, skills, and observations into emerging vocational directions—patterns across discovery data.",
          include: [
            "Patterns emerging from interview across interests, skills, and preferences",
            "Common threads connecting activities, strengths, and preferences",
            "Employment directions aligned with themes",
            "Why these themes are credible based on interview data",
            "How themes validate or expand Stage One discoveries",
          ],
          exclude: [
            "Single interests or jobs without pattern (use 'jobs_client_might_enjoy')",
            "Themes contradicted by interview data",
            "Speculations not grounded in interview content",
          ],
          usedFor: [
            "Possible vocational themes in DSR from interview perspective",
            "Validation or refinement of Stage One themes",
            "Direction for continued Stage Two exploration",
          ],
        },
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
        guidance: {
          purpose: "Capture the key insights from the interview—what the interviewer found most important or surprising.",
          include: [
            "Most significant discoveries or insights",
            "New information not captured elsewhere",
            "Surprising revelations or confirmations",
            "Critical information for employment planning",
            "What changed or clarified understanding",
          ],
          exclude: [
            "Information already detailed in other sections",
            "Information that belongs in specific questions",
          ],
          usedFor: [
            "Key takeaways for DSR from this interview",
            "Prioritizing information for employment planning",
            "Interview summary highlights",
          ],
        },
      },
      {
        id: "patterns_revealed",
        label: "Patterns Revealed",
        type: "textarea",
        guidance: {
          purpose: "Identify cross-cutting patterns across all interview data that support vocational themes and employment planning.",
          include: [
            "Patterns in interests, skills, and strengths",
            "Recurring conditions for success",
            "Consistent support needs or barriers",
            "Repeated themes from interview content",
            "How patterns connect to vocational themes",
          ],
          exclude: [
            "One-time observations treated as patterns",
            "Information not supported by multiple references",
          ],
          usedFor: [
            "Pattern identification and trend analysis in DSR",
            "Supporting vocational theme credibility",
            "Evidence for employment recommendations",
          ],
        },
      },
      {
        id: "recommended_next_steps",
        label: "Recommended Next Discovery Steps",
        type: "textarea",
        guidance: {
          purpose: "Propose concrete next steps for discovery based on interview insights and gaps.",
          include: [
            "People to interview next",
            "Businesses or places to visit",
            "Informational interviews to schedule",
            "Activities or work experiences to observe or try",
            "Information gaps to fill",
            "Why each next step is recommended",
          ],
          exclude: [
            "Steps already completed in Stage One",
            "Unrealistic or inaccessible options",
          ],
          usedFor: [
            "Recommended next discovery steps in DSR",
            "Stage Two planning and prioritization",
            "Focused and efficient continuation of discovery",
          ],
        },
      },
      {
        id: "time_to_complete_interview",
        label: "Time to Complete Interview",
        type: "text",
        placeholder: "Example: 45 minutes",
        guidance: {
          purpose: "Document interview duration to track discovery effort and assess interview quality.",
          include: [
            "Total time spent in the interview",
            "Time spent interviewing (not travel, setup, or documentation)",
          ],
          exclude: [
            "Time spent traveling to interview location",
            "Time spent documenting after the interview",
          ],
          usedFor: [
            "Discovery effort tracking and resource planning",
            "Interview quality and depth assessment",
            "Benchmarking discovery effort",
          ],
        },
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