import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
let _cachedOrg = null;
let _cachedOrgId = null;
let _orgLoadPromise = null;
let _orgResolved = false;
let _invalidOrgIds = new Set();

function looksLikeRealOrgId(value) {
  return typeof value === "string" && value.length >= 20;
}
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
  let mounted = true;

  async function loadOrg() {
    if (_orgResolved) {
      setOrg(_cachedOrg);
      setOrgId(_cachedOrgId);
      setLoading(false);
      return;
    }

    if (_orgLoadPromise) {
      const result = await _orgLoadPromise;
      if (!mounted) return;
      setOrg(result.org);
      setOrgId(result.orgId);
      setLoading(false);
      return;
    }

    _orgLoadPromise = (async () => {
      const user = await base44.auth.me();
      if (!user) {
        _orgResolved = true;
        return { org: null, orgId: null };
      }

      if (
        user.org_id &&
        looksLikeRealOrgId(user.org_id) &&
        !_invalidOrgIds.has(user.org_id)
      ) {
        try {
          const orgs = await base44.entities.Organization.filter({
            id: user.org_id,
          });

          if (orgs?.[0]) {
            _cachedOrg = orgs[0];
            _cachedOrgId = orgs[0].id;
            _orgResolved = true;
            return { org: _cachedOrg, orgId: _cachedOrgId };
          }
        } catch (err) {
          console.warn("Invalid user.org_id:", user.org_id);
          _invalidOrgIds.add(user.org_id);
        }
      } else if (user.org_id) {
        _invalidOrgIds.add(user.org_id);
      }

      try {
        const orgs = await base44.entities.Organization.filter({
          owner_email: user.email,
        });

        if (orgs?.[0]) {
          _cachedOrg = orgs[0];
          _cachedOrgId = orgs[0].id;
        }
      } catch (err) {
        console.warn("owner_email fallback failed");
      }

      _orgResolved = true;
      return { org: _cachedOrg, orgId: _cachedOrgId };
    })();

    const result = await _orgLoadPromise;

    if (!mounted) return;

    setOrg(result.org);
    setOrgId(result.orgId);
    setLoading(false);

    _orgLoadPromise = null;
  }

  loadOrg();

  return () => {
    mounted = false;
  };
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
