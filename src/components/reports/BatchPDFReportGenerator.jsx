import React from "react";

/**
 * Legacy batch PDF workflow disabled during the security remediation freeze.
 *
 * This component previously exposed browser-side template and client discovery
 * and invoked an unscoped server report route. Re-enable only after the report
 * workflow has scoped server reads and server-authorized generation.
 */
export default function BatchPDFReportGenerator() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Batch PDF generation is temporarily unavailable.</p>
      <p className="mt-1">
        This legacy workflow is disabled while security remediation is in progress.
      </p>
    </div>
  );
}
