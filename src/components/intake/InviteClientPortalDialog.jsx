import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Mail, ShieldCheck, AlertTriangle } from "lucide-react";

export default function InviteClientPortalDialog({ open, onOpenChange, client }) {
  const [email, setEmail] = useState(client?.email || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      await base44.functions.invoke("inviteClient", {
        email: trimmed,
        clientId: client?.id,
        clientType: client?.client_type || "job_seeker",
      });
      setSent(true);
      toast.success(`Portal invitation sent to ${trimmed}`);
    } catch (err) {
      toast.error("Failed to send invitation: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setEmail(client?.email || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Invite to Client Portal
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-6 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold text-slate-800">Invitation Sent</p>
            <p className="text-sm text-slate-500">
              An invitation email has been sent to <strong>{email}</strong>. When they sign up using
              that email, they will automatically receive client portal access linked to this record.
            </p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <>
            {/* Security guidance */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">Invitation-only access</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  This creates a secure portal invitation for this specific client. Do not approve
                  public self-registration requests for portal access — use this flow instead.
                </p>
              </div>
            </div>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-sm">Client Name</Label>
                <p className="text-sm text-slate-700 font-medium">
                  {[client?.first_name, client?.last_name].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm" htmlFor="invite-email">
                  Email to invite <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                />
                <p className="text-xs text-slate-400">
                  Must match the email the client will use to sign up.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={sending || !email.trim()}>
                {sending ? "Sending..." : "Send Portal Invitation"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}