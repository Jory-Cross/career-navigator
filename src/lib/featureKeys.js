/**
 * Feature permission keys — single source of truth.
 * Add new keys here to extend the permission system.
 * Admin users always see everything regardless of permissions.
 */

export const FEATURE_KEYS = {
  DASHBOARD:              "dashboard",
  CLIENTS:                "clients",
  TIME_TRACKING:          "time_tracking",
  CALENDAR:               "calendar",
  REPORTS:                "reports",
  TASKS:                  "tasks",
  EMAIL_TEMPLATES:        "email_templates",
  DOCUMENTS:              "documents",
  ASSESSMENTS:            "assessments",
  RECOMMENDATIONS:        "recommendations",
  AI_AGENTS:              "ai_agents",
  APP_ANALYTICS:          "app_analytics",
  ORG_DASHBOARD:          "org_dashboard",
  EMPLOYEES:              "employees",
  PRE_ETS:                "pre_ets",
  DSPD:                   "dspd",
  JOB_SEEKER:             "job_seeker",
  EMPLOYED:               "employed",
  // Client Detail sections
  CLIENT_DETAILS:         "client_details",
  CLIENT_ONBOARDING:      "client_onboarding",
  CLIENT_INTAKE_PACKET:   "client_intake_packet",
  CLIENT_APPLICATIONS:    "client_applications",
  CLIENT_AI_JOB_SEARCH:   "client_ai_job_search",
  CLIENT_INTERVIEW_PREP:  "client_interview_prep",
  CLIENT_ASSESSMENTS:     "client_assessments",
  CLIENT_DOCUMENTS:       "client_documents",
  CLIENT_TASKS:           "client_tasks",
    CLIENT_TIME:            "client_time",
  CLIENT_ACTIVITY:        "client_activity",
  CLIENT_ASSISTANT:       "client_assistant",
  CLIENT_PORTAL:          "client_portal",
  CLIENT_SEND_EMAIL:      "client_send_email",
  CLIENT_TEST_ONET:       "client_test_onet",
  CLIENT_ADD_ACTIONS:     "client_add_actions",

  // Staff-side Pre-ETS Client Detail sections
  CLIENT_PRE_ETS_WBLE_FORMS:        "client_pre_ets_wble_forms",
  CLIENT_PRE_ETS_PROGRAM_CHECKLIST: "client_pre_ets_program_checklist",
  CLIENT_PRE_ETS_IEP_TRANSITION:    "client_pre_ets_iep_transition",
  CLIENT_PRE_ETS_SKILLS_EXPLORATION:"client_pre_ets_skills_exploration",
  CLIENT_PRE_ETS_MEETINGS:          "client_pre_ets_meetings",
  // General Client Portal tabs
  CLIENT_PORTAL_INTAKE_FORMS:     "client_portal_intake_forms",
  CLIENT_PORTAL_APPLICATIONS:     "client_portal_applications",
  CLIENT_PORTAL_RECOMMENDATIONS:  "client_portal_recommendations",
  CLIENT_PORTAL_TASKS:            "client_portal_tasks",
  CLIENT_PORTAL_DOCUMENTS:        "client_portal_documents",
  // Pre-ETS Client Portal tabs
  CLIENT_PORTAL_CLOCK_IN_OUT:         "client_portal_clock_in_out",
  CLIENT_PORTAL_PROGRAM_CHECKLIST:    "client_portal_program_checklist",
  CLIENT_PORTAL_IEP_TRANSITION_PLAN:  "client_portal_iep_transition_plan",
  CLIENT_PORTAL_SKILLS_EXPLORATION:   "client_portal_skills_exploration",
  CLIENT_PORTAL_ASSESSMENTS:          "client_portal_assessments",
  CLIENT_PORTAL_WBLE_FORMS:           "client_portal_wble_forms",
  CLIENT_PORTAL_MEETINGS:             "client_portal_meetings",
};

