import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function TimeLogSection() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-amber-950">
            Client Time Log Unavailable
          </h3>
          <p className="text-sm text-amber-900">
            The legacy client-detail time editor is temporarily unavailable
            during security remediation.
          </p>
          <p className="text-sm text-amber-800">
            Client-specific time-entry creation, editing, deletion, and
            meeting creation will return after this workflow is fully served
            through secured organization-scoped routes.
          </p>
        </div>
      </div>
    </Card>
  );
}
