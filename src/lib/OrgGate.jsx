import React from "react";
import { useOrg } from "@/lib/useOrg";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps content that requires an active org subscription.
 * Shows a paywall/warning if the org is cancelled or inactive.
 */
export default function OrgGate({ children }) {
  const { org, loading } = useOrg();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  // No org yet — likely a brand new admin who hasn't set one up
  if (!org) return <>{children}</>;

  const blocked = org.subscription_status === "cancelled" || org.is_active === false;

  if (blocked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Subscription Inactive</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Your organization's subscription is no longer active. Please reactivate to continue using the platform.
          </p>
          <Button onClick={() => window.location.href = "/Pricing"}>
            Reactivate Subscription
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}