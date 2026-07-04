import React from "react";

/**
 * Organization dashboard disabled during the security remediation freeze.
 *
 * The legacy page directly read Organization, User, and Client records in the
 * browser and exposed legacy invitation actions. Restore it only after a
 * server-authorized organization dashboard is implemented.
 */
export default function OrgDashboard() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Organization dashboard is temporarily unavailable.</h1>
        <p className="mt-2">
          This page is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
