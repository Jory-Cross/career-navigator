/**
 * FeatureGate
 *
 * Wraps content that should only be visible/accessible based on feature permissions.
 * Admin users always pass through.
 *
 * Usage:
 *   <FeatureGate featureKey="assessments" canView={canView}>
 *     <AssessmentSection />
 *   </FeatureGate>
 *
 * Props:
 *   featureKey  — string key from FEATURE_KEYS
 *   canView     — function from useFeaturePermissions
 *   fallback    — optional React node shown when hidden (default: null)
 *   showMessage — if true, shows a "Not available" message instead of null
 */
import React from "react";
import { Lock } from "lucide-react";

export default function FeatureGate({ featureKey, canView, children, fallback, showMessage = false }) {
  if (canView(featureKey)) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  if (showMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Lock className="w-8 h-8 mb-3" />
        <p className="text-sm font-medium">This feature is not available for your account.</p>
        <p className="text-xs mt-1">Contact your administrator for access.</p>
      </div>
    );
  }

  return null;
}