export const ENTRY_TYPE_REGISTRY = {
  job_coaching: {
    code: "job_coaching",
    label: "Job Coaching",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
  },
  job_development: {
    code: "job_development",
    label: "Job Development",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
  },
  usor96: {
    code: "usor96",
    label: "USOR96",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: false,
  },
  life_skills: {
    code: "life_skills",
    label: "Life Skills",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
  },
  csb_hours: {
    code: "csb_hours",
    label: "CSB Hours",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
  },
  end_of_month_reporting: {
    code: "end_of_month_reporting",
    label: "End-of-Month Reporting",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
  },
  admin_time: {
    code: "admin_time",
    label: "Admin Time",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
  },
  miscellaneous: {
    code: "miscellaneous",
    label: "Miscellaneous",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
  },
  pre_ets_training: {
    code: "pre_ets_training",
    label: "Pre-ETS",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: true,
  },
  wsa: {
    code: "wsa",
    label: "WSA",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: true,
  },
  work_based_learning: {
    code: "work_based_learning",
    label: "Work-Based Learning",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: false,
  },
};

export const ENTRY_TYPE_ALIASES = {
  pre_ets: "pre_ets_training",
  misc: "miscellaneous",
  eom_reporting: "end_of_month_reporting",
  wble: "work_based_learning",
  work_based_learning_experience: "work_based_learning",
};

export function normalizeEntryTypeCode(entryTypeCode) {
  if (!entryTypeCode) return "";
  return ENTRY_TYPE_ALIASES[entryTypeCode] || entryTypeCode;
}

export function getEntryTypeConfig(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_REGISTRY[normalizedCode] || null;
}

export function getEntryTypeOptions() {
  return Object.values(ENTRY_TYPE_REGISTRY)
    .filter((item) => item.showInDropdown !== false)
    .map((item) => ({
      value: item.code,
      label: item.label,
    }));
}
