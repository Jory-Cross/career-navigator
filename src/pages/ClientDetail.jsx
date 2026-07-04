import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Client Detail disabled during the security remediation freeze.
 *
 * The legacy page directly loaded a client in the browser, used client-side
 * authorization checks, and mounted multiple direct-data subpanels. Restore
 * it only after a complete server-authorized client workspace is available.
 */
export default function ClientDetail() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        to="/Clients"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <section
        className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="status"
      >
        <h1 className="text-base font-semibold">Client workspace is temporarily unavailable.</h1>
        <p className="mt-2">
          Client detail access is disabled while security remediation is in progress.
        </p>
      </section>
    </main>
  );
}
