/**
 * ServiceAuthorization Validation
 * Validates time entries against active authorizations
 * Prevents logging beyond authorized hours
 * Calculates hours remaining
 */

/**
 * Get active authorization for client and service type
 */
export async function getActiveAuthorization(base44, clientId, serviceType, onDate) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId,
      service_type: serviceType
    });

    // Find authorization active on the given date
    const active = authorizations.find(auth => {
      const startOk = new Date(auth.start_date) <= new Date(onDate);
      const endOk = new Date(auth.end_date) >= new Date(onDate);
      return startOk && endOk && auth.status === 'active';
    });

    return active || null;
  } catch (error) {
    console.error('Error fetching authorization:', error);
    return null;
  }
}

/**
 * Get all active authorizations for a client
 */
export async function getClientAuthorizations(base44, clientId) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId
    });

    const today = new Date().toISOString().split('T')[0];
    return authorizations.filter(auth => {
      return auth.status === 'active' && new Date(auth.end_date) >= new Date(today);
    });
  } catch (error) {
    console.error('Error fetching client authorizations:', error);
    return [];
  }
}

/**
 * Validate time entry against authorization
 * Returns { isValid, message, warning, hoursRemaining }
 */
export async function validateTimeEntryAgainstAuthorization(base44, timeEntry) {
  const durationHours = timeEntry.duration_minutes / 60;

  // If no authorization_id specified, try to find one by service type and date
  let authorization = null;
  if (timeEntry.service_authorization_id) {
    authorization = await base44.entities.ServiceAuthorization.list()
      .then(all => all.find(a => a.id === timeEntry.service_authorization_id));
  } else if (timeEntry.client_id && timeEntry.category) {
    // Map category to service_type
    const serviceType = mapCategoryToServiceType(timeEntry.category);
    authorization = await getActiveAuthorization(base44, timeEntry.client_id, serviceType, timeEntry.date);
  }

  if (!authorization) {
    return {
      isValid: false,
      message: 'No active authorization found for this service type and date',
      warning: null,
      hoursRemaining: null,
      authorizationId: null
    };
  }

  const hoursRemaining = authorization.total_authorized_hours - (authorization.hours_used || 0);

  // Check if adding this time entry would exceed authorized hours
  if (durationHours > hoursRemaining) {
    return {
      isValid: false,
      message: `Cannot log ${durationHours.toFixed(2)} hours. Only ${hoursRemaining.toFixed(2)} hours remaining in authorization ${authorization.authorization_number}`,
      warning: null,
      hoursRemaining,
      authorizationId: authorization.id
    };
  }

  // Warning if nearly exhausted
  let warning = null;
  if (hoursRemaining - durationHours <= 1) {
    warning = `Warning: This will leave only ${(hoursRemaining - durationHours).toFixed(2)} hours remaining`;
  }

  return {
    isValid: true,
    message: `Time entry valid. Authorization: ${authorization.authorization_number}`,
    warning,
    hoursRemaining: hoursRemaining - durationHours,
    authorizationId: authorization.id
  };
}

/**
 * Update authorization hours after time entry creation/update
 * Recalculates hours_used and hours_remaining
 */
