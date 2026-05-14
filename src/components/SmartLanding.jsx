/**
 * SmartLanding
 *
 * Shown at "/" for non-admin staff. Waits for feature permissions to load,
 * then redirects to the first allowed nav page.
 * Admins always land on Dashboard (handled by App.jsx directly).
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isAdmin } from "@/lib/utils";

// Ordered list of nav pages that respect feature permissions.
// Must match the featureKey → route mapping in Layout's navItems.
const NAV_PAGES_ORDERED = [
  { featureKey: "dashboard",       path: "/Dashboard" },
  { featureKey: "time_tracking",   path: "/TimeTracking" },
  { featureKey: "calendar",        path: "/Calendar" },
  { featureKey: "tasks",           path: "/Tasks" },
  { featureKey: "clients",         path: "/Clients" },
  { featureKey: "reports",         path: "/Reports" },
  { featureKey: "email_templates", path: "/EmailTemplates" },
  { featureKey: "ai_agents",       path: "/Agents" },
  { featureKey: "app_analytics",   path: "/AppAnalytics" },
  { featureKey: "org_dashboard",   path: "/OrgDashboard" },
];

export default function SmartLanding({ user }) {
  const navigate = useNavigate();
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Admins always go to Dashboard — this component shouldn't be rendered for them
    // but guard anyway.
    if (isAdmin(user)) {
      navigate("/Dashboard", { replace: true });
      return;
    }

    const role = user.role;

    base44.entities.FeaturePermission.filter({ role })
      .then((permissions) => {
        const permMap = {};
        for (const p of permissions) {
          permMap[p.feature_key] = p;
        }

        // Find the first page the user is allowed to see
        for (const item of NAV_PAGES_ORDERED) {
          const record = permMap[item.featureKey];
          // No record = hidden by default (deny). Record must have visible !== false.
          if (record && record.visible !== false) {
            navigate(item.path, { replace: true });
            return;
          }
        }

        // Nothing is enabled
        setNoAccess(true);
      })
      .catch(() => {
        // On error, fall back to Dashboard to avoid a blank screen
        navigate("/Dashboard", { replace: true });
      });
  }, [user, navigate]);

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Features Available</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          Your account doesn't have access to any features yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  // Show spinner while resolving
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}