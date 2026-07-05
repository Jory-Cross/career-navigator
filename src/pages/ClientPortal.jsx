import React from "react";

/**
 * General client portal disabled during the security remediation freeze.
 *
 * The legacy portal resolved client records in the browser and mounted several
 * direct-data read/write tabs. Pre-ETS uses its separate authorized portal.
 * Restore this portal only after a scoped server-authorized replacement exists.
 */
export default function ClientPortal() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Client portal is temporarily unavailable.</h1>
        <p className="mt-2">
          This portal is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
