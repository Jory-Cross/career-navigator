/**
 * Rehydrate an existing time entry into formData shape
 * Supports both legacy (data/form_data) and new schema structures
 *
 * Fix:
 * - always restores top-level entry.date into whatever date field the schema uses
 * - fixes simple_time edit forms where the schema key is literally "date"
 * - preserves the earlier Voc Rehab date mappings too
 */

const DATE_FIELD_MAP = [
  "date",
  "jc_date",
  "development_date",
  "billable_service_date",
  "service_date",
  "entry_date",
  "preets_date",
  "wsa_date",
  "admin_date",
  "misc_date",
  "eom_month",
];

export function buildFormDataFromEntry(entry, schema) {
  const result = {};

  const fields = Array.isArray(schema?.fields)
    ? schema.fields
    : Array.isArray(schema)
      ? schema
      : [];

  const nestedData =
    (entry?.data && typeof entry.data === "object" ? entry.data : null) ||
    (entry?.form_data && typeof entry.form_data === "object" ? entry.form_data : null) ||
    {};

  // 1) First hydrate fields from schema + nested form data
  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    if (field.saveToTopLevel) {
      result[key] = getTopLevelFieldValue(entry, key);
      continue;
    }

    if (nestedData[key] !== undefined) {
      result[key] = nestedData[key];
    }
  }

  // 2) Always restore common top-level values
  result.notes = entry?.notes ?? "";
  result.service_code_id = entry?.service_code_id ?? null;
  result.duration_minutes = normalizeExistingDuration(entry?.duration_minutes);

  // 3) Rehydrate top-level entry.date into matching schema date field(s)
  if (entry?.date && fields.length) {
    const normalizedDate = normalizeDateForInput(entry.date);
    const schemaKeys = new Set(fields.map((field) => field?.key).filter(Boolean));

    for (const key of DATE_FIELD_MAP) {
      if (schemaKeys.has(key) && isEmpty(result[key])) {
        result[key] = normalizedDate;
      }
    }

    // fallback: any field that looks like a date field
    for (const field of fields) {
      const key = field?.key;
      if (!key) continue;

      const looksLikeDateField =
        field?.isDate === true ||
        String(field?.type || "").toLowerCase() === "date" ||
        String(key).toLowerCase().includes("date") ||
        String(field?.label || "").toLowerCase().includes("date");

      if (looksLikeDateField && isEmpty(result[key])) {
        result[key] = normalizedDate;
      }
    }
  }

  // 4) Rehydrate simple top-level clock fields for simple_time edit flows
  if (entry?.start_time && hasField(fields, "start_time") && isEmpty(result.start_time)) {
    result.start_time = normalizeTimeForSelect(entry.start_time);
  }

  if (entry?.end_time && hasField(fields, "end_time") && isEmpty(result.end_time)) {
    result.end_time = normalizeTimeForSelect(entry.end_time);
  }

  // 5) Rehydrate top-level description/location when not present in nested data
  if (entry?.description && hasField(fields, "description") && isEmpty(result.description)) {
    result.description = entry.description;
  }

  if (entry?.location && hasField(fields, "location") && isEmpty(result.location)) {
    result.location = entry.location;
  }

  return result;
}

/**
 * If form uses split hours/minutes inputs, derive them from duration_minutes
 */
export function attachSplitDurationFields(formData) {
  const total = Number(formData?.duration_minutes || 0);

  return {
    ...formData,
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

/**
 * Get a top-level field value from entry (e.g., client_id, location)
 */
function getTopLevelFieldValue(entry, key) {
  return entry?.[key] ?? null;
}

/**
 * Normalize duration from various input formats to minutes (number)
 */
function normalizeExistingDuration(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function hasField(fields, key) {
  return fields.some((field) => field?.key === key);
}

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

function normalizeDateForInput(value) {
  if (!value) return "";

  // already yyyy-mm-dd
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // mm/dd/yyyy -> yyyy-mm-dd
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [mm, dd, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  // ISO datetime -> yyyy-mm-dd
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return String(value);
}

function normalizeTimeForSelect(value) {
  if (!value) return "";

  const raw = String(value).trim();

  // already HH:mm
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  // HH:mm:ss -> HH:mm
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5);
  }

  // h:mm AM/PM -> HH:mm
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();

    if (ampm === "AM") {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  return raw;
}

/**
 * Sanity check: ensure rehydrated entry has required fields
 */
export function validateRehydratedFormData(formData, schema) {
  const requiredFields =
    schema?.fields?.filter((field) => field.required).map((field) => field.key) || [];

  const missing = requiredFields.filter((key) => !formData[key]);

  if (missing.length > 0) {
    console.warn("[timeEntryRehydration] Missing required fields on edit:", missing);
  }
}
