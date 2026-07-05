import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";

const cache = {};

/**
 * Loads feature permissions from the authenticated server authority.
 * Browser-supplied role or organization values are never used to scope the
 * permission records.
 */
export function useFeaturePermissions(user) {
  const [permissions, setPermissions] = useState([]);
  const [isServerAdmin, setIsServerAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cacheKey = user?.id || "";

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      if (!cacheKey) {
        if (!cancelled) {
          setPermissions([]);
          setIsServerAdmin(false);
          setIsLoading(false);
        }
        return;
      }

      if (cache[cacheKey]) {
        if (!cancelled) {
          setPermissions(cache[cacheKey].permissions);
          setIsServerAdmin(cache[cacheKey].isAdmin);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const response = await base44.functions.invoke(
          "manageFeaturePermissions",
          { action: "get_my_permissions" }
        );
        const payload = response?.data ?? response ?? {};

        if (!payload?.ok || !Array.isArray(payload?.permissions)) {
          throw new Error(payload?.error || "Feature permissions could not be loaded.");
        }

        const cachedValue = {
          permissions: payload.permissions,
          isAdmin: payload.is_admin === true,
        };
        cache[cacheKey] = cachedValue;

        if (!cancelled) {
          setPermissions(cachedValue.permissions);
          setIsServerAdmin(cachedValue.isAdmin);
        }
      } catch {
        if (!cancelled) {
          setPermissions([]);
          setIsServerAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.feature_key, permission])),
    [permissions]
  );

  function canView(featureKey) {
    if (isServerAdmin) return true;
    return permissionMap.get(featureKey)?.visible === true;
  }

  function canInteract(featureKey) {
    if (isServerAdmin) return true;
    return permissionMap.get(featureKey)?.can_interact === true;
  }

  return { canView, canInteract, isLoading, permissions };
}

export function bustPermissionsCache() {
  Object.keys(cache).forEach((key) => delete cache[key]);
}
