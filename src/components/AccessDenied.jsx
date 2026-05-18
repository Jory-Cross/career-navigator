import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldX, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a user is authenticated but does not have the correct
 * role + access_level to access any part of this app.
 *
 * If the user has no role yet (just registered), we auto-attempt to apply
 * their PendingRoleAssignment and reload. This handles the case where
 * a new employee registers with an invited email and lands here.
 */
export default function AccessDenied({ user }) {
  const isNewRegistration = !user?.access_level || user?.role === 'user' || !user?.role;
  const [applying, setApplying] = useState(isNewRegistration);
  const [applied, setApplied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isNewRegistration) return;

    // Auto-attempt role application for freshly registered users
    base44.functions.invoke('applyPendingRoleIfNeeded', {})
      .then(res => {
        if (res?.data?.upgraded) {
          setApplied(true);
          // Reload after a brief moment so auth session picks up new role
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setApplying(false);
          setFailed(true);
        }
      })
      .catch(() => {
        setApplying(false);
        setFailed(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Freshly registered — applying role
  if (isNewRegistration && applying && !applied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-blue-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Setting Up Your Account</h1>
          <p className="text-slate-600">
            Welcome! We&apos;re applying your access permissions now...
          </p>
        </div>
      </div>
    );
  }

  // Role was applied — reloading
  if (applied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-green-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Granted!</h1>
          <p className="text-slate-600">
            Your account has been set up. Loading your portal...
          </p>
        </div>
      </div>
    );
  }

  // Registered but no pending assignment found — show sign-out guidance
  if (isNewRegistration && failed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-amber-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
            <ShieldX className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Pending Access Setup</h1>
          <p className="text-slate-600 mb-4">
            Your account <strong>{user?.email}</strong> was registered, but we couldn&apos;t find an active invitation for it.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
            <p className="font-semibold mb-1">What to do:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Make sure you registered using the <strong>exact email address</strong> from your invitation.</li>
              <li>Contact your manager to re-send the invitation.</li>
              <li>If your invitation was just sent, try signing out and back in.</li>
            </ul>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
            Signed in as <span className="font-mono">{user?.email}</span>
          </div>
          <Button onClick={() => base44.auth.logout()} className="w-full" variant="outline">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Existing user with a real role but wrong access — standard denied screen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-red-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-100">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Not Authorized</h1>

        <p className="text-slate-600 mb-4">
          Your account <strong>{user?.email}</strong> does not have permission to access this application.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
          <p className="font-semibold mb-1">What to do:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>If you were invited, use the <strong>invitation link from your email</strong> to sign in — do not log in directly.</li>
            <li>If you haven&apos;t received an invitation, contact your employment specialist.</li>
            <li>If you believe this is an error, sign out and try again with the correct account.</li>
          </ul>
        </div>

        {user && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
            Signed in as <span className="font-mono">{user.email}</span>
            {user.role && <> · role: <span className="font-mono">{user.role}</span></>}
            {user.access_level && <> · access: <span className="font-mono">{user.access_level}</span></>}
          </div>
        )}

        <Button onClick={() => base44.auth.logout()} className="w-full" variant="outline">
          Sign Out
        </Button>
      </div>
    </div>
  );
}