import React, { useState, useEffect } from "react";
import InviteEmployeeDialog from "@/components/employees/InviteEmployeeDialog";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, Clock, ListChecks, Briefcase, ChevronRight, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EmployeeCard from "@/components/employees/EmployeeCard";
import EmployeeDetail from "@/components/employees/EmployeeDetail";
import AdminHierarchyView from "@/components/employees/AdminHierarchyView";

export default function EmployeePortal() {
  const { viewAsUser } = useViewAs();
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin' && u?.role !== 'management') {
        navigate(createPageUrl("Dashboard"));
      }
    }).catch(() => {});
  }, [navigate]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Effective user perspective
  const effectiveUser = (user?.role === 'admin' && viewAsUser) ? viewAsUser : user;

  // Build hierarchy based on effective role
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

  const employees = visibleUsers;

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedEmployeeId(null)} className="gap-2 text-slate-600">
          <ArrowLeft className="w-4 h-4" /> Back to Employees
        </Button>
        <EmployeeDetail employee={selectedEmployee} currentUser={user} />
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

      {effectiveUser?.role === 'admin' ? (
        // Admin view: all managers + employees with hierarchy assignment
        <AdminHierarchyView allUsers={allUsers} currentUser={effectiveUser} onSelectEmployee={setSelectedEmployeeId} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployeeId(emp.id)} />
          ))}
        </div>
      )}
    </div>
  );
}