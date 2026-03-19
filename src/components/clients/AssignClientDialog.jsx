import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

export default function AssignClientDialog({ open, onOpenChange, client, onAssigned }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(client?.assigned_employee_id || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      base44.entities.User.list().then(users => {
        setEmployees(users.filter(u => (u.role === 'employee' || u.role === 'admin' || u.role === 'management') && !u.is_archived));
      });
      setSelectedEmployee(client?.assigned_employee_id || "");
    }
  }, [open, client]);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      await base44.functions.invoke('assignClient', {
        client_id: client.id,
        employee_id: selectedEmployee
      });
      toast.success("Client assigned successfully");
      onAssigned?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to assign client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Assign Client
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Assign <strong>{client?.first_name} {client?.last_name}</strong> to an employee.
        </p>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger>
            <SelectValue placeholder="Select an employee..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name || emp.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!selectedEmployee || loading}>
            {loading ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}