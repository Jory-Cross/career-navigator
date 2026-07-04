import React from "react";

/**
 * Legacy VR time-entry workflow disabled during the security remediation freeze.
 *
 * This component previously performed direct browser reads and writes against
 * protected entities. Do not re-enable it until an authorized server-side
 * replacement is implemented and all callers are migrated.
 */
export default function VRTimeEntryForm() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Legacy VR Time Entry is temporarily unavailable.</p>
      <p className="mt-1">
        This form is disabled while security remediation is in progress. Use the current
        Time Tracking workflow to record time.
      </p>
    </div>
  );
}
