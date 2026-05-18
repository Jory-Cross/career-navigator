import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, ShieldX, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shown when the platform returns user_not_registered (user exists in auth but not in app users).
 *
 * Invite-only gateway:
 *   - Auto-runs applyPendingRoleIfNeeded on mount.
 *   - If upgraded → hard reload → user lands in app.
 *   - If no invite found → show "No invitation found" + contact admin message.
 *   - NEVER shows Request Access form. Invite email is the only gateway.
 */
const UserNotRegisteredError = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'activated' | 'no_invite'

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('applyPendingRoleIfNeeded', {});
        if (res?.data?.upgraded) {
          console.log('[UserNotRegisteredError] Role applied — reloading...');
          window.location.reload();
          return;
        }
        // already_assigned means DB was updated but claims are stale — still need sign-out/in
        if (res?.data?.reason === 'already_assigned') {
          setStatus('activated');
          return;
        }
      } catch (_) {
        // Non-fatal — fall through to no_invite
      }
      setStatus('no_invite');
    })();
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Checking your invitation...</p>
        </div>
      </div>
    );
  }

  if (status === 'activated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-green-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Activated!</h1>
          <p className="text-slate-600 mb-6">
            Your invitation has been applied. Sign out and back in to enter the app.
          </p>
          <Button onClick={() => base44.auth.logout()} className="w-full">
            Sign Out &amp; Sign Back In
          </Button>
        </div>
      </div>
    );
  }

  // no_invite — the only fallback: contact admin
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
        <Button onClick={() => base44.auth.logout()} variant="outline" className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;