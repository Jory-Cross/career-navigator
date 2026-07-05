import React, { useEffect, useMemo, useState } from "react";
import InviteEmployeeDialog from "@/components/employees/InviteEmployeeDialog";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, ChevronDown, ChevronRight, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmployeeCard from "@/components/employees/EmployeeCard";
import EmployeeDetail from "@/components/employees/EmployeeDetail";
import AdminHierarchyView from "@/components/employees/AdminHierarchyView";
import ManagerAssignments from "@/components/employees/ManagerAssignments";

function isStaffUser(user) {
  return user?.role === "management" || user?.role === "employee";
}

/**
 * Employee Portal.
 *
 * getOrgUsers is the authority for the roster. Administrators receive the
 * organization staff roster; management receives only the caller and active
 * ManagerEmployeeAssignment direct reports. This page never expands scope from
 * manager_id in the browser.
 */
export default function EmployeePortal() {
  const { viewAsUser } = useViewAs();
  const [user, setUser] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth
      .me()
      .then((currentUser) => {
        setUser(currentUser);
        if (
          currentUser?.role !== "admin" &&
          currentUser?.role !== "management"
        ) {
          navigate(createPageUrl("Dashboard"));
        }
      })
      .catch(() => {});
  }, [navigate]);

  const { data: orgData = {} } = useQuery({
    queryKey: ["authorized-org-users"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getOrgUsers", {});
      const payload = response?.data ?? response ?? {};

      if (!payload?.ok || !Array.isArray(payload?.users)) {
        throw new Error(payload?.error || "Organization users could not be loaded.");
      }

      return payload;
    },
    enabled: Boolean(user),
  });

  const allUsers = Array.isArray(orgData.users) ? orgData.users : [];
  const inactiveUsers = Array.isArray(orgData.inactive_users)
    ? orgData.inactive_users
    : [];
  const effectiveUser = user?.role === "admin" && viewAsUser ? viewAsUser : user;

  const employees = useMemo(
    () => allUsers.filter(isStaffUser),
    [allUsers]
  );
  const visibleInactive = useMemo(
    () => inactiveUsers.filter(isStaffUser),
    [inactiveUsers]
  );

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ||
    visibleInactive.find((employee) => employee.id === selectedEmployeeId);

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setSelectedEmployeeId(null)}
          className="gap-2 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>
        <EmployeeDetail
          employee={selectedEmployee}
          currentUser={user}
          onOffboarded={() => {
            queryClient.invalidateQueries({ queryKey: ["authorized-org-users"] });
            setSelectedEmployeeId(null);
          }}
        />
      </div>
    );
  }

  const managerCount = employees.filter(
    (employee) => employee.role === "management"
  ).length;
  const employeeCount = employees.filter(
    (employee) => employee.role === "employee"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Portal</h1>
          <p className="mt-1 text-sm text-slate-500">
            {effectiveUser?.role === "admin"
              ? `${managerCount} managers · ${employeeCount} employees`
              : `${employees.length} authorized staff record${employees.length === 1 ? "" : "s"} in your direct scope`}
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Users className="mr-2 h-4 w-4" />
          Invite Employee
        </Button>
      </div>

      <InviteEmployeeDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        currentUserRole={user?.role}
        currentUserId={user?.id}
      />

      {effectiveUser?.role === "admin" ? (
        <>
          <AdminHierarchyView
            allUsers={employees}
            currentUser={effectiveUser}
            onSelectEmployee={setSelectedEmployeeId}
          />
          <ManagerAssignments allUsers={employees} />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onClick={() => setSelectedEmployeeId(employee.id)}
            />
          ))}
        </div>
      )}

      {visibleInactive.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-dashed border-slate-300">
          <button
            type="button"
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50"
            onClick={() => setShowInactive((current) => !current)}
          >
            <UserX className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">
              Offboarded / Inactive ({visibleInactive.length})
            </span>
            <Badge className="ml-1 border-0 bg-slate-100 text-xs text-slate-500">
              Access Removed
            </Badge>
            {showInactive ? (
              <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
            )}
          </button>

          {showInactive && (
            <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleInactive.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left opacity-70 transition-colors hover:bg-slate-100"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                    {employee.avatar_url ? (
                      <img
                        src={employee.avatar_url}
                        alt={employee.full_name || employee.email || "Employee"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs font-semibold text-slate-600">
                        {employee.full_name
                          ?.split(" ")
                          .map((name) => name[0])
                          .join("") || "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {employee.full_name || employee.email}
                    </p>
                    <p className="truncate text-xs text-slate-400">{employee.email}</p>
                  </div>
                  <Badge className="shrink-0 border-0 bg-red-50 text-[10px] text-red-500">
                    Inactive
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
