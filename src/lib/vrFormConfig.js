// VR Entry Type Field Configurations
// Maps entry types to their required/optional structured fields

export const VR_ENTRY_TYPES = {
  job_development: {
    name: "Job Development",
    code: "job_development",
    description: "Employer contacts, job leads, placement activities (USOR96)",
    usor_form: "USOR 96",
    color: "#3B82F6",
    fields: [
      {
        key: "jd_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core",
        pdf_context: "repeating_row"
      },
      {
        key: "jd_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        pdf_context: "repeating_row",
        step: "0.25"
      },
      {
        key: "jd_activity",
        label: "JD Activity",
        type: "textarea",
        required: true,
        section: "Activity",
        pdf_context: "repeating_row",
        placeholder: "Describe the job development activity"
      },
      {
        key: "jd_outcome",
        label: "Outcome",
        type: "select",
        options: ["Job Offer Extended", "Interview Scheduled", "Possible Interest", "Not Interested", "Other"],
        required: true,
        section: "Outcome",
        pdf_context: "repeating_row"
      },
      {
        key: "jd_next_steps",
        label: "Next Steps",
        type: "textarea",
        required: false,
        section: "Outcome",
        pdf_context: "repeating_row"
      },
      {
        key: "jd_barrier_to_cie",
        label: "Barrier to CIE",
        type: "boolean",
        required: false,
        section: "Notes",
        pdf_context: "summary_field"
      },
      {
        key: "jd_barrier_description",
        label: "Barrier Description",
        type: "textarea",
        required: false,
        section: "Notes",
        pdf_context: "summary_field",
        conditional_key: "jd_barrier_to_cie"
      },
      {
        key: "jd_internal_notes",
        label: "Internal Notes (not on report)",
        type: "textarea",
        required: false,
        section: "Internal",
        pdf_context: "none"
      }
    ]
  },
  job_coaching: {
    name: "Job Coaching",
    code: "job_coaching",
    description: "On-site job coaching and support (USOR95)",
    usor_form: "USOR 95",
    color: "#8B5CF6",
    fields: [
      {
        key: "jc_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core",
        pdf_context: "repeating_row"
      },
      {
        key: "jc_job_coach_name",
        label: "Job Coach Name",
        type: "text",
        required: true,
        section: "Core",
        pdf_context: "repeating_row"
      },
      {
        key: "jc_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        pdf_context: "repeating_row",
        step: "0.25"
      },
      {
        key: "jc_employer_name",
        label: "Employer Name",
        type: "text",
        required: false,
        section: "Work Site",
        pdf_context: "repeating_row"
      },
      {
        key: "jc_primary_service_code",
        label: "Primary Service Code",
        type: "select",
        options: [
          { value: "1", label: "1 - Attend employer training (client and job coach)" },
          { value: "2", label: "2 - Meet with worksite sups and natural supports" },
          { value: "3", label: "3 - Review, train, teach essential job duties with client" },
          { value: "4", label: "4 - Provide individualized training for learning job tasks" },
          { value: "5", label: "5 - Perform onsite follow-up checks with client" },
          { value: "6", label: "6 - Provide direct interventions on the job" },
          { value: "7", label: "7 - Identify and set up accommodations (employer & VR)" },
          { value: "8", label: "8 - Build and coordinate natural supports for continued work success" },
          { value: "9", label: "9 - Shadow and observe client while on worksite" },
          { value: "10", label: "10 - Develop and implement support plan after job coach fades" },
          { value: "11", label: "11 - Develop work culture skills (breaks, sick days, etc.)" },
          { value: "12", label: "12 - Develop work conditioning and hardening" },
          { value: "13", label: "13 - Provide support and encouragement" },
          { value: "14", label: "14 - Provide other support approved in advance by VR" },
          { value: "15", label: "15 - Provide transportation training" }
        ],
        required: true,
        section: "Service Codes",
        pdf_context: "repeating_row"
      },
      {
        key: "jc_secondary_service_code",
        label: "Secondary Service Code (optional)",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "1", label: "1 - Attend employer training (client and job coach)" },
          { value: "2", label: "2 - Meet with worksite sups and natural supports" },
          { value: "3", label: "3 - Review, train, teach essential job duties with client" },
          { value: "4", label: "4 - Provide individualized training for learning job tasks" },
          { value: "5", label: "5 - Perform onsite follow-up checks with client" },
          { value: "6", label: "6 - Provide direct interventions on the job" },
          { value: "7", label: "7 - Identify and set up accommodations (employer & VR)" },
          { value: "8", label: "8 - Build and coordinate natural supports for continued work success" },
          { value: "9", label: "9 - Shadow and observe client while on worksite" },
          { value: "10", label: "10 - Develop and implement support plan after job coach fades" },
          { value: "11", label: "11 - Develop work culture skills (breaks, sick days, etc.)" },
          { value: "12", label: "12 - Develop work conditioning and hardening" },
          { value: "13", label: "13 - Provide support and encouragement" },
          { value: "14", label: "14 - Provide other support approved in advance by VR" },
          { value: "15", label: "15 - Provide transportation training" }
        ],
        required: false,
        section: "Service Codes",
        pdf_context: "repeating_row"
      },
      {
        key: "jc_total_client_hours_worked",
        label: "Total Client Hours Worked (for period)",
        type: "number",
        required: false,
        section: "Calculations",
        pdf_context: "header_field",
        step: "0.25"
      },
      {
        key: "jc_internal_notes",
        label: "Internal Notes (not on report)",
        type: "textarea",
        required: false,
        section: "Internal",
        pdf_context: "none"
      }
    ]
  },
  life_skills: {
    name: "Life Skills",
    code: "life_skills",
    description: "Life skills training and development (USOR148)",
    usor_form: "USOR 148",
    color: "#EC4899",
    fields: [
      {
        key: "billable_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core",
        pdf_context: "repeating_row"
      },
      {
        key: "billable_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        pdf_context: "repeating_row",
        step: "0.25"
      },
      {
        key: "billable_activity",
        label: "Activity",
        type: "textarea",
        required: true,
        section: "Service",
        pdf_context: "repeating_row",
        placeholder: "Describe the life skills activity"
      },
      {
        key: "billable_observations",
        label: "CRP Observations and Comments",
        type: "textarea",
        required: false,
        section: "Service",
        pdf_context: "repeating_row",
        placeholder: "Observations about client participation and progress"
      },
      {
        key: "billable_summary",
        label: "Summary: Overall Information",
        type: "textarea",
        required: false,
        section: "Summary",
        pdf_context: "summary_field",
        placeholder: "Summary of services provided and outcomes"
      },
      {
        key: "billable_internal_notes",
        label: "Internal Notes (not on report)",
        type: "textarea",
        required: false,
        section: "Internal",
        pdf_context: "none"
      }
    ]
  },
  csb_hours: {
    name: "CSB Hours",
    code: "csb_hours",
    description: "Community Services Board hours (USOR148)",
    usor_form: "USOR 148",
    color: "#F59E0B",
    fields: [
      {
        key: "csb_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core",
        pdf_context: "repeating_row"
      },
      {
        key: "csb_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        pdf_context: "repeating_row",
        step: "0.25"
      },
      {
        key: "csb_activity",
        label: "Activity",
        type: "textarea",
        required: true,
        section: "Service",
        pdf_context: "repeating_row"
      },
      {
        key: "csb_observations",
        label: "Observations and Comments",
        type: "textarea",
        required: false,
        section: "Service",
        pdf_context: "repeating_row"
      },
      {
        key: "csb_service_setting",
        label: "Service Setting (internal)",
        type: "select",
        options: ["Community-Based", "Home", "School", "Work Site", "Virtual"],
        required: false,
        section: "Internal",
        pdf_context: "none"
      },
      {
        key: "csb_group_or_individual",
        label: "Group or Individual (internal)",
        type: "select",
        options: ["Individual", "Group"],
        required: false,
        section: "Internal",
        pdf_context: "none"
      },
      {
        key: "csb_internal_notes",
        label: "Internal Notes (not on report)",
        type: "textarea",
        required: false,
        section: "Internal",
        pdf_context: "none"
      }
    ]
  },
  pre_ets: {
    name: "Pre-ETS",
    code: "pre_ets",
    description: "Pre-Employment Transition Services (internal only)",
    usor_form: null,
    color: "#10B981",
    fields: [
      {
        key: "preets_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core"
      },
      {
        key: "preets_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        step: "0.25"
      },
      {
        key: "preets_service_category",
        label: "Service Category",
        type: "select",
        options: ["Job Exploration", "Workplace Readiness", "Work-Based Learning", "Counseling", "Work Incentive Planning", "Other"],
        required: true,
        section: "Service"
      },
      {
        key: "preets_activity",
        label: "Activity",
        type: "textarea",
        required: true,
        section: "Service"
      },
      {
        key: "preets_skills_addressed",
        label: "Skills Addressed",
        type: "textarea",
        required: false,
        section: "Service"
      },
      {
        key: "preets_student_participation",
        label: "Student Participation",
        type: "select",
        options: ["Full", "Partial", "Minimal", "Observation"],
        required: true,
        section: "Participation"
      },
      {
        key: "preets_progress",
        label: "Progress",
        type: "textarea",
        required: false,
        section: "Outcomes"
      },
      {
        key: "preets_barriers",
        label: "Barriers",
        type: "textarea",
        required: false,
        section: "Challenges"
      },
      {
        key: "preets_supports_provided",
        label: "Supports Provided",
        type: "textarea",
        required: false,
        section: "Support"
      },
      {
        key: "preets_next_steps",
        label: "Next Steps",
        type: "textarea",
        required: false,
        section: "Planning"
      }
    ]
  },
  wsa: {
    name: "WSA",
    code: "wsa",
    description: "Work Study Assessment (internal only)",
    usor_form: null,
    color: "#06B6D4",
    fields: [
      {
        key: "wsa_date",
        label: "Service Date",
        type: "date",
        required: true,
        section: "Core"
      },
      {
        key: "wsa_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        step: "0.25"
      },
      {
        key: "wsa_worksite",
        label: "Worksite",
        type: "text",
        required: true,
        section: "Work Site"
      },
      {
        key: "wsa_supervisor",
        label: "Supervisor Name",
        type: "text",
        required: false,
        section: "Work Site"
      },
      {
        key: "wsa_tasks_completed",
        label: "Tasks Completed",
        type: "textarea",
        required: true,
        section: "Activity"
      },
      {
        key: "wsa_supports_provided",
        label: "Supports Provided",
        type: "textarea",
        required: false,
        section: "Support"
      },
      {
        key: "wsa_progress",
        label: "Progress",
        type: "textarea",
        required: false,
        section: "Outcomes"
      },
      {
        key: "wsa_issues",
        label: "Issues or Concerns",
        type: "textarea",
        required: false,
        section: "Challenges"
      },
      {
        key: "wsa_next_steps",
        label: "Next Steps",
        type: "textarea",
        required: false,
        section: "Planning"
      }
    ]
  },
  admin_time: {
    name: "Admin Time",
    code: "admin_time",
    description: "Administrative and documentation time (internal only)",
    usor_form: null,
    color: "#6B7280",
    fields: [
      {
        key: "admin_date",
        label: "Date",
        type: "date",
        required: true,
        section: "Core"
      },
      {
        key: "admin_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        step: "0.25"
      },
      {
        key: "admin_category",
        label: "Category",
        type: "select",
        options: ["Documentation", "Training", "Supervision", "Team Meeting", "Planning", "Other"],
        required: true,
        section: "Details"
      },
      {
        key: "admin_description",
        label: "Description",
        type: "textarea",
        required: true,
        section: "Details"
      },
      {
        key: "admin_related_client_id",
        label: "Related Client (if applicable)",
        type: "text",
        required: false,
        section: "Details"
      },
      {
        key: "admin_billable",
        label: "Billable",
        type: "boolean",
        required: false,
        section: "Billing"
      },
      {
        key: "admin_payroll",
        label: "Payroll Flag",
        type: "boolean",
        required: false,
        section: "Billing"
      }
    ]
  },
  eom_reporting: {
    name: "EOM Reporting",
    code: "eom_reporting",
    description: "End-of-month summary (internal only)",
    usor_form: null,
    color: "#8B5CF6",
    fields: [
      {
        key: "eom_month",
        label: "Reporting Month",
        type: "date",
        required: true,
        section: "Period"
      },
      {
        key: "eom_total_hours",
        label: "Total Hours (auto-calculated)",
        type: "number",
        required: false,
        section: "Summary",
        read_only: true
      },
      {
        key: "eom_services_provided",
        label: "Services Provided Summary",
        type: "textarea",
        required: true,
        section: "Summary"
      },
      {
        key: "eom_progress",
        label: "Progress Toward Goals",
        type: "textarea",
        required: true,
        section: "Summary"
      },
      {
        key: "eom_barriers",
        label: "Barriers",
        type: "textarea",
        required: false,
        section: "Summary"
      },
      {
        key: "eom_outcomes",
        label: "Outcomes Achieved",
        type: "textarea",
        required: false,
        section: "Summary"
      },
      {
        key: "eom_recommendations",
        label: "Recommendations",
        type: "textarea",
        required: false,
        section: "Summary"
      }
    ]
  },
  misc: {
    name: "Misc",
    code: "misc",
    description: "Miscellaneous activities (internal only)",
    usor_form: null,
    color: "#9CA3AF",
    fields: [
      {
        key: "misc_date",
        label: "Date",
        type: "date",
        required: true,
        section: "Core"
      },
      {
        key: "misc_hours",
        label: "Hours",
        type: "number",
        required: true,
        section: "Core",
        step: "0.25"
      },
      {
        key: "misc_activity_type",
        label: "Activity Type",
        type: "text",
        required: true,
        section: "Details"
      },
      {
        key: "misc_description",
        label: "Description",
        type: "textarea",
        required: true,
        section: "Details"
      },
      {
        key: "misc_related_client_id",
        label: "Related Client (if applicable)",
        type: "text",
        required: false,
        section: "Details"
      },
      {
        key: "misc_outcome",
        label: "Outcome",
        type: "textarea",
        required: false,
        section: "Outcome"
      }
    ]
  }
};

