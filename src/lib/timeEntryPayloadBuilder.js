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
 * Normalize duration_minutes from form data.
 * Handles multiple field names and unit conversions.
 * 
 * @param {Record<string, any>} formData
 * @returns {number} Duration in minutes
 */
function normalizeDurationMinutes(formData) {
  if (!formData) return 0;

  // Try direct minutes field
  if (formData.duration_minutes != null) {
    const minutes = Number(formData.duration_minutes);
    return minutes > 0 ? minutes : 0;
  }

  // Try hours field (convert to minutes)
  if (formData.duration_hours != null) {
    const hours = Number(formData.duration_hours);
    return hours > 0 ? Math.round(hours * 60) : 0;
  }

  // Try entry-type-specific hours fields
  const specificHoursFields = [
    'jc_hours', 'jd_hours', 'coaching_hours', 'development_hours',
    'wbl_hours', 'admin_hours', 'cbs_hours', 'iep_hours'
  ];
  
  for (const field of specificHoursFields) {
    if (formData[field] != null) {
      const hours = Number(formData[field]);
      return hours > 0 ? Math.round(hours * 60) : 0;
    }
  }

  // Try start/end time calculation
  if (formData.start_time && formData.end_time) {
    try {
      const start = new Date(`2000-01-01T${formData.start_time}`);
      const end = new Date(`2000-01-01T${formData.end_time}`);
      const diff = (end - start) / (1000 * 60); // Convert ms to minutes
      return diff > 0 ? Math.round(diff) : 0;
    } catch {
      return 0;
    }
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
 * Map template/form fields to structured data object.
 * Only includes fields defined in schema with saveToTopLevel !== true.
 * 
 * @param {Object} schema - Field schema
 * @param {Record<string, any>} formData - Raw form data
 * @returns {Record<string, any>} Mapped template fields
 */
function mapTemplateFields(schema, formData) {
  if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
    // If no schema provided, return form data as-is (for backward compatibility)
    return formData || {};
  }

  const mapped = {};

  for (const field of schema.fields) {
    const { key, saveToTopLevel } = field;
    
    // Skip fields that go to top level
    if (saveToTopLevel === true) continue;
    
    // Only include if defined in formData
    if (key && formData.hasOwnProperty(key)) {
      mapped[key] = formData[key];
    }
  }

  return mapped;
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

  // Normalize duration
  const duration_minutes = normalizeDurationMinutes(formData);
  if (!duration_minutes || duration_minutes <= 0) {
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