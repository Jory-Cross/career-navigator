import React, { useState, useEffect } from "react";
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

export default function EmployeePortal() {
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
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
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Build hierarchy based on role
  const visibleUsers = (() => {
    if (user?.role === 'admin') {
      // Managers assigned to this admin
      const managers = allUsers.filter(u => u.role === 'management' && u.admin_id === user.id);
      const managerIds = managers.map(m => m.id);
      // Employees assigned to those managers
      const employees = allUsers.filter(u => u.role === 'employee' && managerIds.includes(u.manager_id));
      return [...managers, ...employees];
    }
    if (user?.role === 'management') {
      return allUsers.filter(u => u.role === 'employee' && u.manager_id === user.id);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1>
        <p className="text-sm text-slate-500 mt-1">{employees.length} employee{employees.length !== 1 ? 's' : ''} under your management</p>
      </div>

      {employees.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No employees assigned</p>
          <p className="text-slate-400 text-sm mt-1">Assign employees to your team by setting their manager in User settings.</p>
        </Card>
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