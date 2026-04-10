/**
 * Entry Type Registry (CLEANED)
 * - Removed: usor96, work_based_learning
 * - Keeps only canonical types you actually use
 */

const CANONICAL_ENTRY_TYPES = {
  job_coaching: {
    code: "job_coaching",
    label: "Job Coaching",
  },
  job_development: {
    code: "job_development",
    label: "Job Development",
  },
  life_skills: {
    code: "life_skills",
    label: "Life Skills",
  },
  csb_hours: {
    code: "csb_hours",
    label: "CSB Hours",
  },
  admin_time: {
    code: "admin_time",
    label: "Admin Time",
  },
  miscellaneous: {
    code: "miscellaneous",
    label: "Miscellaneous",
  },
  end_of_month_reporting: {
    code: "end_of_month_reporting",
    label: "End-of-Month Reporting",
  },
  pre_ets_training: {
    code: "pre_ets_training",
    label: "Pre-ETS",
  },
  wsa: {
    code: "wsa",
    label: "WSA",
  },
};

const ENTRY_TYPE_ALIASES = {
  job_coaching: "job_coaching",
  job_development: "job_development",
  life_skills: "life_skills",
  csb_hours: "csb_hours",
  admin_time: "admin_time",
  miscellaneous: "miscellaneous",
  end_of_month_reporting: "end_of_month_reporting",
  pre_ets_training: "pre_ets_training",
  wsa: "wsa",

  // legacy mappings (still supported silently)
  misc: "miscellaneous",
  pre_ets: "pre_ets_training",
  eom_reporting: "end_of_month_reporting",

  // remove these from UI but still map safely if old data exists
  usor96: "job_development",
  work_based_learning: "pre_ets_training",
  wble: "pre_ets_training",
  work_based_learning_experience: "pre_ets_training",
};

export const ENTRY_TYPE_REGISTRY = Object.fromEntries(
  Object.entries(ENTRY_TYPE_ALIASES).map(([alias, canonical]) => [
    alias,
    CANONICAL_ENTRY_TYPES[canonical],
  ])
);

export function normalizeEntryTypeCode(entryTypeCode) {
  if (!entryTypeCode) return "";
  return ENTRY_TYPE_ALIASES[entryTypeCode] || entryTypeCode;
}

export function getEntryTypeConfig(entryTypeCode) {
  const normalized = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_REGISTRY[normalized] || null;
}

export function getEntryTypeOptions() {
  return Object.values(CANONICAL_ENTRY_TYPES).map((item) => ({
    value: item.code,
    label: item.label,
  }));
}