export const COMMON_HEADER_FIELDS = {
  client_name: { label: "Client Name", source: "client.full_name" },
  authorization_number: { label: "Authorization Number", source: "authorization.number" },
  vr_counselor: { label: "VR Counselor", source: "counselor.full_name" },
  job_goal: { label: "Job Goal", source: "client.target_role" },
  crp_company: { label: "CRP Company", source: "crp.company_name" },
  crp_phone: { label: "CRP Phone", source: "crp.phone" },
  month_year: { label: "Month/Year", source: "report.month_year" },
  completion_date: { label: "Completion Date", source: "report.completion_date" },
  preferred_contact_number: { label: "Preferred Contact Number", source: "client.phone" },
  counselor_email: { label: "Counselor Email", source: "counselor.email" },
  requesting_counselor_contact: { label: "Requesting Counselor Contact", source: "report.requesting_counselor_contact" },
  crp_signature: { label: "CRP Signature", source: "report.crp_signature" },
  signature_date: { label: "Signature Date", source: "report.signature_date" }
};

export const CALCULATED_FIELDS = {
  total_development_hours: { label: "Total Development Hours", formula: "sum(jd_hours)" },
  coaching_hours: { label: "Total Coaching Hours", formula: "sum(jc_hours)" },
  total_billable_hours: { label: "Total Billable Hours", formula: "sum(billable_hours + csb_hours)" },
  hours_used: { label: "Hours Used", formula: "authorization.hours_used" },
  hours_remaining: { label: "Hours Remaining", formula: "authorization.total - sum(hours_used)" },
  total_client_hours_worked: { label: "Total Client Hours Worked", formula: "sum(jc_total_client_hours_worked)" },
  ratio_percentage: { label: "Coaching Ratio %", formula: "(coaching_hours / total_client_hours_worked) * 100" }
};