// Feature metadata used by the admin permissions UI — STAFF features only
export const FEATURE_DEFINITIONS = [
  { key: "dashboard",       label: "Dashboard",        category: "core" },
  { key: "time_tracking",   label: "Time Tracking",    category: "core" },
  { key: "calendar",        label: "Calendar",         category: "core" },
  { key: "tasks",           label: "Tasks",            category: "core" },
  { key: "clients",         label: "Clients",          category: "clients" },
  { key: "job_seeker",      label: "Job Seeker",       category: "client_categories" },
  { key: "employed",        label: "Employed",         category: "client_categories" },
  { key: "pre_ets",         label: "Pre-ETS",          category: "client_categories" },
  { key: "dspd",            label: "DSPD",             category: "client_categories" },
  { key: "reports",         label: "Reports",          category: "reporting" },
  { key: "email_templates", label: "Email Templates",  category: "reporting" },
  { key: "documents",       label: "Documents",        category: "clinical" },
  { key: "assessments",     label: "Assessments",      category: "clinical" },
  { key: "recommendations", label: "Recommendations",  category: "clinical" },
  { key: "employees",       label: "Employees",        category: "admin" },
  { key: "ai_agents",       label: "AI Agents",        category: "admin" },
  { key: "app_analytics",   label: "App Analytics",    category: "admin" },
  { key: "org_dashboard",   label: "My Organization",  category: "admin" },
  // Client Detail sections
  { key: "client_details",        label: "Client Details",      category: "client_detail" },
  { key: "client_onboarding",     label: "Onboarding",          category: "client_detail" },
  { key: "client_intake_packet",  label: "Intake Packet",       category: "client_detail" },
  { key: "client_applications",   label: "Applications",        category: "client_detail" },
  { key: "client_ai_job_search",  label: "AI Job Search",       category: "client_detail" },
  { key: "client_interview_prep", label: "Interview Prep",      category: "client_detail" },
  { key: "client_assessments",    label: "Assessments",         category: "client_detail" },
  { key: "client_documents",      label: "Documents",           category: "client_detail" },
  { key: "client_tasks",          label: "Tasks",               category: "client_detail" },
  { key: "client_time",           label: "Time / Job Supports", category: "client_detail" },
  { key: "client_activity",       label: "Activity",            category: "client_detail" },
  { key: "client_assistant",      label: "Assistant",           category: "client_detail" },
  { key: "client_portal",         label: "Client Portal",       category: "client_detail" },
  { key: "client_send_email",     label: "Send Email",          category: "client_detail" },
  { key: "client_test_onet",      label: "Test O*NET",          category: "client_detail" },
  { key: "client_add_actions",    label: "Add Actions",         category: "client_detail" },
];

// Client-facing portal feature definitions — used by FeaturePermissions client section
export const CLIENT_PORTAL_FEATURE_DEFINITIONS = [
  // General portal tabs — applicable to client, pre_ets, dspd
  { key: "client_portal_intake_forms",    label: "Intake Forms",    category: "general_client_portal" },
  { key: "client_portal_applications",    label: "Applications",    category: "general_client_portal" },
  { key: "client_portal_recommendations", label: "Recommendations", category: "general_client_portal" },
  { key: "client_portal_tasks",           label: "Tasks",           category: "general_client_portal" },
  { key: "client_portal_documents",       label: "Documents",       category: "general_client_portal" },
  // Pre-ETS specific tabs
  { key: "client_portal_clock_in_out",        label: "Clock In/Out",          category: "pre_ets_portal" },
  { key: "client_portal_program_checklist",   label: "Program Checklist",     category: "pre_ets_portal" },
  { key: "client_portal_iep_transition_plan", label: "IEP & Transition Plan", category: "pre_ets_portal" },
  { key: "client_portal_skills_exploration",  label: "Skills Exploration",    category: "pre_ets_portal" },
  { key: "client_portal_assessments",         label: "Assessments",           category: "pre_ets_portal" },
  { key: "client_portal_wble_forms",          label: "WBLE Forms",            category: "pre_ets_portal" },
  { key: "client_portal_meetings",            label: "Meetings",              category: "pre_ets_portal" },
];

export const CATEGORY_LABELS = {
  core:                  "Core",
  clients:               "Clients",
  client_categories:     "Client Categories",
  reporting:             "Reporting",
  clinical:              "Clinical",
  admin:                 "Admin",
  client_detail:         "Client Detail Sections & Actions",
  general_client_portal: "General Client Portal Tabs",
  pre_ets_portal:        "Pre-ETS Client Portal Tabs",
};

// Which client roles apply to which portal feature categories
export const CLIENT_PORTAL_ROLE_SCOPE = {
  general_client_portal: ["client", "pre_ets", "dspd"],
  pre_ets_portal:        ["pre_ets"],
};
