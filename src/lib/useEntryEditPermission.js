import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook to check if a time entry can be edited
 * Validates against period locks and returns guidance
 */
export function useEntryEditPermission() {
  const [validating, setValidating] = useState(false);
  const [lockError, setLockError] = useState(null);

  const checkEditPermission = useCallback(async (entryId, proposedChanges = {}) => {
    setValidating(true);
    setLockError(null);

    try {
      const res = await base44.functions.invoke('validateTimeEntryEdit', {
        entry_id: entryId,
        proposed_changes: proposedChanges
      });

      if (!res.data.success && res.data.locked) {
        setLockError({
          locked: true,
          locked_in_report_id: res.data.locked_in_report_id,
          message: res.data.message,
          can_override_with_supervisor: res.data.can_override_with_supervisor,
          user_role: res.data.user_role
        });

        return {
          allowed: false,
          locked: true,
          message: res.data.message,
          can_override: res.data.can_override_with_supervisor
        };
      }

      return {
        allowed: true,
        locked: false,
        message: 'Entry can be edited'
      };

    } catch (error) {
      const msg = error.message || 'Failed to validate entry';
      setLockError({ message: msg, locked: false });
      return { allowed: false, message: msg };
    } finally {
      setValidating(false);
    }
  }, []);

  const supervisorOverride = useCallback(async (entryId, updates, reason = '') => {
    setValidating(true);
    setLockError(null);

    try {
      const res = await base44.functions.invoke('supervisorUnlockEntry', {
        entry_id: entryId,
        updates,
        unlock_reason: reason
      });

      if (res.data.success) {
        setLockError(null);
        return { success: true, message: 'Entry unlocked and updated' };
      }

      throw new Error(res.data.error || 'Override failed');

    } catch (error) {
      const msg = error.message || 'Failed to override lock';
      setLockError({ message: msg, locked: true });
      return { success: false, message: msg };
    } finally {
      setValidating(false);
    }
  }, []);

  return {
    validating,
    lockError,
    checkEditPermission,
    supervisorOverride,
    clearLockError: () => setLockError(null)
  };
}