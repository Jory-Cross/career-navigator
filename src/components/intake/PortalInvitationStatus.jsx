import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, XCircle, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_CONFIG = {
  pending: {
    label: "Invitation Pending",
    icon: Clock,
    color: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-amber-100 text-amber-700",
  },
  accepted: {
    label: "Access Active",
    icon: CheckCircle2,
    color: "bg-green-50 border-green-200 text-green-800",
    badge: "bg-green-100 text-green-700",
  },
  revoked: {
    label: "Access Revoked",
    icon: XCircle,
    color: "bg-red-50 border-red-200 text-red-800",
    badge: "bg-red-100 text-red-700",
  },
  expired: {
    label: "Invitation Expired",
    icon: XCircle,
    color: "bg-slate-50 border-slate-200 text-slate-600",
    badge: "bg-slate-100 text-slate-600",
  },
};

export default function PortalInvitationStatus({ client }) {
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    if (!client?.email) return;
    setLoading(true);
    try {
      const results = await base44.entities.PendingRoleAssignment.filter({
        email: client.email,
      });
      // Find the most recent client portal invite
      const inv = results
        .filter((r) => r.client_id === client.id || r.access_level === "client_portal")
        .sort((a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date))[0] || null;
      setInvitation(inv);
    } catch (err) {
      console.error("Failed to load invitation:", err);
    } finally {
      setLoading(false);
    }
  }, [client?.email, client?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResend = async () => {
    setSending(true);
    try {
      await base44.functions.invoke("inviteClient", {
        email: client.email,
        clientId: client.id,
        clientType: client.client_type,
      });
      toast.success("Invitation resent");
      await load();
    } catch (err) {
      toast.error("Failed to resend invitation");
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!invitation?.id) return;
    setRevoking(true);
    try {
      await base44.entities.PendingRoleAssignment.update(invitation.id, {
        status: "revoked",
      });
      toast.success("Access revoked");
      await load();
    } catch (err) {
      toast.error("Failed to revoke access");
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking portal access...
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span>No portal invitation yet.</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 border-blue-200 text-blue-700 hover:bg-blue-50"
          onClick={handleResend}
          disabled={sending}
        >
          {sending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="mr-2 h-3.5 w-3.5" />
          )}
          Send Portal Invitation
        </Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[invitation.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const invitedAt = invitation.invited_at || invitation.created_date;

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", cfg.color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{cfg.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badge)}>
                {invitation.status}
              </span>
            </div>
            <div className="text-xs mt-0.5 opacity-80">
              {invitation.email}
              {invitation.invited_by_name && ` · invited by ${invitation.invited_by_name}`}
              {invitedAt && ` · ${format(new Date(invitedAt), "MMM d, yyyy")}`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {invitation.status !== "revoked" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={sending}
            className="bg-white/60 hover:bg-white"
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Resend
          </Button>
        )}

        {invitation.status === "pending" || invitation.status === "accepted" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevoke}
            disabled={revoking}
            className="bg-white/60 hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300"
          >
            {revoking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Revoke
          </Button>
        ) : null}

        {(invitation.status === "revoked" || invitation.status === "expired") && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={sending}
            className="bg-white/60 hover:bg-blue-50 text-blue-700 border-blue-200"
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="mr-1.5 h-3.5 w-3.5" />
            )}
            Re-invite
          </Button>
        )}
      </div>
    </div>
  );
}