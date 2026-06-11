/**
 * Centralized payload builder for all time entry saves.
 * Safe for both structured Voc Rehab forms and simple clock-in/clock-out forms.
 *
 * Phase 4 cleanup goals:
 * - preserve current working behavior
 * - normalize date/time consistently
 * - keep top-level vs form_data mapping predictable
 * - reduce repeated ad-hoc parsing across callers
 */

function getSchemaFields(schema) {
  if (Array.isArray(schema)) return schema;
  if (Array.isArray(schema?.fields)) return schema.fields;
  return [];
}

function numberFromAny(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
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
    } else if (hour !== 12) {
      hour += 12;
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

  const totalMinutes = parseTimeToMinutes(value);
  if (totalMinutes == null) return String(value).trim();

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

function getClockTimeCandidates(formData) {
  return {
    startTime:
      formData?.start_time ??
      formData?.startTime ??
      formData?.clock_in ??
      formData?.clockIn ??
      null,
    endTime:
      formData?.end_time ??
      formData?.endTime ??
      formData?.clock_out ??
      formData?.clockOut ??
      null,
  };
}

function getDurationFieldFromSchema(schema) {
  const fields = getSchemaFields(schema);

  return (
    fields.find((f) => f.isDuration === true) ||
    fields.find((f) => (f.key || "").toLowerCase().includes("duration")) ||
    fields.find((f) => (f.key || "").toLowerCase().includes("hour")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("hours spent")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("hours")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("duration")) ||
    null
  );
}

function normalizeDurationMinutes(formData, schema) {
  if (!formData) return 0;

  // 1) Prefer explicit clock-in/clock-out values (start/end time range)
  const { startTime, endTime } = getClockTimeCandidates(formData);
  const calculatedFromClock = calculateDurationMinutes(startTime, endTime);
  if (calculatedFromClock > 0) {
    return calculatedFromClock;
  }

  // 2) Schema-based duration field (isDuration:true) — checked BEFORE duration_minutes
  //    so that a user editing "Hours Spent" always wins over the stale duration_minutes
  //    echo that rehydration places into formData from the existing entry.
  const durationField = getDurationFieldFromSchema(schema);
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

  // 3) Direct duration_minutes in formData (fallback for forms without a schema duration field)
  const directDurationMinutes = numberFromAny(formData.duration_minutes);
  if (directDurationMinutes > 0) {
    return directDurationMinutes;
  }

  // 4) Generic duration field in minutes
  const directDuration = numberFromAny(formData.duration);
  if (directDuration > 0) {
    return directDuration;
  }

  // 5) Legacy split hours/minutes fields
  if (formData.hours != null || formData.minutes != null) {
    const hours = numberFromAny(formData.hours);
    const minutes = numberFromAny(formData.minutes);
    const total = hours * 60 + minutes;

    if (total > 0) return total;
  }

  // 6) Legacy hours-like fields
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
    formData.pto_hours,
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

function getSchemaDateField(schema) {
  const fields = getSchemaFields(schema);

  return (
    fields.find((f) => f.isDate === true) ||
    fields.find((f) => (f.type || "").toLowerCase() === "date") ||
    fields.find((f) => (f.key || "").toLowerCase().includes("date")) ||
    fields.find((f) => (f.label || "").toLowerCase().includes("date")) ||
    null
  );
}

function getRawDateValue(formData, schema) {
  const dateField = getSchemaDateField(schema);

  return (
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
    (dateField ? formData[dateField.key] : null)
  );
}

function getDescriptionValue(formData) {
  return (
    formData.description ??
    formData.activity_description ??
    formData.admin_description ??
    formData.misc_description ??
    formData.preets_activity ??
    formData.wsa_tasks_completed ??
    formData.eom_services_provided ??
    formData.notes ??
    formData.note ??
    formData.comments ??
    formData.comment ??
    formData.observations ??
    null
  );
}

function getNotesValue(formData) {
  return (
    formData.notes ??
    formData.note ??
    formData.comments ??
    formData.comment ??
    formData.observations ??
    null
  );
}

function getFlags(formData) {
  return {
    is_reportable:
      formData.is_reportable === undefined ? true : Boolean(formData.is_reportable),
    is_billable:
      formData.is_billable === undefined ? false : Boolean(formData.is_billable),
    is_payroll_eligible:
      formData.is_payroll_eligible === undefined
        ? true
        : Boolean(formData.is_payroll_eligible),
  };
}

function getReportingPeriodKey(normalizedDate) {
  if (
    normalizedDate &&
    typeof normalizedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
  ) {
    return normalizedDate.slice(0, 7);
  }

  return null;
}

function buildTopLevelPayload(entryType, formData, schema) {
  const normalizedSchema = Array.isArray(schema) ? { fields: schema } : schema;

  const duration_minutes = normalizeDurationMinutes(formData, normalizedSchema);
  if (duration_minutes <= 0) {
    throw new Error(`❌ buildTimeEntryPayload: duration must be > 0, got ${duration_minutes}`);
  }

  const { startTime, endTime } = getClockTimeCandidates(formData);
  const normalizedStartTime = normalizeClockValue(startTime);
  const normalizedEndTime = normalizeClockValue(endTime);

  const normalizedDate = normalizeDateValue(getRawDateValue(formData, normalizedSchema));
  const description = getDescriptionValue(formData);
  const notes = getNotesValue(formData);
  const flags = getFlags(formData);

  const topLevel = {
    entry_type_id: entryType.id,
    duration_minutes,
    notes: asString(notes),
    service_code_id: emptyToNull(formData.service_code_id),
    reporting_period_key: getReportingPeriodKey(normalizedDate),
    ...flags,
  };

  if (normalizedDate) {
    topLevel.date = normalizedDate;
  }

  if (normalizedStartTime) {
    topLevel.start_time = normalizedStartTime;
  }

  if (normalizedEndTime) {
    topLevel.end_time = normalizedEndTime;
  }

  if (!isBlank(formData.location)) {
    topLevel.location = formData.location;
  }

  if (!isBlank(description)) {
    topLevel.description = description;
  }

  if (!isBlank(entryType.code)) {
    topLevel.entry_type_code = entryType.code;
  }

  return {
    topLevel,
    normalizedStartTime,
    normalizedEndTime,
    normalizedDate,
  };
}

function mapTemplateFields(schema, formData, existingEntry = null) {
  const result = {};
  const fields = getSchemaFields(schema);
  const existingFormData = existingEntry?.form_data || {};

  for (const field of fields) {
    const key = field.key;
    if (!key) continue;
    // Only skip fields marked to save at top level; all others go to form_data
    if (field.saveToTopLevel) continue;
    
    const value = formData[key];
    
    // In EDIT mode: only save if value is non-empty, OR if it's explicitly different from existing
    if (existingEntry?.id) {
      // Skip blank/undefined values that would overwrite existing data
      if (value === undefined || value === null || value === "") {
        continue;
      }
      result[key] = value;
    } else {
      // In CREATE mode: save all defined values
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

export function buildTimeEntryPayload({
  entryType,
  formData = {},
  schema,
  existingEntry = null,
}) {
  if (!entryType?.id) {
    throw new Error("❌ buildTimeEntryPayload: entryType.id is required");
  }

  const normalizedSchema = Array.isArray(schema) ? { fields: schema } : schema;

  const {
    topLevel,
    normalizedStartTime,
    normalizedEndTime,
  } = buildTopLevelPayload(entryType, formData, normalizedSchema);

  const newFormData = mapTemplateFields(
    normalizedSchema,
    {
      ...formData,
      start_time: normalizedStartTime ?? formData.start_time,
      end_time: normalizedEndTime ?? formData.end_time,
    },
    existingEntry
  );

  // On edit: merge existing form_data so fields not currently in the schema
  // (e.g. from a prior schema version) are not silently wiped.
  // User-entered values from formData always win over existing values.
  const existingFormData =
    existingEntry?.form_data && typeof existingEntry.form_data === "object"
      ? existingEntry.form_data
      : {};

  const form_data = { ...existingFormData, ...newFormData };

  console.log("[buildTimeEntryPayload] form_data to save:", JSON.stringify(form_data, null, 2));

  return {
    ...topLevel,
    form_data,
  };
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
