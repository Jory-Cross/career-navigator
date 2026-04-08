const SIMPLE_TYPES = [
  "end_of_month_reporting",
  "admin_time",
  "miscellaneous",
  "pre_ets_training",
  "wsa",
  "work_based_learning",
];

export function validateEntryForm(entryTypeCode, formData) {
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

  if (
    entryTypeCode === "job_coaching" ||
    entryTypeCode === "job_development" ||
    entryTypeCode === "usor96"
  ) {
    if (!formData.date) return "Date is required.";
    if (!formData.hours) return "Hours is required.";
    if (!formData.activity?.trim()) return "Activity is required.";
  }

  return null;
}