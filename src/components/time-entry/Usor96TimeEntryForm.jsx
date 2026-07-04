import React from "react";

/**
 * Legacy USOR96 TimeEntry workflow disabled during the security remediation freeze.
 *
 * This form previously read EntryType configuration in the browser before
 * submitting a TimeEntry. Re-enable only after a server-authorized replacement
 * provides both entry-type discovery and persistence.
 */
export default function Usor96TimeEntryForm() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">USOR96 time entry is temporarily unavailable.</p>
      <p className="mt-1">
        This legacy workflow is disabled while security remediation is in progress.
        Use the current Time Tracking workflow to record time.
      </p>
    </div>
  );
}
