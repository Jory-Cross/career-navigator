import React from "react";

/**
 * Reporting disabled during the security remediation freeze.
 *
 * The legacy page assembled report, payroll, compliance, and authorization
 * widgets from browser-side entity reads. Restore only after each reporting
 * surface uses organization-scoped server aggregates and authorized generation.
 */
export default function Reports() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Reporting is temporarily unavailable.</h1>
        <p className="mt-2">
          Reporting is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
