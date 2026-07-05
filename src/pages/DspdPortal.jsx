import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Disabled during the security remediation freeze.
 *
 * The prior DSPD portal directly read, created, updated, and deleted
 * client-linked records from the browser using browser-defined client scope.
 * It also used email matching to resolve DSPD self-service records. A secure
 * replacement must use canonical user identity, organization scope, explicit
 * linked-client relationships, and server-authorized mutations.
 */
export default function DspdPortal() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"
        role="status"
      >
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          DSPD portal access is temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          This portal is being rebuilt behind verified organization and
          client-access controls. Existing records are not changed.
        </p>
      </section>
    </main>
  );
}