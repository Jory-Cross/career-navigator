import React from "react";

/**
 * Legacy time-entry workflow disabled during the security remediation freeze.
 *
 * This component previously created TimeEntry records through a browser-accessible
 * service-role client. Do not re-enable it until an authorized server-side
 * replacement exists and all callers are explicitly migrated.
 */
export default function TimeEntryFormRefactored() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Legacy Time Entry is temporarily unavailable.</p>
      <p className="mt-1">
        This form is disabled while security remediation is in progress. Use the current
        Time Tracking workflow to record time.
      </p>
    </div>
  );
}
