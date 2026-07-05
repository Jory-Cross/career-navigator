import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Staff invitation dialog.
 *
 * Manager assignment is derived by the authorized invitation workflow from the
 * canonical inviter. The browser never selects or submits a manager identity.
 */
export default function InviteEmployeeDialog({
  open,
  onOpenChange,
  currentUserRole,
}) {
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
      const res = await base44.functions.invoke("inviteEmployee", {
        email,
        role,
      });
      const data = res.data;

      if (data?.success) {
        toast.success(`Invitation sent to ${email.toLowerCase().trim()}`);
        setEmail("");
        setRole("employee");
        onOpenChange(false);
      } else {
        toast.error(data?.message || data?.error || "Invitation failed");
      }
    } catch (error) {
      const backendData =
        error?.response?.data?.data ?? error?.response?.data ?? error?.data ?? {};
      toast.error(
        backendData?.message ||
          backendData?.error ||
          error?.message ||
          "The staff invitation could not be sent."
      );
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = currentUserRole === "admin";

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
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleInvite();
              }}
            />
            <p className="text-[11px] text-slate-400">
              The employee will register using exactly this email address.
            </p>
          </div>

          {isAdmin && (
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
            New employees are assigned through the secure invitation workflow to
            the person who sends the invitation. A different manager must send
            the invitation directly.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={saving}>
            {saving ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
