/**
 * 🧠 DETERMINISTIC TEMPLATE FIELD MAPPER
 * 
 * Maps form data to template fields using ONLY schema.key, never labels.
 * This is the ONLY way to extract template fields from forms.
 * 
 * Rules:
 * ✅ ALWAYS use field.key
 * ❌ NEVER use field.label
 * ❌ NEVER mix nested + flat fields
 * ❌ NEVER hardcode field names in components
 */

/**
 * Extract template fields from form data based on schema
 * 
 * @param {Array} schemaFields - Array of schema field definitions with {key, type, label, ...}
 * @param {Object} formData - Raw form data from component
 * @param {Object} options - Additional options
 * @param {Set} options.excludeKeys - Additional keys to exclude
 * @param {boolean} options.includeEmpty - Include fields with null/undefined values
 * @returns {Object} Mapped template fields keyed by schema field.key
 */
export function mapTemplateFields(schemaFields = [], formData = {}, options = {}) {
  const { excludeKeys = new Set(), includeEmpty = false } = options;

  const result = {};

  // Iterate ONLY by schema field keys - never by form data keys
  schemaFields.forEach(field => {
    const key = field.key;

    // Skip excluded keys
    if (excludeKeys.has(key)) {
      return;
    }

    const value = formData[key];

    // Include if defined, or if includeEmpty=true
    if (value !== undefined && value !== null) {
      result[key] = value;
    } else if (includeEmpty && value !== undefined) {
      result[key] = value;
    }
  });

  return result;
}

/**
 * Validate form data completeness against schema
 * Returns missing required fields
 * 
 * @param {Array} schemaFields - Array of required schema fields
 * @param {Object} formData - Form data to validate
 * @returns {Array} Array of missing field keys
 */
export function validateTemplateFields(schemaFields = [], formData = {}) {
  const missing = [];

  schemaFields.forEach(field => {
    // Skip optional fields
    if (field.required === false) {
      return;
    }

    const value = formData[field.key];
    if (value === undefined || value === null || value === "") {
      missing.push(field.key);
    }
  });

  return missing;
}

/**
 * Extract field by key from schema
 * 
 * @param {Array} schemaFields - Array of schema fields
 * @param {string} key - Field key to find
 * @returns {Object|null} Field definition or null
 */
export function getSchemaFieldByKey(schemaFields = [], key) {
  return schemaFields.find(f => f.key === key) || null;
}

/**
 * Format field value for display based on field type
 * 
 * @param {Object} field - Schema field definition
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
export function formatFieldValue(field, value) {
  if (value === null || value === undefined) {
    return "—";
  }

  switch (field.type) {
    case "date":
      return formatDate(value);
    case "number":
      return Number(value).toLocaleString();
    case "select":
      // Return the value or look up in options
      const option = field.options?.find(o => o.value === value || o === value);
      return option?.label || option || String(value);
    case "checkbox":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

/**
 * Helper: format date consistently
 */
function formatDate(dateValue) {
  if (!dateValue) return "—";
  
  try {
    const date = new Date(dateValue);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  } catch {
    return String(dateValue);
  }
}

/**
 * Build a display object for form data based on schema
 * Useful for previews, confirmations, etc.
 * 
 * @param {Array} schemaFields - Schema definition
 * @param {Object} formData - Form data
 * @returns {Object} {key: displayValue} pairs
 */
export function buildDisplayData(schemaFields = [], formData = {}) {
  const display = {};

  schemaFields.forEach(field => {
    const value = formData[field.key];
    if (value !== undefined && value !== null) {
      display[field.key] = formatFieldValue(field, value);
    }
  });

  return display;
}