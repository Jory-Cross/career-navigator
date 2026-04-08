/**
 * Authorization Validation Utilities
 * Validates time entries against ServiceAuthorization rules
 */

/**
 * Validate a time entry against its service authorization
 * Returns { valid: boolean, warnings: string[] }
 * Non-blocking: warnings don't prevent entry creation
 */
export function validateTimeEntryAuthorization(entry, authorization) {
  const warnings = [];

  if (!authorization) {
    return { valid: true, warnings };
  }

  // Check date range
  if (entry.date < authorization.service_start_date) {
    warnings.push(`Entry date (${entry.date}) is before authorization start date (${authorization.service_start_date})`);
  } else if (entry.date > authorization.service_end_date) {
    warnings.push(`Entry date (${entry.date}) is after authorization end date (${authorization.service_end_date})`);
  }

  // Check hours against remaining authorized hours (if authorization has remaining_hours set)
  if (authorization.remaining_hours > 0 && authorization.remaining_hours !== null) {
    const entryHours = (entry.duration_minutes || 0) / 60;
    if (entryHours > authorization.remaining_hours) {
      warnings.push(`Entry hours (${entryHours.toFixed(2)}) exceed remaining authorized hours (${authorization.remaining_hours.toFixed(2)})`);
    }
  }

  // Check authorization status
  if (authorization.status !== 'active') {
    warnings.push(`Authorization status is "${authorization.status}" (expected "active")`);
  }

  return {
    valid: true, // Always returns valid since this is non-blocking
    warnings
  };
}

/**
 * Check if a billable or reportable entry requires authorization
 */
export function requiresAuthorization(entry, entryType) {
  if (!entryType) return false;
  
  // Entry type requires authorization
  if (entryType.requires_authorization && !entry.service_authorization_id) {
    return true;
  }

  // Billable or reportable entries should have authorization
  if ((entry.is_billable || entry.is_reportable) && !entry.service_authorization_id) {
    return false; // Warning only, not a hard requirement
  }

  return false;
}

/**
 * Build authorization warning message from validation result
 */
export function formatAuthorizationWarnings(validationResult) {
  if (!validationResult.warnings || validationResult.warnings.length === 0) {
    return null;
  }
  return validationResult.warnings.join('; ');
}

/**
 * Match a time entry to an authorization by entry_type_code and date
 */
export function matchEntryToAuthorization(entry, authorizations) {
  if (!authorizations || authorizations.length === 0) {
    return null;
  }

  // Find authorization matching entry_type_code and date range
  for (const auth of authorizations) {
    if (
      auth.entry_type_code === entry.entry_type_code &&
      auth.service_start_date <= entry.date &&
      auth.service_end_date >= entry.date &&
      auth.status === 'active'
    ) {
      return auth;
    }
  }

  return null;
}