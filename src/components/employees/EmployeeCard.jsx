import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDisplayPayrollPeriod, parseDateOnly } from "@/lib/payrollDisplayPeriod";

const roleColors = {
  employee: "bg-blue-100 text-blue-700",
  management: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

export default function EmployeeCard({ employee, onClick }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => c.assigned_employee_id === employee.id && !c.is_archived);
    }
  });

  const period = getDisplayPayrollPeriod();

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-for-employee-card", employee.id],
    queryFn: async () => {
      const all = await base44.entities.TimeEntry.list();
      return all.filter(t => t.employee_id === employee.id || t.created_by_id === employee.id);
    }
  });

  const periodHours = Math.round(
    timeEntries
      .filter(t => {
        const d = parseDateOnly(t.date);
        return d && d >= period.start && d <= period.end;
      })
      .reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10
  ) / 10;

  const initials = `${employee.full_name?.split(' ')[0]?.[0] || ''}${employee.full_name?.split(' ')[1]?.[0] || ''}`;

  return (
    <Card
      onClick={onClick}
      className="border-0 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-5"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
          {employee.avatar_url ? (
            <img src={employee.avatar_url} alt={employee.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {initials || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{employee.full_name || employee.email}</h3>
            <Badge className={cn("text-[10px] border-0 shrink-0", roleColors[employee.role] || "bg-slate-100 text-slate-500")}>
              {employee.role}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{employee.email}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="w-3 h-3" />
          <span>{clients.length} client{clients.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{periodHours}h · {period.label}</span>
        </div>
      </div>
    </Card>
  );
}