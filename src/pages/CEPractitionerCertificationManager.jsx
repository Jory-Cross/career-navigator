import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Disabled during the security remediation freeze.
 *
 * Certification administration is a cross-tenant platform authority surface.
 * The prior workflow is unavailable until its canonical Platform Owner and
 * audit controls are fully rebuilt and reviewed.
 */
export default function CEPractitionerCertificationManager() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"
        role="status"
      >
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          CE practitioner certification administration is temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Certification records are protected while platform-level access controls
          are being remediated. Existing certifications and enrollment records are
          not changed.
        </p>
      </section>
    </main>
  );
}