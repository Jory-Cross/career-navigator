import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";

const NAV_PAGES_ORDERED = [
  { featureKey: "dashboard", path: "/Dashboard" },
  { featureKey: "time_tracking", path: "/TimeTracking" },
  { featureKey: "calendar", path: "/Calendar" },
  { featureKey: "tasks", path: "/Tasks" },
  { featureKey: "clients", path: "/Clients" },
  { featureKey: "reports", path: "/Reports" },
  { featureKey: "email_templates", path: "/EmailTemplates" },
  { featureKey: "ai_agents", path: "/Agents" },
  { featureKey: "app_analytics", path: "/AppAnalytics" },
  { featureKey: "org_dashboard", path: "/OrgDashboard" },
];

/**
 * Server-authorized landing resolution for non-admin users.
 */
export default function SmartLanding({ user }) {
  const navigate = useNavigate();
  const { canView, isLoading } = useFeaturePermissions(user);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!user || isLoading) return;

    const destination = NAV_PAGES_ORDERED.find((item) =>
      canView(item.featureKey)
    );

    if (destination) {
      navigate(destination.path, { replace: true });
      return;
    }

    setNoAccess(true);
  }, [canView, isLoading, navigate, user]);

  if (noAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 text-4xl">🔒</div>
        <h2 className="mb-2 text-xl font-semibold text-slate-800">
          No Features Available
        </h2>
        <p className="max-w-sm text-sm text-slate-500">
          Your account does not have access to any features yet. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
    </div>
  );
}
