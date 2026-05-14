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
    defaultValue: "07:00",
    saveToTopLevel: true,
  },
  {
    key: "end_time",
    label: "Clock Out",
    type: "time",
    required: true,
    defaultValue: "07:15",
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

const LIFE_SKILLS_SCHEMA = [
  {
    key: "billable_service_date",
    label: "Billable Service Date",
    type: "date",
    required: true,
    isDate: true,
    saveToTopLevel: false,
  },
  {
    key: "billable_hours",
    label: "Billable Hours",
    type: "number",
    required: true,
    isDuration: true,
  },
  {
    key: "life_skills_area",
    label: "Life Skills Area",
    type: "select",
    required: true,
    options: [
      "Personal Hygiene & Grooming",
      "Money Management",
      "Transportation & Mobility",
      "Meal Planning & Food Preparation",
      "Home Management & Cleaning",
      "Health & Wellness",
      "Social & Interpersonal Skills",
      "Communication Skills",
      "Time Management & Organization",
      "Job Readiness & Work Habits",
      "Educational Support",
      "Leisure & Recreation",
      "Community Integration",
      "Safety & Emergency Preparedness",
      "Other",
    ],
  },
  {
    key: "specific_skill_taught",
    label: "Specific Skill Taught",
    type: "text",
    required: true,
  },
  {
    key: "client_progress_mastery_level",
    label: "Client Progress/Mastery Level",
    type: "text",
    required: true,
  },
  {
    key: "practice_homework_assigned",
    label: "Practice/Homework Assigned",
    type: "textarea",
    required: false,
  },
  {
    key: "activity_description",
    label: "Activity Description",
    type: "textarea",
    required: true,
  },
  {
    key: "observations_comments",
    label: "Observations & Comments",
    type: "textarea",
    required: false,
  },
];

const SCHEMA_REGISTRY = {
  simple_time: SIMPLE_TIME_SCHEMA,
  life_skills: LIFE_SKILLS_SCHEMA,
  voc_rehab: [],
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

function toOptionObjects(items) {
  return items.map((item) => {
    if (typeof item === "string") {
      return { value: item, label: item };
    }

    return {
      value: item.value ?? item.code ?? item.id ?? item.label,
      label: item.label ?? item.display_label ?? item.name ?? item.value,
    };
  });
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
 * Fields that are derived from client/org/authorization context and should
 * never appear as staff-editable form fields. They are populated automatically
 * from the linked client record, org settings, or service authorization.
 */
const CONTEXT_DERIVED_FIELD_KEYS = new Set([
  "client_name",
  "client_first_name",
  "client_last_name",
  "authorization_number",
  "auth_number",
  "service_authorization_number",
  "vr_counselor_name",
  "vr_counselor",
  "crp_company_name",
  "crp_name",
  "crp_contact_phone",
  "crp_phone",
  "counselor_name",
  "case_number",
  "vr_case_number",
]);

export async function loadVocRehabSchema(entryTypeCode) {
  try {
    const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
    const { base44 } = await import("@/api/base44Client");

    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: normalizedCode,
      is_active: true,
      is_internal_only: false,
    });

    if (!Array.isArray(templates) || templates.length === 0) {
      console.warn(`[formSchemas] No ReportFieldTemplate found for ${normalizedCode}`);
      return [];
    }

    let serviceCodes = [];
    try {
      serviceCodes = await base44.entities.ServiceCode.filter({
        is_active: true,
        program_type: "vr",
      });
    } catch (error) {
      console.error("[formSchemas] Failed to load service codes:", error);
    }

    const primaryCodes = toOptionObjects(
      (serviceCodes || [])
        .filter((code) => code.is_primary)
        .map((code) => ({
          value: code.code,
          label: code.display_label || code.code,
        }))
    );

    const secondaryCodes = toOptionObjects(
      (serviceCodes || [])
        .filter((code) => code.is_secondary)
        .map((code) => ({
          value: code.code,
          label: code.display_label || code.code,
        }))
    );

    return templates
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .filter((template) => !CONTEXT_DERIVED_FIELD_KEYS.has(String(template.field_key || "").toLowerCase()))
      .map((template) => {
        const fieldKey = template.field_key || "";
        const fieldKeyLower = String(fieldKey).toLowerCase();

        let options = Array.isArray(template.options)
          ? toOptionObjects(template.options)
          : [];

        if (fieldKeyLower.includes("primary_service_code") && primaryCodes.length > 0) {
          options = primaryCodes;
        } else if (
          fieldKeyLower.includes("secondary_service_code") &&
          secondaryCodes.length > 0
        ) {
          options = secondaryCodes;
        }

        return {
          key: fieldKey,
          label: template.label,
          type: template.field_type,
          required: Boolean(template.is_required),
          placeholder: template.placeholder || "",
          help_text: template.help_text || "",
          options,
        };
      });
  } catch (error) {
    console.error("[formSchemas] Failed to load voc rehab schema:", error);
    return [];
  }
}

export function getSchemaKeyForEntryType(entryTypeCode) {
  const normalized = normalizeEntryTypeCode(entryTypeCode);
  return ENTRY_TYPE_TO_SCHEMA_KEY[normalized] || normalized || "";
}

export function hasStaticSchema(schemaKeyOrEntryType) {
  return getSchema(schemaKeyOrEntryType).length > 0;
}

export const FORM_SCHEMAS = {
  simple_time: cloneSchema(SIMPLE_TIME_SCHEMA),
  life_skills: cloneSchema(LIFE_SKILLS_SCHEMA),
  voc_rehab: [],
};

export const SIMPLE_TIME_FIELDS = cloneSchema(SIMPLE_TIME_SCHEMA);
export const LIFE_SKILLS_FIELDS = cloneSchema(LIFE_SKILLS_SCHEMA);