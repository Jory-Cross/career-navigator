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
        guidance: {
          purpose: "Identify the community location where the activity took place—a place identifier for community connection mapping.",
          include: [
            "Community location names (e.g., 'Smith's Library', 'Community Food Pantry', 'Donation Center')",
            "Type of setting if no name (e.g., 'Local grocery store', 'Volunteer site')",
            "Neighborhood or area if relevant",
          ],
          exclude: [
            "Businesses to pursue for employment (use 'possible_business_settings' in Section 7)",
            "Employer contacts or decision-makers",
            "Activities performed at the location",
            "Skills or conditions",
          ],
          usedFor: [
            "Community Connections locations in DSR",
            "Tracking breadth of community exploration",
            "Identifying sites for return visits and employer leads",
          ],
        },
      },
      {
        id: "activity_name",
        label: "Activity / Task / Setting",
        type: "short_text",
        guidance: {
          purpose: "Record what the client actually did — the activity or task attempted — for pattern recognition across activities.",
          include: [
            "Activity name (e.g., 'Sorting donations', 'Stocking shelves', 'Labeling containers')",
            "Task type (e.g., 'Filing paperwork', 'Creating inventory lists')",
            "Whether familiar or new exploration",
          ],
          exclude: [
            "Skills demonstrated (use 'skills_demonstrated' in Section 3)",
            "Conditions or environment (use Section 5)",
            "Employer or business names",
            "Interests apart from the activity itself",
          ],
          usedFor: [
            "Observed Activities catalog in DSR — discrete tasks attempted",
            "Pattern recognition across activities",
            "Building job match task catalog",
          ],
        },
      },
      {
        id: "people_present",
        label: "People Present",
        type: "textarea",
        guidance: {
          purpose: "Document who was there — informs support intensity, social conditions, and possible natural supports or community connections.",
          include: [
            "Names or roles (e.g., 'Job coach, store manager, two volunteers')",
            "Staff who observed or supported",
            "Family or familiar people present",
            "Number and general nature of strangers",
          ],
          exclude: [
            "Social conditions of the activity (use 'people_social_conditions' in Section 5)",
            "Support strategies used (use 'supports_or_accommodations_used')",
            "Skills",
          ],
          usedFor: [
            "Context for support intensity interpretation",
            "Tracking social conditions during observations",
            "Identifying potential natural supports at this site",
          ],
        },
      },
      {
        id: "time_spent",
        label: "Time Spent",
        type: "short_text",
        placeholder: "Example: 1 hour, 45 minutes...",
        guidance: {
          purpose: "Record duration of the activity — used to judge evidence weight and engagement stamina.",
          include: [
            "Total time in activity",
            "How long client was engaged vs. observing if relevant",
          ],
          exclude: [
            "Travel time",
            "Setup or documentation time",
          ],
          usedFor: [
            "Discovery effort tracking",
            "Stamina and engagement interpretation",
            "Quality and depth of evidence assessment",
          ],
        },
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
        guidance: {
          purpose: "Capture the specific observable ACTIONS performed during the session — what was physically done.",
          include: [
            "Concrete actions performed (e.g., 'Sorted donated clothing by type', 'Stocked cans on shelves by label')",
            "Sequence of actions during the activity",
            "Whether each action was completed",
          ],
          exclude: [
            "Skills demonstrated to do tasks well (use 'skills_demonstrated')",
            "Interests or motivation (use Section 4)",
            "Conditions or supports (use Section 5)",
            "Employer names",
          ],
          usedFor: [
            "Observed Activities in DSR — discrete actions performed",
            "Pattern recognition of task preferences",
            "Job task matching for customized employment",
          ],
        },
      },
      {
        id: "client_chose_to_do",
        label: "What the Client Chose to Do",
        type: "textarea",
        guidance: {
          purpose: "Identify what the client self-selected when given choices — observable evidence of preferences and motivation.",
          include: [
            "Tasks the client initiated or chose (e.g., 'Client chose to organize by color')",
            "Activities selected when multiple were available",
            "Order or sequence the client chose",
          ],
          exclude: [
            "What was assigned or directed by staff (use 'what_was_done')",
            "Skills used in the chosen tasks (use 'skills_demonstrated')",
            "Things avoided (use 'client_avoided_or_declined')",
            "Conditions",
          ],
          usedFor: [
            "Observable preferences and interests in DSR",
            "Building vocational themes around client-initiated tasks",
            "Job task recommendations matched to chosen patterns",
          ],
        },
      },
      {
        id: "client_avoided_or_declined",
        label: "What the Client Avoided, Declined, or Disengaged From",
        type: "textarea",
        guidance: {
          purpose: "Document avoidance or disengagement — strong evidence of what is NOT going to work.",
          include: [
            "Tasks the client declined (e.g., 'Client declined cashier interactions')",
            "Activities abandoned partway through",
            "Situations the client tried to leave",
            "Specific behaviors or factors that accompanied avoidance (e.g., 'Disengaged when loud music played')",
          ],
          exclude: [
            "Skills the client lacks (use 'difficulties_observed' in Section 6)",
            "Conditions the client prefers (use relevant Section 5 fields)",
            "General barriers without context",
          ],
          usedFor: [
            "Avoidance conditions and exclusions in DSR",
            "Job site exclusions and task exclusions",
            "Accommodation planning to address avoidance triggers",
          ],
        },
      },
      {
        id: "engagement_observed",
        label: "Engagement Observed",
        type: "textarea",
        placeholder: "Describe attention, energy, persistence, enjoyment, curiosity, initiation, questions, or participation.",
        guidance: {
          purpose: "Document the client's affective and behavioral engagement during the activity—qualitative evidence.",
          include: [
            "Observable attention and focus (e.g., 'Sustained attention for 30 minutes')",
            "Energy level and persistence",
            "Signs of enjoyment or frustration",
            "Curiosity and initiation (questions asked, exploration)",
            "Participation level (active vs. passive)",
          ],
          exclude: [
            "Specific tasks done (use 'what_was_done')",
            "Skills (use 'skills_demonstrated')",
            "Conditions causing engagement level (use 'conditions_associated_with_success' or 'conditions_associated_with_difficulty')",
          ],
          usedFor: [
            "Engagement patterns in DSR — qualitative interest evidence",
            "Predicting motivation in similar job settings",
            "Validating interest evidence quality",
          ],
        },
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
        guidance: {
          purpose: "Document the discrete task steps the client completed — the structured work observed.",
          include: [
            "Specific discrete tasks (e.g., 'Sorted clothing by type', 'Stocked shelves', 'Labeled containers')",
            "Steps within multi-step tasks if relevant",
            "Whether each was completed",
          ],
          exclude: [
            "Skills used to do them (use 'skills_demonstrated')",
            "Activities to which they relate is in Section 2 — keep this field task-focused",
            "Conditions (Section 5)",
            "Employer names",
          ],
          usedFor: [
            "Observed Activities — discrete tasks in DSR",
            "Customized employment task-list building",
            "Vocational theme task evidence",
          ],
        },
      },
      {
        id: "skills_demonstrated",
        label: "Skills Demonstrated",
        type: "textarea",
        guidance: {
          purpose: "Document the specific competencies and abilities the client showed while doing tasks — abilities NOT tasks.",
          include: [
            "Competencies demonstrated (e.g., 'Categorization, inventory tracking, quality checking, attention to detail, record keeping')",
            "Observable skill strengths (e.g., 'Accurate sorting', 'Consistent attention to detail')",
            "How well the skill was performed",
          ],
          exclude: [
            "The activities themselves (use 'tasks_performed')",
            "Interests (use Section 4)",
            "Supports (use 'support_details')",
            "Conditions (Section 5)",
            "Employer names",
            "Community locations",
          ],
          usedFor: [
            "Observed Skills in DSR — explicit competencies catalog",
            "Vocational theme skills evidence",
            "Job match skills requirements comparison",
          ],
        },
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
        guidance: {
          purpose: "Codify prompt hierarchy intensity required for success — a quantified support indicator across activities.",
          include: [
            "Most intrusive prompt level needed during the activity",
            "Whether prompts faded as activity progressed (note in 'support_details')",
          ],
          exclude: [
            "Conditions for success generally (use Section 5 fields)",
            "Specific support strategies (use 'support_details')",
            "Skills (use 'skills_demonstrated')",
          ],
          usedFor: [
            "Support intensity quantification in DSR",
            "Job coaching intensity planning",
            "Comparing support needs across activities",
          ],
        },
      },
      {
        id: "support_details",
        label: "Support Details",
        type: "textarea",
        placeholder: "Describe prompts, modeling, coaching, accommodations, reminders, or assistance used.",
        guidance: {
          purpose: "Describe the specific supports and strategies that enabled success — the natural supports or staff interventions used.",
          include: [
            "Specific prompt types and timing",
            "Modeling or demonstration used",
            "Coaching conversations or verbal guidance",
            "Accommodations used (visual supports, written lists, etc.)",
            "Reminders or cues given",
            "Physical assistance provided",
          ],
          exclude: [
            "Conditions present that helped (use 'conditions_associated_with_success')",
            "Skills the client showed (use 'skills_demonstrated')",
            "Environment description (use 'environmental_conditions')",
            "Tasks done (use 'tasks_performed')",
          ],
          usedFor: [
            "Natural Supports and staff support details in DSR",
            "Job coaching strategy planning",
            "Accommodation design for future settings",
          ],
        },
      },
      {
        id: "task_performance_notes",
        label: "Task Performance Notes",
        type: "textarea",
        placeholder: "Describe pace, accuracy, stamina, attention, sequencing, problem solving, quality, and follow-through.",
        guidance: {
          purpose: "Document the quality and characteristics of how tasks were performed — work habits and performance.",
          include: [
            "Pace (quick, moderate, slow)",
            "Accuracy and error rate",
            "Stamina and fatigue",
            "Attention level and duration",
            "Sequencing and following steps",
            "Problem-solving on obstacles",
            "Quality and follow-through to completion",
          ],
          exclude: [
            "Discrete skills labeled (use 'skills_demonstrated') — this is about how tasks went, not what skills",
            "Supports used (use 'support_details')",
            "Interests (Section 4)",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Work performance characteristics in DSR",
            "Employment readiness indicators",
            "Job match feasibility for similar tasks",
          ],
        },
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
        guidance: {
          purpose: "Document observable signs that the client was interested or motivated — qualitative evidence of interest.",
          include: [
            "Body language (smiling, leaning in, sustained attention)",
            "Verbal indications ('This is fun', 'Can I do more?')",
            "Initiating without prompting",
            "Asking questions about the activity",
            "Choosing to return or continue",
          ],
          exclude: [
            "Tasks performed (use 'tasks_performed')",
            "Skills demonstrated (use 'skills_demonstrated')",
            "Conditions at the activity (Section 5)",
            "Activities avoided (use 'client_avoided_or_declined')",
          ],
          usedFor: [
            "Observable Interests in DSR — motivational evidence",
            "Vocational theme validation through interest signals",
            "Predicting engagement in similar job tasks",
          ],
        },
      },
      {
        id: "preferred_activities_tools_materials",
        label: "Preferred Activities, Tools, Materials, or Topics",
        type: "textarea",
        guidance: {
          purpose: "Capture the concrete things the client preferred — activities, tools, materials, or topics of engagement.",
          include: [
            "Preferred activities (e.g., 'Sorting, organizing by category')",
            "Preferred tools (e.g., 'Labels, sticky notes, scanner')",
            "Preferred materials (e.g., 'Paperwork, clothing, cans')",
            "Preferred topics of discussion (e.g., 'Talked about animals, sports')",
          ],
          exclude: [
            "Skills used while engaging (use 'skills_demonstrated')",
            "Conditions supporting preference (use 'conditions_associated_with_success')",
            "Things the client avoided (use 'client_avoided_or_declined')",
            "Employer names",
          ],
          usedFor: [
            "Observable Interests — concrete preferred things in DSR",
            "Job matching to similar activities and tools",
            "Vocational theme content development",
          ],
        },
      },
      {
        id: "repeated_patterns",
        label: "Repeated Patterns Observed",
        type: "textarea",
        guidance: {
          purpose: "Identify cross-activity patterns in preferences or actions — evidence that a preference is real, not incidental.",
          include: [
            "Patterns across this session (e.g., 'Client chose color-sorting three different times')",
            "Patterns across prior activities if observed before (e.g., 'Same preference emerged at pantry last week')",
            "Repeated sequences or approaches",
            "Consistency of choices",
          ],
          exclude: [
            "Single instances without repetition (those belong in specific fields)",
            "Skills (use 'skills_demonstrated')",
            "Conditions (Section 5)",
            "Employer or community locations unrelated to pattern",
          ],
          usedFor: [
            "Pattern-based interest evidence in DSR",
            "Building credible vocational themes with pattern support",
            "Distinguishing durable preferences from incidental events",
          ],
        },
      },
      {
        id: "interest_evidence",
        label: "Evidence Supporting Interest",
        type: "textarea",
        placeholder: "Include quotes, actions, repeated choices, body language, questions asked, or time spent.",
        guidance: {
          purpose: "Provide concrete proof that interests are real and sustained — quotes, actions, and observable signals.",
          include: [
            "Direct quotes from the client (e.g., 'I love organizing these')",
            "Specific actions demonstrating interest ('Sorted for 45 minutes without prompts')",
            "Repeated choices documented",
            "Body language observations ('Smiling, leaning in')",
            "Questions asked by the client",
            "Time spent on preferred activities",
          ],
          exclude: [
            "Speculation ('seems like she might enjoy')",
            "Single mentions without pattern or specific evidence",
            "Skills (use 'skills_demonstrated')",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Discovery Staging Record evidence sourcing for interests",
            "Validating vocational theme credibility",
            "Building Stage Five and beyond exploration focus",
          ],
        },
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
        guidance: {
          purpose: "Document the physical environment of the activity—conditions present that may affect performance independent of the client's preferences.",
          include: [
            "Noise levels and type (quiet, loud, conversations, music)",
            "Pace of the setting",
            "Lighting conditions",
            "Crowding level",
            "Layout and physical setup",
            "Predictability of the environment",
            "Temperature and sensory factors",
            "Accessibility features",
          ],
          exclude: [
            "Social conditions (use 'people_social_conditions')",
            "Instruction methods (use 'instruction_style')",
            "Supports (use 'supports_or_accommodations_used')",
            "Skills (Section 3)",
            "Activities performed (Section 2)",
            "Employer or community location names (Section 1)",
          ],
          usedFor: [
            "Conditions for Success — environmental side in DSR",
            "Matching workplace environment to client's known best environments",
            "Planning accommodations for similar settings",
          ],
        },
      },
      {
        id: "people_social_conditions",
        label: "People / Social Conditions",
        type: "textarea",
        placeholder: "Group size, familiar people, unfamiliar people, public contact, supervisor style, coworker interaction...",
        guidance: {
          purpose: "Document the social and relational conditions of the activity—people-related factors independent of the client.",
          include: [
            "Group size (one-on-one, small group, large group)",
            "Familiar vs. unfamiliar people present",
            "Level of public or customer contact",
            "Supervisor or coaching style observed",
            "Coworker interaction level",
            "General social expectations of the setting",
          ],
          exclude: [
            "Specific natural supports provided to the client (use 'supports_or_accommodations_used')",
            "Instruction method (use 'instruction_style')",
            "Skills (Section 3)",
            "Conditions the CLIENT needs (synthesized in 'conditions_associated_with_success')",
            "Employer names",
          ],
          usedFor: [
            "Conditions for Success — social and relational side in DSR",
            "Matching workplace social environment to client's social preferences",
            "Planning for supervision approaches in future jobs",
          ],
        },
      },
      {
        id: "instruction_style",
        label: "Instruction Style That Worked Best",
        type: "textarea",
        placeholder: "Hands-on practice, modeling, written steps, visual supports, demonstration, verbal explanation, repetition...",
        guidance: {
          purpose: "Document which teaching approaches enabled the client to succeed—workplace conditions for learning.",
          include: [
            "Hands-on practice",
            "Modeling or demonstration",
            "Written steps or checklists",
            "Visual supports (pictures, diagrams)",
            "Verbal explanation style",
            "Repetition and pacing of instruction",
          ],
          exclude: [
            "Supports provided during the activity (use 'supports_or_accommodations_used')",
            "Conditions the CLIENT needs generally (use 'conditions_associated_with_success')",
            "Skills (Section 3)",
            "Supervision approach generally (use 'people_social_conditions')",
            "Employer names",
          ],
          usedFor: [
            "Conditions for Success — instruction side in DSR",
            "Job coaching and training method planning",
            "Building accommodation strategies for similar tasks",
          ],
        },
      },
      {
        id: "supports_or_accommodations_used",
        label: "Supports or Accommodations Used",
        type: "textarea",
        guidance: {
          purpose: "Document the SPECIFIC supports and accommodations applied — concrete interventions, not general conditions.",
          include: [
            "Visual supports used (picture schedules, color coding)",
            "Written checklists or task lists",
            "Verbal prompts or cueing",
            "Physical assistance or guidance",
            "Assistive technology or tools",
            "Schedule modifications (breaks, shorter shifts)",
            "Environmental modifications made",
          ],
          exclude: [
            "General conditions of environment (use 'environmental_conditions')",
            "General social conditions (use 'people_social_conditions')",
            "Instruction method (use 'instruction_style')",
            "Skills the client had (use 'skills_demonstrated')",
            "Employer or community locations",
          ],
          usedFor: [
            "Natural Supports and accommodations inventory in DSR",
            "Job coach and workplace accommodation design",
            "Comparing what worked across activities",
          ],
        },
      },
      {
        id: "conditions_associated_with_success",
        label: "Conditions Associated With Success",
        type: "textarea",
        guidance: {
          purpose: "Synthesize the conditions present when the client was successful — the workplace conditions correlated with strong performance.",
          include: [
            "Synthesis of environmental, social, and instructional conditions when success occurred",
            "Patterns across instances of success in this activity",
            "Why those conditions likely supported success",
          ],
          exclude: [
            "Raw environmental data alone (use 'environmental_conditions')",
            "Raw social conditions alone (use 'people_social_conditions')",
            "Supports used (use 'supports_or_accommodations_used')",
            "Skills (Section 3)",
            "Employer or community locations",
          ],
          usedFor: [
            "Conditions for Success synthesis in DSR",
            "Customized employment condition design",
            "Job site environment and supervision planning",
          ],
        },
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
        guidance: {
          purpose: "Document specific struggles the client had during the activity — concrete performance issues.",
          include: [
            "Specific task difficulties (e.g., 'Struggled with fast-paced stocking')",
            "Skills gaps observed in the moment",
            "Breakdowns in sequencing or attention",
            "Quality issues or errors made",
          ],
          exclude: [
            "Conditions that caused difficulty (use 'conditions_associated_with_difficulty')",
            "Supports to address (use 'supports_needed_to_reduce_barriers')",
            "Activities avoided entirely (use 'client_avoided_or_declined')",
            "Employer or community locations",
          ],
          usedFor: [
            "Observed difficulties and barriers in DSR",
            "Job site exclusion planning",
            "Training and accommodation prioritization",
          ],
        },
      },
      {
        id: "conditions_associated_with_difficulty",
        label: "Conditions Associated With Difficulty",
        type: "textarea",
        guidance: {
          purpose: "Identify environmental, social, or instructional conditions that correlated with the difficulties observed.",
          include: [
            "Environmental conditions when difficulty occurred (e.g., 'Struggled during loud, crowded period')",
            "Social conditions that coincided with difficulty (e.g., 'Struggled with public-facing tasks')",
            "Instruction methods that did not work",
            "Specific triggers observed",
          ],
          exclude: [
            "The difficulties themselves (use 'difficulties_observed')",
            "Conditions that supported success (use 'conditions_associated_with_success')",
            "Supports to address (use 'supports_needed_to_reduce_barriers')",
            "Skills (Section 3)",
          ],
          usedFor: [
            "Avoidance conditions and barriers in DSR",
            "Job site exclusions and environment planning",
            "Accommodation design to avoid difficult conditions",
          ],
        },
      },
      {
        id: "barriers_to_repeat_or_employment",
        label: "Barriers to Repeating This Activity or Connecting It to Employment",
        type: "textarea",
        guidance: {
          purpose: "Identify obstacles to repeating this activity or turning it into employment — what would prevent progression.",
          include: [
            "Resource barriers (no nearby employers doing this task)",
            "Schedule or transportation barriers",
            "Skill ceiling concerns (task requires skills beyond demonstrated ability)",
            "Stamina or time barriers",
            "Logistical obstacles to scaling into employment",
          ],
          exclude: [
            "The difficulties themselves (use 'difficulties_observed')",
            "Conditions that caused difficulty (use 'conditions_associated_with_difficulty')",
            "Supports to address (use 'supports_needed_to_reduce_barriers')",
            "Skills the client has (Section 3)",
            "Strengths (Section 7 synthesis)",
          ],
          usedFor: [
            "Barrier analysis for DSR exploration planning",
            "Determining whether to pursue or pivot themes",
            "Customized employment feasibility assessment",
          ],
        },
      },
      {
        id: "supports_needed_to_reduce_barriers",
        label: "Supports Needed to Reduce Barriers",
        type: "textarea",
        guidance: {
          purpose: "Identify supports or accommodations that could reduce barriers—concrete solutions to obstacles.",
          include: [
            "Specific supports that could help (additional coaching, assistive tech, environmental modification)",
            "Support intensity needed (frequency of check-ins)",
            "Accommodations that would address barriers",
            "Natural support opportunities to develop",
          ],
          exclude: [
            "The barriers themselves (use 'barriers_to_repeat_or_employment')",
            "Supports already used (use 'supports_or_accommodations_used')",
            "Skills (Section 3)",
            "Conditions present (Section 5)",
          ],
          usedFor: [
            "Support plan development in DSR",
            "Job coaching intensity planning",
            "Customized employment accommodation design",
          ],
        },
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
        guidance: {
          purpose: "Identify specific work tasks in employment settings that align with what the client did here—job task translations.",
          include: [
            "Concrete work tasks elsewhere (e.g., 'Sorting inventory in retail stockroom', 'Filing in office setting')",
            "Tasks that use the same actions performed here",
            "Tasks that match demonstrated skills",
          ],
          exclude: [
            "Skills demonstrated (use 'skills_demonstrated') — this is job tasks not competencies",
            "Employer names (use 'possible_business_settings')",
            "Interests apart from translated tasks (Section 4)",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Vocational Themes Evidence — task translations in DSR",
            "Job development task identification",
            "Customized employment task design",
          ],
        },
      },
      {
        id: "possible_business_settings",
        label: "Possible Business or Community Settings to Explore",
        type: "textarea",
        guidance: {
          purpose: "Identify specific business types and community settings where similar work happens — concrete exploration targets.",
          include: [
            "Specific types of business settings (libraries, warehouses, donation centers, food pantries, office environments, community organizations)",
            "Specific business names if known (becomes employer leads)",
            "Community organizations where similar activity happens",
            "Why each is a good exploration target",
          ],
          exclude: [
            "Skills (Section 3)",
            "Activities performed (Section 2)",
            "Conditions (Section 5)",
            "Tasks alone without setting context (use 'possible_work_tasks')",
          ],
          usedFor: [
            "Employer Leads and Community Connections in DSR",
            "Stage Five informational interview target pipeline",
            "Customized employment site exploration direction",
          ],
        },
      },
      {
        id: "emerging_vocational_themes_supported",
        label: "Emerging Vocational Themes Supported",
        type: "textarea",
        guidance: {
          purpose: "Identify which emerging vocational themes gained support from this activity—validation evidence.",
          include: [
            "Themes supported (e.g., 'Organizing and categorization theme strongly supported')",
            "How this activity reinforces themes with specific evidence",
            "Patterns that emerged consistent with themes",
            "New supporting evidence not previously documented",
          ],
          exclude: [
            "Themes weakened (use 'themes_or_hypotheses_refuted')",
            "Detailed skills (use 'skills_demonstrated')",
            "Tasks alone (use 'possible_work_tasks')",
          ],
          usedFor: [
            "Vocational Themes Evidence — supporting data in DSR",
            "Building confidence in emerging themes for plan development",
            "Theme progression tracking across activities",
          ],
        },
      },
      {
        id: "themes_or_hypotheses_refuted",
        label: "Themes or Hypotheses Refuted / Weakened",
        type: "textarea",
        guidance: {
          purpose: "Identify themes or hypotheses that this activity weakened or refuted — necessary course-correction evidence.",
          include: [
            "Themes weakened with specific reasons",
            "Hypotheses refuted by observed behavior",
            "Surprising results that contradict prior Discovery data",
            "What this means for theme progression",
          ],
          exclude: [
            "Themes supported (use 'emerging_vocational_themes_supported')",
            "General difficulties (use 'difficulties_observed')",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Vocational Themes Evidence — disconfirmation in DSR",
            "Course-correction to exploration focus",
            "Building evidence-based confidence in remaining themes",
          ],
        },
      },
      {
        id: "customized_employment_possibilities",
        label: "Customized Employment Possibilities",
        type: "textarea",
        guidance: {
          purpose: "Synthesize specific customized employment role concepts grounded in this activity—concrete role proposals.",
          include: [
            "Concrete role proposals building on observed task preferences (e.g., 'Donations sorting role 3 mornings/week')",
            "Tasks combined into a coherent role description",
            "How this role fits client skills and conditions for success",
            "Why this is credible based on the activity evidence",
          ],
          exclude: [
            "Vague ideas without grounding",
            "Roles disconnected from observed preferences or skills",
            "Employer settings alone (use 'possible_business_settings')",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Discovery Hypotheses — concrete CE role proposals in DSR",
            "Foundation for customized employment job plan",
            "Employer pitch starting point",
          ],
        },
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
        guidance: {
          purpose: "Summarize the most important findings from this activity — the headline insights driving decisions.",
          include: [
            "Most significant findings from the activity",
            "Strongest evidence and surprising revelations",
            "Whether to pursue this activity further and the headline why",
            "Key contributions to DSR categories",
          ],
          exclude: [
            "Detailed field-by-field summary (already in other sections)",
          ],
          usedFor: [
            "Activity summary for DSR",
            "Quick-reference decision context",
            "Highlights for next-step planning",
          ],
        },
      },
      {
        id: "recommended_next_activities",
        label: "Recommended Next Activities to Try",
        type: "textarea",
        guidance: {
          purpose: "Propose concrete next activities grounded in this activity's findings — Stage progression direction.",
          include: [
            "Related activities to try (e.g., 'Try similar sorting in larger retail setting')",
            "Settings or businesses to explore for activity replication",
            "Tasks to advance complexity",
            "Why each next activity is recommended",
          ],
          exclude: [
            "Specific employer follow-up (use 'possible_business_settings')",
            "Skills (Section 3)",
            "Conditions (Section 5)",
          ],
          usedFor: [
            "Discovery Stage progression in DSR",
            "Activity pipeline planning",
            "Targeted exploration based on observed patterns",
          ],
        },
      },
      {
        id: "discovery_hypotheses_confirmed",
        label: "Discovery Hypotheses Confirmed",
        type: "textarea",
        guidance: {
          purpose: "Identify Discovery hypotheses validated by this activity — confirmation evidence.",
          include: [
            "Specific hypotheses confirmed (e.g., 'Hypothesis that client prefers organizing tasks confirmed')",
            "Why this activity confirms them",
            "Confidence level gained",
          ],
          exclude: [
            "Hypotheses to continue testing (use 'discovery_hypotheses_to_continue_testing')",
            "Vocational themes generally (use 'emerging_vocational_themes_supported') — those are themes; this is testing statements",
            "Refuted hypotheses (use 'themes_or_hypotheses_refuted')",
          ],
          usedFor: [
            "Discovery Hypotheses confirmation in DSR",
            "Building confidence for plan development",
            "Tracking hypothesis verification across activities",
          ],
        },
      },
      {
        id: "discovery_hypotheses_to_continue_testing",
        label: "Discovery Hypotheses to Continue Testing",
        type: "textarea",
        guidance: {
          purpose: "Identify hypotheses still in testing — questions to answer with future activities.",
          include: [
            "Hypotheses to test next (e.g., 'Stamina across a 4-hour shift')",
            "How future activities would test them",
            "What evidence would confirm or refute them",
          ],
          exclude: [
            "Confirmed hypotheses (use 'discovery_hypotheses_confirmed')",
            "Refuted hypotheses (use 'themes_or_hypotheses_refuted')",
            "Recommended activities alone (use 'recommended_next_activities') — this is hypothesis statements",
          ],
          usedFor: [
            "Discovery Hypotheses pipeline in DSR",
            "Test design for next activities",
            "Tracking open questions across Discovery",
          ],
        },
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
        guidance: {
          purpose: "Make an explicit disposition about this activity or setting — a clear status to prioritize exploration.",
          include: [
            "'Yes - strong target' — pursue further as a Discovery theme",
            "'Maybe - needs more exploration' — gather more information",
            "'No - poor fit at this time' — deprioritize with rationale",
            "'Unknown' — insufficient information to decide",
          ],
          exclude: [
            "Detailed rationale (use 'key_takeaways' or 'recommended_next_activities')",
            "Hypothesis statements (use other summary fields)",
          ],
          usedFor: [
            "Discovery Stage disposition in DSR",
            "Activity and setting pipeline prioritization",
            "Tracking which activities should be revisited",
          ],
        },
      },
      {
        id: "additional_notes",
        label: "Additional Notes",
        type: "textarea",
        guidance: {
          purpose: "Capture context not fitting any specific field.",
          include: [
            "Information not captured elsewhere",
            "Contextual observations about this activity",
            "Anything emphatic from those present",
          ],
          exclude: [
            "Information that belongs in a specific field (place there instead)",
          ],
          usedFor: [
            "Supplementary context for this activity record",
            "Background for future revisit decisions",
            "Qualitative nuances",
          ],
        },
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