export async function updateAuthorizationHours(base44, authorizationId, durationMinutes, operation = 'add') {
  try {
    const authorization = await base44.entities.ServiceAuthorization.list()
      .then(all => all.find(a => a.id === authorizationId));

    if (!authorization) {
      throw new Error('Authorization not found');
    }

    const durationHours = durationMinutes / 60;
    const newHoursUsed = operation === 'add'
      ? (authorization.hours_used || 0) + durationHours
      : (authorization.hours_used || 0) - durationHours;

    const newHoursRemaining = authorization.total_authorized_hours - newHoursUsed;

    // Determine new status
    let newStatus = authorization.status;
    if (newHoursRemaining <= 0) {
      newStatus = 'exhausted';
    }

    const updated = await base44.asServiceRole.entities.ServiceAuthorization.update(authorizationId, {
      hours_used: Math.max(0, newHoursUsed),
      hours_remaining: Math.max(0, newHoursRemaining),
      status: newStatus
    });

    return {
      success: true,
      authorization: updated,
      hoursUsed: newHoursUsed,
      hoursRemaining: newHoursRemaining,
      message: `Updated authorization. ${newHoursRemaining.toFixed(2)} hours remaining.`
    };
  } catch (error) {
    console.error('Error updating authorization hours:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get hours used for authorization between date range
 */
export async function getAuthorizationHoursUsedInPeriod(base44, authorizationId, startDate, endDate) {
  try {
    const authorization = await base44.entities.ServiceAuthorization.list()
      .then(all => all.find(a => a.id === authorizationId));

    if (!authorization) return 0;

    const timeEntries = await base44.entities.TimeEntry.filter({
      service_authorization_id: authorizationId
    });

    const entriesInPeriod = timeEntries.filter(te => {
      const entryDate = new Date(te.date);
      return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
    });

    return entriesInPeriod.reduce((sum, te) => sum + (te.duration_minutes / 60), 0);
  } catch (error) {
    console.error('Error calculating authorization hours:', error);
    return 0;
  }
}

/**
 * Map TimeEntry category to ServiceAuthorization service_type
 */
export function mapCategoryToServiceType(category) {
  const mapping = {
    'job_coaching': 'job_coaching',
    'life_skills': 'life_skills',
    'cbh': 'cbh',
    'job_search': 'job_development',
    'resume_work': 'job_development',
    'interview_prep': 'job_development',
    'follow_up': 'job_development',
    'consultation': 'job_development',
    'admin': null,
    'other': null
  };

  return mapping[category] || 'job_development';
}

/**
 * Get authorization summary for client
 */
export async function getAuthorizationSummary(base44, clientId) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId
    });

    const today = new Date().toISOString().split('T')[0];

    return {
      total: authorizations.length,
      active: authorizations.filter(a => 
        a.status === 'active' && new Date(a.end_date) >= new Date(today)
      ).length,
      expired: authorizations.filter(a => 
        new Date(a.end_date) < new Date(today)
      ).length,
      exhausted: authorizations.filter(a => a.status === 'exhausted').length,
      pending: authorizations.filter(a => a.status === 'pending').length,
      byServiceType: groupAuthorizationsByType(authorizations),
      authorizations
    };
  } catch (error) {
    console.error('Error getting authorization summary:', error);
    return {
      total: 0,
      active: 0,
      expired: 0,
      exhausted: 0,
      pending: 0,
      byServiceType: {},
      authorizations: []
    };
  }
}

/**
 * Group authorizations by service type with summary
 */
function groupAuthorizationsByType(authorizations) {
  const grouped = {};

  authorizations.forEach(auth => {
    if (!grouped[auth.service_type]) {
      grouped[auth.service_type] = {
        count: 0,
        totalAuthorized: 0,
        totalUsed: 0,
        totalRemaining: 0,
        items: []
      };
    }

    grouped[auth.service_type].count += 1;
    grouped[auth.service_type].totalAuthorized += auth.total_authorized_hours;
    grouped[auth.service_type].totalUsed += auth.hours_used || 0;
    grouped[auth.service_type].totalRemaining += auth.hours_remaining || 0;
    grouped[auth.service_type].items.push({
      id: auth.id,
      number: auth.authorization_number,
      status: auth.status,
      hoursUsed: auth.hours_used,
      hoursRemaining: auth.hours_remaining,
      endDate: auth.end_date
    });
  });

  return grouped;
}

/**
 * Check authorization expiration status
 */
export function getAuthorizationStatus(authorization) {
  const today = new Date();
  const endDate = new Date(authorization.end_date);
  const daysUntilExpiry = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

  return {
    status: authorization.status,
    isExpired: endDate < today,
    isExpiring: daysUntilExpiry <= 7 && daysUntilExpiry >= 0,
    daysUntilExpiry,
    percentUsed: (authorization.hours_used / authorization.total_authorized_hours) * 100,
    isExhausted: authorization.hours_remaining <= 0
  };
}

/**
 * Validate authorization and return detailed status
 */
export function validateAuthorizationStatus(authorization) {
  const errors = [];
  const warnings = [];

  // Check expiration
  const today = new Date().toISOString().split('T')[0];
  if (authorization.end_date < today) {
    errors.push('Authorization has expired');
  }

  // Check hours exhaustion
  if ((authorization.hours_remaining || 0) <= 0) {
    errors.push('Authorization hours exhausted');
  }

  // Check near-exhaustion
  const hoursRemaining = authorization.hours_remaining || 0;
  if (hoursRemaining <= 5 && hoursRemaining > 0) {
    warnings.push(`Only ${hoursRemaining.toFixed(2)} hours remaining`);
  }

  // Check if expiring soon
  const daysUntilExpiry = Math.floor(
    (new Date(authorization.end_date) - new Date(today)) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
    warnings.push(`Authorization expires in ${daysUntilExpiry} days`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    canUse: errors.length === 0
  };
}