import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Loader2, CheckCircle2, Clock, UserX } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function EmployeeAccessActions({ employee, currentUser }) {
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'management';

  // Determine if employee is inactive/offboarded
  const isInactive = employee.is_active === false || !employee.access_level || employee.access_level === '';

   // Pending invitation records are no longer read directly in the browser.
  // Authorized administrators and managers can still resend the secured staff invitation.
  const hasPendingInvite = false;

  // Determine registration status from presence of full_name
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

  // Inactive/offboarded: show access removed state, no action buttons
  if (isInactive) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Access</p>
          <Badge className="text-[10px] border-0 flex items-center gap-1 bg-red-100 text-red-600">
            <UserX className="w-3 h-3" /> Access Removed
          </Badge>
        </div>
        <p className="text-[11px] text-slate-400">
          This employee has been offboarded. Use "Reactivate Employee" to restore access.
        </p>
      </div>
    );
  }

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
