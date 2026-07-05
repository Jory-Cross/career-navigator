import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Disabled during the security remediation freeze.
 *
 * The prior intake panel directly listed, created, and updated IntakeSection
 * records in the browser, including bulk client assignment. Intake workflows
 * must return only after a reviewed, server-authorized, organization-scoped
 * replacement is implemented.
 */
export default function IntakePacketPanel() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-amber-950">
            Intake Packet Unavailable
          </h2>
          <p className="text-sm text-amber-900">
            Intake packet editing is temporarily unavailable while security remediation is in progress.
          </p>
        </div>
      </div>
    </Card>
  );
}
