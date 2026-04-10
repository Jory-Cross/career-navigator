/**
 * Centralized payload builder for all time entry saves.
 * Safe for both structured Voc Rehab forms and simple clock-in/clock-out forms.
 */

function getSchemaFields(schema) {
  if (Array.isArray(schema)) return schema;
  if (Array.isArray(schema?.fields)) return schema.fields;
  return [];
}

function parseTimeToMinutes(value) {
  if (!value) return null;

  const raw = String(value).trim();

  // Supports:
  // - "07:00"
  // - "7:00"
  // - "07:00:00"
  // - "7:00 AM"
  // - "1:15 PM"
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const ampm = ampmMatch[3].toUpperCase();

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour < 1 || hour > 12) return null;

    if (ampm === "AM") {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }

    return hour * 60 + minute;
  }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = Number(hhmmMatch[2]);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;

    return hour * 60 + minute;
  }

  return null;
}

function normalizeClockValue(value) {
  if (!value) return value;

  const raw = String(value).trim();
  const totalMinutes = parseTimeToMinutes(raw);
  if (totalMinutes == null) return raw;

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const startTotal = parseTimeToMinutes(startTime);
  const endTotal = parseTimeToMinutes(endTime);

  if (startTotal == null || endTotal == null) return 0;

  const diff = endTotal - startTotal;
  if (diff <= 0) return 0;

  return diff;
}

function numberFromAny(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDurationMinutes(formData, schema) {
  if (!formData) return 0;

  // 1. Prefer explicit clock-in/clock-out values
  const startTime =
    formData.start_time ??
    formData.startTime ??
    formData.clock_in ??
    formData.clockIn ??
    null;

  const endTime =
    formData.end_time ??
    formData.endTime ??
    formData.clock_out ??
    formData.clockOut ??
    null;

  const calculatedFromClock = calculateDurationMinutes(startTime, endTime);
  if (calculatedFromClock > 0) {
    return calculatedFromClock;
  }

  // 2. Direct duration_minutes
  const directDurationMinutes = numberFromAny(formData.duration_minutes);
  if (directDurationMinutes > 0) {
    return directDurationMinutes;
  }

  // 3. Generic duration field in minutes
  const directDuration = numberFromAny(formData.duration);
  if (directDuration > 0) {
    return directDuration;
  }

  // 4. Schema-based duration field lookup (hours -> convert to minutes)
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
    const value = numberFromAny(raw);
    if (value > 0) {
      const fieldKey = String(durationField.key || "").toLowerCase();
      const fieldLabel = String(durationField.label || "").toLowerCase();

      const looksLikeMinutes =
        fieldKey.includes("duration_minutes") ||
        fieldKey === "duration" ||
        fieldLabel.includes("minutes");

      return looksLikeMinutes ? value : value * 60;
    }
  }

  // 5. Legacy split hours/minutes fields
  if (formData.hours != null || formData.minutes != null) {
    const hours = numberFromAny(formData.hours);
    const minutes = numberFromAny(formData.minutes);
    const total = hours * 60 + minutes;
    if (total > 0) return total;
  }

  // 6. Legacy hours-like fields
  const legacyHourCandidates = [
    formData.hours_spent,
    formData.billable_hours,
    formData.coaching_hours,
    formData.job_dev_hours,
    formData.hours_of_coaching,
    formData.development_hours,
    formData.jc_hours,
    formData.usor96_hours,
    formData.preets_hours,
    formData.wsa_hours,
    formData.admin_hours,
    formData.misc_hours,
    formData.eom_total_hours,
  ];

  for (const candidate of legacyHourCandidates) {
    const value = numberFromAny(candidate);
    if (value > 0) {
      return value * 60;
    }
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
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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

  const normalizedStartTime = normalizeClockValue(
    formData.start_time ??
      formData.startTime ??
      formData.clock_in ??
      formData.clockIn ??
      null
  );

  const normalizedEndTime = normalizeClockValue(
    formData.end_time ??
      formData.endTime ??
      formData.clock_out ??
      formData.clockOut ??
      null
  );

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
    formData.billable_service_date ??
    formData.coaching_date ??
    formData.job_dev_date ??
    formData.development_date ??
    formData.preets_date ??
    formData.wsa_date ??
    formData.admin_date ??
    formData.misc_date ??
    formData.eom_month ??
    (dateField ? formData[dateField.key] : null);

  const normalizedDate = normalizeDateValue(rawDate);
  if (normalizedDate) {
    topLevel.date = normalizedDate;
  }

  if (normalizedStartTime) {
    topLevel.start_time = normalizedStartTime;
  }

  if (normalizedEndTime) {
    topLevel.end_time = normalizedEndTime;
  }

  if (formData.location) {
    topLevel.location = formData.location;
  }

  if (formData.description) {
    topLevel.description = formData.description;
  } else if (formData.activity_description) {
    topLevel.description = formData.activity_description;
  } else if (formData.admin_description) {
    topLevel.description = formData.admin_description;
  } else if (formData.misc_description) {
    topLevel.description = formData.misc_description;
  } else if (formData.preets_activity) {
    topLevel.description = formData.preets_activity;
  } else if (formData.wsa_tasks_completed) {
    topLevel.description = formData.wsa_tasks_completed;
  } else if (formData.eom_services_provided) {
    topLevel.description = formData.eom_services_provided;
  }

  const form_data = mapTemplateFields(normalizedSchema, {
    ...formData,
    start_time: normalizedStartTime ?? formData.start_time,
    end_time: normalizedEndTime ?? formData.end_time,
  });

  return {
    ...topLevel,
    form_data,
  };
}

function mapTemplateFields(schema, formData) {
  const result = {};
  const fields = getSchemaFields(schema);

  const TOP_LEVEL_DATE_KEYS = new Set([
    "date",
    "entry_date",
    "service_date",
    "billable_service_date",
    "coaching_date",
    "job_dev_date",
    "development_date",
    "preets_date",
    "wsa_date",
    "admin_date",
    "misc_date",
    "eom_month",
  ]);

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
