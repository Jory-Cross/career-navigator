/**
 * Shared schema registry for time-entry forms.
 *
 * Phase 4 cleanup goals:
 * - keep schema lookup predictable
 * - preserve current working behavior
 * - make callers independent from ad-hoc schema branching
 * - centralize simple schema definitions here
 */

import { normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";

const SIMPLE_TIME_SCHEMA = [
  {
    key: "date",
    label: "Date",
    type: "date",
    required: true,
    isDate: true,
    saveToTopLevel: true,
  },
  {
    key: "start_time",
    label: "Clock In",
    type: "time",
    required: true,
    saveToTopLevel: true,
  },
  {
    key: "end_time",
    label: "Clock Out",
    type: "time",
    required: true,
    saveToTopLevel: true,
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: false,
    placeholder: "Enter details...",
    saveToTopLevel: true,
  },
];

const LIFE_SKILLS_AREAS = [
  { value: "communication", label: "Communication" },
  { value: "social_skills", label: "Social Skills" },
  { value: "problem_solving", label: "Problem Solving" },
  { value: "time_management", label: "Time Management" },
  { value: "money_management", label: "Money Management" },
  { value: "transportation", label: "Transportation" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "community_access", label: "Community Access" },
  { value: "self_advocacy", label: "Self-Advocacy" },
  { value: "job_readiness", label: "Job Readiness" },
  { value: "independent_living", label: "Independent Living" },
  { value: "other", label: "Other" },
];

const LIFE_SKILLS_SCHEMA = [
  {
    key: "billable_service_date",
    label: "Date",
    type: "date",
    required: true,
    isDate: true,
    saveToTopLevel: false,
  },
  {
    key: "hours_spent",
    label: "Hours Spent",
    type: "number",
    required: true,
    placeholder: "e.g. 1.5",
    isDuration: true,
  },
  {
    key: "life_skills_area",
    label: "Life Skills Area",
    type: "select",
    required: false,
    options: LIFE_SKILLS_AREAS,
  },
  {
    key: "activity",
    label: "Activity",
    type: "textarea",
    required: true,
    placeholder: "What was worked on?",
  },
  {
    key: "observations",
    label: "Observations",
    type: "textarea",
    required: false,
    placeholder: "Observations or progress notes",
  },
  {
    key: "comments",
    label: "Comments",
    type: "textarea",
    required: false,
    placeholder: "Additional comments",
  },
];

const EMPTY_SCHEMA = [];

const SCHEMA_REGISTRY = {
  simple_time: SIMPLE_TIME_SCHEMA,
  life_skills: LIFE_SKILLS_SCHEMA,

  // voc_rehab is loaded dynamically elsewhere through loadVocRehabSchema()
  voc_rehab: EMPTY_SCHEMA,
};

const ENTRY_TYPE_TO_SCHEMA_KEY = {
  job_coaching: "voc_rehab",
  job_development: "voc_rehab",
  usor96: "voc_rehab",

  life_skills: "life_skills",
  csb_hours: "life_skills",

  admin_time: "simple_time",
  miscellaneous: "simple_time",
  pre_ets_training: "simple_time",
  wsa: "simple_time",
  end_of_month_reporting: "simple_time",
  work_based_learning: "simple_time",
};

function cloneSchema(schema) {
  return Array.isArray(schema) ? schema.map((field) => ({ ...field })) : [];
}

export function getSchema(schemaKeyOrEntryType) {
  if (!schemaKeyOrEntryType) return [];

  const normalized = normalizeEntryTypeCode(schemaKeyOrEntryType);
  const resolvedKey =
    SCHEMA_REGISTRY[normalized] !== undefined
      ? normalized
      : ENTRY_TYPE_TO_SCHEMA_KEY[normalized] || normalized;

  return cloneSchema(SCHEMA_REGISTRY[resolvedKey] || []);
}

/**
 * Dynamic Voc Rehab schema loader.
 * Callers already use this for job coaching / job development style forms.
 * For non-voc-rehab entry types, it safely falls back to static schema lookup.
 */
export async function loadVocRehabSchema(entryTypeCode) {
  const normalized = normalizeEntryTypeCode(entryTypeCode);

  if (
    normalized === "job_coaching" ||
    normalized === "job_development" ||
    normalized === "usor96"
  ) {
    try {
      const mod = await import("@/lib/loadVocRehabSchema");
      if (typeof mod.loadVocRehabSchema === "function") {
        return await mod.loadVocRehabSchema(normalized);
      }
    } catch (error) {
      console.error("[formSchemas] Failed to load dynamic voc rehab schema:", error);
      return [];
    }
  }

  return getSchema(normalized);
}

export function getSchemaKeyForEntryType(entryTypeCode) {
  const normalized = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_TO_SCHEMA_KEY[normalized] || normalized || "";
}

export function hasStaticSchema(schemaKeyOrEntryType) {
  return getSchema(schemaKeyOrEntryType).length > 0;
}

export const SIMPLE_TIME_FIELDS = cloneSchema(SIMPLE_TIME_SCHEMA);
export const LIFE_SKILLS_FIELDS = cloneSchema(LIFE_SKILLS_SCHEMA);
