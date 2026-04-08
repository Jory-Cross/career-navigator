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
    formData[field.key] =
      entry?.form_data?.[field.key] ??
      entry?.[field.key] ??
      "";
  });

  return formData;
}

export function normalizeTopLevelFields(entryTypeCode, formData) {
  const topLevel = {
    entry_type_code: entryTypeCode,
    form_data: formData,
  };

  // Standard fields
  if (formData.date) topLevel.date = formData.date;
  if (formData.description) topLevel.description = formData.description;
  if (formData.duration) topLevel.duration = formData.duration;
  if (formData.start_time) topLevel.start_time = formData.start_time;
  if (formData.end_time) topLevel.end_time = formData.end_time;

  // Life skills field mappings
  if (formData.billable_service_date && !topLevel.date) {
    topLevel.date = formData.billable_service_date;
  }

  if (formData.billable_hours && !topLevel.duration) {
    topLevel.duration = formData.billable_hours;
  }

  if (formData.activity_description && !topLevel.description) {
    topLevel.description = formData.activity_description;
  }

  // Voc Rehab field mappings
  if (formData.coaching_date && !topLevel.date) {
    topLevel.date = formData.coaching_date;
  }

  if (formData.hours && !topLevel.duration) {
    // Convert hours to minutes for duration_minutes
    topLevel.duration = parseInt(formData.hours) * 60;
  }

  if (formData.activity && !topLevel.description) {
    topLevel.description = formData.activity;
  }

  return topLevel;
}