/**
 * Rehydrate an existing time entry into formData shape
 * Supports both legacy (data/form_data) and new schema structures
 *
 * Phase 4 cleanup:
 * - keeps current behavior
 * - makes edit hydration more predictable
 * - always maps top-level date/time fields back into schema fields
 * - avoids overwriting already-present nested values
 */

const KNOWN_DATE_KEYS = [
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

const KNOWN_TIME_KEYS = {
  start: ["start_time", "startTime", "clock_in", "clockIn"],
  end: ["end_time", "endTime", "clock_out", "clockOut"],
};

const KNOWN_DESCRIPTION_KEYS = [
  "description",
  "activity_description",
  "admin_description",
  "misc_description",
  "preets_activity",
  "wsa_tasks_completed",
  "eom_services_provided",
];

function getSchemaFields(schema) {
  if (Array.isArray(schema?.fields)) return schema.fields;
  if (Array.isArray(schema)) return schema;
  return [];
}

function getNestedEntryData(entry) {
  return (
    (entry?.data && typeof entry.data === "object" ? entry.data : null) ||
    (entry?.form_data && typeof entry.form_data === "object" ? entry.form_data : null) ||
    {}
  );
}

function getTopLevelFieldValue(entry, key) {
  return entry?.[key] ?? null;
}

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

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [mm, dd, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

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

function normalizeTimeForInput(value) {
  if (!value) return "";

  const raw = String(value).trim();

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5);
  }

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();

    if (ampm === "AM") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  return raw;
}

function looksLikeDateField(field) {
  const key = String(field?.key || "").toLowerCase();
  const label = String(field?.label || "").toLowerCase();
  const type = String(field?.type || "").toLowerCase();

  return (
    field?.isDate === true ||
    type === "date" ||
    key.includes("date") ||
    label.includes("date")
  );
}

function looksLikeDescriptionField(field) {
  const key = String(field?.key || "").toLowerCase();
  const label = String(field?.label || "").toLowerCase();

  return (
    key === "description" ||
    key.includes("description") ||
    key.includes("activity") ||
    label.includes("description") ||
    label.includes("activity")
  );
}

function looksLikeHoursField(field) {
  const key = String(field?.key || "").toLowerCase();
  const label = String(field?.label || "").toLowerCase();

  return (
    key.includes("hours") ||
    key.includes("hour") ||
    label.includes("hours") ||
    label.includes("hour")
  );
}

function hydrateDateFields(result, entry, fields) {
  if (!entry?.date || !fields.length) return;

  const normalizedDate = normalizeDateForInput(entry.date);
  const schemaKeys = new Set(fields.map((field) => field?.key).filter(Boolean));

  for (const key of KNOWN_DATE_KEYS) {
    if (schemaKeys.has(key) && isEmpty(result[key])) {
      result[key] = normalizedDate;
    }
  }

  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    if (looksLikeDateField(field) && isEmpty(result[key])) {
      result[key] = normalizedDate;
    }
  }
}

function hydrateTimeFields(result, entry, fields) {
  const startValue =
    entry?.start_time ?? entry?.startTime ?? entry?.clock_in ?? entry?.clockIn ?? null;
  const endValue =
    entry?.end_time ?? entry?.endTime ?? entry?.clock_out ?? entry?.clockOut ?? null;

  if (startValue) {
    const normalizedStart = normalizeTimeForInput(startValue);

    for (const key of KNOWN_TIME_KEYS.start) {
      if (hasField(fields, key) && isEmpty(result[key])) {
        result[key] = normalizedStart;
      }
    }
  }

  if (endValue) {
    const normalizedEnd = normalizeTimeForInput(endValue);

    for (const key of KNOWN_TIME_KEYS.end) {
      if (hasField(fields, key) && isEmpty(result[key])) {
        result[key] = normalizedEnd;
      }
    }
  }
}

function hydrateDescriptionFields(result, entry, fields) {
  if (!entry?.description) return;

  for (const key of KNOWN_DESCRIPTION_KEYS) {
    if (hasField(fields, key) && isEmpty(result[key])) {
      result[key] = entry.description;
    }
  }

  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    if (looksLikeDescriptionField(field) && isEmpty(result[key])) {
      result[key] = entry.description;
    }
  }
}

function hydrateSplitDurationFields(result, fields) {
  const total = Number(result?.duration_minutes || 0);
  if (!total) return;

  if (hasField(fields, "hours") && isEmpty(result.hours)) {
    result.hours = Math.floor(total / 60);
  }

  if (hasField(fields, "minutes") && isEmpty(result.minutes)) {
    result.minutes = total % 60;
  }

  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    if (looksLikeHoursField(field) && isEmpty(result[key])) {
      result[key] = total / 60;
    }
  }
}

export function buildFormDataFromEntry(entry, schema) {
  const result = {};
  const fields = getSchemaFields(schema);
  const nestedData = getNestedEntryData(entry);

  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    if (field.saveToTopLevel) {
      result[key] = getTopLevelFieldValue(entry, key);
      continue;
    }

    // Read from form_data first; fall back to top-level entry field
    if (nestedData[key] !== undefined) {
      result[key] = nestedData[key];
    } else if (entry?.[key] !== undefined) {
      result[key] = entry[key];
    }
  }

  result.notes = entry?.notes ?? "";
  result.service_code_id = entry?.service_code_id ?? null;
  result.duration_minutes = normalizeExistingDuration(entry?.duration_minutes);

  hydrateDateFields(result, entry, fields);
  hydrateTimeFields(result, entry, fields);
  hydrateDescriptionFields(result, entry, fields);
  hydrateSplitDurationFields(result, fields);

  if (entry?.location && hasField(fields, "location") && isEmpty(result.location)) {
    result.location = entry.location;
  }

  console.log("[buildFormDataFromEntry] rehydrated formData:", JSON.stringify(result, null, 2));

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
 * Warn if required schema fields are still missing after rehydration
 */
export function validateRehydratedFormData(formData, schema) {
  const fields = getSchemaFields(schema);

  const missing = fields
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((key) => !formData[key]);

  if (missing.length > 0) {
    console.warn("[timeEntryRehydration] Missing required fields on edit:", missing);
  }
}