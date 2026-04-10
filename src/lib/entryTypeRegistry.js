export const ENTRY_TYPE_REGISTRY = {
  job_coaching: {
    code: "job_coaching",
    label: "Job Coaching",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
  },
  job_development: {
    code: "job_development",
    label: "Job Development",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
  },
  usor96: {
    code: "usor96",
    label: "USOR96",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
  },
  life_skills: {
    code: "life_skills",
    label: "Life Skills",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
  },
  csb_hours: {
    code: "csb_hours",
    label: "CSB Hours",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
  },
  end_of_month_reporting: {
    code: "end_of_month_reporting",
    label: "End-of-Month Reporting",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
  },
  admin_time: {
    code: "admin_time",
    label: "Admin Time",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
  },
  miscellaneous: {
    code: "miscellaneous",
    label: "Miscellaneous",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
  },
  pre_ets_training: {
    code: "pre_ets_training",
    label: "Pre-ETS",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
  },
  wsa: {
    code: "wsa",
    label: "WSA",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
  },
  work_based_learning: {
    code: "work_based_learning",
    label: "Work-Based Learning",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
  },
};

export function getEntryTypeConfig(entryTypeCode) {
  return ENTRY_TYPE_REGISTRY[entryTypeCode] || null;
}

export function getEntryTypeOptions() {
  return Object.values(ENTRY_TYPE_REGISTRY)
  .filter(
  (item) =>
    item.code !== "work_based_learning" &&
    item.code !== "usor96"
)
    .map((item) => ({
      value: item.code,
      label: item.label,
    }));
}
