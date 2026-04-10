const CANONICAL_ENTRY_TYPES = {
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

const ENTRY_TYPE_ALIASES = {
  // canonical -> canonical
  job_coaching: "job_coaching",
  job_development: "job_development",
  usor96: "usor96",
  life_skills: "life_skills",
  csb_hours: "csb_hours",
  end_of_month_reporting: "end_of_month_reporting",
  admin_time: "admin_time",
  miscellaneous: "miscellaneous",
  pre_ets_training: "pre_ets_training",
  wsa: "wsa",
  work_based_learning: "work_based_learning",

  // legacy / DB / seed aliases
  eom_reporting: "end_of_month_reporting",
  misc: "miscellaneous",
  pre_ets: "pre_ets_training",
  wble: "work_based_learning",
  work_based_learning_experience: "work_based_learning",
};

export const ENTRY_TYPE_REGISTRY = Object.fromEntries(
  Object.entries(CANONICAL_ENTRY_TYPES).flatMap(([key, config]) => {
    const aliasesForKey = Object.entries(ENTRY_TYPE_ALIASES)
      .filter(([, canonicalKey]) => canonicalKey === key)
      .map(([alias]) => alias);

    return aliasesForKey.map((alias) => [alias, config]);
  })
);

export function normalizeEntryTypeCode(entryTypeCode) {
  if (!entryTypeCode) return "";
  return ENTRY_TYPE_ALIASES[entryTypeCode] || entryTypeCode;
}

export function getEntryTypeConfig(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_REGISTRY[normalizedCode] || null;
}

export function getEntryTypeOptions() {
  return Object.values(CANONICAL_ENTRY_TYPES).map((item) => ({
    value: item.code,
    label: item.label,
  }));
}
