import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Cache org per session to avoid repeated fetches
let _cachedOrg = null;
let _cachedOrgId = null;

/**
 * Hook that returns the current user's org and org_id.
 * Also provides a helper to inject org_id into entity create calls.
 */
export function useOrg() {
  const [org, setOrg] = useState(_cachedOrg);
  const [orgId, setOrgId] = useState(_cachedOrgId);
  const [loading, setLoading] = useState(!_cachedOrg);

  useEffect(() => {
    if (_cachedOrg) return;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user) return;
        // Check user's own org_id field first (set on registration)
      if (user.org_id) {
  try {
    const orgs = await base44.entities.Organization.filter({ id: user.org_id });
    if (orgs[0]) {
      _cachedOrg = orgs[0];
      _cachedOrgId = orgs[0].id;
      setOrg(orgs[0]);
      setOrgId(orgs[0].id);
      return;
    }
  } catch (e) {
    console.warn("Invalid user.org_id, falling back to owner_email:", user.org_id);
  }
}
        // Fallback: find org by owner_email
        const orgs = await base44.entities.Organization.filter({ owner_email: user.email });
        if (orgs[0]) {
          _cachedOrg = orgs[0];
          _cachedOrgId = orgs[0].id;
          setOrg(orgs[0]);
          setOrgId(orgs[0].id);
        }
      } catch (e) {
        console.error("useOrg error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Call this to clear cache (e.g. after org update) */
  const invalidateOrg = () => {
    _cachedOrg = null;
    _cachedOrgId = null;
  };

  /** Wrap entity filter calls to automatically scope by org_id */
  const scopedFilter = (filters = {}) => {
    if (!orgId) return filters;
    return { ...filters, org_id: orgId };
  };

  return { org, orgId, loading, invalidateOrg, scopedFilter };
}
