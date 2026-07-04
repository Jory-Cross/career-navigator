import React from "react";

/**
 * Global operational metrics are disabled during the security remediation freeze.
 *
 * The previous widget directly listed all TimeEntry and ReportFieldAnswer
 * records in the browser. Restore it only with an organization-scoped,
 * server-authorized aggregate route.
 */
export default function OperationalMetrics() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Operational metrics are temporarily unavailable.</p>
      <p className="mt-1">
        This widget is disabled while security remediation is in progress.
      </p>
    </div>
  );
}
