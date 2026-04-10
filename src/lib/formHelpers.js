import { getEntryTypeConfig } from "./entryTypeRegistry";
import { getSchema } from "./formSchemas";

export function getSchemaForEntryType(entryTypeCode) {
  const config = getEntryTypeConfig(entryTypeCode);
  if (!config) return [];
  return getSchema(config.schemaKey);
}

export function buildInitialFormData(schema, entry = null) {
  const formData = {};

  schema.forEach((field) => {
    const existingValue =
      entry?.form_data?.[field.key] ??
      entry?.[field.key];

    formData[field.key] =
      existingValue ??
      field.defaultValue ??
      "";
  });

  return formData;
}

export function normalizeTopLevelFields(entryTypeCode, formData) {
  const topLevel = {
    entry_type_code: entryTypeCode,
    form_data: formData,
  };

  if (formData.date) topLevel.date = formData.date;
  if (formData.description) topLevel.description = formData.description;

  if (formData.start_time) topLevel.start_time = formData.start_time;
  if (formData.end_time) topLevel.end_time = formData.end_time;

  // Only use raw duration if explicitly present
  if (formData.duration) {
    topLevel.duration_minutes = parseInt(formData.duration, 10) || 0;
  }

  if (formData.billable_service_date && !topLevel.date) {
    topLevel.date = formData.billable_service_date;
  }

  if (formData.billable_hours && !topLevel.duration_minutes) {
    topLevel.duration_minutes = parseInt(formData.billable_hours, 10) * 60;
  }

  if (formData.activity_description && !topLevel.description) {
    topLevel.description = formData.activity_description;
  }

  if (!topLevel.date) {
    if (formData.coaching_date) {
      topLevel.date = formData.coaching_date;
    } else if (formData.job_dev_date) {
      topLevel.date = formData.job_dev_date;
    }
  }

  if (!topLevel.duration_minutes) {
    const hoursField =
      formData.hours_of_coaching ||
      formData.hours ||
      formData.coaching_hours ||
      formData.job_dev_hours;

    if (hoursField) {
      const hours = parseInt(hoursField, 10);
      if (!isNaN(hours)) {
        topLevel.duration_minutes = hours * 60;
      }
    }
  }

  if (!topLevel.description && formData.activity_description) {
    topLevel.description = formData.activity_description;
  }

  return topLevel;
}
