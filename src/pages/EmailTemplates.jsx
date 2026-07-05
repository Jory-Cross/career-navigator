import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Disabled during the security remediation freeze.
 *
 * The prior page directly listed and mutated email templates in the browser.
 * Outbound-email workflows remain unavailable until tenant-scoped server
 * authority and audit controls are rebuilt.
 */
export default function EmailTemplates() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm"
        role="status"
      >
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-700" />
        <h1 className="text-lg font-semibold text-amber-950">
          Email templates are temporarily unavailable.
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Email configuration is being rebuilt behind verified organization and
          audit controls. Existing templates are not changed.
        </p>
      </section>
    </main>
  );
}