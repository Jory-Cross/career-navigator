/**
 * FeaturePermissions — Admin-only page
 * Section 1: Staff permissions (management, employee)
 * Section 2: Client portal permissions (client, pre_ets, dspd)
 */
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  FEATURE_DEFINITIONS,
  CLIENT_PORTAL_FEATURE_DEFINITIONS,
  CATEGORY_LABELS,
  CLIENT_PORTAL_ROLE_SCOPE,
} from "@/lib/featureKeys";
import { bustPermissionsCache } from "@/lib/useFeaturePermissions";
import { toast } from "sonner";
import { Loader2, Save, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const STAFF_ROLES = [
  { key: "management", label: "Management" },
  { key: "employee",   label: "Employee" },
];

const CLIENT_ROLES = [
  { key: "client",    label: "Client" },
  { key: "pre_ets",   label: "Pre-ETS" },
  { key: "dspd",      label: "DSPD" },
];

const ALL_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES];

// Group features by category helper
function groupByCategory(definitions) {
  return definitions.reduce((acc, f) => {
    const cat = f.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});
}

const staffGrouped  = groupByCategory(FEATURE_DEFINITIONS);
const clientGrouped = groupByCategory(CLIENT_PORTAL_FEATURE_DEFINITIONS);

/** Determine if a client role column is applicable for a given category */
function roleAppliesTo(roleKey, category) {
  const scope = CLIENT_PORTAL_ROLE_SCOPE[category];
  if (!scope) return true; // unknown category → show all
  return scope.includes(roleKey);
}

