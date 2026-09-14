import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmployeeDetailHeader from "@/components/employees/EmployeeDetailHeader";
import EmployeeClientsSection from "@/components/employees/EmployeeClientsSection";
import EmployeeTimeSection from "@/components/employees/EmployeeTimeSection";
import EmployeeTasksSection from "@/components/employees/EmployeeTasksSection";
import EmployeeAccessActions from "@/components/employees/EmployeeAccessActions";
import EmployeeOffboardingDialog from "@/components/employees/EmployeeOffboardingDialog";
import EmployeeReactivationDialog from "@/components/employees/EmployeeReactivationDialog";

export default function EmployeeDetail({ employee, currentUser, onOffboarded }) {
  const [showOffboard, setShowOffboard] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const queryClient = useQueryClient();

  const employeeId = employee?.id;
  const isInactive = employee?.is_active === false || !employee?.access_level;
  const canManage = currentUser?.role === "admin" || currentUser?.role === "management";

  // Secured organization-scoped route: clients visible to the caller,
  // narrowed here to those assigned to this employee.
  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ["employee-workspace", employeeId, "clients"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getClientsForUser", {});
      const data = res?.data || {};
      if (data.error) throw new Error(data.error);
      return (Array.isArray(data.clients) ? data.clients : [])
        .filter(c => c.assigned_employee_id === employeeId && !c.is_archived);
    },
    enabled: !!employeeId,
  });

  // Secured organization-scoped route: time entries visible to the caller,
  // narrowed here to those owned by this employee.
  const { data: timeEntries = [], isLoading: timeLoading, error: timeError } = useQuery({
    queryKey: ["employee-workspace", employeeId, "time"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getAuthorizedTimeEntries", { action: "list" });
      const data = res?.data || {};
      if (data.ok === false) throw new Error(data.error);
      return (Array.isArray(data.entries) ? data.entries : [])
        .filter(e => e.employee_id === employeeId || (!e.employee_id && e.created_by_id === employeeId));
    },
    enabled: !!employeeId,
  });

  const clientsById = useMemo(
    () => new Map(clients.map(c => [c.id, c])),
    [clients]
  );

  const refreshWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-workspace"] });
  };

  return (
    <div className="space-y-5">
      <EmployeeDetailHeader
        employee={employee}
        isInactive={isInactive}
        canManage={canManage}
        onOffboard={() => setShowOffboard(true)}
        onReactivate={() => setShowReactivate(true)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EmployeeClientsSection clients={clients} isLoading={clientsLoading} error={clientsError} />
        <EmployeeTimeSection entries={timeEntries} clientsById={clientsById} isLoading={timeLoading} error={timeError} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EmployeeTasksSection
          employeeId={employeeId}
          employeeClientIds={clients.map(c => c.id)}
          clientsById={clientsById}
        />
        <EmployeeAccessActions employee={employee} currentUser={currentUser} />
      </div>

      {canManage && (
        <EmployeeOffboardingDialog
          open={showOffboard}
          onOpenChange={setShowOffboard}
          employee={employee}
          currentUser={currentUser}
          onComplete={() => {
            refreshWorkspace();
            onOffboarded?.();
          }}
        />
      )}

      {canManage && isInactive && (
        <EmployeeReactivationDialog
          open={showReactivate}
          onOpenChange={setShowReactivate}
          employee={employee}
          currentUser={currentUser}
          onComplete={refreshWorkspace}
        />
      )}
    </div>
  );
}