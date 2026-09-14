import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Briefcase, Clock, UserX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const roleColors = {
  employee: "bg-blue-100 text-blue-700",
  management: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

export default function EmployeeDetailHeader({ employee, isInactive, canManage, onOffboard, onReactivate }) {
  const initials = `${employee.full_name?.split(' ')[0]?.[0] || ''}${employee.full_name?.split(' ')[1]?.[0] || ''}`;

  const contactItems = [
    employee.title && { icon: Briefcase, text: employee.title },
    employee.phone && { icon: Phone, text: employee.phone },
    employee.timezone && { icon: Clock, text: employee.timezone },
  ].filter(Boolean);

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
          {employee.avatar_url ? (
            <img src={employee.avatar_url} alt={employee.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
              {initials || '?'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{employee.full_name || employee.email}</h2>
            <Badge className={cn("text-[10px] border-0", roleColors[employee.role] || "bg-slate-100 text-slate-500")}>
              {employee.role}
            </Badge>
            {isInactive && (
              <Badge className="text-[10px] border-0 bg-red-100 text-red-600 flex items-center gap-1">
                <UserX className="w-3 h-3" /> Access Removed
              </Badge>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-sm text-slate-500 truncate">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {employee.email}
          </p>

          {contactItems.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap pt-0.5">
              {contactItems.map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1 text-xs text-slate-400">
                  <Icon className="w-3 h-3" /> {text}
                </span>
              ))}
            </div>
          )}
        </div>

        {canManage && !isInactive && (
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            onClick={onOffboard}
          >
            <UserX className="w-4 h-4 mr-2" /> Offboard Employee
          </Button>
        )}
        {canManage && isInactive && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            onClick={onReactivate}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Reactivate Employee
          </Button>
        )}
      </div>
    </Card>
  );
}