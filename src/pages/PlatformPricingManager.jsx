import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Disabled during the security remediation freeze.
 *
 * Platform pricing, plan, rate, and subscription administration are deferred
 * until the canonical platform-governance workflow is reviewed and re-enabled.
 */
export default function PlatformPricingManager() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"
        role="status"
      >
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          Platform pricing administration is temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Pricing plans, rates, and subscription configuration are protected while
          security remediation is in progress. Existing billing records are not changed.
        </p>
      </section>
    </main>
  );
}