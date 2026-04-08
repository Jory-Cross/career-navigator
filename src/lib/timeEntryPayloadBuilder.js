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
 * Extract fields array from schema, supporting both shapes:
 * - Array of fields directly
 * - Object with { fields: [...] }
 * 
 * @param {Array | Object} schema
 * @returns {Array} Fields array
 */
function getSchemaFields(schema) {
  if (Array.isArray(schema)) return schema;
  if (Array.isArray(schema?.fields)) return schema.fields;
  return [];
}

/**
 * Single source of truth for normalizing duration to minutes.
 * Reads from schema to find the actual duration field (not hardcoded keys).
 * Prevents regressions by centralizing all duration conversions.
 * 
 * @param {Record<string, any>} formData
 * @param {Array | Object} [schema] - Field schema (array or object with fields)
 * @returns {number} Duration in minutes
 */
function normalizeDurationMinutes(formData, schema) {
  console.log("🔍 FORM DATA FULL:", JSON.stringify(formData, null, 2));

  if (!formData) return 0;

  if (typeof formData.duration_minutes === "number") {
    return formData.duration_minutes;
  }

  if (
    typeof formData.duration_minutes === "string" &&
    formData.duration_minutes.trim()
  ) {
    return Number(formData.duration_minutes);
  }

  const fields = getSchemaFields(schema);

  console.log(
    "🔍 SCHEMA FIELDS:",
    JSON.stringify(
      fields.map(f => ({
        key: f.key,
        label: f.label,
        type: f.type,
        isDuration: f.isDuration,
      })),
      null,
      2
    )
  );

  const durationField =
    fields.find(f => f.isDuration === true) ||
    fields.find(f => (f.key || "").toLowerCase().includes("duration")) ||
    fields.find(f => (f.key || "").toLowerCase().includes("hour")) ||
    fields.find(f => (f.label || "").toLowerCase().includes("hours spent")) ||
    fields.find(f => (f.label || "").toLowerCase().includes("hours")) ||
    fields.find(f => (f.label || "").toLowerCase().includes("duration"));

  if (durationField) {
    const raw = formData[durationField.key];
    const value = Number(raw || 0);
    if (value > 0) {
      return value * 60;
    }
  }

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

  // Normalize schema shape to object form for consistent handling
  const normalizedSchema = Array.isArray(schema) ? { fields: schema } : schema;

  // Normalize duration (single source of truth) - pass schema for dynamic field lookup
  const duration_minutes = normalizeDurationMinutes(formData, normalizedSchema);
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
  const form_data = mapTemplateFields(normalizedSchema, formData);

  return {
    ...topLevel,
    form_data,
  };
}

/**
 * Map form data to template fields based on schema.
 * Only saves fields defined in schema—prevents labels, UI helpers, and duplicates from leaking.
 * 
 * @param {Array | Object} schema - Field schema (array or object with fields)
 * @param {Record<string, any>} formData
 * @returns {Record<string, any>} Filtered form data
 */
function mapTemplateFields(schema, formData) {
  const result = {};
  const fields = getSchemaFields(schema);

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