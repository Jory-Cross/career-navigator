import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { setOrgId } from "@/lib/orgContext";

let cachedOrg = null;
let cachedOrgId = null;
let orgLoadPromise = null;
let orgResolved = false;

/**
 * Returns the signed-in user's organization context.
 *
 * Organization resolution is derived on the server from the authenticated
 * user's canonical org_id. The browser never filters Organization by ID or
 * owner email.
 */
export function useOrg() {
  const [org, setOrg] = useState(cachedOrg);
  const [orgId, setOrgIdState] = useState(cachedOrgId);
  const [loading, setLoading] = useState(!orgResolved);

  useEffect(() => {
    let mounted = true;

    async function loadOrg() {
      if (orgResolved) {
        if (mounted) {
          setOrg(cachedOrg);
          setOrgIdState(cachedOrgId);
          setLoading(false);
        }
        return;
      }

      if (!orgLoadPromise) {
        orgLoadPromise = (async () => {
          try {
            const response = await base44.functions.invoke(
              "getAuthorizedOrganizationContext",
              {}
            );
            const payload = response?.data ?? response ?? {};

            if (!payload?.ok) {
              throw new Error(payload?.error || "Organization context is unavailable.");
            }

            cachedOrg = payload.organization || null;
            cachedOrgId = cachedOrg?.id || null;
            setOrgId(cachedOrgId);
          } catch (error) {
            console.warn(
              "[useOrg] Organization context could not be loaded:",
              error?.message || error
            );
            cachedOrg = null;
            cachedOrgId = null;
            setOrgId(null);
          } finally {
            orgResolved = true;
            orgLoadPromise = null;
          }

          return { org: cachedOrg, orgId: cachedOrgId };
        })();
      }

      const result = await orgLoadPromise;

      if (!mounted) return;
      setOrg(result.org);
      setOrgIdState(result.orgId);
      setLoading(false);
    }

    loadOrg();

    return () => {
      mounted = false;
    };
  }, []);

  const invalidateOrg = () => {
    cachedOrg = null;
    cachedOrgId = null;
    orgResolved = false;
    orgLoadPromise = null;
    setOrgId(null);
  };

  const scopedFilter = (filters = {}) => {
    if (!orgId) return filters;
    return { ...filters, org_id: orgId };
  };

  return { org, orgId, loading, invalidateOrg, scopedFilter };
}
