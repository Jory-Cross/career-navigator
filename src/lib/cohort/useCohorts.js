import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * useCohorts — Phase 6A data hook for CETrainingCohort + CETrainingCohortMember.
 *
 * Provides:
 *  - cohorts: all CETrainingCohort rows visible to the caller (org-scoped)
 *  - memberships: all CETrainingCohortMember rows (for join counts)
 *  - createCohort / updateCohort mutations
 *  - addMember / removeMember mutations that route through the
 *    manageCohortMembership backend function (server-side authority).
 */

export const COHORT_QUERY_KEYS = {
  cohorts: ["cohorts", "list"],
  memberships: ["cohorts", "memberships"],
};

export function useCohorts(user) {
  const queryClient = useQueryClient();
  const enabled = !!user;

  // Resolve org_id up front so create/edit can assert it exists (org scoping rule).
  const orgId = user?.org_id || null;

   const {
    data: cohortDirectory = {
      cohorts: [],
      memberships: [],
    },
    isLoading: loadingCohorts,
  } = useQuery({
    queryKey: COHORT_QUERY_KEYS.cohorts,
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getAuthorizedCohorts",
        {}
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to load authorized CE Training cohorts."
        );
      }

      return {
        cohorts: Array.isArray(res.data.cohorts)
          ? res.data.cohorts
          : [],
        memberships: Array.isArray(res.data.memberships)
          ? res.data.memberships
          : [],
      };
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const cohorts = cohortDirectory.cohorts;
  const memberships = cohortDirectory.memberships;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cohorts"] });
  };

  const createCohort = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke(
        "manageCETrainingCohort",
        {
          action: "create",
          cohort: payload,
        }
      );

      const response = res?.data || res;

      if (!response?.ok) {
        throw new Error(
          response?.error || "Unable to create the CE cohort."
        );
      }

      return response.cohort;
    },
    onSuccess: () => {
      toast.success("Cohort created");
      invalidateAll();
    },
    onError: (err) =>
      toast.error(err?.message || "Failed to create cohort"),
  });

  const updateCohort = useMutation({
    mutationFn: async ({ id, patch }) => base44.entities.CETrainingCohort.update(id, patch),
    onSuccess: () => {
      toast.success("Cohort updated");
      invalidateAll();
    },
    onError: (err) => toast.error(err?.message || "Failed to update cohort"),
  });

  const addMember = useMutation({
    mutationFn: async ({ cohort_id, user_id, cohort_role }) => {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "add",
        cohort_id,
        user_id,
        cohort_role,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Member added");
      invalidateAll();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || "Failed to add member";
      toast.error(msg);
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ cohort_id, membership_id, user_id, cohort_role }) => {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id,
        user_id,
        cohort_role,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Member removed");
      invalidateAll();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || "Failed to remove member";
      toast.error(msg);
    },
  });

  return {
    orgId,
    cohorts,
    memberships,
    loadingCohorts,
    createCohort: createCohort.mutateAsync,
    updateCohort: updateCohort.mutateAsync,
    addMember: addMember.mutateAsync,
    removeMember: removeMember.mutateAsync,
    isCreating: createCohort.isPending,
    isUpdating: updateCohort.isPending,
    isAdding: addMember.isPending,
    isRemoving: removeMember.isPending,
  };
}

export default useCohorts;
