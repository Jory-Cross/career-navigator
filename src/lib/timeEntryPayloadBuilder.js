/**
 * 🔒 NORMALIZED TIME ENTRY PAYLOAD BUILDER
 * 
 * Single source of truth for building TimeEntry payloads.
 * ALL components MUST use this function to build payloads.
 * This prevents manual payload construction and ensures contract consistency.
 */

import { getEntryTypeConfig } from "@/lib/entryTypeRegistry";
import { mapTemplateFields } from "@/lib/templateFieldMapper";

/**
 * Normalize duration to minutes (from various input formats)
 */
function normalizeDuration(formData) {
  // Direct minutes
  if (formData.duration_minutes !== undefined && formData.duration_minutes !== null) {
    return Number(formData.duration_minutes) || 0;
  }

  // Hours → minutes (handles decimal hours like 1.5)
  if (formData.duration_hours !== undefined && formData.duration_hours !== null) {
    return Math.round(Number(formData.duration_hours) * 60) || 0;
  }

  // Structured form hours (job coaching, life skills, etc.)
  const hoursKey = [
    "jc_hours", "jd_hours", "development_hours", "ls_hours",
    "job_coaching_hours", "job_development_hours", "life_skills_hours"
  ].find(key => formData[key] !== undefined && formData[key] !== null);

  if (hoursKey) {
    return Math.round(Number(formData[hoursKey]) * 60) || 0;
  }

  return 0;
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateValue) {
  if (!dateValue) return null;

  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  // MM/DD/YYYY → YYYY-MM-DD
  const match = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, mm, dd, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // Date object
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return dateValue;
}

/**
 * Extract date from multiple possible fields
 */
function extractDate(formData) {
  // Direct date field
  if (formData.date) {
    return normalizeDate(formData.date);
  }

  // Structured form date fields (service-specific)
  const dateKey = [
    "jc_date", "jd_date", "development_date", "ls_date",
    "coaching_date", "job_dev_date", "job_coaching_date", "job_development_date", "life_skills_date"
  ].find(key => formData[key]);

  if (dateKey) {
    return normalizeDate(formData[dateKey]);
  }

  return null;
}

/**
 * Build template data using schema-based mapping
 * Falls back to dynamic field extraction if schema unavailable
 */
function buildTemplateData(formData, schemaFields = null, excludeKeys = new Set()) {
  // If schema available, use deterministic schema-based mapping
  if (schemaFields && Array.isArray(schemaFields)) {
    return mapTemplateFields(schemaFields, formData, { excludeKeys });
  }

  // Fallback: extract non-reserved fields
  const reservedKeys = new Set([
    "date", "duration", "duration_minutes", "duration_hours", "description", 
    "entry_type_code", "entry_type_id", "start_time", "end_time", 
    "client_id", "employee_id", "status", "is_reportable", "is_billable", 
    "is_payroll_eligible", "reporting_period_key", "category", "legacy_category",
    "created_date", "updated_date", "id", "org_id", "service_authorization_id",
    "location"
  ]);

  const allExcluded = new Set([...reservedKeys, ...excludeKeys]);

  return Object.fromEntries(
    Object.entries(formData || {}).filter(([key, value]) => {
      return !allExcluded.has(key) && value !== undefined && value !== null;
    })
  );
}

/**
 * Build normalized TimeEntry payload
 * 
 * @param {Object} options
 * @param {Object} options.formData - Raw form data from component
 * @param {string} options.entryTypeCode - Service code (e.g., 'job_coaching', 'life_skills')
 * @param {string} [options.description] - Optional notes/description
 * @param {Object} [options.timeFields] - Optional {start_time, end_time}
 * @param {Array} [options.schemaFields] - Optional schema field definitions (enables deterministic mapping)
 * @param {Set} [options.excludeKeys] - Additional fields to exclude from dynamic data
 * @returns {Object} Normalized payload ready for API
 */
export function buildTimeEntryPayload({
  formData = {},
  entryTypeCode,
  description = null,
  timeFields = {},
  schemaFields = null,
  excludeKeys = new Set()
}) {
  // Get entry type config to validate it exists
  const config = getEntryTypeConfig(entryTypeCode);
  if (!config) {
    throw new Error(`Unknown entry type: ${entryTypeCode}`);
  }

  // Extract and normalize core fields
  const date = extractDate(formData);
  if (!date) {
    throw new Error("Missing or invalid date");
  }

  const durationMinutes = normalizeDuration(formData);
  if (!durationMinutes) {
    throw new Error("Missing or invalid duration");
  }

  // Map template fields using schema if available, fallback to dynamic extraction
  const templateData = buildTemplateData(formData, schemaFields, excludeKeys);

  // Build base payload
  const payload = {
    date,
    duration_minutes: durationMinutes,
    entry_type_code: entryTypeCode,
    description: description || formData.description || "",
    form_data: templateData
  };

  // Add optional time fields if provided
  if (timeFields.start_time) {
    payload.start_time = timeFields.start_time;
  }
  if (timeFields.end_time) {
    payload.end_time = timeFields.end_time;
  }

  return payload;
}

/**
 * Build payload for create operation (adds defaults)
 */
export function buildCreatePayload({ formData, entryTypeCode, description, timeFields, schemaFields, excludeKeys }) {
  const basePayload = buildTimeEntryPayload({
    formData,
    entryTypeCode,
    description,
    timeFields,
    schemaFields,
    excludeKeys
  });

  return {
    ...basePayload,
    status: "submitted",
    is_reportable: true,
    is_billable: false,
    is_payroll_eligible: true,
    reporting_period_key: basePayload.date ? basePayload.date.substring(0, 7) : null
  };
}

/**
 * Build payload for update operation
 */
export function buildUpdatePayload({ formData, entryTypeCode, description, timeFields, schemaFields, excludeKeys }) {
  return buildTimeEntryPayload({
    formData,
    entryTypeCode,
    description,
    timeFields,
    schemaFields,
    excludeKeys
  });
}