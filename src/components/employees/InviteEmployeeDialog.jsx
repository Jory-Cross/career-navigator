import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function InviteEmployeeDialog({ open, onOpenChange, currentUserRole, currentUserId }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [managerId, setManagerId] = useState("");
  const [saving, setSaving] = useState(false);

  // Load managers for admin role-assignment
  const { data: managers = [] } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOrgUsers', {});
      return (res.data?.users || []).filter(u => u.role === 'management');
    },
    enabled: open && currentUserRole === 'admin',
  });

  const handleInvite = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { email, role };
      // Admins can explicitly assign a manager; managers always become the manager via backend
      if (currentUserRole === 'admin' && managerId && managerId !== 'none') {
        payload.manager_id = managerId;
      }
      const res = await base44.functions.invoke('inviteEmployee', payload);
      const data = res.data;
      if (data?.success === false || data?.error) {
        toast.error("Invitation failed: " + (data.error || 'Unknown error'));
        return;
      }
      toast.success(`Invitation sent to ${email.toLowerCase().trim()}`);
      setEmail("");
      setRole("employee");
      setManagerId("");
      onOpenChange(false);
    } catch (error) {
      // Surface the actual backend error message
      const msg = error?.response?.data?.error || error?.message || 'Unknown error';
      toast.error("Failed to send invitation: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email Address *</Label>
            <Input
              type="email"
              placeholder="employee@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <p className="text-[11px] text-slate-400">
              The employee will register using exactly this email address.
            </p>
          </div>

          {currentUserRole === 'admin' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === 'employee' && managers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Assign to Manager (optional)</Label>
                  <Select value={managerId || "none"} onValueChange={v => setManagerId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="— Default: assign to you —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Default: assign to you —</SelectItem>
                      {managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-slate-500">
            They'll receive an email invitation to create their account with <strong>{role}</strong> access.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={saving}>
            {saving ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}