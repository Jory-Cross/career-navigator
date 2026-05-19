import React, { useState, useEffect } from "react";
import InviteEmployeeDialog from "@/components/employees/InviteEmployeeDialog";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, ArrowLeft, UserX, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import EmployeeCard from "@/components/employees/EmployeeCard";
import EmployeeDetail from "@/components/employees/EmployeeDetail";
import AdminHierarchyView from "@/components/employees/AdminHierarchyView";
import ManagerAssignments from "@/components/employees/ManagerAssignments";

export default function EmployeePortal() {
  const { viewAsUser } = useViewAs();
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin' && u?.role !== 'management') {
        navigate(createPageUrl("Dashboard"));
      }
    }).catch(() => {});
  }, [navigate]);

  const { data: orgData = {} } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOrgUsers', {});
      return res.data || {};
    },
    enabled: !!user
  });

  const allUsers = orgData.users || [];
  const inactiveUsers = orgData.inactive_users || [];

  const effectiveUser = (user?.role === 'admin' && viewAsUser) ? viewAsUser : user;

  // Only active users in the visible list
  const visibleUsers = (() => {
    if (effectiveUser?.role === 'admin') {
      const managers = allUsers.filter(u => u.role === 'management');
      const managerIds = managers.map(m => m.id);
      const employees = allUsers.filter(u => u.role === 'employee' && managerIds.includes(u.manager_id));
      return [...managers, ...employees];
    }
    if (effectiveUser?.role === 'management') {
      return allUsers.filter(u => u.role === 'employee' && u.manager_id === effectiveUser.id);
    }
    return [];
  })();

  // Inactive employees relevant to current user's scope
  const visibleInactive = (() => {
    if (effectiveUser?.role === 'admin') {
      return inactiveUsers.filter(u => u.role === 'employee' || u.role === 'management');
    }
    if (effectiveUser?.role === 'management') {
      return inactiveUsers.filter(u => u.role === 'employee' && u.manager_id === effectiveUser.id);
    }
    return [];
  })();

  const employees = visibleUsers;

  // Check both active and inactive lists for selected employee
  const selectedEmployee =
    employees.find(e => e.id === selectedEmployeeId) ||
    visibleInactive.find(e => e.id === selectedEmployeeId);

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedEmployeeId(null)} className="gap-2 text-slate-600">
          <ArrowLeft className="w-4 h-4" /> Back to Employees
        </Button>
        <EmployeeDetail
          employee={selectedEmployee}
          currentUser={user}
          onOffboarded={() => {
            queryClient.invalidateQueries({ queryKey: ["all-users"] });
            setSelectedEmployeeId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {effectiveUser?.role === 'admin'
              ? `${allUsers.filter(u => u.role === 'management').length} managers · ${allUsers.filter(u => u.role === 'employee').length} employees`
              : `${employees.length} employee${employees.length !== 1 ? 's' : ''} under ${viewAsUser ? (viewAsUser.full_name || 'their') + "'s" : 'your'} management`}
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Users className="w-4 h-4 mr-2" /> Invite Employee
        </Button>
      </div>

      <InviteEmployeeDialog open={showInvite} onOpenChange={setShowInvite} currentUserRole={user?.role} currentUserId={user?.id} />

      {effectiveUser?.role === 'admin' ? (
        <>
          <AdminHierarchyView allUsers={allUsers} currentUser={effectiveUser} onSelectEmployee={setSelectedEmployeeId} />
          <ManagerAssignments allUsers={allUsers} />
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployeeId(emp.id)} />
          ))}
        </div>
      )}

      {/* Inactive / Offboarded Employees Section */}
      {visibleInactive.length > 0 && (
        <div className="border border-dashed border-slate-300 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            onClick={() => setShowInactive(v => !v)}
          >
            <UserX className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">
              Offboarded / Inactive ({visibleInactive.length})
            </span>
            <Badge className="bg-slate-100 text-slate-500 border-0 text-xs ml-1">Access Removed</Badge>
            {showInactive
              ? <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
              : <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />}
          </button>
          {showInactive && (
            <div className="border-t border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleInactive.map(emp => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors opacity-70"
                  onClick={() => setSelectedEmployeeId(emp.id)}
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                    {emp.avatar_url
                      ? <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-semibold">
                          {emp.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{emp.full_name || emp.email}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                  </div>
                  <Badge className="bg-red-50 text-red-500 border-0 text-[10px] shrink-0">Inactive</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}