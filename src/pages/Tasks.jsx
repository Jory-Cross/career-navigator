import React from "react";

/**
 * Tasks disabled during the security remediation freeze.
 *
 * The legacy page directly read and mutated broad Task and Client records in
 * the browser. Restore it only after a server-authorized, organization-scoped
 * task workflow is implemented.
 */
export default function Tasks() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Tasks are temporarily unavailable.</h1>
        <p className="mt-2">
          This page is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
