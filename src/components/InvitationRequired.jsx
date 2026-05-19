import React from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

/**
 * Shown when an authenticated user has no matching PendingRoleAssignment.
 * This is the ONLY gate for uninvited users on the public app.
 * No "Request Access" form. No self-service. Invite-only.
 */
export default function InvitationRequired({ user }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-amber-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
          <Mail className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Invitation Required</h1>
        <p className="text-slate-600 mb-4">
          Access to this app is by invitation only. No active invitation was found for your account.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
          <p className="font-semibold mb-1">What to do:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Contact your manager or administrator to send you an invitation.</li>
            <li>Make sure you signed in with the <strong>exact email</strong> your invite was sent to.</li>
            <li>If you just received an invite, sign out and back in to retry.</li>
          </ul>
        </div>
        {user?.email && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
            Signed in as <span className="font-mono">{user.email}</span>
          </div>
        )}
        <Button onClick={() => base44.auth.logout()} variant="outline" className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  );
}