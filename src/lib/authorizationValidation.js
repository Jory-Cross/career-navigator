/**
 * Service Authorization Validation
 * Validates time entries against authorization rules
 */

/**
 * Get active authorization for a client/service type
 */
export async function getActiveAuthorization(base44, clientId, serviceTypeCode) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId,
      service_type_code: serviceTypeCode,
      status: 'active'
    });

    if (authorizations.length === 0) return null;
    return authorizations[0]; // Return first active
  } catch (error) {
    console.error('getActiveAuthorization error:', error);
    return null;
  }
}

/**
 * Get all authorizations for a client
 */
export async function getClientAuthorizations(base44, clientId) {
  try {
    return await base44.entities.ServiceAuthorization.filter({
      client_id: clientId
    });
  } catch (error) {
    console.error('getClientAuthorizations error:', error);
    return [];
  }
}

/**
 * Validate time entry against authorization
 * Returns: { isValid, message, warnings[], authorization, remainingHours }
 */
export async function validateTimeEntryAuthorization(base44, timeEntry, authorization) {
  const errors = [];
  const warnings = [];

  // Check if authorization exists
  if (!authorization) {
    return {
      isValid: false,
      message: 'No active authorization found',
      errors: ['Authorization required for billable entry'],
      warnings: [],
      authorization: null,
      remainingHours: 0
    };
  }

  // Check date range
  if (timeEntry.date < authorization.authorization_start_date) {
    errors.push(`Entry date (${timeEntry.date}) is before authorization start (${authorization.authorization_start_date})`);
  }

  if (timeEntry.date > authorization.authorization_end_date) {
    errors.push(`Entry date (${timeEntry.date}) is after authorization end (${authorization.authorization_end_date})`);
  }

  // Check hours
  const entryHours = (timeEntry.duration_minutes || 0) / 60;
  const remainingHours = authorization.remaining_hours || 0;

  if (entryHours > remainingHours) {
    errors.push(`Entry hours (${entryHours.toFixed(1)}) exceeds remaining (${remainingHours.toFixed(1)})`);
  }

  // Warn if low on hours
  if (remainingHours - entryHours < 5) {
    warnings.push(`Low on hours: only ${(remainingHours - entryHours).toFixed(1)} hours will remain after this entry`);
  }

  // Check status
  if (authorization.status === 'expired') {
    errors.push('Authorization has expired');
  } else if (authorization.status === 'exhausted') {
    errors.push('Authorization hours exhausted');
  } else if (authorization.status === 'cancelled') {
    errors.push('Authorization has been cancelled');
  }

  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors[0] : 'Authorization valid',
    errors,
    warnings,
    authorization,
    remainingHours: Math.max(0, remainingHours - entryHours)
  };
}

/**
 * Update authorization hours after time entry creation/update
 * Recalculates used_hours and remaining_hours, updates status
 */
export async function updateAuthorizationHours(base44, authorizationId) {
  try {
    const auth = await base44.entities.ServiceAuthorization.filter({
      id: authorizationId
    });

    if (!auth || auth.length === 0) {
      throw new Error(`Authorization ${authorizationId} not found`);
    }

    const authorization = auth[0];

    // Sum all time entries for this authorization
    const entries = await base44.entities.TimeEntry.filter({
      service_authorization_id: authorizationId
    });

    const usedMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const usedHours = usedMinutes / 60;
    const remainingHours = Math.max(0, authorization.total_authorized_hours - usedHours);

    // Determine status
    let status = authorization.status;
    if (remainingHours === 0 && usedHours > 0) {
      status = 'exhausted';
    } else if (new Date(authorization.authorization_end_date) < new Date()) {
      status = 'expired';
    }

    // Update authorization
    await base44.asServiceRole.entities.ServiceAuthorization.update(authorizationId, {
      used_hours: parseFloat(usedHours.toFixed(2)),
      remaining_hours: parseFloat(remainingHours.toFixed(2)),
      status
    });

    return {
      authorizationId,
      usedHours: parseFloat(usedHours.toFixed(2)),
      remainingHours: parseFloat(remainingHours.toFixed(2)),
      status
    };
  } catch (error) {
    console.error('updateAuthorizationHours error:', error);
    throw error;
  }
}

/**
 * Get authorization summary for a client
 * Groups authorizations by status and service type
 */
export async function getAuthorizationSummary(base44, clientId) {
  try {
    const authorizations = await getClientAuthorizations(base44, clientId);

    const summary = {
      total: authorizations.length,
      active: 0,
      pending: 0,
      expired: 0,
      exhausted: 0,
      cancelled: 0,
      byServiceType: {},
      authorizations
    };

    authorizations.forEach(auth => {
      summary[auth.status]++;

      if (!summary.byServiceType[auth.service_type_code]) {
        summary.byServiceType[auth.service_type_code] = {
          count: 0,
          totalHours: 0,
          usedHours: 0,
          remainingHours: 0
        };
      }

      const type = summary.byServiceType[auth.service_type_code];
      type.count++;
      type.totalHours += auth.total_authorized_hours || 0;
      type.usedHours += auth.used_hours || 0;
      type.remainingHours += auth.remaining_hours || 0;
    });

    return summary;
  } catch (error) {
    console.error('getAuthorizationSummary error:', error);
    return { total: 0, authorizations: [], byServiceType: {} };
  }
}

/**
 * Check if authorization is still valid
 */
export function isAuthorizationValid(authorization) {
  if (!authorization) return false;
  if (authorization.status !== 'active') return false;

  const today = new Date().toISOString().split('T')[0];
  if (today > authorization.authorization_end_date) return false;
  if (today < authorization.authorization_start_date) return false;

  return authorization.remaining_hours > 0;
}

/**
 * Get all time entries for an authorization
 */
export async function getAuthorizationTimeEntries(base44, authorizationId) {
  try {
    return await base44.entities.TimeEntry.filter({
      service_authorization_id: authorizationId
    });
  } catch (error) {
    console.error('getAuthorizationTimeEntries error:', error);
    return [];
  }
}