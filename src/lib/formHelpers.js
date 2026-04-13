import { getEntryTypeConfig, normalizeEntryTypeCode } from "./entryTypeRegistry";
import { getSchema } from "./formSchemas";

function getSchemaFields(schema) {
  if (Array.isArray(schema)) return schema;
  if (Array.isArray(schema?.fields)) return schema.fields;
  return [];
}

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function numberFromAny(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateValue(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [mm, dd, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  return String(value);
}

function normalizeClockValue(value) {
  if (!value) return "";

  const raw = String(value).trim();
  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = Number(hhmmMatch[2]);

    if (
      Number.isFinite(hour) &&
      Number.isFinite(minute) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return raw;
}

function parseTimeToMinutes(value) {
  if (!value) return null;

  const normalized = normalizeClockValue(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null) return 0;

  const diff = endMinutes - startMinutes;
  if (diff <= 0) return 0;

  return diff;
}

function getDateCandidates(formData) {
  return [
    formData?.date,
    formData?.entry_date,
    formData?.service_date,
    formData?.billable_service_date,
    formData?.coaching_date,
    formData?.job_dev_date,
    formData?.development_date,
    formData?.preets_date,
    formData?.wsa_date,
    formData?.admin_date,
    formData?.misc_date,
    formData?.eom_month,
  ];
}

function getDescriptionCandidates(formData) {
  return [
    formData?.description,
    formData?.activity_description,
    formData?.admin_description,
    formData?.misc_description,
    formData?.preets_activity,
    formData?.wsa_tasks_completed,
    formData?.eom_services_provided,
  ];
}

function getDurationCandidates(formData) {
  return [
    formData?.duration_minutes,
    formData?.duration,
    formData?.hours_of_coaching != null
      ? numberFromAny(formData.hours_of_coaching) * 60
      : 0,
    formData?.hours != null ? numberFromAny(formData.hours) * 60 : 0,
    formData?.coaching_hours != null ? numberFromAny(formData.coaching_hours) * 60 : 0,
    formData?.job_dev_hours != null ? numberFromAny(formData.job_dev_hours) * 60 : 0,
    formData?.billable_hours != null ? numberFromAny(formData.billable_hours) * 60 : 0,
  ];
}

export function getSchemaForEntryType(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);
  const config = getEntryTypeConfig(normalizedCode);
  if (!config) return [];
  return getSchema(config.schemaKey);
}

export function buildInitialFormData(schema, entry = null) {
  const fields = getSchemaFields(schema);
  const formData = {};

  for (const field of fields) {
    const key = field?.key;
    if (!key) continue;

    const existingValue =
      entry?.form_data?.[key] ??
      entry?.data?.[key] ??
      entry?.[key];

    if (existingValue !== undefined && existingValue !== null) {
      formData[key] = existingValue;
      continue;
    }

    if (field.defaultValue !== undefined) {
      formData[key] = field.defaultValue;
      continue;
    }

    switch (field.type) {
      case "checkbox":
        formData[key] = false;
        break;
      default:
        formData[key] = "";
        break;
    }
  }

  return formData;
}

export function normalizeTopLevelFields(entryTypeCode, formData = {}) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);

  const startTime =
    formData.start_time ??
    formData.startTime ??
    formData.clock_in ??
    formData.clockIn ??
    "";

  const endTime =
    formData.end_time ??
    formData.endTime ??
    formData.clock_out ??
    formData.clockOut ??
    "";

  const calculatedDuration = calculateDurationMinutes(startTime, endTime);

  let durationMinutes = 0;

  if (calculatedDuration > 0) {
    durationMinutes = calculatedDuration;
  } else {
    for (const candidate of getDurationCandidates(formData)) {
      const value = numberFromAny(candidate);
      if (value > 0) {
        durationMinutes = value;
        break;
      }
    }
  }

  let normalizedDate = "";
  for (const candidate of getDateCandidates(formData)) {
    if (!isBlank(candidate)) {
      normalizedDate = normalizeDateValue(candidate);
      break;
    }
  }

  let normalizedDescription = "";
  for (const candidate of getDescriptionCandidates(formData)) {
    if (!isBlank(candidate)) {
      normalizedDescription = String(candidate);
      break;
    }
  }

  const topLevel = {
    entry_type_code: normalizedCode || entryTypeCode,
    form_data: formData,
  };

  if (!isBlank(normalizedDate)) {
    topLevel.date = normalizedDate;
  }

  if (!isBlank(normalizedDescription)) {
    topLevel.description = normalizedDescription;
  }

  if (!isBlank(startTime)) {
    topLevel.start_time = normalizeClockValue(startTime);
  }

  if (!isBlank(endTime)) {
    topLevel.end_time = normalizeClockValue(endTime);
  }

  if (durationMinutes > 0) {
    topLevel.duration_minutes = durationMinutes;
  }

  return topLevel;
}
