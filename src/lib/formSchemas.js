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

const ADMIN_TIME_SCHEMA = [
  {
    key: "date",
    label: "Date",
    type: "date",
    required: true,
    isDate: true,
    saveToTopLevel: true,
  },
  {
    key: "admin_hours",
    label: "Total Hours",
    type: "number",
    required: true,
    isDuration: true,
    placeholder: "e.g. 1.5",
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

const DSPD_SCHEMA = [
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
    key: "job_coaching",
    label: "Job Coaching",
    type: "textarea",
    required: false,
    placeholder: "Describe job coaching activities...",
  },
  {
    key: "individual_support",
    label: "Individual Support",
    type: "textarea",
    required: false,
    placeholder: "Describe individual support provided...",
  },
  {
    key: "community_outreach",
    label: "Community Outreach",
    type: "textarea",
    required: false,
    placeholder: "Describe community outreach activities...",
  },
  {
    key: "job_application_process",
    label: "Job Application Process",
    type: "textarea",
    required: false,
    placeholder: "Describe job application activities...",
  },
  {
    key: "resume_writing",
    label: "Resume Writing",
    type: "textarea",
    required: false,
    placeholder: "Describe resume writing activities...",
  },
  {
    key: "job_interview_process",
    label: "Job Interview Process",
    type: "textarea",
    required: false,
    placeholder: "Describe job interview preparation or activities...",
  },
];

const SCHEMA_REGISTRY = {
  simple_time: SIMPLE_TIME_SCHEMA,
  admin_time: ADMIN_TIME_SCHEMA,
  life_skills: LIFE_SKILLS_SCHEMA,
  dspd: DSPD_SCHEMA,
  voc_rehab: [],
};

const ENTRY_TYPE_TO_SCHEMA_KEY = {
  job_coaching: "voc_rehab",
  job_development: "voc_rehab",
  usor96: "voc_rehab",
  life_skills: "life_skills",
  csb_hours: "life_skills",
  admin_time: "admin_time",
  miscellaneous: "simple_time",
  pre_ets_training: "simple_time",
  wsa: "simple_time",
  end_of_month_reporting: "simple_time",
  work_based_learning: "simple_time",
  dspd: "dspd",
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

    const matchingEntryTypes = await base44.entities.EntryType.filter({
      code: normalizedCode,
      is_active: true,
    });

    const activeEntryTypes = (Array.isArray(matchingEntryTypes)
      ? matchingEntryTypes
      : []
    ).filter(
      (entryType) =>
        entryType?.is_active !== false &&
        entryType?.is_archived !== true
    );

    if (activeEntryTypes.length !== 1) {
      console.warn(
        `[formSchemas] Expected exactly one active EntryType for ${normalizedCode}; found ${activeEntryTypes.length}.`
      );
      return [];
    }

    const entryType = activeEntryTypes[0];

    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_id: entryType.id,
      entry_type_code: normalizedCode,
      is_active: true,
      is_internal_only: false,
    });

    if (!Array.isArray(templates) || templates.length === 0) {
      console.warn(
        `[formSchemas] No active ReportFieldTemplate found for ${normalizedCode} on EntryType ${entryType.id}.`
      );
      return [];
    }

    let serviceCodes = [];
    try {
      // For job_coaching, fetch ONLY job_coaching service codes.
      // For other VR types (job_development, usor96, etc.), fetch all VR codes.
      const serviceTypeFilter =
        normalizedCode === "job_coaching"
          ? { is_active: true, service_type: "job_coaching" }
          : { is_active: true, program_type: "vr" };

      serviceCodes = await base44.entities.ServiceCode.filter(serviceTypeFilter);
    } catch (error) {
      console.error("[formSchemas] Failed to load service codes:", error);
    }

    // Sort numerically by the number portion of the code (e.g. JC01 < JC02 ... JC15)
    const sortedCodes = (serviceCodes || []).slice().sort((a, b) => {
      const numA = parseInt((String(a.code || "").match(/\d+/) || ["0"])[0], 10);
      const numB = parseInt((String(b.code || "").match(/\d+/) || ["0"])[0], 10);
      return numA - numB;
    });

    const primaryCodes = toOptionObjects(
      sortedCodes
        .filter((code) => code.is_primary)
        .map((code) => ({
          value: code.code,
          label: code.display_label || code.code,
        }))
    );

    const secondaryCodes = toOptionObjects(
      sortedCodes
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
  admin_time: cloneSchema(ADMIN_TIME_SCHEMA),
  life_skills: cloneSchema(LIFE_SKILLS_SCHEMA),
  dspd: cloneSchema(DSPD_SCHEMA),
  voc_rehab: [],
};

export const SIMPLE_TIME_FIELDS = cloneSchema(SIMPLE_TIME_SCHEMA);
export const LIFE_SKILLS_FIELDS = cloneSchema(LIFE_SKILLS_SCHEMA);
export const DSPD_FIELDS = cloneSchema(DSPD_SCHEMA);
