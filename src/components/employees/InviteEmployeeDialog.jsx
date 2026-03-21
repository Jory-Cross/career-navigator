import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function InviteEmployeeDialog({ open, onOpenChange, currentUserRole }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('inviteEmployee', { email, role });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setRole("employee");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to send invitation: " + (error.response?.data?.error || error.message));
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
            />
          </div>
          {currentUserRole === 'admin' && (
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