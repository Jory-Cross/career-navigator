/**
 * Centralized payload builder for all time entry saves.
 */

function getSchemaFields(schema) {
  if (Array.isArray(schema)) return schema;
  if (Array.isArray(schema?.fields)) return schema.fields;
  return [];
}

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const diff = endTotal - startTotal;

  if (diff <= 0) return 0;
  return diff;
}

function normalizeDurationMinutes(formData, schema) {
  if (!formData) return 0;

  // 1. For clock-in/clock-out flows, always derive duration from start/end first
  const startTime = formData.start_time;
  const endTime = formData.end_time;
  const calculatedFromClock = calculateDurationMinutes(startTime, endTime);

  if (calculatedFromClock > 0) {
    return calculatedFromClock;
  }

  // 2. Direct duration_minutes
  if (typeof formData.duration_minutes === "number") {
    return formData.duration_minutes;
  }

  if (
    typeof formData.duration_minutes === "string" &&
    formData.duration_minutes.trim()
  ) {
    return Number(formData.duration_minutes);
  }

  // 3. Schema-based duration field lookup
  const fields = getSchemaFields(schema);

  const durationField =
    fields.find((f) => f.isDuration === true) ||
    fields.find((f) => (f.key || "").toLowerCase().includes("duration")) ||
    fields.find((f) => (f.key || "").toLowerCase().includes("hour")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("hours spent")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("hours")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("duration"));

  if (durationField) {
    const raw = formData[durationField.key];
    const value = Number(raw || 0);
    if (value > 0) {
      return value * 60;
    }
  }

  // 4. Legacy hour/minute split
  if (formData.hours != null || formData.minutes != null) {
    const hours = Number(formData.hours || 0);
    const minutes = Number(formData.minutes || 0);
    return hours * 60 + minutes;
  }

  // 5. Legacy hours_spent
  if (formData.hours_spent != null) {
    return Number(formData.hours_spent) * 60;
  }

  return 0;
}

function normalizeDateValue(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [mm, dd, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

export function buildTimeEntryPayload({
  entryType,
  formData = {},
  schema,
}) {
  if (!entryType?.id) {
    throw new Error("❌ buildTimeEntryPayload: entryType.id is required");
  }

  const normalizedSchema = Array.isArray(schema) ? { fields: schema } : schema;

  const duration_minutes = normalizeDurationMinutes(formData, normalizedSchema);
  if (duration_minutes <= 0) {
    throw new Error(`❌ buildTimeEntryPayload: duration must be > 0, got ${duration_minutes}`);
  }

  const topLevel = {
    entry_type_id: entryType.id,
    duration_minutes,
    notes: asString(formData.notes),
    service_code_id: emptyToNull(formData.service_code_id),
  };

  const schemaFields = getSchemaFields(normalizedSchema);
  const dateField =
    schemaFields.find((f) => f.isDate === true) ||
    schemaFields.find((f) => (f.type || "").toLowerCase() === "date") ||
    schemaFields.find((f) => (f.key || "").toLowerCase().includes("date")) ||
    schemaFields.find((f) => (f.label || "").toLowerCase().includes("date"));

  const rawDate =
    formData.date ??
    formData.entry_date ??
    formData.service_date ??
    (dateField ? formData[dateField.key] : null);

  const normalizedDate = normalizeDateValue(rawDate);
  if (normalizedDate) {
    topLevel.date = normalizedDate;
  }

  if (formData.start_time) {
    topLevel.start_time = formData.start_time;
  }
  if (formData.end_time) {
    topLevel.end_time = formData.end_time;
  }
  if (formData.location) {
    topLevel.location = formData.location;
  }
  if (formData.description) {
    topLevel.description = formData.description;
  }

  const form_data = mapTemplateFields(normalizedSchema, formData);

  return {
    ...topLevel,
    form_data,
  };
}

function mapTemplateFields(schema, formData) {
  const result = {};
  const fields = getSchemaFields(schema);

  const TOP_LEVEL_DATE_KEYS = new Set(["date", "entry_date", "service_date"]);
  for (const f of fields) {
    if (
      f.isDate === true ||
      (f.type || "").toLowerCase() === "date" ||
      (f.key || "").toLowerCase().includes("date")
    ) {
      TOP_LEVEL_DATE_KEYS.add(f.key);
    }
  }

  for (const field of fields) {
    const key = field.key;
    if (!key) continue;

    if (field.saveToTopLevel) continue;
    if (TOP_LEVEL_DATE_KEYS.has(key)) continue;

    if (formData[key] !== undefined) {
      result[key] = formData[key];
    }
  }

  return result;
}

export { normalizeDurationMinutes, mapTemplateFields };

export function buildCreatePayload() {
  throw new Error(
    "buildCreatePayload is deprecated. Use buildTimeEntryPayload({ entryType: { id }, formData, schema })"
  );
}

export function buildUpdatePayload() {
  throw new Error(
    "buildUpdatePayload is deprecated. Use buildTimeEntryPayload({ entryType: { id }, formData, schema })"
  );
}
