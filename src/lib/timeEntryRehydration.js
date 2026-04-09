/**
 * Rehydrate an existing time entry into formData shape
 * Supports both legacy (data/form_data) and new schema structures
 */
const DATE_FIELD_MAP = [
  "jc_date",
  "development_date",
  "billable_service_date",
];

export function buildFormDataFromEntry(entry, schema) {
  const result = {};

  const nestedData =
    (entry.data && typeof entry.data === "object" ? entry.data : null) ||
    (entry.form_data && typeof entry.form_data === "object" ? entry.form_data : null) ||
    {};

  if (schema?.fields) {
    for (const field of schema.fields) {
      const key = field.key;
      if (!key) continue;

      if (field.saveToTopLevel) {
        result[key] = getTopLevelFieldValue(entry, key);
        continue;
      }

      if (nestedData[key] !== undefined) {
        result[key] = nestedData[key];
      }
    }
  }

  result.notes = entry?.notes ?? "";
  result.service_code_id = entry?.service_code_id ?? null;
  result.duration_minutes = normalizeExistingDuration(entry?.duration_minutes);

  // Rehydrate top-level entry.date into the matching schema date field(s)
  if (entry?.date && schema?.fields) {
    const schemaKeys = new Set(schema.fields.map(field => field.key));

    for (const key of DATE_FIELD_MAP) {
      if (schemaKeys.has(key) && result[key] == null) {
        result[key] = entry.date;
      }
    }
  }

  return result;
}

/**
 * If form uses split hours/minutes inputs, derive them from duration_minutes
 */
export function attachSplitDurationFields(formData) {
  const total = Number(formData.duration_minutes || 0);

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

/**
 * Sanity check: ensure rehydrated entry has required fields
 */
export function validateRehydratedFormData(formData, schema) {
  const requiredFields =
    schema?.fields?.filter(field => field.required).map(field => field.key) || [];

  const missing = requiredFields.filter(key => !formData[key]);

  if (missing.length > 0) {
    console.warn("[timeEntryRehydration] Missing required fields on edit:", missing);
  }
}

  return missing.length === 0;
}
