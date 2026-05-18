import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserX, Users, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function EmployeeOffboardingDialog({ open, onOpenChange, employee, currentUser, onComplete }) {
  const [overrideManagerId, setOverrideManagerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [needsManager, setNeedsManager] = useState(false);
  const [preview, setPreview] = useState(null); // { clients_assigned, manager_name }
  const [done, setDone] = useState(false);

  // Load managers for override selection
  const { data: managers = [] } = useQuery({
    queryKey: ["managers-for-offboarding"],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOrgUsers', {});
      return (res.data?.users || []).filter(u =>
        (u.role === 'management' || u.role === 'admin') && u.id !== employee.id
      );
    },
    enabled: open,
  });

  // Load client count assigned to this employee
  const { data: assignedClients = [] } = useQuery({
    queryKey: ["clients-for-offboard", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => c.assigned_employee_id === employee.id && !c.is_archived);
    },
    enabled: open,
  });

  const handleOffboard = async () => {
    setSaving(true);
    setNeedsManager(false);
    try {
      const payload = { employee_id: employee.id };
      if (overrideManagerId && overrideManagerId !== 'auto') {
        payload.override_manager_id = overrideManagerId;
      }

      const res = await base44.functions.invoke('offboardEmployee', payload);
      const data = res.data;

      if (data?.error === 'no_manager') {
        setNeedsManager(true);
        setSaving(false);
        return;
      }

      if (data?.success) {
        setPreview({
          clients_reassigned: data.clients_reassigned,
          manager_name: data.reassigned_to_manager_name,
        });
        setDone(true);
        toast.success(`Offboarding complete. ${data.clients_reassigned} client(s) reassigned to ${data.reassigned_to_manager_name}.`);
        onComplete?.();
      } else {
        toast.error(data?.error || 'Offboarding failed');
      }
    } catch (err) {
      toast.error('Offboarding failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOverrideManagerId("");
    setNeedsManager(false);
    setDone(false);
    setPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <UserX className="w-5 h-5" />
            Offboard Employee
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-slate-800">Offboarding Complete</p>
            <p className="text-sm text-slate-500">
              {preview?.clients_reassigned} client(s) reassigned to <strong>{preview?.manager_name}</strong>.
            </p>
            <p className="text-xs text-slate-400">All historical records, time entries, and documents have been preserved.</p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Employee info */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {employee.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{employee.full_name || employee.email}</p>
                  <p className="text-xs text-slate-400">{employee.email}</p>
                  <Badge className="mt-1 text-[10px] bg-purple-100 text-purple-700 border-0">{employee.role}</Badge>
                </div>
              </div>

              {/* What will happen */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <span>
                    <strong>{assignedClients.length}</strong> assigned client(s) will be reassigned to the overseeing manager.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>All historical records, time entries, documents, and tasks will be preserved.</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>Client portal accounts will not be affected.</span>
                </div>
              </div>

              {/* Manager override selector (always shown for admin, shown when needsManager) */}
              {(currentUser?.role === 'admin' || needsManager) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {needsManager
                      ? <span className="text-red-600 font-semibold">⚠ No manager found — select one to continue</span>
                      : "Reassign clients to (optional override)"}
                  </Label>
                  <Select
                    value={overrideManagerId || "auto"}
                    onValueChange={v => setOverrideManagerId(v === 'auto' ? '' : v)}
                  >
                    <SelectTrigger className={needsManager && !overrideManagerId ? "border-red-400" : ""}>
                      <SelectValue placeholder="Auto-detect manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      {!needsManager && <SelectItem value="auto">— Auto-detect from assignments —</SelectItem>}
                      {managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name || m.email}
                          <span className="text-slate-400 text-xs ml-1">({m.role})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  This action reassigns active client records but does <strong>not</strong> delete the employee account or any historical data.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
              <Button
                onClick={handleOffboard}
                disabled={saving || (needsManager && !overrideManagerId)}
                className="bg-red-600 hover:bg-red-700 text-white shadow-none"
              >
                {saving ? "Processing..." : "Confirm Offboarding"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}