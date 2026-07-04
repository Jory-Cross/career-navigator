import React from "react";

/**
 * Legacy USOR96 launcher disabled during the security remediation freeze.
 */
export default function Usor96Launcher() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">USOR96 time entry is temporarily unavailable.</p>
      <p className="mt-1">
        This legacy workflow is disabled while security remediation is in progress.
      </p>
    </div>
  );
}
