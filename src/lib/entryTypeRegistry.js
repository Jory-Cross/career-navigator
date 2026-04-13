const BASE_ENTRY_TYPES = [
  {
    code: "job_coaching",
    label: "Job Coaching",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "job_development",
    label: "Job Development",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "usor96",
    label: "USOR96",
    schemaKey: "voc_rehab",
    category: "structured",
    programType: "vr",
    showInDropdown: false,
    active: true,
    group: "time_entry",
  },
  {
    code: "life_skills",
    label: "Life Skills",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "csb_hours",
    label: "CSB Hours",
    schemaKey: "life_skills",
    category: "structured",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "end_of_month_reporting",
    label: "End-of-Month Reporting",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "admin_time",
    label: "Admin Time",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "miscellaneous",
    label: "Miscellaneous",
    schemaKey: "simple_time",
    category: "simple",
    programType: "internal",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "pre_ets_training",
    label: "Pre-ETS",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "wsa",
    label: "WSA",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: true,
    active: true,
    group: "time_entry",
  },
  {
    code: "work_based_learning",
    label: "Work-Based Learning",
    schemaKey: "simple_time",
    category: "simple",
    programType: "vr",
    showInDropdown: false,
    active: true,
    group: "time_entry",
  },
];

export const ENTRY_TYPE_ALIASES = {
  pre_ets: "pre_ets_training",
  misc: "miscellaneous",
  eom_reporting: "end_of_month_reporting",
  wble: "work_based_learning",
  work_based_learning_experience: "work_based_learning",
};

function dedupeByCode(items) {
  const seen = new Map();

  for (const item of items) {
    if (!item?.code) continue;

    const normalizedCode = String(item.code).trim().toLowerCase();
    if (!seen.has(normalizedCode)) {
      seen.set(normalizedCode, {
        ...item,
        code: normalizedCode,
      });
    }
  }

  return Array.from(seen.values());
}

export const ENTRY_TYPES = dedupeByCode(BASE_ENTRY_TYPES);

export const ENTRY_TYPE_REGISTRY = ENTRY_TYPES.reduce((acc, item) => {
  acc[item.code] = item;
  return acc;
}, {});

export function normalizeEntryTypeCode(entryTypeCode) {
  if (!entryTypeCode) return "";

  const raw = String(entryTypeCode).trim().toLowerCase();
  return ENTRY_TYPE_ALIASES[raw] || raw;
}

export function getEntryTypeConfig(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_REGISTRY[normalizedCode] || null;
}

export function getEntryTypeLabel(entryTypeCode) {
  const config = getEntryTypeConfig(entryTypeCode);
  return config?.label || entryTypeCode || "Unknown";
}

export function getEntryTypeOptions(filters = {}) {
  const {
    includeHidden = false,
    activeOnly = true,
    group = null,
    programType = null,
    category = null,
  } = filters;

  return ENTRY_TYPES.filter((item) => {
    if (!includeHidden && item.showInDropdown === false) return false;
    if (activeOnly && item.active === false) return false;
    if (group && item.group !== group) return false;
    if (programType && item.programType !== programType) return false;
    if (category && item.category !== category) return false;
    return true;
  }).map((item) => ({
    code: item.code,
    value: item.code,
    label: item.label,
    schemaKey: item.schemaKey,
    category: item.category,
    programType: item.programType,
    active: item.active,
    group: item.group,
  }));
}

export function isValidEntryTypeCode(entryTypeCode) {
  return Boolean(getEntryTypeConfig(entryTypeCode));
}