// ──────────────────────────────────────────────
// Sub-component: a single permissions table
// ──────────────────────────────────────────────
function PermissionsTable({ grouped, roles, permissions, onToggle, defaultVisible, savingToggle }) {
  const colCount = roles.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="grid border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide"
        style={{ gridTemplateColumns: `1fr repeat(${colCount}, 140px)` }}
      >
        <div className="px-4 py-3">Feature</div>
        {roles.map((r) => (
          <div key={r.key} className="px-4 py-3 text-center">{r.label}</div>
        ))}
      </div>

      {Object.entries(grouped).map(([category, features]) => (
        <div key={category}>
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
              style={{ gridTemplateColumns: `1fr repeat(${colCount}, 140px)` }}
            >
              <div className="px-4 py-3">
                <span className="text-sm font-medium text-slate-800">{feat.label}</span>
                <span className="ml-2 text-xs text-slate-400 font-mono">{feat.key}</span>
              </div>

              {roles.map((role) => {
                // For client portal features, grey out roles that don't apply
                const applies = roleAppliesTo(role.key, category);
                if (!applies) {
                  return (
                    <div key={role.key} className="px-4 py-3 flex justify-center">
                      <span className="text-xs text-slate-300">—</span>
                    </div>
                  );
                }

                const perm = permissions[role.key]?.[feat.key];
                // opt-out model: default to defaultVisible if no record
                const isVisible = perm !== undefined ? perm.visible : defaultVisible;

                const toggleKey = `${role.key}__${feat.key}`;
                const isSaving = savingToggle[toggleKey];

                return (
                  <div key={role.key} className="px-4 py-3 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isVisible}
                        onCheckedChange={() => onToggle(role.key, feat.key)}
                        disabled={isSaving}
                      />
                      <span className={cn(
                        "text-xs font-medium",
                        isSaving ? "text-slate-400" : isVisible ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {isSaving ? "Saving..." : isVisible ? "On" : "Off"}
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
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
export default function FeaturePermissions() {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savingToggle, setSavingToggle] = useState({}); // { "role__featureKey": true }

  useEffect(() => { loadPermissions(); }, []);

  async function loadPermissions() {
    setLoading(true);
    try {
      const rows = await base44.entities.FeaturePermission.list();

      const map = {};
      ALL_ROLES.forEach((r) => { map[r.key] = {}; });

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
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(role, featureKey) {
    // Get current state for rollback
    const current = permissions[role]?.[featureKey];
    const isClientPortalKey = featureKey.startsWith("client_portal_");
    const currentVisible = current !== undefined
      ? current.visible
      : isClientPortalKey;
    
    const newVisible = !currentVisible;
    const toggleKey = `${role}__${featureKey}`;

    // Optimistically update UI
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [featureKey]: {
          ...(current || {}),
          visible: newVisible,
          can_interact: current?.can_interact ?? true,
        },
      },
    }));

    // Mark this toggle as saving
    setSavingToggle((prev) => ({ ...prev, [toggleKey]: true }));

    try {
      console.log(`[FeaturePermissions] Auto-saving toggle ${role}/${featureKey}: ${currentVisible} → ${newVisible}`);

      // Try to find existing record
      const allRecords = await base44.entities.FeaturePermission.list();
      const existingRecord = allRecords.find(
        (r) => r.role === role && r.feature_key === featureKey
      );

      const payload = {
        role,
        feature_key: featureKey,
        visible: newVisible,
        can_interact: current?.can_interact ?? true,
      };

      // Fetch feature definition to get label and category
      const allDefs = [...FEATURE_DEFINITIONS, ...CLIENT_PORTAL_FEATURE_DEFINITIONS];
      const featDef = allDefs.find((f) => f.key === featureKey);
      if (featDef) {
        payload.label = featDef.label;
        payload.category = featDef.category;
      }

      if (existingRecord) {
        console.log(`[FeaturePermissions] Updating existing record ${existingRecord.id}`);
        await base44.entities.FeaturePermission.update(existingRecord.id, payload);
      } else {
        console.log(`[FeaturePermissions] Creating new record for ${role}/${featureKey}`);
        await base44.entities.FeaturePermission.create(payload);
      }

      bustPermissionsCache();
      toast.success(`${featureKey} ${newVisible ? "enabled" : "disabled"}`);
      console.log(`[FeaturePermissions] ✓ Auto-save successful for ${toggleKey}`);
    } catch (error) {
      console.error(`[FeaturePermissions] Auto-save failed for ${toggleKey}:`, error);
      toast.error(`Failed to save ${featureKey}`);

      // Rollback on error
      setPermissions((prev) => ({
        ...prev,
        [role]: {
          ...prev[role],
          [featureKey]: {
            ...(current || {}),
            visible: currentVisible,
            can_interact: current?.can_interact ?? true,
          },
        },
      }));
    } finally {
      setSavingToggle((prev) => ({ ...prev, [toggleKey]: false }));
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      const existing = await base44.entities.FeaturePermission.list();
      const existingMap = {};
      existing.forEach((r) => { existingMap[`${r.role}__${r.feature_key}`] = r; });

      const allDefs = [...FEATURE_DEFINITIONS, ...CLIENT_PORTAL_FEATURE_DEFINITIONS];
      const ops = [];
      const savedRecords = [];

      for (const roleObj of ALL_ROLES) {
        const role = roleObj.key;
        
        for (const feat of allDefs) {
          const perm = permissions[role]?.[feat.key];
          // Determine default visibility based on feature type
          const isClientPortalFeature = feat.key.startsWith("client_portal_");
          const defaultVisible = isClientPortalFeature ? true : false;
          const currentVisible = perm !== undefined ? perm.visible : defaultVisible;
          
          const mapKey = `${role}__${feat.key}`;
          const existingRow = existingMap[mapKey];
          const payload = {
            role,
            feature_key: feat.key,
            label: feat.label,
            category: feat.category,
            visible: currentVisible,
            can_interact: perm?.can_interact ?? true,
          };
          
          // Log every feature being saved, especially client portal ones
          if (isClientPortalFeature) {
            console.log(`[FeaturePermissions] Saving client portal feature:`, {
              role,
              feature_key: feat.key,
              label: feat.label,
              visible: currentVisible,
              action: existingRow ? "UPDATE" : "CREATE"
            });
          }
          
          if (existingRow) {
            // Always update existing rows to match current state
            ops.push(
              base44.entities.FeaturePermission.update(existingRow.id, payload)
                .then(() => { 
                  savedRecords.push({ ...payload, id: existingRow.id, action: "UPDATE" });
                  return existingRow.id;
                })
            );
          } else {
            // Create new records for all features with their current visibility
            ops.push(
              base44.entities.FeaturePermission.create(payload)
                .then((created) => { 
                  savedRecords.push({ ...payload, id: created.id, action: "CREATE" });
                  return created.id;
                })
            );
          }
        }
      }

      console.log(`[FeaturePermissions] Starting save of ${ops.length} permission records`);
      await Promise.all(ops);
      console.log(`[FeaturePermissions] Successfully saved ${savedRecords.length} records:`, savedRecords);
      
      bustPermissionsCache();
      
      // Immediately verify the save for Clock In/Out
      console.log("[FeaturePermissions] Verifying Clock In/Out record...");
      const allRecords = await base44.entities.FeaturePermission.list();
      const clockRecords = allRecords.filter(r => 
        r.role === "pre_ets" && r.feature_key === "client_portal_clock_in_out"
      );
      
      if (clockRecords.length > 0) {
        console.log("[FeaturePermissions] ✓ FOUND Clock In/Out record:", clockRecords[0]);
      } else {
        console.warn("[FeaturePermissions] ✗ Clock In/Out record NOT FOUND after save");
        console.log("[FeaturePermissions] All pre_ets records:", 
          allRecords.filter(r => r.role === "pre_ets")
        );
      }
      
      toast.success("Permissions saved");
    } catch (e) {
      console.error("[FeaturePermissions] Save error:", e);
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
    <div className="max-w-6xl space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Feature Permissions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Control what staff and client-portal users can see. Admins always see everything.
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
        Admin users always have full access and are not affected by these settings.
      </div>

      {/* ── SECTION 1: Staff Permissions ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">Staff Permissions</h2>
          <span className="text-xs text-slate-400">— management &amp; employee roles</span>
        </div>
        <p className="text-xs text-slate-500">
          Features default to <strong>hidden</strong> unless explicitly enabled.
        </p>
        <PermissionsTable
          grouped={staffGrouped}
          roles={STAFF_ROLES}
          permissions={permissions}
          onToggle={toggle}
          defaultVisible={false}
          savingToggle={savingToggle}
        />
      </section>

      {/* ── SECTION 2: Client Portal Permissions ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-800">Client Portal Permissions</h2>
          <span className="text-xs text-slate-400">— client, pre_ets, dspd roles</span>
        </div>
        <p className="text-xs text-slate-500">
          Portal tabs default to <strong>visible</strong> unless explicitly hidden. A "—" means that tab doesn't apply to that role.
        </p>
        <PermissionsTable
          grouped={clientGrouped}
          roles={CLIENT_ROLES}
          permissions={permissions}
          onToggle={toggle}
          defaultVisible={true}
          savingToggle={savingToggle}
        />
      </section>

      <p className="text-xs text-slate-400 pb-8">
        Changes take effect immediately after saving. Users may need to refresh their browser.
      </p>
    </div>
  );
}