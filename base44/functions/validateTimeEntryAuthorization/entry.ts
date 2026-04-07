import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validates time entry against service authorization before saving
 * Prevents logging time beyond authorized hours
 * Updates authorization hours_used when entry is created
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, timeEntry, authorizationId } = body;

    if (action === 'validate') {
      return await validateTimeEntry(base44, timeEntry);
    } else if (action === 'create_with_auth') {
      return await createTimeEntryWithAuth(base44, user, timeEntry, authorizationId);
    } else if (action === 'get_summary') {
      return await getClientAuthorizationSummary(base44, timeEntry.client_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('validateTimeEntryAuthorization error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ===== VALIDATE TIME ENTRY =====

async function validateTimeEntry(base44, timeEntry) {
  const durationHours = timeEntry.duration_minutes / 60;

  // Find active authorization for this service type
  let authorization = null;
  if (timeEntry.service_authorization_id) {
    const auths = await base44.entities.ServiceAuthorization.list();
    authorization = auths.find(a => a.id === timeEntry.service_authorization_id);
  } else if (timeEntry.client_id && timeEntry.category) {
    const serviceType = mapCategoryToServiceType(timeEntry.category);
    authorization = await getActiveAuthorization(
      base44,
      timeEntry.client_id,
      serviceType,
      timeEntry.date
    );
  }

  if (!authorization) {
    return Response.json({
      success: false,
      valid: false,
      message: 'No active authorization found for this service',
      error: 'NO_AUTHORIZATION'
    }, { status: 422 });
  }

  // Check hours remaining
  const hoursRemaining = authorization.total_authorized_hours - (authorization.hours_used || 0);
  if (durationHours > hoursRemaining) {
    return Response.json({
      success: false,
      valid: false,
      message: `Cannot log ${durationHours.toFixed(2)} hours. Only ${hoursRemaining.toFixed(2)} hours remaining in authorization ${authorization.authorization_number}`,
      error: 'INSUFFICIENT_HOURS',
      hoursRemaining,
      authorizationId: authorization.id
    }, { status: 422 });
  }

  // Check expiration
  const today = new Date().toISOString().split('T')[0];
  if (authorization.end_date < today) {
    return Response.json({
      success: false,
      valid: false,
      message: `Authorization ${authorization.authorization_number} expired on ${authorization.end_date}`,
      error: 'AUTHORIZATION_EXPIRED',
      authorizationId: authorization.id
    }, { status: 422 });
  }

  // Warn if nearly exhausted
  let warning = null;
  if (hoursRemaining - durationHours <= 1) {
    warning = `Warning: This will leave only ${(hoursRemaining - durationHours).toFixed(2)} hours remaining`;
  }

  return Response.json({
    success: true,
    valid: true,
    message: `Time entry valid. Authorization: ${authorization.authorization_number}`,
    warning,
    hoursRemaining: hoursRemaining - durationHours,
    authorizationId: authorization.id
  });
}

// ===== CREATE TIME ENTRY WITH AUTHORIZATION =====

async function createTimeEntryWithAuth(base44, user, timeEntry, authorizationId) {
  try {
    // First validate
    const validation = await validateTimeEntry(base44, timeEntry);
    if (!validation.ok && validation.status !== 200) {
      return validation;
    }

    const validationData = await validation.json();
    if (!validationData.valid) {
      return Response.json(validationData, { status: 422 });
    }

    // Create time entry with authorization link
    const finalAuthId = authorizationId || validationData.authorizationId;
    const entry = await base44.asServiceRole.entities.TimeEntry.create({
      ...timeEntry,
      service_authorization_id: finalAuthId,
      org_id: user.org_id
    });

    // Update authorization hours
    const durationHours = timeEntry.duration_minutes / 60;
    const authUpdate = await base44.entities.ServiceAuthorization.list()
      .then(all => all.find(a => a.id === finalAuthId));

    const newHoursUsed = (authUpdate.hours_used || 0) + durationHours;
    const newHoursRemaining = authUpdate.total_authorized_hours - newHoursUsed;
    const newStatus = newHoursRemaining <= 0 ? 'exhausted' : authUpdate.status;

    await base44.asServiceRole.entities.ServiceAuthorization.update(finalAuthId, {
      hours_used: newHoursUsed,
      hours_remaining: newHoursRemaining,
      status: newStatus
    });

    return Response.json({
      success: true,
      entry,
      authorizationId: finalAuthId,
      hoursUsed: newHoursUsed,
      hoursRemaining: newHoursRemaining,
      message: `Time entry created. ${newHoursRemaining.toFixed(2)} hours remaining in authorization.`
    });
  } catch (error) {
    console.error('Error creating time entry:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== GET CLIENT AUTHORIZATION SUMMARY =====

async function getClientAuthorizationSummary(base44, clientId) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId
    });

    const today = new Date().toISOString().split('T')[0];

    const summary = {
      total: authorizations.length,
      active: [],
      expired: [],
      exhausted: [],
      byServiceType: {}
    };

    for (const auth of authorizations) {
      const status = {
        id: auth.id,
        number: auth.authorization_number,
        serviceType: auth.service_type,
        totalHours: auth.total_authorized_hours,
        hoursUsed: auth.hours_used || 0,
        hoursRemaining: auth.hours_remaining || 0,
        percentUsed: ((auth.hours_used || 0) / auth.total_authorized_hours * 100).toFixed(1),
        startDate: auth.start_date,
        endDate: auth.end_date,
        status: auth.status,
        isActive: auth.status === 'active' && auth.end_date >= today,
        isExpired: auth.end_date < today,
        isExhausted: auth.hours_remaining <= 0
      };

      if (status.isExhausted) {
        summary.exhausted.push(status);
      } else if (status.isExpired) {
        summary.expired.push(status);
      } else if (status.isActive) {
        summary.active.push(status);
      }

      // Group by service type
      if (!summary.byServiceType[auth.service_type]) {
        summary.byServiceType[auth.service_type] = [];
      }
      summary.byServiceType[auth.service_type].push(status);
    }

    return Response.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting authorization summary:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== HELPER FUNCTIONS =====

async function getActiveAuthorization(base44, clientId, serviceType, onDate) {
  try {
    const authorizations = await base44.entities.ServiceAuthorization.filter({
      client_id: clientId,
      service_type: serviceType
    });

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

function mapCategoryToServiceType(category) {
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