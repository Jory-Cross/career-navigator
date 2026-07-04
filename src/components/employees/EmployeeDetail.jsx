import React from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function EmployeeDetail({ employee }) {
  const employeeName = employee?.full_name || employee?.email || "Employee";

  return (
    <Card className="border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-amber-950">
            Employee Detail Unavailable
          </h2>
          <p className="text-sm text-amber-900">
            Detailed employee records for {employeeName} are temporarily
            unavailable during security remediation.
          </p>
          <p className="text-sm text-amber-800">
            This workspace will return after employee, client, time-entry,
            task, and activity data are served through secured
            organization-scoped routes.
          </p>
        </div>
      </div>
    </Card>
  );
}
