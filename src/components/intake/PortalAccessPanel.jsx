/**
 * PortalAccessPanel — full in-app portal access management for a client record.
 *
 * Shows:
 *   - Live invite/access status (PendingRoleAssignment + User record)
 *   - Actions: Invite, Resend, Revoke, Repair, Delete Portal User
 *   - Email-failed fallback instructions
 *   - Stale/broken access detection
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail, RefreshCw, XCircle, CheckCircle2, Clock, Loader2,
  ShieldCheck, AlertTriangle, Wrench, Trash2, UserX, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Status derivation ────────────────────────────────────────────────────────

function deriveStatus({ pra, portalUser, client }) {
  const hasStaleUser = portalUser && portalUser.linked_client_id && portalUser.linked_client_id !== client?.id;
  // Active = User record exists with correct client link + client_portal access
  const hasActiveUser = portalUser &&
    portalUser.access_level === 'client_portal' &&
    portalUser.linked_client_id === client?.id;

  if (hasStaleUser) return 'stale';
  // Live User record is authoritative — if they're linked and active, show Active regardless of PRA state
  if (hasActiveUser) return 'active';
  // No live user — fall back to PRA state
  if (!pra) return 'not_invited';
  if (pra.status === 'revoked') return 'revoked';
  if (pra.status === 'expired') return 'expired';
  if (pra.status === 'accepted') return 'active'; // accepted PRA but user record not found yet
  return 'pending';
}

const STATUS_UI = {
  not_invited: {
    label: 'Not Invited',
    desc: 'Client has not been invited to the portal.',
    icon: ShieldCheck,
    color: 'bg-slate-50 border-slate-200 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
  pending: {
    label: 'Invitation Pending',
    desc: 'Invitation sent — waiting for client to accept.',
    icon: Clock,
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  active: {
    label: 'Active Portal User',
    desc: 'Client has an active portal account.',
    icon: CheckCircle2,
    color: 'bg-green-50 border-green-200 text-green-800',
    badgeClass: 'bg-green-100 text-green-700',
  },
  revoked: {
    label: 'Access Revoked',
    desc: 'Portal access has been revoked.',
    icon: XCircle,
    color: 'bg-red-50 border-red-200 text-red-800',
    badgeClass: 'bg-red-100 text-red-700',
  },
  expired: {
    label: 'Invitation Expired',
    desc: 'The invitation has expired.',
    icon: XCircle,
    color: 'bg-slate-50 border-slate-200 text-slate-500',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
  stale: {
    label: 'Stale / Broken Access',
    desc: 'User account is linked to a different client record — access is inconsistent.',
    icon: AlertTriangle,
    color: 'bg-orange-50 border-orange-200 text-orange-800',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
};

// ── Main component ───────────────────────────────────────────────────────────

export default function PortalAccessPanel({ client, onRefresh }) {
  const [pra, setPra] = useState(null);          // most relevant PendingRoleAssignment
  const [allPras, setAllPras] = useState([]);    // all PRAs for this client email
  const [portalUser, setPortalUser] = useState(null); // User record if exists
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);        // which action is in progress
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emailFailedNote, setEmailFailedNote] = useState(false);

   const load = useCallback(async () => {
    if (!client?.id) {
      setPra(null);
      setAllPras([]);
      setPortalUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await base44.functions.invoke(
        "getClientPortalAccessStatus",
        {
          clientId: client.id,
        }
      );

      const data = response?.data || {};

      if (data.success === false) {
        throw new Error(
          data.error || "Client portal access could not be reviewed."
        );
      }

      setPra(data.invitation || null);
      setAllPras(Array.isArray(data.invitations) ? data.invitations : []);
      setPortalUser(data.portal_user || null);
    } catch (err) {
      console.error("[PortalAccessPanel] load failed:", err);
      setPra(null);
      setAllPras([]);
      setPortalUser(null);
    } finally {
      setLoading(false);
    }
  }, [client?.id]);

  useEffect(() => { load(); }, [load]);

  const status = deriveStatus({ pra, portalUser, client });
  const ui = STATUS_UI[status] || STATUS_UI.not_invited;
  const Icon = ui.icon;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleInvite = async (isResend = false) => {
    setBusy('invite');
    try {
      const res = await base44.functions.invoke('inviteClient', {
        email: client.email,
        clientId: client.id,
        clientType: client.client_type || 'job_seeker',
        org_id: client.org_id || null,
      });
      const data = res?.data || {};
      if (data.success === false) throw new Error(data.error || 'Invite failed');

      if (data.email_sent) {
        toast.success(isResend ? 'Invitation resent successfully' : 'Portal invitation sent');
        setEmailFailedNote(false);
      } else {
        toast.warning('Portal access prepared — but email delivery failed.');
        setEmailFailedNote(true);
      }
      await load();
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to send invitation: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    setConfirmRevoke(false);
    setBusy('revoke');
    try {
      const res = await base44.functions.invoke('revokePortalUser', {
        email: client.email,
        clientId: client.id,
      });
      if (res?.data?.success === false) throw new Error(res.data.error || 'Revoke failed');
      toast.success('Portal access revoked');
      await load();
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to revoke: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

   // Secure stale-access repair is unavailable during security remediation.

  const handleDeletePortalUser = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    try {
      const res = await base44.functions.invoke('revokePortalUser', {
        email: client.email,
        clientId: client.id,
      });
      if (res?.data?.success === false) throw new Error(res.data.error || 'Delete failed');
      toast.success('Portal user access removed');
      await load();
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to remove portal user: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking portal access...
      </div>
    );
  }

  const invitedAt = pra?.invited_at || pra?.created_date;
  const isBusy = busy !== null;

  return (
    <>
      <div className={cn('rounded-lg border p-4 space-y-3', ui.color)}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{ui.label}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ui.badgeClass)}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-80">{ui.desc}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={load}
            disabled={isBusy}
            className="opacity-60 hover:opacity-100 h-7 w-7 p-0"
            title="Refresh status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Details row */}
        {(pra || portalUser) && (
          <div className="text-xs opacity-75 space-y-0.5">
            {portalUser && (
              <div>Portal account: <strong>{portalUser.email}</strong> · role: {portalUser.role}</div>
            )}
            {pra && (
              <div>{pra.email}{pra.invited_by_name && ` · invited by ${pra.invited_by_name}`}</div>
            )}
            {invitedAt && <div>Sent {format(new Date(invitedAt), 'MMM d, yyyy h:mm a')}</div>}
          </div>
        )}

        {/* Email-failed fallback */}
        {emailFailedNote && (
          <div className="rounded-md bg-amber-100 border border-amber-300 p-3 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Email delivery failed
            </div>
            <p>Portal access is set up, but the invitation email could not be delivered.</p>
            <p>
              Ask the client to go directly to the portal URL and sign in with{' '}
              <strong>{client.email}</strong> — their access will activate automatically.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Not invited / revoked / expired → Invite */}
          {(status === 'not_invited' || status === 'revoked' || status === 'expired') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleInvite(false)}
              disabled={isBusy}
              className="bg-white/70 hover:bg-white border-blue-200 text-blue-700"
            >
              {busy === 'invite' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
              {status === 'not_invited' ? 'Send Invitation' : 'Re-invite'}
            </Button>
          )}

          {/* Pending / active → Resend */}
          {(status === 'pending' || status === 'active') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleInvite(true)}
              disabled={isBusy}
              className="bg-white/70 hover:bg-white"
            >
              {busy === 'invite' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Resend Invite
            </Button>
          )}

          {/* Pending / active → Revoke */}
          {(status === 'pending' || status === 'active') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmRevoke(true)}
              disabled={isBusy}
              className="bg-white/70 hover:bg-red-50 text-red-600 border-red-200"
            >
              {busy === 'revoke' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
              Revoke Access
            </Button>
          )}

          {/* Active → Delete portal user */}
          {(status === 'active' || status === 'stale') && portalUser && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={isBusy}
              className="bg-white/70 hover:bg-red-50 text-red-700 border-red-200"
            >
              {busy === 'delete' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserX className="mr-1.5 h-3.5 w-3.5" />}
              Remove Portal User
            </Button>
          )}

                  {/* Stale access repair is unavailable until the secured workflow exists. */}
          {status === 'stale' && (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="bg-white/50 text-orange-700 border-orange-200 cursor-not-allowed"
              title="Secure stale-access repair is not yet available."
            >
              <Wrench className="mr-1.5 h-3.5 w-3.5" />
              Repair Unavailable
            </Button>
          )}
        </div>

               {/* Stale details */}
        {status === 'stale' && portalUser && (
          <div className="text-xs text-orange-700 bg-orange-100 rounded p-2 border border-orange-200">
            User <strong>{portalUser.email}</strong> is linked to client ID{' '}
            <code className="font-mono">{portalUser.linked_client_id}</code> (not this record).
            Secure stale-access repair is temporarily unavailable during security remediation.
          </div>
        )}
      </div>

      {/* Multiple PRAs warning */}
      {allPras.length > 1 && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{allPras.length} pending invitations found for this email. Only the most recent is shown. Consider revoking older ones.</span>
        </div>
      )}

      {/* Revoke confirm */}
      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Portal Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the portal invitation and remove portal access for{' '}
              <strong>{client?.email}</strong>. They will no longer be able to log into the client portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-red-600 hover:bg-red-700">
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete portal user confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Portal User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will strip portal access from the user account for{' '}
              <strong>{client?.email}</strong> — removing their <code>access_level</code>,{' '}
              <code>linked_client_id</code>, and reverting their role to <code>user</code>.
              You can re-invite them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePortalUser} className="bg-red-600 hover:bg-red-700">
              Remove Portal User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
