/**
 * Feature permission keys — single source of truth.
 * Add new keys here to extend the permission system.
 * Admin users always see everything regardless of permissions.
 */

export const FEATURE_KEYS = {
  DASHBOARD:      "dashboard",
  CLIENTS:        "clients",
  TIME_TRACKING:  "time_tracking",
  CALENDAR:       "calendar",
  REPORTS:        "reports",
  TASKS:          "tasks",
  EMAIL_TEMPLATES:"email_templates",
  DOCUMENTS:      "documents",
  ASSESSMENTS:    "assessments",
  RECOMMENDATIONS:"recommendations",
  AI_AGENTS:      "ai_agents",
  APP_ANALYTICS:  "app_analytics",
  ORG_DASHBOARD:  "org_dashboard",
  EMPLOYEES:      "employees",
  PRE_ETS:        "pre_ets",
  DSPD:           "dspd",
};

// Feature metadata used by the admin permissions UI
export const FEATURE_DEFINITIONS = [
  { key: "dashboard",       label: "Dashboard",        category: "core" },
  { key: "clients",         label: "Clients",           category: "client_management" },
  { key: "time_tracking",   label: "Time Tracking",     category: "core" },
  { key: "calendar",        label: "Calendar",          category: "core" },
  { key: "tasks",           label: "Tasks",             category: "core" },
  { key: "reports",         label: "Reports",           category: "reporting" },
  { key: "email_templates", label: "Email Templates",   category: "reporting" },
  { key: "documents",       label: "Documents",         category: "clinical" },
  { key: "assessments",     label: "Assessments",       category: "clinical" },
  { key: "recommendations", label: "Recommendations",   category: "clinical" },
  { key: "pre_ets",         label: "Pre-ETS",           category: "client_management" },
  { key: "dspd",            label: "DSPD",              category: "client_management" },
  { key: "employees",       label: "Employees",         category: "admin" },
  { key: "ai_agents",       label: "AI Agents",         category: "admin" },
  { key: "app_analytics",   label: "App Analytics",     category: "admin" },
  { key: "org_dashboard",   label: "My Organization",   category: "admin" },
];

export const CATEGORY_LABELS = {
  core:              "Core",
  client_management: "Clients / Client Management",
  reporting:         "Reporting",
  clinical:          "Clinical",
  admin:             "Admin",
};