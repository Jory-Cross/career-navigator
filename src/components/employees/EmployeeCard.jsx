import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const roleColors = {
  employee: "bg-blue-100 text-blue-700",
  management: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

/**
 * Employee summary card constrained during the security remediation freeze.
 *
 * Payroll-hour and client-count summaries previously required broad browser
 * reads of Client and TimeEntry. Those summaries return only after a scoped
 * server aggregate route is introduced.
 */
export default function EmployeeCard({ employee, onClick }) {
  const firstInitial = employee?.full_name?.split(" ")[0]?.[0] || "";
  const secondInitial = employee?.full_name?.split(" ")[1]?.[0] || "";
  const initials = `${firstInitial}${secondInitial}` || "?";

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer border-0 p-5 shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          {employee?.avatar_url ? (
            <img
              src={employee.avatar_url}
              alt={employee?.full_name || "Employee"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-sm font-semibold text-white">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">
              {employee?.full_name || employee?.email || "Employee"}
            </h3>
            <Badge
              className={cn(
                "shrink-0 border-0 text-[10px]",
                roleColors[employee?.role] || "bg-slate-100 text-slate-500"
              )}
            >
              {employee?.role || "staff"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {employee?.email || ""}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Client and payroll summaries are temporarily unavailable during security remediation.
          </p>
        </div>

        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
      </div>
    </Card>
  );
}
