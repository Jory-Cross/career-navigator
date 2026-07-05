import React from "react";
import { Building2 } from "lucide-react";

/**
 * Legacy organization provisioning is disabled during the security remediation
 * freeze. The prior page created organization and billing state from
 * browser-supplied values before the authoritative lifecycle was validated.
 */
export default function OrgSignup() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50 p-4">
      <section
        className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm"
        role="status"
      >
        <Building2 className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          Organization signup is temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm text-amber-900">
          Organization provisioning is paused while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
