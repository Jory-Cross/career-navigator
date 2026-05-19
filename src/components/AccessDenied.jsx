import React from "react";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function AccessDenied({ user, forceActivated, deactivated }) {
  if (deactivated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-red-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-100">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Removed</h1>
          <p className="text-slate-600 mb-4">
            Your account has been deactivated. You no longer have access to this application.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            If you believe this is a mistake, please contact your administrator.
          </p>
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

  if (forceActivated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-green-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
            <ShieldX className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Account Activated</h1>
          <p className="text-slate-600 mb-6">
            Your account has been set up. Please sign out and sign back in to access the app.
          </p>
          <Button onClick={() => base44.auth.logout()} className="w-full">
            Sign Out &amp; Sign In Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-red-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-100">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Denied</h1>
        <p className="text-slate-600 mb-6">
          Your account does not have permission to access this area. Contact your administrator for assistance.
        </p>
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