import React from "react";

/**
 * Legacy structured VR TimeEntry workflow disabled during the security remediation freeze.
 *
 * This form previously performed direct browser reads of protected User,
 * ReportFieldTemplate, and ServiceAuthorization records. Do not re-enable it
 * until server-authorized reads and writes are implemented and all callers are
 * explicitly migrated.
 */
export default function StructuredVRTimeEntryForm() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">
        Legacy structured VR Time Entry is temporarily unavailable.
      </p>
      <p className="mt-1">
        This form is disabled while security remediation is in progress. Use the
        current Time Tracking workflow to record time.
      </p>
    </div>
  );
}
