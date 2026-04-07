/**
 * Time Entry Validation
 * Enforces required fields, entry type constraints, and data integrity
 */

import {
  validateRequiredFields,
  getFieldsForEntryType,
  fieldBelongsToEntryType,
  isFieldRequired
} from './vrFieldConfig';

/**
 * Validate a time entry before saving
 */
export function validateTimeEntry(entryData) {
  const errors = [];

  // Check required time entry fields
  if (!entryData.client_id) {
    errors.push('Client is required');
  }
  if (!entryData.date) {
    errors.push('Date is required');
  }
  if (!entryData.duration_minutes || entryData.duration_minutes <= 0) {
    errors.push('Duration must be greater than 0 minutes');
  }
  if (!entryData.entry_type_id) {
    errors.push('Entry type is required');
  }

  // Date validation
  if (entryData.date) {
    const entryDate = new Date(entryData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (entryDate > today) {
      errors.push('Entry date cannot be in the future');
    }
  }

  // Duration validation
  if (entryData.duration_minutes && entryData.duration_minutes > 1440) {
    errors.push('Duration cannot exceed 24 hours (1440 minutes)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate report field answers for an entry type
 */
export function validateReportFieldAnswers(entryTypeId, answers = {}) {
  const errors = [];

  // Check that all answers belong to this entry type
  Object.keys(answers).forEach(fieldKey => {
    if (!fieldBelongsToEntryType(entryTypeId, fieldKey)) {
      errors.push(`Field '${fieldKey}' does not belong to entry type '${entryTypeId}'`);
    }
  });

  // Check required fields
  const requiredValidation = validateRequiredFields(entryTypeId, answers);
  if (!requiredValidation.isValid) {
    requiredValidation.missingFields.forEach(fieldKey => {
      errors.push(`Required field '${fieldKey}' is missing or empty`);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    completionRate: requiredValidation.completedFieldsCount / requiredValidation.requiredFieldsCount
  };
}

/**
 * Validate complete time entry + answers submission
 */
export function validateTimeEntrySubmission(entryData, fieldAnswers = {}) {
  const errors = [];

  // Validate time entry
  const entryValidation = validateTimeEntry(entryData);
  if (!entryValidation.isValid) {
    errors.push(...entryValidation.errors);
  }

  // Validate field answers if entry type is set
  if (entryData.entry_type_id) {
    const answersValidation = validateReportFieldAnswers(entryData.entry_type_id, fieldAnswers);
    if (!answersValidation.isValid) {
      errors.push(...answersValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * Validate that all required fields exist in the field definition
 * (Used before report generation)
 */
export function validateFieldsExistForReporting(entryTypeId) {
  const config = getFieldsForEntryType(entryTypeId);
  
  if (!config) {
    return {
      isValid: false,
      error: `Entry type '${entryTypeId}' not found in field definitions`,
      missingFieldDefinitions: []
    };
  }

  // All required fields should be defined
  const allFieldKeys = new Set(config.all_fields.map(f => f.field_key));
  const missingDefs = config.required_fields.filter(key => !allFieldKeys.has(key));

  return {
    isValid: missingDefs.length === 0,
    error: missingDefs.length > 0 ? `Missing field definitions: ${missingDefs.join(', ')}` : null,
    missingFieldDefinitions: missingDefs,
    totalFields: config.all_fields.length,
    requiredFields: config.required_fields.length
  };
}

/**
 * Validate batch of entries before report generation
 */
export function validateEntriesForBatchReporting(entries, fieldAnswersMap = {}) {
  const errors = [];
  const warnings = [];
  const byEntryType = {};

  entries.forEach((entry, index) => {
    const entryTypeId = entry.entry_type_id;
    
    if (!entryTypeId) {
      errors.push(`Entry ${index + 1}: No entry type specified`);
      return;
    }

    // Track by entry type for reporting
    if (!byEntryType[entryTypeId]) {
      byEntryType[entryTypeId] = { valid: 0, invalid: 0, incomplete: 0 };
    }

    // Validate time entry basics
    const entryValidation = validateTimeEntry(entry);
    if (!entryValidation.isValid) {
      byEntryType[entryTypeId].invalid++;
      errors.push(`Entry ${index + 1} (${entryTypeId}): ${entryValidation.errors.join('; ')}`);
      return;
    }

    // Validate field answers
    const answers = fieldAnswersMap[entry.id] || {};
    const answersValidation = validateReportFieldAnswers(entryTypeId, answers);
    
    if (!answersValidation.isValid) {
      byEntryType[entryTypeId].incomplete++;
      warnings.push(`Entry ${index + 1} (${entryTypeId}): ${answersValidation.missingFields.length} required fields missing`);
    } else {
      byEntryType[entryTypeId].valid++;
    }
  });

  return {
    isValid: errors.length === 0,
    canGenerate: errors.length === 0 && Object.values(byEntryType).every(et => et.invalid === 0),
    errors,
    warnings,
    summary: byEntryType,
    totalEntries: entries.length,
    validEntries: entries.length - errors.length
  };
}

/**
 * Check if an entry type has all required fields configured
 */
export function isEntryTypeFullyConfigured(entryTypeId) {
  const validation = validateFieldsExistForReporting(entryTypeId);
  return validation.isValid;
}

/**
 * Get validation error message for user display
 */
export function getValidationErrorMessage(fieldKey, entryTypeId) {
  const messages = {
    client_id: 'Please select a client',
    date: 'Please select a date',
    duration_minutes: 'Please enter a duration (in minutes)',
    entry_type_id: 'Please select an entry type'
  };

  return messages[fieldKey] || `${fieldKey} is required`;
}