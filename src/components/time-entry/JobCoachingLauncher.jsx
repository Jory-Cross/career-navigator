import React from "react";

/**
 * Legacy Job Coaching launcher disabled during the security remediation freeze.
 *
 * The active Time Tracking workflow owns Job Coaching entry creation through
 * the authorized TimeEntry mutation route.
 */
export default function JobCoachingLauncher() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      role="status"
    >
      <p className="font-semibold">Legacy Job Coaching entry launcher is temporarily unavailable.</p>
      <p className="mt-1">
        Use the current Time Tracking workflow to record Job Coaching time.
      </p>
    </div>
  );
}
