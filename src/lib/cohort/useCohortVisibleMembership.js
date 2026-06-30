import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * useCohortVisibleMembership
 *
 * Additive-only cohort visibility hook for the Time Tracking page (and any
 * future staff surface that needs cohort membership context).
 *
 * Calls the existing `getCohortVisibleClients` backend oracle, which returns:
 *   - memberUserIds : user IDs visible to the caller through cohort membership
 *                     (cohort managers → cohort members + self; cohort members → self)
 *   - clientIds     : clients assigned to those member users
 *   - clients       : full client records for those clientIds
 *   - isAdmin       : whether the resolved user is a platform admin
 *
 * Fires ONLY for employee | management roles. Admin already sees everything
 * through the platform path, so the hook is disabled for admins to avoid a
 * redundant round trip.
 *
 * Returned shape is always present (never undefined) so callers can destructure
 * safely. On error or while disabled, returns empty arrays — the platform path
 * still runs normally, so this hook can only ADD visibility, never reduce it.
 */
export function useCohortVisibleMembership(user) {
  const enabled = !!user && (user.role === "employee" || user.role === "management");

  const { data } = useQuery({
    queryKey: ["cohortVisibility", user?.id, user?.role],
       queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCohortVisibleClients",
        {}
      );

      const payload = res.data || {};
      return {
        memberUserIds: Array.isArray(payload.memberUserIds) ? payload.memberUserIds : [],
        clientIds: Array.isArray(payload.clientIds) ? payload.clientIds : [],
        clients: Array.isArray(payload.clients) ? payload.clients : [],
        isAdmin: !!payload.isAdmin,
      };
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Always return a stable empty shape when disabled / loading / errored.
  if (!enabled || !data) {
    return { memberUserIds: [], clientIds: [], clients: [], isAdmin: false };
  }
  return data;
}

export default useCohortVisibleMembership;
