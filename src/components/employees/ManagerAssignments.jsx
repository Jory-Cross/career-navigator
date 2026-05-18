import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ManagerAssignments({ allUsers }) {
  const queryClient = useQueryClient();
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  const managers = allUsers.filter((u) => !u.is_archived && u.role === "management");
  const employees = allUsers.filter((u) => !u.is_archived && u.role === "employee");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["managerAssignments"],
    queryFn: () => base44.entities.ManagerEmployeeAssignment.filter({ is_active: true }),
    staleTime: 30 * 1000,
  });

  // Build a set of already-assigned pairs for dedup check
  const assignedPairs = new Set(
    assignments.map((a) => `${a.manager_user_id}__${a.employee_user_id}`)
  );

  // Employees already assigned to the selected manager
  const assignedToSelectedManager = assignments.filter(
    (a) => a.manager_user_id === selectedManagerId
  );

  const handleAdd = async () => {
    if (!selectedManagerId || !selectedEmployeeId) {
      toast.error("Select both a manager and an employee.");
      return;
    }
    const pairKey = `${selectedManagerId}__${selectedEmployeeId}`;
    if (assignedPairs.has(pairKey)) {
      toast.error("This employee is already assigned to that manager.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ManagerEmployeeAssignment.create({
        manager_user_id: selectedManagerId,
        employee_user_id: selectedEmployeeId,
        is_active: true,
      });
      toast.success("Assignment created.");
      setSelectedEmployeeId("");
      queryClient.invalidateQueries({ queryKey: ["managerAssignments"] });
    } catch {
      toast.error("Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignment) => {
    try {
      await base44.entities.ManagerEmployeeAssignment.update(assignment.id, { is_active: false });
      toast.success("Assignment removed.");
      queryClient.invalidateQueries({ queryKey: ["managerAssignments"] });
    } catch {
      toast.error("Failed to remove assignment.");
    }
  };

  const getUserName = (id) => {
    const u = allUsers.find((x) => x.id === id);
    return u ? (u.full_name || u.email) : id;
  };

  // Employees not yet assigned to the selected manager (for the add dropdown)
  const unassignedEmployees = employees.filter(
    (e) => !assignedToSelectedManager.some((a) => a.employee_user_id === e.id)
  );

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <UserCog className="w-5 h-5 text-slate-600" />
        <h2 className="text-base font-semibold">Manager Assignments</h2>
        <span className="text-xs text-slate-500 ml-1">— controls Time Tracking visibility</span>
      </div>

      {/* Add assignment row */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs text-slate-500">Manager</label>
          <Select value={selectedManagerId} onValueChange={(v) => { setSelectedManagerId(v); setSelectedEmployeeId(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select manager…" />
            </SelectTrigger>
            <SelectContent>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs text-slate-500">Employee to assign</label>
          <Select
            value={selectedEmployeeId}
            onValueChange={setSelectedEmployeeId}
            disabled={!selectedManagerId}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedManagerId ? "Select employee…" : "Select manager first"} />
            </SelectTrigger>
            <SelectContent>
              {unassignedEmployees.length === 0
                ? <SelectItem value="__none__" disabled>All employees assigned</SelectItem>
                : unassignedEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleAdd}
          disabled={saving || !selectedManagerId || !selectedEmployeeId}
          className="gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </Button>
      </div>

      {/* Current assignments grouped by manager */}
      {isLoading ? (
        <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : managers.length === 0 ? (
        <p className="text-sm text-slate-500">No managers found. Invite staff with the Management role first.</p>
      ) : (
        <div className="space-y-4">
          {managers.map((manager) => {
            const managerAssignments = assignments.filter((a) => a.manager_user_id === manager.id);
            return (
              <div key={manager.id} className="rounded-lg border p-3 space-y-2">
                <div className="font-medium text-sm text-slate-800">{manager.full_name || manager.email}</div>
                {managerAssignments.length === 0 ? (
                  <p className="text-xs text-slate-400">No employees assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {managerAssignments.map((a) => (
                      <Badge key={a.id} variant="secondary" className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1">
                        {getUserName(a.employee_user_id)}
                        <button
                          type="button"
                          onClick={() => handleRemove(a)}
                          className="ml-1 hover:text-red-600 transition-colors"
                          title="Remove assignment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}