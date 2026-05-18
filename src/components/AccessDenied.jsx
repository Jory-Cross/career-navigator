import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldX, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when classifyUserAccess returns 'denied'.
 *
 * For new registrations (no role/access_level yet):
 *   - Auto-runs applyPendingRoleIfNeeded as a safety net
 *   - If upgraded → shows "access activated, sign out and back in"
 *   - If already_assigned (AuthContext reload happened but claims still stale) → same message
 *   - If no assignment found → shows "no invite found" guidance
 *
 * For existing users with a real but wrong role/access combo → standard denied screen.
 *
 * The invited employee NEVER needs to click "Request Access".
 */
export default function AccessDenied({ user }) {
  const isNewRegistration = !user?.access_level || user?.role === 'user' || !user?.role;

  const [status, setStatus] = useState(isNewRegistration ? 'checking' : 'denied');
  // status: 'checking' | 'activated' | 'no_invite' | 'denied'

  useEffect(() => {
    if (!isNewRegistration) return;

    console.log(`[AccessDenied] New registration detected for ${user?.email} — running applyPendingRoleIfNeeded`);

    base44.functions.invoke('applyPendingRoleIfNeeded', {})
      .then(res => {
        const data = res?.data;
        console.log(`[AccessDenied] applyPendingRoleIfNeeded result:`, data);

        if (data?.upgraded) {
          // Role was just applied — session claims need a fresh login to take effect
          console.log(`[AccessDenied] Role applied: ${JSON.stringify(data.applied)} — prompting sign-out/in`);
          setStatus('activated');
        } else if (data?.reason === 'already_assigned') {
          // DB was already updated (e.g. by AuthContext before reload), but claims are stale
          console.log(`[AccessDenied] Role already assigned but session is stale — prompting sign-out/in`);
          setStatus('activated');
        } else {
          // No valid pending assignment found
          console.log(`[AccessDenied] No matching invite for ${user?.email} — reason: ${data?.reason}`);
          setStatus('no_invite');
        }
      })
      .catch(err => {
        console.error('[AccessDenied] applyPendingRoleIfNeeded error:', err?.message);
        setStatus('no_invite');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Checking / spinner ─────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-blue-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Setting Up Your Account</h1>
          <p className="text-slate-600">Applying your employee access...</p>
        </div>
      </div>
    );
  }

  // ── Access activated — session refresh needed ──────────────────────────────
  if (status === 'activated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-green-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Employee Access Activated!</h1>
          <p className="text-slate-600 mb-4">
            Your employee access has been activated for <strong>{user?.email}</strong>.
            Sign out and back in to complete the setup.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left text-sm text-green-800">
            <p className="font-semibold mb-2">One last step:</p>
            <ol className="list-decimal list-inside space-y-1 text-green-700">
              <li>Click <strong>Sign Out</strong> below.</li>
              <li>Sign back in with <strong>{user?.email}</strong>.</li>
              <li>You&apos;ll land directly on your employee portal — no approval needed.</li>
            </ol>
          </div>
          <Button onClick={() => base44.auth.logout()} className="w-full">
            Sign Out &amp; Sign Back In
          </Button>
        </div>
      </div>
    );
  }

  // ── No matching invite found ───────────────────────────────────────────────
  if (status === 'no_invite') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-amber-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
            <ShieldX className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">No Invitation Found</h1>
          <p className="text-slate-600 mb-4">
            We couldn&apos;t find an active invitation for <strong>{user?.email}</strong>.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
            <p className="font-semibold mb-1">What to do:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>Make sure you registered with the <strong>exact email</strong> from your invitation.</li>
              <li>Ask your manager to resend the invitation.</li>
              <li>If an invitation was just sent, sign out and back in to retry.</li>
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

  // ── Standard denied (existing user, wrong role/access combo) ──────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-red-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-100">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Not Authorized</h1>
        <p className="text-slate-600 mb-4">
          Your account does not have permission to access this application.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
          <p className="font-semibold mb-1">What to do:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>If you were invited, use the <strong>invitation link from your email</strong>.</li>
            <li>Contact your employment specialist if you need access.</li>
            <li>Sign out and try again with the correct account if needed.</li>
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