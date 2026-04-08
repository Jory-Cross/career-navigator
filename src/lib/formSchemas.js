export const FORM_SCHEMAS = {
  simple_time: [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "duration", label: "Duration (minutes)", type: "number", required: false },
    { key: "start_time", label: "Start Time", type: "time", required: false },
    { key: "end_time", label: "End Time", type: "time", required: false },
    { key: "description", label: "Description", type: "textarea", required: true },
  ],

  life_skills: [
    { key: "billable_service_date", label: "Billable Service Date", type: "date", required: true },
    { key: "billable_hours", label: "Billable Hours", type: "number", required: true },
    { key: "life_skills_area", label: "Life Skills Area", type: "text", required: true },
    { key: "specific_skill_taught", label: "Specific Skill Taught", type: "text", required: true },
    { key: "client_progress_mastery_level", label: "Client Progress/Mastery Level", type: "text", required: true },
    { key: "practice_homework_assigned", label: "Practice/Homework Assigned", type: "textarea", required: false },
    { key: "activity_description", label: "Activity Description", type: "textarea", required: true },
    { key: "observations_comments", label: "Observations & Comments", type: "textarea", required: false },
  ],

  voc_rehab: [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "hours", label: "Hours", type: "number", required: true },
    { key: "activity", label: "Activity", type: "textarea", required: true },
    { key: "crp", label: "CRP", type: "text", required: false },
    { key: "observations_comments", label: "Observations & Comments", type: "textarea", required: false },
  ],
};

export function getSchema(schemaKey) {
  return FORM_SCHEMAS[schemaKey] || [];
}