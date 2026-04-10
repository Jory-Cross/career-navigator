/**
 * Entry Type Registry
 * SAFE VERSION:
 * - Keeps ALL existing types (so nothing breaks)
 * - ONLY removes 2 from dropdown: usor96 + work_based_learning
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
  usor96: {
    code: "usor96",
    label: "USOR96",
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
  work_based_learning: {
    code: "work_based_learning",
    label: "Work-Based Learning",
  },
};

const ENTRY_TYPE_ALIASES = {
  job_coaching: "job_coaching",
  job_development: "job_development",
  usor96: "usor96",
  life_skills: "life_skills",
  csb_hours: "csb_hours",
  admin_time: "admin_time",
  miscellaneous: "miscellaneous",
  end_of_month_reporting: "end_of_month_reporting",
  pre_ets_training: "pre_ets_training",
  wsa: "wsa",
  work_based_learning: "work_based_learning",

  // legacy support
  misc: "miscellaneous",
  pre_ets: "pre_ets_training",
  eom_reporting: "end_of_month_reporting",
  wble: "work_based_learning",
  work_based_learning_experience: "work_based_learning",
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

/**
 * 🔑 ONLY CHANGE IS HERE
 * Removes 2 options from dropdown WITHOUT removing them from system
 */
export function getEntryTypeOptions() {
  return Object.values(CANONICAL_ENTRY_TYPES)
    .filter(
      (item) =>
        item.code !== "usor96" &&
        item.code !== "work_based_learning"
    )
    .map((item) => ({
      value: item.code,
      label: item.label,
    }));
}
