import React from "react";

/**
 * Report generation is disabled during the security remediation freeze.
 *
 * The previous workflow performed broad browser-side reads of Clients and
 * TimeEntries, then invoked a legacy server route that could create report
 * artifacts and lock TimeEntry records without canonical organization scope.
 * Re-enable only after scoped server reads and server-authorized report
 * generation are implemented.
 */
export default function SafeReportGenerator() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Report generation is temporarily unavailable.</p>
      <p className="mt-1">
        This workflow is disabled while security remediation is in progress.
      </p>
    </div>
  );
}
