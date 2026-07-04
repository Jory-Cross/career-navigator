import React from "react";

/**
 * Legacy structured vocational-rehabilitation TimeEntry workflow disabled
 * during the security remediation freeze.
 *
 * This form previously read templates and ReportFieldAnswer records directly
 * in the browser. Re-enable only after a server-authorized replacement exists
 * and all callers are explicitly migrated.
 */
export default function StructuredVocRehabForm() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">
        Legacy structured vocational-rehabilitation time entry is temporarily unavailable.
      </p>
      <p className="mt-1">
        This workflow is disabled while security remediation is in progress. Use
        the current Time Tracking workflow to record time.
      </p>
    </div>
  );
}
