import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validate time entry against service authorization
 * POST /validateTimeEntryAuthorization
 * 
 * Body:
 * {
 *   action: 'validate' | 'create_with_auth',
 *   timeEntry: { client_id, date, duration_minutes, entry_type_code, ... },
 *   serviceAuthorizationId?: 'auth_123' (optional, auto-fetch if not provided)
 * }
 * 
 * Returns validation result or created entry
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, timeEntry, serviceAuthorizationId } = await req.json();

    if (!action || !timeEntry) {
      return Response.json(
        { error: 'Missing required fields: action, timeEntry' },
        { status: 400 }
      );
    }

    // Get or auto-fetch authorization
    let authorization = null;
    if (serviceAuthorizationId) {
      try {
        const auths = await base44.entities.ServiceAuthorization.filter({
          id: serviceAuthorizationId
        });
        authorization = auths[0] || null;
      } catch (error) {
        console.error('Error fetching authorization:', error);
      }
    } else if (timeEntry.entry_type_code) {
      // Auto-fetch active authorization for this service type
      try {
        const auths = await base44.entities.ServiceAuthorization.filter({
          client_id: timeEntry.client_id,
          service_type_code: timeEntry.entry_type_code,
          status: 'active'
        });
        authorization = auths[0] || null;
      } catch (error) {
        console.error('Error auto-fetching authorization:', error);
      }
    }

    if (action === 'validate') {
      // Just validate, don't create
      const validation = validateTimeEntry(timeEntry, authorization);
      return Response.json(validation);
    }

    if (action === 'create_with_auth') {
      // Validate and create if valid
      const validation = validateTimeEntry(timeEntry, authorization);

      if (!validation.isValid) {
        return Response.json(
          { error: validation.message, ...validation },
          { status: 400 }
        );
      }

      // Create time entry
      try {
        const entry = await base44.asServiceRole.entities.TimeEntry.create({
          ...timeEntry,
          service_authorization_id: authorization?.id || null,
          org_id: user.org_id
        });

        // Update authorization hours if linked
        if (authorization?.id) {
          await updateAuthorizationHours(base44, authorization.id);
        }

        return Response.json({
          success: true,
          entry,
          validation,
          message: `Time entry created${validation.warnings.length > 0 ? ' with warnings' : ''}`
        });
      } catch (error) {
        console.error('Error creating time entry:', error);
        return Response.json(
          { error: 'Failed to create time entry', details: error.message },
          { status: 500 }
        );
      }
    }

    return Response.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('validateTimeEntryAuthorization error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

/**
 * Validate time entry against authorization
 */
function validateTimeEntry(timeEntry, authorization) {
  const errors = [];
  const warnings = [];

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
  if (remainingHours - entryHours < 5 && remainingHours - entryHours > 0) {
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
    authorization: {
      id: authorization.id,
      authorization_number: authorization.authorization_number,
      vr_counselor_name: authorization.vr_counselor_name,
      job_goal: authorization.job_goal,
      total_authorized_hours: authorization.total_authorized_hours,
      used_hours: authorization.used_hours,
      remaining_hours: remainingHours - entryHours
    }
  };
}

/**
 * Update authorization hours after time entry creation
 */
async function updateAuthorizationHours(base44, authorizationId) {
  try {
    const auths = await base44.entities.ServiceAuthorization.filter({
      id: authorizationId
    });

    if (!auths || auths.length === 0) return;

    const authorization = auths[0];

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
  } catch (error) {
    console.error('updateAuthorizationHours error:', error);
  }
}