import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

export default function EmployeeReactivationDialog({ open, onOpenChange, employee, currentUser, onComplete }) {
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    if (open && currentUser?.role === 'admin') {
      // Load list of managers for admin to assign
      base44.entities.User.filter({}, "-created_date", 100)
        .then(users => {
          const mgrs = users.filter(u => u.role === 'management' && u.data?.is_active !== false);
          setManagers(mgrs);
          // Pre-select current manager if exists
          if (employee.manager_id) {
            setSelectedManagerId(employee.manager_id);
          }
        })
        .catch(() => {});
    } else if (open && currentUser?.role === 'management') {
      // Management can only assign to themselves
      setSelectedManagerId(currentUser.id);
    }
  }, [open, currentUser, employee]);

  const handleReactivate = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('reactivateEmployee', {
        employee_id: employee.id,
        manager_id: selectedManagerId || null
      });

      if (res.data?.success) {
        toast.success(`${res.data.employee_name} reactivated successfully`);
        onOpenChange(false);
        onComplete?.();
      } else {
        toast.error(res.data?.error || 'Reactivation failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reactivate employee');
    } finally {
      setLoading(false);
    }
  };

  const isInactive = employee.is_active === false || !employee.access_level || employee.access_level === '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            Reactivate Employee
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-slate-600">
              <strong>{employee.full_name}</strong> ({employee.email}) is currently inactive.
            </p>
            {isInactive && (
              <p className="text-xs text-slate-400 mt-2">
                Reactivating will restore their access to the system and allow them to sign in.
              </p>
            )}
          </div>

          {/* Manager Assignment */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {currentUser?.role === 'admin' ? 'Assign Manager (Optional)' : 'Assigned To'}
            </Label>
            {currentUser?.role === 'admin' ? (
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a manager..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— No Manager —</SelectItem>
                  {managers.map(mgr => (
                    <SelectItem key={mgr.id} value={mgr.id}>
                      {mgr.full_name || mgr.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                {currentUser?.full_name || currentUser?.email}
              </div>
            )}
          </div>

          {/* What will be restored */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-emerald-900">Will be restored:</p>
            <ul className="text-xs text-emerald-800 space-y-0.5">
              <li>✓ Access level set to <strong>staff</strong></li>
              <li>✓ Role remains <strong>{employee.role}</strong></li>
              <li>✓ Sign-in enabled</li>
              {selectedManagerId && <li>✓ Manager assignment updated</li>}
              <li>✓ All historical data preserved</li>
            </ul>
          </div>

          {/* What won't change */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">Not changed:</p>
            <ul className="text-xs text-slate-500 space-y-0.5">
              <li>• Clients remain with previous assignments</li>
              <li>• Time entries & documents preserved</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleReactivate}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Reactivating...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Reactivate Employee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}