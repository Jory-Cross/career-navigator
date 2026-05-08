import React from "react";
import { base44 } from "@/api/base44Client";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a user is authenticated but does not have the correct
 * role + access_level to access any part of this app.
 * 
 * This covers:
 * - role === "user" (no valid role assigned yet)
 * - access_level blank or not in [client_portal, staff, admin]
 * - Any mismatch between role and access_level
 */
export default function AccessDenied({ user }) {
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
            <li>If you haven't received an invitation, contact your employment specialist.</li>
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

        <Button
          onClick={() => base44.auth.logout()}
          className="w-full"
          variant="outline"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}