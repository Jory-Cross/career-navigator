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
  console.log("[normalizeTopLevelFields] Entry type:", entryTypeCode);
  console.log("[normalizeTopLevelFields] Raw form data:", formData);

  const topLevel = {
    entry_type_code: entryTypeCode,
    form_data: formData,
  };

  // Standard fields
  if (formData.date) topLevel.date = formData.date;
  if (formData.description) topLevel.description = formData.description;
  if (formData.duration) topLevel.duration_minutes = parseInt(formData.duration) || 0;
  if (formData.start_time) topLevel.start_time = formData.start_time;
  if (formData.end_time) topLevel.end_time = formData.end_time;

  // Life skills field mappings
  if (formData.billable_service_date && !topLevel.date) {
    topLevel.date = formData.billable_service_date;
  }

  if (formData.billable_hours && !topLevel.duration_minutes) {
    // Convert hours to minutes for duration_minutes
    topLevel.duration_minutes = parseInt(formData.billable_hours) * 60;
  }

  if (formData.activity_description && !topLevel.description) {
    topLevel.description = formData.activity_description;
  }

  // Voc Rehab field mappings - support all prefixes (jc_, jd_, or generic)
  // Date field detection
  if (!topLevel.date) {
    if (formData.coaching_date) {
      topLevel.date = formData.coaching_date;
      console.log("[normalizeTopLevelFields] Mapped coaching_date →", topLevel.date);
    } else if (formData.job_dev_date) {
      topLevel.date = formData.job_dev_date;
      console.log("[normalizeTopLevelFields] Mapped job_dev_date →", topLevel.date);
    }
  }

  // Hours to duration_minutes conversion - detect any hours/coaching_hours field
  if (!topLevel.duration_minutes) {
    const hoursField = 
      formData.hours_of_coaching ||
      formData.hours ||
      formData.coaching_hours ||
      formData.job_dev_hours;
    
    if (hoursField) {
      const hours = parseInt(hoursField);
      if (!isNaN(hours)) {
        topLevel.duration_minutes = hours * 60;
        console.log("[normalizeTopLevelFields] Converted", hoursField, "to duration_minutes:", topLevel.duration_minutes);
      }
    }
  }

  // Activity description mapping
  if (!topLevel.description && formData.activity_description) {
    topLevel.description = formData.activity_description;
  }

  console.log("[normalizeTopLevelFields] Normalized result:", topLevel);
  return topLevel;
}