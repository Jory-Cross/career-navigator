import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Disabled during the security remediation freeze.
 *
 * This legacy editor directly listed, created, updated, and deleted shared
 * PDFFieldMap records in the browser. Report mapping maintenance must return
 * only through a reviewed, server-authorized configuration workflow.
 */
export default function PDFFieldMapEditor() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-amber-950">
            PDF Field Mapping Unavailable
          </h2>
          <p className="text-sm text-amber-900">
            PDF field-mapping maintenance is temporarily unavailable while security remediation is in progress.
          </p>
        </div>
      </div>
    </Card>
  );
}
