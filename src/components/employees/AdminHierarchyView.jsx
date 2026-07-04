import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AdminHierarchyView() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-amber-950">
            Organization Hierarchy Editing Unavailable
          </h2>
          <p className="text-sm text-amber-900">
            Legacy hierarchy controls are temporarily unavailable during
            security remediation.
          </p>
          <p className="text-sm text-amber-800">
            Manager assignments can still be managed through the secured
            Manager Assignments section below.
          </p>
        </div>
      </div>
    </Card>
  );
}
