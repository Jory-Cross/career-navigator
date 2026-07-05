import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Disabled during the security remediation freeze.
 *
 * The prior page launched platform agent conversations without the reviewed
 * server-authorized tenant and client-context boundary required for AI tools.
 */
export default function AgentsPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"
        role="status"
      >
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          AI agents are temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          AI workflows are being reviewed for verified organization and client
          data boundaries. Existing client records are not changed.
        </p>
      </section>
    </main>
  );
}