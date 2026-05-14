/**
 * FeaturePermissions — Admin-only page
 * Allows admins to configure which features each staff role can see.
 */
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FEATURE_DEFINITIONS, CATEGORY_LABELS } from "@/lib/featureKeys";
import { bustPermissionsCache } from "@/lib/useFeaturePermissions";
import { toast } from "sonner";
import { Loader2, Save, Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLES = [
  { key: "management", label: "Management" },
  { key: "employee",   label: "Employee" },
];

// Group features by category
const grouped = FEATURE_DEFINITIONS.reduce((acc, f) => {
  const cat = f.category || "other";
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(f);
  return acc;
}, {});

export default function FeaturePermissions() {
  // permissions[role][feature_key] = { id?, visible, can_interact }
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    setLoading(true);
    try {
      const rows = await base44.entities.FeaturePermission.list();
      const map = {};
      ROLES.forEach((r) => {
        map[r.key] = {};
        FEATURE_DEFINITIONS.forEach((f) => {
          map[r.key][f.key] = { id: null, visible: false, can_interact: true };
        });
      });
      rows.forEach((row) => {
        if (map[row.role] && row.feature_key) {
          map[row.role][row.feature_key] = {
            id: row.id,
            visible: row.visible !== false,
            can_interact: row.can_interact !== false,
          };
        }
      });
      setPermissions(map);
    } catch (e) {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  function toggle(role, featureKey, field) {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [featureKey]: {
          ...prev[role][featureKey],
          [field]: !prev[role][featureKey][field],
        },
      },
    }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const existing = await base44.entities.FeaturePermission.list();
      const existingMap = {};
      existing.forEach((r) => {
        existingMap[`${r.role}__${r.feature_key}`] = r;
      });

      const ops = [];
      for (const role of ROLES.map((r) => r.key)) {
        for (const feat of FEATURE_DEFINITIONS) {
          const perm = permissions[role]?.[feat.key];
          if (!perm) continue;
          const key = `${role}__${feat.key}`;
          const existing = existingMap[key];
          const payload = {
            role,
            feature_key: feat.key,
            label: feat.label,
            category: feat.category,
            visible: perm.visible,
            can_interact: perm.can_interact,
          };
          if (existing) {
            ops.push(base44.entities.FeaturePermission.update(existing.id, payload));
          } else {
            ops.push(base44.entities.FeaturePermission.create(payload));
          }
        }
      }
      await Promise.all(ops);
      bustPermissionsCache();
      toast.success("Permissions saved");
    } catch (e) {
      toast.error("Failed to save: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Feature Permissions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Control which features each staff role can see. Admins always see everything.
          </p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Admin notice */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-700 flex items-center gap-2">
        <Shield className="w-4 h-4 shrink-0" />
        Admin users always have full access to all features and are not affected by these settings.
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide"
             style={{ gridTemplateColumns: "1fr repeat(2, 160px)" }}>
          <div className="px-4 py-3">Feature</div>
          {ROLES.map((r) => (
            <div key={r.key} className="px-4 py-3 text-center">{r.label}</div>
          ))}
        </div>

        {Object.entries(grouped).map(([category, features]) => (
          <div key={category}>
            {/* Category header */}
            <div className="px-4 py-2 bg-slate-50/70 border-y border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {CATEGORY_LABELS[category] || category}
            </div>

            {features.map((feat, idx) => (
              <div
                key={feat.key}
                className={cn(
                  "grid items-center border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                  idx === features.length - 1 && "border-b-0"
                )}
                style={{ gridTemplateColumns: "1fr repeat(2, 160px)" }}
              >
                {/* Feature label */}
                <div className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-800">{feat.label}</span>
                  <span className="ml-2 text-xs text-slate-400 font-mono">{feat.key}</span>
                </div>

                {/* Per-role toggles */}
                {ROLES.map((role) => {
                  const perm = permissions[role.key]?.[feat.key];
                  const isVisible = perm?.visible ?? false;
                  return (
                    <div key={role.key} className="px-4 py-3 flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isVisible}
                          onCheckedChange={() => toggle(role.key, feat.key, "visible")}
                        />
                        <span className={cn("text-xs font-medium", isVisible ? "text-emerald-600" : "text-slate-400")}>
                          {isVisible ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Changes take effect immediately after saving. Staff users may need to refresh their browser.
      </p>
    </div>
  );
}