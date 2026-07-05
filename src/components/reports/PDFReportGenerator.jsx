import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Disabled during the security remediation freeze.
 *
 * This legacy report generator directly read client, TimeEntry, PDFTemplate,
 * EntryType, and PDFFieldMap records in the browser and could mutate shared
 * report configuration. Reporting must return only through reviewed,
 * server-authorized report and template workflows.
 */
export default function PDFReportGenerator() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-amber-950">
            PDF Reporting Unavailable
          </h2>
          <p className="text-sm text-amber-900">
            PDF report generation and template administration are temporarily unavailable while security remediation is in progress.
          </p>
        </div>
      </div>
    </Card>
  );
}
