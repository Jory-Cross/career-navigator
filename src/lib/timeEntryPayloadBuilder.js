/**
 * Centralized payload builder for all time entry saves.
 * Single entry point for create and update operations.
 * 
 * @typedef {Object} BuildPayloadArgs
 * @property {Object} entryType - Entry type metadata
 * @property {string} entryType.id - Entry type ID
 * @property {string} [entryType.key] - Entry type code key
 * @property {string} [entryType.name] - Entry type name
 * @property {Record<string, any>} formData - Raw form submission data
 * @property {Object} [schema] - Optional schema for field mapping
 * @property {Array} [schema.fields] - Array of field definitions
 */

/**
 * Single source of truth for normalizing duration to minutes.
 * Reads from schema to find the actual duration field (not hardcoded keys).
 * Prevents regressions by centralizing all duration conversions.
 * 
 * @param {Record<string, any>} formData
 * @param {Object} [schema] - Field schema with fields array
 * @returns {number} Duration in minutes
 */
function normalizeDurationMinutes(formData, schema) {
  console.log("🔍 FORM DATA:", formData);
  
  if (!formData) return 0;

  // ✅ Already normalized as number
  if (typeof formData.duration_minutes === "number") {
    return formData.duration_minutes;
  }

  // 🔑 FIND DURATION FIELD FROM SCHEMA
  const durationField = schema?.fields?.find(
    f =>
      f.isDuration ||
      f.key.toLowerCase().includes("hour") ||
      f.label?.toLowerCase().includes("hour")
  );

  if (durationField) {
    const value = formData[durationField.key];

    if (value != null) {
      return Number(value) * 60;
    }
  }

  // Fallback (safety) - check common field names
  if (formData.hours != null || formData.minutes != null) {
    const hours = Number(formData.hours || 0);
    const minutes = Number(formData.minutes || 0);
    return (hours * 60) + minutes;
  }

  if (formData.hours_spent != null) {
    return Number(formData.hours_spent) * 60;
  }

  return 0;
}

/**
 * Convert value to string, empty string for null/undefined.
 * 
 * @param {any} value
 * @returns {string}
 */
function asString(value) {
  if (value == null) return "";
  return String(value);
}

/**
 * Convert empty string or undefined to null, otherwise return value.
 * 
 * @param {any} value
 * @returns {any}
 */
function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}



/**
 * Unified time entry payload builder.
 * Used for both create and update operations.
 * 
 * @param {BuildPayloadArgs} args
 * @returns {Record<string, any>} Normalized payload
 */
export function buildTimeEntryPayload({
  entryType,
  formData = {},
  schema
}) {
  // ⚠️ Guard: entry type ID required
  if (!entryType?.id) {
    throw new Error("❌ buildTimeEntryPayload: entryType.id is required");
  }

  // Normalize duration (single source of truth) - pass schema for dynamic field lookup
  const duration_minutes = normalizeDurationMinutes(formData, schema);
  if (duration_minutes <= 0) {
    throw new Error(`❌ buildTimeEntryPayload: duration must be > 0, got ${duration_minutes}`);
  }

  // Top-level fields (always included)
  const topLevel = {
    entry_type_id: entryType.id,
    duration_minutes,
    notes: asString(formData.notes),
    service_code_id: emptyToNull(formData.service_code_id),
  };

  // Optional fields if provided
  if (formData.date) {
    topLevel.date = formData.date;
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

  // Template/form data (nested)
  const form_data = mapTemplateFields(schema, formData);

  return {
    ...topLevel,
    form_data,
  };
}

/**
 * Map form data to template fields based on schema.
 * Only saves fields defined in schema—prevents labels, UI helpers, and duplicates from leaking.
 * 
 * @param {Object} schema - Field schema
 * @param {Record<string, any>} formData
 * @returns {Record<string, any>} Filtered form data
 */
function mapTemplateFields(schema, formData) {
  const result = {};
  const fields = schema?.fields ?? [];

  for (const field of fields) {
    const key = field.key;
    if (!key) continue;

    // Skip fields that should be saved at top level
    if (field.saveToTopLevel) continue;

    // Only include if defined in form data
    if (formData[key] !== undefined) {
      result[key] = formData[key];
    }
  }

  return result;
}

/**
 * Export normalizeDurationMinutes for direct use.
 * This is the ONLY function to use for duration normalization.
 */
export { normalizeDurationMinutes, mapTemplateFields };

/**
 * Legacy exports for backward compatibility.
 * These delegate to the unified builder.
 */
export function buildCreatePayload({
  formData,
  entryTypeCode,
  description,
  timeFields = {}
}) {
  console.warn("[buildCreatePayload] DEPRECATED - use buildTimeEntryPayload instead");
  
  // This was the old pattern - try to reconstruct entry type and call new builder
  // Note: This function is deprecated and should not be used for new code
  throw new Error(
    "buildCreatePayload is deprecated. Use buildTimeEntryPayload({ entryType: { id }, formData, schema })"
  );
}

export function buildUpdatePayload({
  formData,
  entryTypeCode,
  description,
  timeFields = {}
}) {
  console.warn("[buildUpdatePayload] DEPRECATED - use buildTimeEntryPayload instead");
  
  // This was the old pattern - try to reconstruct entry type and call new builder
  // Note: This function is deprecated and should not be used for new code
  throw new Error(
    "buildUpdatePayload is deprecated. Use buildTimeEntryPayload({ entryType: { id }, formData, schema })"
  );
}