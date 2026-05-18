import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function EmployeeAccessActions({ employee, currentUser }) {
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'management';

  // Check for a pending invite
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["pending-invite", employee.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOrgUsers', {});
      const allPending = await base44.entities.PendingRoleAssignment.filter({ email: employee.email.toLowerCase().trim() });
      return allPending || [];
    },
    enabled: !!employee.email,
  });

  const hasPendingInvite = pendingInvites.some(p => p.status === 'pending');

  // Determine registration status from presence of full_name or last login
  // A registered user will have a full_name set (they completed onboarding)
  const isRegistered = !!employee.full_name && employee.full_name.trim().length > 0;

  const handleResendInvite = async () => {
    setResendLoading(true);
    try {
      await base44.functions.invoke('resendInviteOrReset', {
        employee_id: employee.id,
        action: 'resend_invite',
      });
      toast.success(`Invitation resent to ${employee.email}`);
    } catch (err) {
      toast.error("Failed to resend invite: " + (err.response?.data?.error || err.message));
    } finally {
      setResendLoading(false);
    }
  };

  const handleSendReset = async () => {
    setResetLoading(true);
    try {
      await base44.functions.invoke('resendInviteOrReset', {
        employee_id: employee.id,
        action: 'send_reset',
      });
      toast.success(`Password reset email sent to ${employee.email}`);
    } catch (err) {
      toast.error("Failed to send reset: " + (err.response?.data?.error || err.message));
    } finally {
      setResetLoading(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Access</p>
        <Badge className={cn(
          "text-[10px] border-0 flex items-center gap-1",
          isRegistered ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        )}>
          {isRegistered
            ? <><CheckCircle2 className="w-3 h-3" /> Registered</>
            : <><Clock className="w-3 h-3" /> {hasPendingInvite ? "Invite Pending" : "Not Registered"}</>
          }
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isRegistered && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={handleResendInvite}
            disabled={resendLoading}
          >
            {resendLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Mail className="w-3.5 h-3.5" />
            }
            Resend Invite
          </Button>
        )}
        {isRegistered && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={handleSendReset}
            disabled={resetLoading}
          >
            {resetLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            Send Password Reset
          </Button>
        )}
        {/* Always allow resend regardless of registration in case user lost the email */}
        {isRegistered && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs gap-1.5 text-slate-500"
            onClick={handleResendInvite}
            disabled={resendLoading}
          >
            {resendLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Mail className="w-3.5 h-3.5" />
            }
            Resend Invite Email
          </Button>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        {isRegistered
          ? "Password reset sends a sign-in email so the employee can set a new password."
          : "Resend invite delivers a new sign-in setup email to this address."}
      </p>
    </div>
  );
}