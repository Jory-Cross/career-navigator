import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronDown, ChevronRight, UserCog, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import EmployeeCard from "./EmployeeCard";

function ManagerSection({ manager, allUsers, onSelectEmployee }) {
  const [expanded, setExpanded] = useState(true);

  const employees = allUsers.filter(u => u.role === 'employee' && u.manager_id === manager.id);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-manager", manager.id],
    queryFn: async () => {
      const empIds = employees.map(e => e.id);
      if (!empIds.length) return [];
      const all = await base44.entities.Client.list();
      return all.filter(c => empIds.includes(c.assigned_employee_id) && !c.is_archived);
    },
    enabled: employees.length > 0
  });

  const initials = `${manager.full_name?.split(' ')[0]?.[0] || ''}${manager.full_name?.split(' ')[1]?.[0] || ''}`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Manager header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
          {manager.avatar_url ? (
            <img src={manager.avatar_url} alt={manager.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {initials || '?'}
            </div>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm">{manager.full_name || manager.email}</span>
            <Badge className="text-[10px] border-0 bg-purple-100 text-purple-700">Manager</Badge>
          </div>
          <p className="text-xs text-slate-500">{manager.email}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500">
          <span className="flex items-center gap-1"><UserCog className="w-3.5 h-3.5" />{employees.length} employee{employees.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{clients.length} client{clients.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Employees under this manager */}
      {expanded && (
        <div className="p-4 bg-white">
          {employees.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No employees assigned to this manager</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {employees.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} onClick={() => onSelectEmployee(emp.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminHierarchyView({ allUsers, currentUser, onSelectEmployee }) {
  const managers = allUsers.filter(u => u.role === 'management' && u.admin_id === currentUser.id);

  // Summary counts
  const allEmployees = allUsers.filter(u => u.role === 'employee' && managers.map(m => m.id).includes(u.manager_id));

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients-for-admin", currentUser.id],
    queryFn: async () => {
      const empIds = allEmployees.map(e => e.id);
      if (!empIds.length) return [];
      const all = await base44.entities.Client.list();
      return all.filter(c => empIds.includes(c.assigned_employee_id) && !c.is_archived);
    },
    enabled: allEmployees.length > 0
  });

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-4 text-center">
          <Building2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{managers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Managers</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <UserCog className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{allEmployees.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Employees</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{allClients.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Clients</p>
        </Card>
      </div>

      {managers.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No managers assigned to you yet</p>
          <p className="text-slate-400 text-sm mt-1">Set the <strong>admin_id</strong> field on manager users to your user ID to see them here.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {managers.map(manager => (
            <ManagerSection
              key={manager.id}
              manager={manager}
              allUsers={allUsers}
              onSelectEmployee={onSelectEmployee}
            />
          ))}
        </div>
      )}
    </div>
  );
}