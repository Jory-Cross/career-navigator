import React from "react";

/**
 * Application analytics disabled during the security remediation freeze.
 *
 * The legacy page directly listed organization-wide JobApplication and Client
 * records in the browser. Restore it only with a server-authorized aggregate.
 */
export default function AppAnalytics() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Application analytics are temporarily unavailable.</h1>
        <p className="mt-2">
          This page is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
