import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  FEATURE_DEFINITIONS,
  CLIENT_PORTAL_FEATURE_DEFINITIONS,
  CATEGORY_LABELS,
  CLIENT_PORTAL_ROLE_SCOPE,
} from "@/lib/featureKeys";
import { bustPermissionsCache } from "@/lib/useFeaturePermissions";
import { toast } from "sonner";
import { Loader2, Shield, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const STAFF_ROLES = [
  { key: "management", label: "Management" },
  { key: "employee", label: "Employee" },
];

const CLIENT_ROLES = [
  { key: "client", label: "Client" },
  { key: "pre_ets", label: "Pre-ETS" },
  { key: "dspd", label: "DSPD" },
];

function groupByCategory(definitions) {
  return definitions.reduce((groups, feature) => {
    const category = feature.category || "other";
    groups[category] = groups[category] || [];
    groups[category].push(feature);
    return groups;
  }, {});
}

function roleAppliesTo(roleKey, category) {
  const scope = CLIENT_PORTAL_ROLE_SCOPE[category];
  return !scope || scope.includes(roleKey);
}

function buildPermissionMap(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((map, permission) => {
    const role = permission?.role;
    const featureKey = permission?.feature_key;

    if (role && featureKey) {
      map[role] = map[role] || {};
      map[role][featureKey] = permission;
    }

    return map;
  }, {});
}

function PermissionTable({
  grouped,
  roles,
  permissions,
  defaultVisible,
  savingKeys,
  onToggle,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="grid border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
        style={{ gridTemplateColumns: `minmax(220px, 1fr) repeat(${roles.length}, 140px)` }}
      >
        <div className="px-4 py-3">Feature</div>
        {roles.map((role) => (
          <div key={role.key} className="px-4 py-3 text-center">
            {role.label}
          </div>
        ))}
      </div>

      {Object.entries(grouped).map(([category, features]) => (
        <section key={category}>
          <div className="border-y border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {CATEGORY_LABELS[category] || category}
          </div>

          {features.map((feature, index) => (
            <div
              key={feature.key}
              className={cn(
                "grid items-center border-b border-slate-50",
                index === features.length - 1 && "border-b-0"
              )}
              style={{ gridTemplateColumns: `minmax(220px, 1fr) repeat(${roles.length}, 140px)` }}
            >
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-slate-800">{feature.label}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{feature.key}</p>
              </div>

              {roles.map((role) => {
                if (!roleAppliesTo(role.key, category)) {
                  return (
                    <div key={role.key} className="px-4 py-3 text-center text-xs text-slate-300">
                      —
                    </div>
                  );
                }

                const permission = permissions[role.key]?.[feature.key];
                const visible = permission ? permission.visible !== false : defaultVisible;
                const saving = savingKeys[`${role.key}__${feature.key}`] === true;

                return (
                  <div key={role.key} className="flex flex-col items-center gap-1.5 px-4 py-3">
                    <Switch
                      checked={visible}
                      disabled={saving}
                      onCheckedChange={() => onToggle(role.key, feature.key, defaultVisible)}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        saving
                          ? "text-slate-400"
                          : visible
                            ? "text-emerald-600"
                            : "text-slate-400"
                      )}
                    >
                      {saving ? "Saving…" : visible ? "On" : "Off"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Organization-admin feature-permission editor.
 * All permission reads and writes are scoped and validated by
 * manageFeaturePermissions; this component never accesses FeaturePermission
 * entities directly.
 */
export default function FeaturePermissions() {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState({});

  const staffGrouped = useMemo(
    () => groupByCategory(FEATURE_DEFINITIONS),
    []
  );
  const clientGrouped = useMemo(
    () => groupByCategory(CLIENT_PORTAL_FEATURE_DEFINITIONS),
    []
  );

  async function loadPermissions() {
    setLoading(true);

    try {
      const response = await base44.functions.invoke("manageFeaturePermissions", {
        action: "list_for_admin",
      });
      const payload = response?.data ?? response ?? {};

      if (!payload?.ok || !Array.isArray(payload?.permissions)) {
        throw new Error(payload?.error || "Permissions could not be loaded.");
      }

      setPermissions(buildPermissionMap(payload.permissions));
    } catch (error) {
      toast.error(
        error?.message || "Permissions could not be loaded."
      );
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPermissions();
  }, []);

  async function toggle(role, featureKey, defaultVisible) {
    const current = permissions[role]?.[featureKey];
    const currentVisible = current ? current.visible !== false : defaultVisible;
    const toggleKey = `${role}__${featureKey}`;

    setSavingKeys((currentSaving) => ({
      ...currentSaving,
      [toggleKey]: true,
    }));

    try {
      const response = await base44.functions.invoke("manageFeaturePermissions", {
        action: "set_for_admin",
        role,
        feature_key: featureKey,
        visible: !currentVisible,
        can_interact: current ? current.can_interact !== false : true,
      });
      const payload = response?.data ?? response ?? {};

      if (!payload?.ok || !payload?.permission) {
        throw new Error(payload?.error || "Permission could not be saved.");
      }

      setPermissions((currentPermissions) => ({
        ...currentPermissions,
        [role]: {
          ...currentPermissions[role],
          [featureKey]: payload.permission,
        },
      }));
      bustPermissionsCache();
      toast.success(`${featureKey} ${payload.permission.visible ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error(error?.message || "Permission could not be saved.");
    } finally {
      setSavingKeys((currentSaving) => ({
        ...currentSaving,
        [toggleKey]: false,
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Shield className="h-5 w-5 text-indigo-600" />
          Feature Permissions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Control what staff and portal users can see. Organization administrators always retain full access.
        </p>
      </header>

      <section className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
        <Shield className="h-4 w-4 shrink-0" />
        Changes save immediately and apply through the organization-scoped permission route.
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">Staff Permissions</h2>
        </div>
        <p className="text-xs text-slate-500">
          Staff features default to hidden unless explicitly enabled.
        </p>
        <PermissionTable
          grouped={staffGrouped}
          roles={STAFF_ROLES}
          permissions={permissions}
          defaultVisible={false}
          savingKeys={savingKeys}
          onToggle={toggle}
        />
      </section>

      <section className="space-y-3 pb-8">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-800">Client Portal Permissions</h2>
        </div>
        <p className="text-xs text-slate-500">
          Portal tabs default to visible unless explicitly hidden. A dash means a tab does not apply to that role.
        </p>
        <PermissionTable
          grouped={clientGrouped}
          roles={CLIENT_ROLES}
          permissions={permissions}
          defaultVisible
          savingKeys={savingKeys}
          onToggle={toggle}
        />
      </section>
    </main>
  );
}
