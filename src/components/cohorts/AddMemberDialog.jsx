import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * AddMemberDialog — Phase 6C
 *
 * Reusable dialog for assigning cohort members. Fetches org users, filters
 * by `allowedRoles`, excludes `existingMemberUserIds`, and calls `onSubmit(user)`
 * on selection. Parent owns the mutation and error handling.
 *
 * Props:
 *   - open: boolean
 *   - onOpenChange: (open) => void
 *   - title: string (e.g. "Add Manager")
 *   - cohortRole: "manager" | "member"
 *   - allowedRoles: string[] (e.g. ["admin", "management", "employee"])
 *   - existingMemberUserIds: string[] (user IDs already assigned this cohortRole)
 *   - onSubmit: (user) => Promise<void> (parent handles mutation + refresh)
 */
export default function AddMemberDialog({
  open,
  onOpenChange,
   title = "Add Member",
  cohortRole = "member",
  cohortId = "",
  allowedRoles = [],
  existingMemberUserIds = [],
  onSubmit,
}) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

   // Fetch organization users.
  const {
    data: orgUsers = [],
    isLoading: orgUsersLoading,
  } = useQuery({
    queryKey: ["orgUsers", "addMember"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getOrgUsers", {});
      const payload = res.data || {};
      return Array.isArray(payload.users) ? payload.users : [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Active CE students may belong to only one cohort at a time.
  // This query is only needed for the student-assignment dialog.
  const {
    data: assignedStudentIds = [],
    isLoading: assignedStudentsLoading,
  } = useQuery({
       queryKey: [
      "ceTraining",
      "assignedStudentIds",
      cohortId || "unscoped",
    ],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getAssignedCEStudentIds",
        cohortId ? { cohort_id: cohortId } : {}
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to load assigned CE students"
        );
      }

      return Array.isArray(res.data.assigned_user_ids)
        ? res.data.assigned_user_ids
        : [];
    },
    enabled: open && cohortRole === "member",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const isLoading =
    orgUsersLoading ||
    (cohortRole === "member" && assignedStudentsLoading);

   // Filter by role, current-cohort assignment, other-cohort student
  // assignment, and the optional name/email search.
  const filtered = useMemo(() => {
    return orgUsers
      .filter((u) => allowedRoles.includes(u.role))
      .filter((u) => !existingMemberUserIds.includes(u.id))
      .filter(
        (u) =>
          cohortRole !== "member" ||
          !assignedStudentIds.includes(u.id)
      )
      .filter((u) => {
        if (!search.trim()) return true;

        const q = search.trim().toLowerCase();
        const hay = `${u.full_name || ""} ${u.email || ""}`.toLowerCase();

        return hay.includes(q);
      });
  }, [
    orgUsers,
    allowedRoles,
    existingMemberUserIds,
    cohortRole,
    assignedStudentIds,
    search,
  ]);
  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(selectedUser);
      setSearch("");
      setSelectedUser(null);
      onOpenChange(false);
    } catch (err) {
      // Parent mutation handles toast; don't toast again
      console.error("AddMemberDialog submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search name or email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* User list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
              {orgUsers.length === 0
                ? "No users available"
                : existingMemberUserIds.length === orgUsers.filter((u) => allowedRoles.includes(u.role)).length
                  ? "All eligible users already assigned"
                  : "No matching users"}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                    selectedUser?.id === u.id
                      ? "bg-blue-50 border-l-2 border-blue-600"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {u.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  {selectedUser?.id === u.id && (
                    <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUser || submitting || isLoading}
          >
            {submitting ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
