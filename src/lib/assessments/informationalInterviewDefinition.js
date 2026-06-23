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
        guidance: {
          purpose: "Record the exact name of the business or organization contacted — the primary employer lead identifier.",
          include: [
            "Full legal or commonly-known business name (e.g., 'Smith's Grocery', 'Salt Lake Library')",
            "Organization name if not a traditional business (e.g., 'Community Food Pantry')",
          ],
          exclude: [
            "Industry or generic type (e.g., 'a grocery store')",
            "Job titles or person names",
            "What they do (use 'business_description')",
          ],
          usedFor: [
            "Employer Leads in DSR — the named employer for job development",
            "Tracking employer contacts for future follow-up",
            "Building a business database for customized employment",
          ],
        },
      },
      {
        id: "person_interviewed",
        label: "Person Interviewed",
        type: "short_text",
        guidance: {
          purpose: "Identify the specific individual interviewed — a named contact for employer leads and follow-up.",
          include: [
            "Full name of the person (e.g., 'Maria Gonzales')",
            "Decision-maker or knowledgeable employee",
          ],
          exclude: [
            "Just the job title without a name",
            "Generic references (e.g., 'the manager')",
            "The business name",
          ],
          usedFor: [
            "Employer Leads — named contact for future interactions",
            "Community Connections — individual relationship tracking",
            "Follow-up contact and relationship building",
          ],
        },
      },
      {
        id: "person_job_title",
        label: "Person's Job Title / Role",
        type: "short_text",
        guidance: {
          purpose: "Establish the authority and perspective of the interviewee—whether they hire, manage, or perform the work.",
          include: [
            "Exact job title (e.g., 'Store Manager', 'HR Director')",
            "Hiring authority if relevant (e.g., 'Owner')",
            "Role context if needed (e.g., 'Warehouse Supervisor') — the title, not tasks",
          ],
          exclude: [
            "General person descriptions ('he's been there a while')",
            "Tasks performed — those belong in Section 3",
            "Supervision style they use — that belongs in Section 5",
          ],
          usedFor: [
            "Assessing weight of information shared",
            "Determining future follow-up contacts",
            "Relationship mapping for this employer lead",
          ],
        },
      },
      {
        id: "contact_information",
        label: "Contact Information",
        type: "short_text",
        placeholder: "Phone, email, website, or preferred contact method...",
        guidance: {
          purpose: "Capture actionable contact details for the employer lead—how to reach them for follow-up.",
          include: [
            "Phone number",
            "Email address",
            "Website",
            "Preferred contact method or best time to reach",
          ],
          exclude: [
            "Personal information unrelated to business contact",
            "Information about the business itself",
            "People the client already knows (those are natural supports)",
          ],
          usedFor: [
            "Employer Leads — follow-up communication channel",
            "Scheduling tours, job shadows, additional interviews",
            "Building employer relationship pipeline",
          ],
        },
      },
      {
        id: "how_contact_identified",
        label: "How This Contact Was Identified",
        type: "textarea",
        placeholder: "Referral, client/family connection, neighborhood mapping, employer lead, staff contact, community contact...",
        guidance: {
          purpose: "Track provenance of this employer lead—how the connection was made — to understand your discovery pipeline.",
          include: [
            "Referral source (client suggested them, family recommended them)",
            "Neighborhood mapping (walked by, drove past)",
            "Previous employer lead or staff contact",
            "Community connection (chamber of commerce, networking)",
            "Industry research",
          ],
          exclude: [
            "Tasks performed at business (Section 3)",
            "Client skills or interests (Section 7)",
            "Anything about the interviewee's role",
          ],
          usedFor: [
            "Documenting which discovery methods yield viable leads",
            "Evaluating Discovery pipeline effectiveness",
            "Tracking community connection and referral sources",
          ],
        },
      },
      {
        id: "time_spent",
        label: "Time Spent",
        type: "short_text",
        placeholder: "Example: 45 minutes",
        guidance: {
          purpose: "Track effort and quality of the informational interview—depth of engagement matters.",
          include: [
            "Time in interview (e.g., '45 minutes', '1 hour')",
            "Whether this includes tour or shadow time if applicable",
          ],
          exclude: [
            "Travel time",
            "Time for documentation",
          ],
          usedFor: [
            "Discovery effort tracking",
            "Interview quality assessment",
            "Resource planning for Stage Three",
          ],
        },
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
        guidance: {
          purpose: "Describe what this business does at a high level — a general picture of their core purpose.",
          include: [
            "Core purpose or main activity (e.g., 'Sells groceries', 'Loans library materials')",
            "Customer base or who they serve",
            "Size and scale (e.g., 'small family-owned', 'large national franchise')",
          ],
          exclude: [
            "Specific tasks or duties (use 'tasks_performed')",
            "Physical environment details (use 'work_environment')",
            "Client skills or how client might fit here (Section 7)",
          ],
          usedFor: [
            "Business Settings description in DSR",
            "Initial fit assessment against client vocational themes",
            "Industry context for vocational theme validation",
          ],
        },
      },
      {
        id: "products_services",
        label: "Products / Services",
        type: "textarea",
        guidance: {
          purpose: "Catalog the specific products made or services offered—concrete outputs of the business.",
          include: [
            "Products made or sold (e.g., 'Fresh produce, baked goods, canned items')",
            "Services provided (e.g., 'Loans books, offers computer access, runs community programs')",
            "Customer-facing outputs",
          ],
          exclude: [
            "Internal work tasks (use 'tasks_performed')",
            "What the client may like or dislike (Section 7)",
            "Equipment used (use 'tools_equipment_used')",
          ],
          usedFor: [
            "Business Settings detail in DSR",
            "Matching client interests to product/service context",
            "Vocational theme validation through product/service alignment",
          ],
        },
      },
      {
        id: "departments_or_areas",
        label: "Departments, Areas, or Work Units Discussed or Observed",
        type: "textarea",
        guidance: {
          purpose: "Identify distinct areas of the business—different settings within this employer where work happens.",
          include: [
            "Named departments (e.g., 'Produce, Bakery, Customer Service, Stock Room')",
            "Functional areas (e.g., 'Front of house, back of house, warehouse, office')",
            "Physical zones within the business",
          ],
          exclude: [
            "Tasks done in those departments (use 'tasks_performed')",
            "Skills needed (use 'important_skills')",
            "Conditions in those areas (use 'work_environment') — though area names can be mentioned",
            "Things the client likes (Section 7)",
          ],
          usedFor: [
            "Business Settings — granular work areas in DSR",
            "Identifying multiple potential CE opportunities within one employer",
            "Job matching to specific areas aligned with client themes",
          ],
        },
      },
      {
        id: "work_environment",
        label: "Work Environment",
        type: "textarea",
        placeholder: "Noise, pace, lighting, layout, team size, public contact, physical demands, sensory factors, accessibility...",
        guidance: {
          purpose: "Describe the physical and sensory setting of the workplace — conditions present independent of the client.",
          include: [
            "Noise levels and types (quiet office, loud warehouse, customer chatter)",
            "Pace and activity level (fast-paced retail, slow library)",
            "Lighting and layout (bright fluorescent, dim warehouse, open office)",
            "Team size (small team, large team, solo work)",
            "Public contact (high/low customer interaction)",
            "Sensory factors and accessibility features",
          ],
          exclude: [
            "Conditions the CLIENT needs for success (use 'conditions_needed_for_client_success')",
            "Client preferences (Section 7)",
            "Skills to succeed here (use 'important_skills')",
            "Employer names or contacts",
            "Community connections",
          ],
          usedFor: [
            "Business Settings — environmental conditions in DSR",
            "Matching workplace to client's conditions for success",
            "Initial screening for environmental compatibility",
          ],
        },
      },
      {
        id: "business_hours_schedule",
        label: "Business Hours / Scheduling Patterns",
        type: "textarea",
        guidance: {
          purpose: "Document when work happens—operating hours and shift patterns that shape possible schedules.",
          include: [
            "Hours of operation (e.g., '7am-10pm daily')",
            "Shift patterns (morning, evening, weekend availability)",
            "Peak vs. slow times",
            "Seasonal scheduling patterns",
          ],
          exclude: [
            "Client's preferred schedule (use 'conditions_needed_for_client_success')",
            "Pace within shifts (use 'pace_productivity_expectations')",
            "Supervision schedule (use 'supervision_style')",
            "Supports needed",
          ],
          usedFor: [
            "Business Settings — schedule compatibility in DSR",
            "Matching client's best schedule/time of day to this business",
            "Identifying CE opportunities at non-peak times",
          ],
        },
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
        guidance: {
          purpose: "Document the actual work tasks done in this business—discrete, observable activities that constitute the job.",
          include: [
            "Specific tasks (e.g., 'Sorting donations, stocking shelves, filing paperwork, inventory tracking, material handling')",
            "Concrete action verbs (sorting, stocking, filing, organizing)",
            "Frequency or proportion of tasks in the workday",
          ],
          exclude: [
            "Interests (Section 7)",
            "Employer names (Section 1)",
            "Supports or accommodations (Section 5)",
            "Conditions for success (Section 5)",
            "Client strengths and skills (Section 7)",
            "Environment description (Section 2)",
          ],
          usedFor: [
            "Job Tasks in DSR — discrete duties for job carving and matching",
            "Comparing to client's known task preferences",
            "Building customized job descriptions",
          ],
        },
      },
      {
        id: "tools_equipment_used",
        label: "Tools, Equipment, Technology, or Materials Used",
        type: "textarea",
        guidance: {
          purpose: "Identify specific tools, equipment, technology, and materials used on the job—concrete objects for matching.",
          include: [
            "Hand tools (e.g., 'box cutters, label makers')",
            "Equipment (e.g., 'forklifts, pallet jacks, cash registers')",
            "Technology (e.g., 'scanners, software systems')",
            "Materials handled (e.g., 'boxes, clothing, food, paper documents')",
            "Safety equipment required",
          ],
          exclude: [
            "Skills needed to use tools (use 'important_skills')",
            "Tasks performed with tools (use 'tasks_performed')",
            "Client's ability to use them (Section 7)",
            "Conditions or supports for using them",
          ],
          usedFor: [
            "Job Tasks resources in DSR",
            "Matching client's comfort with specific tools and technology",
            "Training and accommodation planning",
          ],
        },
      },
      {
        id: "physical_requirements",
        label: "Physical Requirements",
        type: "textarea",
        placeholder: "Standing, sitting, lifting, walking, reaching, fine motor, stamina, transportation within site...",
        guidance: {
          purpose: "Document the physical demands of the work — what the body must do to perform tasks.",
          include: [
            "Movement requirements (standing, sitting, walking, lifting)",
            "Strength demands (weight amounts if known)",
            "Fine motor or coordination needs",
            "Stamina or endurance expectations",
            "Mobility within the worksite",
          ],
          exclude: [
            "Client's physical abilities or limitations (use 'concerns_or_barriers')",
            "Accommodations (use 'support_accommodation_openness')",
            "Environmental conditions (use 'work_environment')",
            "Skills related to physical ability",
            "Interests",
          ],
          usedFor: [
            "Job Task demands in DSR",
            "Initial compatibility screen against client physical capabilities",
            "Accommodation planning for physical barriers",
          ],
        },
      },
      {
        id: "social_requirements",
        label: "Social / Communication Requirements",
        type: "textarea",
        placeholder: "Customer contact, coworker interaction, supervisor communication, teamwork, phone use, written communication...",
        guidance: {
          purpose: "Identify social and communication demands — how much interaction this setting requires.",
          include: [
            "Customer/public contact level",
            "Coworker interaction level",
            "Supervisor communication needs",
            "Teamwork expectations",
            "Phone, written, or verbal communication demands",
          ],
          exclude: [
            "Conditions the client needs for social success (use 'conditions_needed_for_client_success')",
            "Client's social skills or preferences (Section 7)",
            "Supervision style (use 'supervision_style')",
            "Employer personal qualities (use 'traits_successful_employees')",
          ],
          usedFor: [
            "Job Task social demands in DSR",
            "Matching workplace to client's social preferences",
            "Initial screen for social compatibility",
          ],
        },
      },
      {
        id: "pace_productivity_expectations",
        label: "Pace / Productivity Expectations",
        type: "textarea",
        guidance: {
          purpose: "Document the pace and output expectations — how fast and how much work is expected.",
          include: [
            "Output expectations (items per hour, customers per shift, etc.)",
            "Pace (slow, moderate, fast-paced)",
            "Quotas or time-based targets",
            "Quality expectations",
          ],
          exclude: [
            "Conditions for client success (use 'conditions_needed_for_client_success')",
            "Client's work pace or abilities (Section 7)",
            "Pace accommodations (use 'support_accommodation_openness')",
            "Employer personal qualities",
          ],
          usedFor: [
            "Job Task demands in DSR",
            "Feasibility check against client's known work pace",
            "Customized employment pace negotiation",
          ],
        },
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
        guidance: {
          purpose: "Capture skills the EMPLOYER says matter for this work — what they look for in candidates.",
          include: [
            "Technical or task-specific skills (e.g., 'cashier experience', 'inventory tracking')",
            "General workplace skills (e.g., 'attention to detail', 'punctuality')",
            "Skills explicitly named by the employer",
          ],
          exclude: [
            "Client's skills or strengths (use 'client_strengths_that_align')",
            "Conditions for success (Section 5)",
            "Employer names or contacts",
            "Community connections",
            "Interests",
          ],
          usedFor: [
            "Observed employer needs — skills in DSR",
            "Gap analysis against client strengths",
            "Training and development planning",
          ],
        },
      },
      {
        id: "preferred_experience",
        label: "Preferred Experience",
        type: "textarea",
        guidance: {
          purpose: "Document experience employers prefer — history they value, not formal requirements.",
          include: [
            "Type of prior work experience preferred",
            "Industry or role background valued",
            "Specific experience that gives candidates an edge",
          ],
          exclude: [
            "Client's experience (use 'client_strengths_that_align')",
            "Education or certifications (use 'education_certifications')",
            "Conditions or supports",
          ],
          usedFor: [
            "Observed employer needs — experience preferences in DSR",
            "Determining if client's profile aligns at a high level",
            "Job development messaging about background fit",
          ],
        },
      },
      {
        id: "education_certifications",
        label: "Education, Certifications, Licenses, or Training",
        type: "textarea",
        guidance: {
          purpose: "Document formal qualifications required — credentials that gate access to the role.",
          include: [
            "Education level required (high school, AA, BA, etc.)",
            "Certifications required (food handler, forklift, first aid)",
            "Licenses (driver's license, professional license)",
            "Training programs valued",
          ],
          exclude: [
            "Skills (use 'important_skills')",
            "Experience (use 'preferred_experience')",
            "Client's qualifications (use 'client_strengths_that_align' or 'concerns_or_barriers')",
          ],
          usedFor: [
            "Observed employer needs — formal qualifications in DSR",
            "Credential gap assessment for client",
            "Customized employment role design considering credential needs",
          ],
        },
      },
      {
        id: "traits_successful_employees",
        label: "Traits Associated With Successful Employees",
        type: "textarea",
        guidance: {
          purpose: "Capture personal qualities the employer values in successful employees — soft skills and character.",
          include: [
            "Personality traits valued (e.g., 'patient, friendly, detail-oriented')",
            "Work habits valued (e.g., 'reliable, punctual, organized')",
            "Character traits (e.g., 'honest, hardworking')",
            "Interpersonal qualities",
          ],
          exclude: [
            "Client's positive qualities — those belong to Section 7",
            "Skills (use 'important_skills')",
            "Conditions or supports",
            "Job tasks",
          ],
          usedFor: [
            "Observed employer needs — soft skills and traits in DSR",
            "Cultural fit assessment for job site",
            "Identifying aligned strengths from client Discovery data",
          ],
        },
      },
      {
        id: "skills_that_can_be_trained",
        label: "Skills That Can Be Trained On the Job",
        type: "textarea",
        guidance: {
          purpose: "Identify which skills the employer is willing to teach — entry points where candidate training can substitute for prior experience.",
          include: [
            "Skills explicitly trainable on the job",
            "Tasks where the employer will invest in training",
            "Soft skills the employer will mentor",
          ],
          exclude: [
            "Required qualifications (use 'education_certifications')",
            "Non-trainable skills (use 'important_skills')",
            "Client's skills or training needs (Section 7)",
            "Training methods (use 'training_methods')",
          ],
          usedFor: [
            "Observed employer needs — CE flexibility in DSR",
            "Determining entry-viability for client without specific experience",
            "Customized employment opportunity identification",
          ],
        },
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
        guidance: {
          purpose: "Identify conditions in THIS workplace that predict success — patterns observed by the employer independent of the client.",
          include: [
            "Workplace conditions that help (structured environments, written instructions, predictable routines)",
            "Team size that supports success",
            "Support resources typically provided",
            "Cultural factors (e.g., 'clear expectations, regular check-ins')",
          ],
          exclude: [
            "Skills that successful employees have (use 'important_skills' or 'traits_successful_employees')",
            "What the CLIENT needs (use 'conditions_needed_for_client_success')",
            "Employer names or community connections",
            "Job tasks",
          ],
          usedFor: [
            "Workplace conditions for success in DSR — observable employer-side conditions",
            "Comparing workplace conditions to client's known success conditions",
            "Customized employment condition negotiation",
          ],
        },
      },
      {
        id: "common_reasons_employees_struggle",
        label: "Common Reasons Employees Struggle",
        type: "textarea",
        guidance: {
          purpose: "Document employer-observed patterns of struggle — cautionary indicators about workplace demands.",
          include: [
            "Workplace conditions that cause struggle (e.g., 'unpredictable schedule', 'loud environment')",
            "Skills gaps that lead to failure",
            "Cultural or pace mismatches observed",
            "Specific demands that overwhelm new employees",
          ],
          exclude: [
            "Client's specific barriers (use 'concerns_or_barriers')",
            "Job tasks (use 'tasks_performed')",
            "How clients might struggle (Section 7)",
            "Employer names",
            "Supports they have (use 'what_makes_employees_successful')",
          ],
          usedFor: [
            "Workplace conditions for success — risk factors in DSR",
            "Compatibility screen against client's known aversions and barriers",
            "Job site risk mitigation planning",
          ],
        },
      },
      {
        id: "supervision_style",
        label: "Supervision Style / Management Approach",
        type: "textarea",
        guidance: {
          purpose: "Document how this employer supervises and manages — workplace characteristic independent of the client.",
          include: [
            "Supervision approach (hands-on vs. hands-off)",
            "Communication style with employees",
            "Feedback approach (immediate vs. scheduled)",
            "Expectations of autonomy vs. direction",
            "Team size and supervision ratio",
          ],
          exclude: [
            "Supervision style the CLIENT needs (use 'conditions_needed_for_client_success')",
            "Training approaches (use 'training_methods')",
            "Skills needed for supervisor relationship (use 'important_skills')",
            "Employer names — this is about style, not people",
          ],
          usedFor: [
            "Workplace conditions — supervision style in DSR",
            "Matching to client's preferred supervision style",
            "Job coach role boundary planning",
          ],
        },
      },
      {
        id: "training_methods",
        label: "Training Methods Used",
        type: "textarea",
        placeholder: "Modeling, shadowing, written instructions, videos, checklists, hands-on practice, verbal coaching...",
        guidance: {
          purpose: "Identify how this employer trains new employees — workplace methods available independent of the client.",
          include: [
            "Training approaches (modeling, shadowing, hands-on practice)",
            "Written resources provided (manuals, checklists, SOPs)",
            "Digital training (videos, online modules)",
            "Verbal coaching habits",
            "Onboarding length and structure",
          ],
          exclude: [
            "Training the CLIENT needs (use 'conditions_needed_for_client_success')",
            "Skills that can be trained (use 'skills_that_can_be_trained') — that's content, this is method",
            "Supervision style generally (use 'supervision_style')",
          ],
          usedFor: [
            "Workplace conditions — training methods in DSR",
            "Comparing to client's best learning style",
            "Job coach intervention planning — fill method gaps",
          ],
        },
      },
      {
        id: "support_accommodation_openness",
        label: "Openness to Supports, Accommodations, or Job Coaching",
        type: "textarea",
        guidance: {
          purpose: "Document the employer's stated or implied willingness to support customized employment interventions.",
          include: [
            "Stated openness to accommodations or job coaching",
            "Past experience with supported employment",
            "Flexibility to customize tasks or schedules",
            "Openness to job carving or task reassignment",
            "Specific accommodations they've provided or refused",
          ],
          exclude: [
            "Supports the CLIENT needs (use 'conditions_needed_for_client_success')",
            "Skills (use 'important_skills')",
            "Conditions for success generally (use 'what_makes_employees_successful')",
            "Job tasks",
          ],
          usedFor: [
            "Workplace conditions — CE accommodation openness in DSR",
            "Determining viability for customized employment placement",
            "Job coach role negotiation and workplace support planning",
          ],
        },
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
        guidance: {
          purpose: "Identify gaps in what the business provides — pain points that a customized role could address.",
          include: [
            "Tasks needing attention (e.g., 'Donations are piling up unsorted')",
            "Customer service gaps",
            "Quality issues (e.g., 'Shelves often mis-stocked')",
            "Workflow bottlenecks the employer acknowledges",
          ],
          exclude: [
            "Job tasks generally performed (use 'tasks_performed')",
            "Client skills or strengths (Section 7)",
            "Skills needed (use 'important_skills')",
            "Conditions for success (Section 5)",
            "Employer names",
          ],
          usedFor: [
            "Discovery Hypotheses — unmet need identification in DSR",
            "Foundation for job carving and customized employment design",
            "Pitching customized employment opportunity to employer",
          ],
        },
      },
      {
        id: "tasks_not_getting_done",
        label: "Tasks Not Getting Completed or Completed Consistently",
        type: "textarea",
        guidance: {
          purpose: "Identify specific tasks that fall through the cracks — clear evidence of where added capacity could help.",
          include: [
            "Specific tasks left undone (e.g., 'Sorting donations, organizing the storage room')",
            "Tasks completed inconsistently or late",
            "Tasks no one has time for",
            "Frequency of the gap (daily, weekly)",
          ],
          exclude: [
            "General tasks the business does (use 'tasks_performed')",
            "Client interests (Section 7)",
            "Skills needed to do them (use 'important_skills')",
            "Conditions the client needs",
          ],
          usedFor: [
            "Discovery Hypotheses — specific evidence of unmet capacity in DSR",
            "Customized employment job design — discrete tasks to carve out",
            "Job description construction for negotiated role",
          ],
        },
      },
      {
        id: "bottlenecks_or_pain_points",
        label: "Bottlenecks, Pain Points, or Inefficiencies",
        type: "textarea",
        guidance: {
          purpose: "Identify workflow problems and inefficiencies — where work backs up or doesn't flow well.",
          include: [
            "Process bottlenecks (e.g., 'Donations queue up before sorting happens')",
            "Pain points preventing smooth operation",
            "Inefficiencies or wasted steps",
            "Time-sinks or frustration points",
          ],
          exclude: [
            "Specific tasks not done (use 'tasks_not_getting_done')",
            "Skills or training gaps (use 'important_skills')",
            "Client strengths or fit (Section 7)",
            "Employer names",
          ],
          usedFor: [
            "Discovery Hypotheses — workflow intervention opportunities in DSR",
            "Customized employment role design around process fixes",
            "Quantifying employer benefit of a CE placement",
          ],
        },
      },
      {
        id: "job_carving_opportunities",
        label: "Job Carving / Task Reassignment Opportunities",
        type: "textarea",
        guidance: {
          purpose: "Identify where existing duties could be carved out or reassigned to create a focused role.",
          include: [
            "Tasks other employees do that could be reassigned (e.g., 'Sorting currently done by floor staff')",
            "Combining pieces of multiple roles into one (e.g., 'Combine pantry organizing with donation intake')",
            "Tasks that relieve other employees for higher-value work",
            "Why carving would benefit the business",
          ],
          exclude: [
            "General tasks performed (use 'tasks_performed')",
            "Client strengths (Section 7)",
            "Skills required (use 'important_skills')",
            "Employer names",
            "Conditions for success",
          ],
          usedFor: [
            "Discovery Hypotheses — CE role construction in DSR",
            "Customized employment job description development",
            "Quantifying mutual benefit of role restructuring",
          ],
        },
      },
      {
        id: "customized_employment_possibilities",
        label: "Possible Customized Employment Opportunities",
        type: "textarea",
        guidance: {
          purpose: "Synthesize all discoveries into concrete CE role proposals — specific role concepts grounded in evidence.",
          include: [
            "Concrete role proposals (e.g., 'Donations sorter role Mon-Wed-Fri mornings')",
            "Tasks combined into a coherent role description",
            "How this role addresses an unmet need",
            "Approximate schedule and hours",
            "Why this is viable based on interview evidence",
          ],
          exclude: [
            "Vague ideas without grounding",
            "Roles disconnected from observed needs",
            "Client skills strengths (use 'client_strengths_that_align') — those come from client Discovery, not the employer",
            "Conditions the client needs (use 'conditions_needed_for_client_success')",
          ],
          usedFor: [
            "Discovery Hypotheses — concrete CE role proposals in DSR",
            "Foundation for customized employment job plan",
            "Employer pitch and negotiation starting point",
          ],
        },
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
        guidance: {
          purpose: "Connect this employer and work setting to themes emerging from Stage One and Stage Two Discovery about the client.",
          include: [
            "How this business aligns with client vocational themes (e.g., 'Matches organizing and categorization theme')",
            "Product/service/setting overlap with client interests and patterns",
            "Why this is a relevant target for exploration based on client Discovery",
            "How this reinforces or tests emerging themes",
          ],
          exclude: [
            "Specific client strengths (use 'client_strengths_that_align')",
            "Skills required by employer (use 'important_skills')",
            "Employer names — already captured",
            "Job tasks alone (use 'tasks_performed')",
          ],
          usedFor: [
            "Vocational Themes Evidence in DSR — patterns supporting themes",
            "Prioritizing which employer leads to pursue",
            "Theme validation through employer exploration",
          ],
        },
      },
      {
        id: "client_strengths_that_align",
        label: "Client Strengths, Interests, or Skills That May Align",
        type: "textarea",
        guidance: {
          purpose: "Identify SPECIFIC client strengths, interests, or skills that connect to what's needed or valued here — synthesis from Discovery.",
          include: [
            "Specific client skills relevant (e.g., 'Client is highly organized')",
            "Interests that align with this work (e.g., 'Client enjoys sorting and categorizing')",
            "Observed talents relevant to tasks here",
            "Past demonstrations relevant to this setting",
          ],
          exclude: [
            "Workplace conditions for success (use 'what_makes_employees_successful') — that's employer-side",
            "Skills required by employer (use 'important_skills') — that's employer-side",
            "Concerns (use 'concerns_or_barriers')",
            "Employer names — already captured",
            "Vague 'the client would be good at this' without evidence",
          ],
          usedFor: [
            "Client Strengths alignment in DSR",
            "Customized employment job match validation",
            "Pitching the client to the employer",
          ],
        },
      },
      {
        id: "concerns_or_barriers",
        label: "Concerns or Barriers for This Client",
        type: "textarea",
        guidance: {
          purpose: "Identify SPECIFIC concerns or barriers in this setting FOR THIS CLIENT — grounded in client Discovery data.",
          include: [
            "Client barriers relevant here (e.g., 'Loud environment may be challenging based on noise sensitivity')",
            "Concerns about client-specific needs (e.g., 'Client struggles with unpredictable schedule')",
            "Job demands that may strain client capabilities (e.g., 'High customer contact needs client's social preferences')",
            "Specific evidence from Discovery of risk",
          ],
          exclude: [
            "General reasons any employee might struggle (use 'common_reasons_employees_struggle')",
            "Supports to address concerns (use 'conditions_needed_for_client_success')",
            "Skills required (use 'important_skills')",
            "Employer names",
          ],
          usedFor: [
            "Concerns and barriers specific to client fit in DSR",
            "Risk mitigation and accommodation planning",
            "Determining whether to pursue or pass on this employer",
          ],
        },
      },
      {
        id: "conditions_needed_for_client_success",
        label: "Conditions Needed for Client Success in This Setting",
        type: "textarea",
        guidance: {
          purpose: "Synthesize the SPECIFIC conditions the CLIENT needs at this workplace — grounded in client Discovery data.",
          include: [
            "Specific accommodations (e.g., 'Written instructions, predictable breaks')",
            "Supervision approaches (e.g., 'Direct coaching, visual task lists')",
            "Environmental needs (e.g., 'Quiet area for high-stimulation tasks')",
            "Support intensity needed here",
          ],
          exclude: [
            "Workplace conditions generally successful (use 'what_makes_employees_successful') — that's employer-side",
            "Training methods used by employer (use 'training_methods') — that's employer-side",
            "Supervision style generally (use 'supervision_style') — that's employer-side",
            "Skills (use 'important_skills' or 'client_strengths_that_align')",
            "Employer names",
          ],
          usedFor: [
            "Conditions for Success — client-specific CE conditions in DSR",
            "Customized employment negotiation and accommodation planning",
            "Job coach intervention design",
          ],
        },
      },
      {
        id: "follow_up_opportunities",
        label: "Follow-Up Opportunities",
        type: "textarea",
        placeholder: "Tour, observation, job shadow, introduction, work experience, additional contact, employer meeting...",
        guidance: {
          purpose: "Identify specific next actions with this employer or community contact — concrete steps for progression.",
          include: [
            "Tour or workplace observation",
            "Job shadow opportunities",
            "Introductions to other contacts",
            "Work experience or trial opportunities",
            "Follow-up meetings or calls",
            "Specific person to contact and when",
          ],
          exclude: [
            "General next steps (use 'recommended_next_steps')",
            "Conditions for client success (use 'conditions_needed_for_client_success')",
            "Client's strengths or skills (use 'client_strengths_that_align')",
          ],
          usedFor: [
            "Employer Leads — follow-up pipeline in DSR",
            "Community Connections — referral opportunities",
            "Stage progression planning toward employment",
          ],
        },
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
        guidance: {
          purpose: "Summarize the most important findings — the headline insights that should drive the next decision.",
          include: [
            "Most significant findings about this employer",
            "Whether this is a viable lead and why",
            "Top CE opportunities identified",
            "Critical caveats or red flags",
          ],
          exclude: [
            "Detailed field-by-field summary (already in other sections)",
            "Information already detailed in other sections",
          ],
          usedFor: [
            "Interview summary for DSR",
            "Quick-reference context for future planning",
            "Decision rationale archival",
          ],
        },
      },
      {
        id: "recommended_next_steps",
        label: "Recommended Next Steps",
        type: "textarea",
        guidance: {
          purpose: "Propose concrete actions across discovery, client exploration, and employer relationship.",
          include: [
            "Discovery actions (more interviews, additional employer research)",
            "Client exploration actions (try this environment, shadow visit)",
            "Employer relationship actions (follow-up meeting, pitch)",
            "Internal staff actions (prepare accommodation plan)",
            "Timeline and ownership if relevant",
          ],
          exclude: [
            "Specific contact opportunities (use 'follow_up_opportunities')",
            "Conditions for client success (use 'conditions_needed_for_client_success')",
          ],
          usedFor: [
            "Discovery Stage Three planning in DSR",
            "Action items for the CE team",
            "Progress tracking on this employer lead",
          ],
        },
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
        guidance: {
          purpose: "Make an explicit disposition decision about this employer lead — a clear status to prioritize pipeline.",
          include: [
            "'Yes - strong target' — viable lead worth pursuing",
            "'Maybe - needs more exploration' — gather more information",
            "'No - poor fit at this time' — deprioritize with rationale",
            "'Unknown' — insufficient information to decide",
          ],
          exclude: [
            "Detailed rationale (use 'key_takeaways' or 'recommended_next_steps')",
            "Concerns alone (use 'concerns_or_barriers')",
            "Strengths alone (use 'client_strengths_that_align')",
          ],
          usedFor: [
            "Employer lead disposition in DSR",
            "Discovery pipeline prioritization",
            "Pipeline status tracking across informational interviews",
          ],
        },
      },
      {
        id: "additional_notes",
        label: "Additional Notes",
        type: "textarea",
        guidance: {
          purpose: "Capture context or observations not belonging in any specific field.",
          include: [
            "Information not fitting other categories",
            "Contextual observations about this employer",
            "Interview dynamics or environment details",
            "Anything the interviewee emphasized",
          ],
          exclude: [
            "Information that belongs in a specific field (place there instead)",
          ],
          usedFor: [
            "Supplementary context for this interview record",
            "Background for future interactions with this employer",
            "Capturing qualitative context",
          ],
        },
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