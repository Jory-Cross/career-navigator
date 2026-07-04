import React from "react";

/**
 * Legacy VR batch report workflow disabled during the security remediation freeze.
 *
 * This component previously read templates and clients directly in the browser
 * and invoked an unscoped report-generation route. Do not re-enable it until
 * server-authorized report discovery and generation are implemented.
 */
export default function VRBatchReportGenerator() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">VR batch report generation is temporarily unavailable.</p>
      <p className="mt-1">
        This legacy workflow is disabled while security remediation is in progress.
      </p>
    </div>
  );
}
