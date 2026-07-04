import React from "react";

/**
 * Calendar disabled during the security remediation freeze.
 *
 * The legacy page directly read organization-wide Client, Meeting, and
 * TimeEntry data in the browser and could directly delete a linked TimeEntry.
 * Restore only after all calendar data and mutations use authorized,
 * organization-scoped server routes.
 */
export default function Calendar() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Calendar is temporarily unavailable.</h1>
        <p className="mt-2">
          Calendar access is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
