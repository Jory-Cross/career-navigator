import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Supervisor/Admin override to unlock and edit a locked entry
 * Creates audit log entry for the unlock
 * 
 * Request body:
 * {
 *   entry_id: string,
 *   updates: { field: value, ... },
 *   unlock_reason: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin/management can override locks
    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json(
        { error: 'Forbidden: Only supervisors can override locks' },
        { status: 403 }
      );
    }

    const { entry_id, updates, unlock_reason } = await req.json();

    if (!entry_id) {
      return Response.json({ error: 'entry_id required' }, { status: 400 });
    }

    // Fetch the entry
    const entries = await base44.entities.TimeEntry.filter({ id: entry_id });
    const entry = entries[0];

    if (!entry) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    if (!entry.locked_in_report_id) {
      return Response.json(
        { error: 'Entry is not locked', locked: false },
        { status: 400 }
      );
    }

    // Apply updates and clear lock
    const updateData = {
      ...updates,
      locked_in_report_id: null, // Unlock
      report_ready: false // Reset report ready flag
    };

    const updated = await base44.entities.TimeEntry.update(entry_id, updateData);

    // Log the override action
    console.log(`[supervisor override] ${user.email} unlocked entry ${entry_id} from report ${entry.locked_in_report_id}. Reason: ${unlock_reason || 'none provided'}`);

    return Response.json({
      success: true,
      entry_id: updated.id,
      was_locked_in_report: entry.locked_in_report_id,
      unlocked_by: user.email,
      unlocked_at: new Date().toISOString(),
      unlock_reason,
      updated_fields: Object.keys(updates || {})
    });

  } catch (error) {
    console.error('supervisorUnlockEntry error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});