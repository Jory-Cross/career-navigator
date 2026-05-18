import React from "react";
import { base44 } from "@/api/base44Client";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a user is authenticated but classifyUserAccess returns 'denied'.
 *
 * Two cases:
 *  1. isNewRegistration: role/access_level is blank — applyPendingRoleIfNeeded already
 *     ran in AuthContext but either failed to find an assignment, or the DB update
 *     happened and the hard reload is imminent. Show a friendly "sign out and back in"
 *     message.
 *  2. Existing user with a role mismatch — show standard access denied.
 */
export default function AccessDenied({ user }) {
  const isNewRegistration = !user?.access_level || user?.role === 'user' || !user?.role;

  if (isNewRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-amber-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-amber-100">
            <ShieldX className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Almost There!</h1>
          <p className="text-slate-600 mb-4">
            Your account was found but your access hasn&apos;t been applied yet.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left text-sm text-amber-800">
            <p className="font-semibold mb-2">To complete setup:</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-700">
              <li>Click <strong>Sign Out</strong> below.</li>
              <li>Sign back in with <strong>{user?.email}</strong>.</li>
              <li>Your access will be applied automatically on sign-in.</li>
            </ol>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-500">
            Signed in as <span className="font-mono">{user?.email}</span>
          </div>
          <Button onClick={() => base44.auth.logout()} className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Existing user with a real role but wrong access combination
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
            <li>If you haven&apos;t received an invitation, contact your employment specialist.</li>
            <li>If you believe this is an error, sign out and try again.</li>
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