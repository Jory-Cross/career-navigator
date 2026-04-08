const SIMPLE_TYPES = [
  "end_of_month_reporting",
  "admin_time",
  "miscellaneous",
  "pre_ets_training",
  "wsa",
  "work_based_learning",
];

const VOC_REHAB_TYPES = [
  "job_coaching",
  "job_development",
  "usor96",
];

export function validateEntryForm(entryTypeCode, formData, schema = []) {
  if (!formData) return "Form data is missing.";

  if (SIMPLE_TYPES.includes(entryTypeCode)) {
    if (!formData.date) return "Date is required.";
    if (!formData.description?.trim()) return "Description is required.";

    const hasDuration = !!formData.duration;
    const hasStartStop = !!formData.start_time && !!formData.end_time;

    if (!hasDuration && !hasStartStop) {
      return "Enter either duration or start and end times.";
    }
  }

  if (entryTypeCode === "life_skills" || entryTypeCode === "csb_hours") {
    if (!formData.billable_service_date) return "Billable Service Date is required.";
    if (!formData.billable_hours) return "Billable Hours is required.";
    if (!formData.activity_description?.trim()) return "Activity Description is required.";
  }

  if (VOC_REHAB_TYPES.includes(entryTypeCode)) {
    // For voc_rehab types, validate required fields from schema
    if (schema && schema.length > 0) {
      for (const field of schema) {
        if (field.required) {
          const value = formData[field.key];
          if (!value || (typeof value === "string" && !value.trim())) {
            return `${field.label} is required.`;
          }
        }
      }
    } else {
      // Fallback validation if schema not provided
      if (!formData.date) return "Date is required.";
      if (!formData.hours) return "Hours is required.";
    }
  }

  return null;
}