/**
 * 🔍 SERVICE CODE CONSISTENCY VALIDATOR
 * 
 * Ensures service codes in TimeEntry payloads and form data are:
 * 1. Always stored as IDs (never labels)
 * 2. Not duplicated (one field per code type)
 * 3. Properly marked as required/optional
 * 
 * Use this in tests and backend functions to verify data integrity.
 */

import { VR_ENTRY_TYPES } from "@/lib/vrFormConfig";

/**
 * Check if a value looks like a service code ID (numeric string 1-15)
 * @param {*} value
 * @returns {boolean}
 */
function isServiceCodeId(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && num >= 1 && num <= 15;
}

/**
 * Check if a value looks like a service code label (contains descriptive text)
 * @param {*} value
 * @returns {boolean}
 */
function isServiceCodeLabel(value) {
  if (typeof value !== "string") {
    return false;
  }
  // Labels usually contain " - " and description text
  return value.includes(" - ") && value.length > 5;
}

/**
 * Validate that a single field contains only ID (not label)
 * @param {string} key - Field key
 * @param {*} value - Field value
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateServiceCodeField(key, value) {
  // Empty value is OK if field is optional
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  // Value must be an ID, never a label
  if (isServiceCodeLabel(value)) {
    return {
      valid: false,
      error: `${key} contains a LABEL instead of ID: "${value}". Should store only the ID (e.g., "1", "2")`
    };
  }

  if (!isServiceCodeId(value)) {
    return {
      valid: false,
      error: `${key} has invalid service code ID: "${value}". Must be numeric 1-15 or empty`
    };
  }

  return { valid: true };
}

/**
 * Validate form_data for service code consistency
 * @param {Object} formData - The form_data object from TimeEntry
 * @param {string} entryTypeCode - Code like "job_coaching"
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateFormDataServiceCodes(formData = {}, entryTypeCode) {
  const errors = [];

  // Get service code fields for this entry type
  const config = VR_ENTRY_TYPES[entryTypeCode];
  if (!config) {
    return { valid: true };  // Not a VR entry type
  }

  const serviceCodeFields = config.fields.filter(f => 
    f.key && f.key.includes("service_code")
  );

  // Validate each service code field
  serviceCodeFields.forEach(field => {
    const value = formData[field.key];
    const result = validateServiceCodeField(field.key, value);

    if (!result.valid) {
      errors.push(result.error);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate entire TimeEntry payload
 * @param {Object} timeEntry - TimeEntry entity from database
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateTimeEntryServiceCodes(timeEntry = {}) {
  const errors = [];

  if (!timeEntry.form_data) {
    return { valid: true };
  }

  // Check form_data
  const formDataResult = validateFormDataServiceCodes(
    timeEntry.form_data,
    timeEntry.entry_type_code
  );

  if (!formDataResult.valid) {
    errors.push(...formDataResult.errors);
  }

  // Check for accidental duplication (service code stored twice)
  const formDataStr = JSON.stringify(timeEntry.form_data);
  const serviceCodeCount = (formDataStr.match(/service_code/g) || []).length;

  // Should be 1 or 2 service code fields max (primary + optional secondary)
  const config = VR_ENTRY_TYPES[timeEntry.entry_type_code];
  const maxExpected = config ? 
    config.fields.filter(f => f.key?.includes("service_code")).length : 
    2;

  if (serviceCodeCount > maxExpected) {
    errors.push(`Possible duplication: found ${serviceCodeCount} service_code references, expected max ${maxExpected}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Audit all service code fields match schema definitions
 * @param {Object} formData
 * @param {string} entryTypeCode
 * @returns {Object} { valid: boolean, details: Object }
 */
export function auditServiceCodeFields(formData = {}, entryTypeCode) {
  const config = VR_ENTRY_TYPES[entryTypeCode];
  if (!config) {
    return { valid: true, details: {} };
  }

  const details = {};
  const serviceCodeFields = config.fields.filter(f => 
    f.key && f.key.includes("service_code")
  );

  serviceCodeFields.forEach(field => {
    const value = formData[field.key];
    const isRequired = field.required === true;
    const hasValue = value !== null && value !== undefined && value !== "";

    details[field.key] = {
      required: isRequired,
      hasValue,
      value: hasValue ? value : null,
      isValidId: hasValue ? isServiceCodeId(value) : true,
      isLabel: hasValue ? isServiceCodeLabel(value) : false
    };
  });

  // Valid if all required fields have values and all values are IDs
  const valid = Object.entries(details).every(([key, detail]) => {
    if (detail.required && !detail.hasValue) {
      return false;  // Required field missing
    }
    if (detail.hasValue && !detail.isValidId) {
      return false;  // Has value but not valid ID
    }
    if (detail.isLabel) {
      return false;  // Has label instead of ID
    }
    return true;
  });

  return { valid, details };
}

/**
 * Generate a report of service code usage in a TimeEntry
 * @param {Object} timeEntry
 * @returns {string} Human-readable report
 */
export function generateServiceCodeReport(timeEntry = {}) {
  const entryType = timeEntry.entry_type_code || "unknown";
  const audit = auditServiceCodeFields(timeEntry.form_data || {}, entryType);
  const validation = validateTimeEntryServiceCodes(timeEntry);

  let report = `
═══════════════════════════════════════════════
  SERVICE CODE AUDIT REPORT
═══════════════════════════════════════════════

Entry Type: ${entryType}
Entry ID: ${timeEntry.id || "NEW"}

────────────────────────────────────────────────
  FIELD AUDIT
────────────────────────────────────────────────
`;

  Object.entries(audit.details).forEach(([key, detail]) => {
    report += `
${key}:
  Required: ${detail.required}
  Has Value: ${detail.hasValue}
  Value: ${detail.value || "(empty)"}
  Valid ID: ${detail.isValidId ? "✅" : "❌"}
  Is Label: ${detail.isLabel ? "❌ YES" : "✅ No"}
`;
  });

  report += `
────────────────────────────────────────────────
  OVERALL VALIDATION
────────────────────────────────────────────────
Audit Status: ${audit.valid ? "✅ VALID" : "❌ INVALID"}
Validation Status: ${validation.valid ? "✅ VALID" : "❌ INVALID"}

${validation.errors.length > 0 ? 
  "Errors:\n" + validation.errors.map(e => `  • ${e}`).join("\n") : 
  "No errors detected"}

═══════════════════════════════════════════════
`;

  return report;
}