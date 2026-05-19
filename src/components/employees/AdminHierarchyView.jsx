import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ChevronDown, ChevronRight, UserCog, Building2, Link2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Avatar({ user, size = "sm" }) {
  const initials = `${user.full_name?.split(' ')[0]?.[0] || ''}${user.full_name?.split(' ')[1]?.[0] || ''}`;
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={cn("rounded-lg overflow-hidden shrink-0", cls)}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
        : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold">{initials || '?'}</div>
      }
    </div>
  );
}

function EmployeeRow({ employee, allManagers, allClients, onSelectEmployee }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const assignManager = useMutation({
    mutationFn: (manager_id) => base44.entities.User.update(employee.id, { manager_id: manager_id === "none" ? null : manager_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-users"] }); toast.success("Manager updated"); setEditing(false); },
    onError: () => toast.error("Failed to update manager")
  });

  const myClients = allClients.filter(c => c.assigned_employee_id === employee.id);

  return (
    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3 hover:bg-slate-50 group">
        <button onClick={() => setExpanded(e => !e)} className="shrink-0 text-slate-400">
          {myClients.length > 0
            ? (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
            : <span className="w-4 h-4 block" />}
        </button>
        <Avatar user={employee} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectEmployee(employee.id)}>
          <p className="text-sm font-medium text-slate-800 truncate">{employee.full_name || employee.email}</p>
          <p className="text-xs text-slate-400 truncate">{employee.email}</p>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{myClients.length} clients</span>
        {editing ? (
          <div className="flex items-center gap-2">
            <Select
              defaultValue={employee.manager_id || "none"}
              onValueChange={(val) => assignManager.mutate(val)}
              disabled={assignManager.isPending}
            >
              <SelectTrigger className="w-40 h-8 text-xs border-slate-200">
                <SelectValue placeholder="Assign manager…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {allManagers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-400" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
            onClick={() => setEditing(true)}
          >
            <Link2 className="w-3 h-3" /> Assign
          </Button>
        )}
      </div>
      {expanded && myClients.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 space-y-1.5">
          {myClients.map(client => (
            <div key={client.id} className="flex items-center gap-2 py-1">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                {client.first_name?.[0]}{client.last_name?.[0]}
              </div>
              <span className="text-sm text-slate-700 truncate">{client.first_name} {client.last_name}</span>
              <Badge className={cn("text-[10px] border-0 ml-auto shrink-0", {
                "bg-emerald-100 text-emerald-700": client.status === 'active',
                "bg-slate-100 text-slate-500": client.status === 'inactive',
                "bg-blue-100 text-blue-700": client.status === 'completed',
              })}>{client.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManagerSection({ manager, allUsers, allAdmins, currentUser, onSelectEmployee, allClients }) {
  const [expanded, setExpanded] = useState(true);
  const [editingAdmin, setEditingAdmin] = useState(false);
  const qc = useQueryClient();

  const employees = allUsers.filter(u => u.role === 'employee' && u.manager_id === manager.id && u.is_active !== false);
  const allManagers = allUsers.filter(u => u.role === 'management' && u.is_active !== false);
  const managerClientCount = allClients.filter(c => employees.some(e => e.id === c.assigned_employee_id)).length;

  const assignAdmin = useMutation({
    mutationFn: (admin_id) => base44.entities.User.update(manager.id, { admin_id: admin_id === "none" ? null : admin_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-users"] }); toast.success("Admin assignment updated"); setEditingAdmin(false); },
    onError: () => toast.error("Failed to update assignment")
  });

  const assignedAdmin = allAdmins.find(a => a.id === manager.admin_id);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <Avatar user={manager} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">{manager.full_name || manager.email}</span>
              <Badge className="text-[10px] border-0 bg-purple-100 text-purple-700">Manager</Badge>
              {manager.title && <span className="text-xs text-slate-400">{manager.title}</span>}
            </div>
            <p className="text-xs text-slate-500">{manager.email}</p>
          </div>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <UserCog className="w-3.5 h-3.5" />{employees.length} emp
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />{managerClientCount} clients
          </span>
          {editingAdmin ? (
            <div className="flex items-center gap-2">
              <Select
                defaultValue={manager.admin_id || "none"}
                onValueChange={(val) => assignAdmin.mutate(val)}
                disabled={assignAdmin.isPending}
              >
                <SelectTrigger className="w-40 h-8 text-xs border-slate-200">
                  <SelectValue placeholder="Assign to admin…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {allAdmins.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-400" onClick={() => setEditingAdmin(false)}>Cancel</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-slate-500 hover:text-purple-700"
              onClick={() => setEditingAdmin(true)}
            >
              <Link2 className="w-3 h-3" />
              {assignedAdmin ? assignedAdmin.full_name?.split(' ')[0] || "Admin" : "Assign Admin"}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 bg-white space-y-2">
          {employees.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">No employees assigned to this manager</p>
          ) : (
            employees.map(emp => (
              <EmployeeRow
                key={emp.id}
                employee={emp}
                allManagers={allUsers.filter(u => u.role === 'management' && u.is_active !== false)}
                allClients={allClients}
                onSelectEmployee={onSelectEmployee}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminHierarchyView({ allUsers, currentUser, onSelectEmployee }) {
  // Only show active users in all hierarchy views
  const activeUsers = allUsers.filter(u => u.is_active !== false);
  const allAdmins = activeUsers.filter(u => u.role === 'admin');
  const allManagers = activeUsers.filter(u => u.role === 'management');
  const allEmployees = activeUsers.filter(u => u.role === 'employee');

  // Employees with no manager assigned
  const unassignedEmployees = allEmployees.filter(e => !e.manager_id || !allManagers.find(m => m.id === e.manager_id));

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients-for-admin"],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => !c.is_archived);
    }
  });

  const qc = useQueryClient();
  const assignManager = useMutation({
    mutationFn: ({ empId, manager_id }) => base44.entities.User.update(empId, { manager_id: manager_id === "none" ? null : manager_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-users"] }); toast.success("Manager assigned"); },
    onError: () => toast.error("Failed to assign")
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-4 text-center">
          <Building2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-slate-900">{allManagers.length}</p>
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

      {/* All Managers with their employees */}
      {allManagers.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No managers found</p>
          <p className="text-slate-400 text-sm mt-1">Invite managers and set their role to "management".</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {allManagers.map(manager => (
            <ManagerSection
              key={manager.id}
              manager={manager}
              allUsers={allUsers}
              allAdmins={allAdmins}
              currentUser={currentUser}
              onSelectEmployee={onSelectEmployee}
              allClients={allClients}
            />
          ))}
        </div>
      )}

      {/* Unassigned Employees */}
      {unassignedEmployees.length > 0 && (
        <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Unlink className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">Unassigned Employees ({unassignedEmployees.length})</span>
          </div>
          {unassignedEmployees.map(emp => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              allManagers={allManagers}
              allClients={allClients}
              onSelectEmployee={onSelectEmployee}
            />
          ))}
        </div>
      )}
    </div>
  );
}