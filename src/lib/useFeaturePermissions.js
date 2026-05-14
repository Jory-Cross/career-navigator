/**
 * useFeaturePermissions
 *
 * Fetches FeaturePermission records for the current user's role.
 * Admin users always have full access — no DB lookup needed.
 *
 * Returns:
 *   canView(featureKey)    → boolean (defaults to true for admin, false for others if no record)
 *   canInteract(featureKey)→ boolean
 *   isLoading              → boolean
 *   permissions            → raw array
 */
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { isAdmin as checkIsAdmin } from "@/lib/utils";

const cache = {}; // simple in-memory cache keyed by role

export function useFeaturePermissions(user) {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const role = user?.role;
  const isAdmin = checkIsAdmin(user);

  useEffect(() => {
    if (!role || isAdmin) {
      // Admins always see everything — no fetch needed
      // Admins always see everything — no fetch needed
      setIsLoading(false);
      return;
    }

    if (cache[role]) {
      setPermissions(cache[role]);
      setIsLoading(false);
      return;
    }

    base44.entities.FeaturePermission.filter({ role })
      .then((rows) => {
        cache[role] = rows;
        setPermissions(rows);
      })
      .catch(() => {
        setPermissions([]);
      })
      .finally(() => setIsLoading(false));
  }, [role, isAdmin]);

  function canView(featureKey) {
    if (isAdmin) return true;
    const record = permissions.find((p) => p.feature_key === featureKey);
    // If no record exists, default to HIDDEN for non-admin (safe default)
    if (!record) return false;
    return record.visible !== false;
  }

  function canInteract(featureKey) {
    if (isAdmin) return true;
    const record = permissions.find((p) => p.feature_key === featureKey);
    if (!record) return false;
    return record.can_interact !== false;
  }

  return { canView, canInteract, isLoading, permissions };
}

// Bust the in-memory cache (call after admin saves changes)
export function bustPermissionsCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}