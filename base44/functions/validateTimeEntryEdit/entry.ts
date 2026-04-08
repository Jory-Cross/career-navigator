import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validate if a time entry can be edited
 * Checks if entry is locked in a report and returns guidance
 * 
 * Request body:
 * {
 *   entry_id: string,
 *   proposed_changes: { field: value, ... }
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entry_id, proposed_changes } = await req.json();

    if (!entry_id) {
      return Response.json({ error: 'entry_id required' }, { status: 400 });
    }

    // Fetch the entry
    const entries = await base44.entities.TimeEntry.filter({ id: entry_id });
    const entry = entries[0];

    if (!entry) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Check lock status
    const lockStatus = checkEntryLocked(entry);

    if (lockStatus.locked) {
      // Entry is locked
      const canOverride = user.role === 'admin' || user.role === 'management';

      return Response.json({
        success: false,
        locked: true,
        locked_in_report_id: lockStatus.locked_in_report_id,
        message: lockStatus.message,
        can_override_with_supervisor: canOverride,
        user_role: user.role
      });
    }

    // Entry is not locked - edit is allowed
    return Response.json({
      success: true,
      locked: false,
      message: 'Entry can be edited',
      changes_proposed: Object.keys(proposed_changes || {})
    });

  } catch (error) {
    console.error('validateTimeEntryEdit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function checkEntryLocked(entry) {
  if (!entry) {
    return { locked: false, locked_in_report_id: null, message: null };
  }

  if (entry.locked_in_report_id) {
    return {
      locked: true,
      locked_in_report_id: entry.locked_in_report_id,
      message: `Entry is locked in generated report ${entry.locked_in_report_id}. Contact supervisor to unlock or regenerate report.`
    };
  }

  return { locked: false, locked_in_report_id: null, message: null };
}