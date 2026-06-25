import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, GraduationCap, Users, UserCog, Plus } from "lucide-react";
import { toast } from "sonner";
import MemberRow from "@/components/cohorts/MemberRow";
import AddMemberDialog from "@/components/cohorts/AddMemberDialog";

const STATUS_STYLES = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const TYPE_LABELS = {
  testing: "Testing",
  training: "Training",
  production: "Production",
};

function InfoField({ label, value, multiline }) {
  return (
    <div className={multiline ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className={multiline ? "text-sm text-slate-700 whitespace-pre-wrap" : "text-sm text-slate-800"}>
        {value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

/**
 * CohortDetail — Phase 6B (view-only).
 *
 * Permissions: admin + management. No editing per spec.
 */
export default function CohortDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const cohort_id = searchParams.get("cohort_id");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAddManagerDialog, setShowAddManagerDialog] = useState(false);
  const [addingManager, setAddingManager] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    let active = true;
    base44.auth.me().then((u) => {
      if (!active) return;
      setUser(u);
      setAuthChecked(true);
      // Allow admin, management, and CE instructors
      const allowedRoles = ["admin", "management", "ce_instructor"];
      if (u && !allowedRoles.includes(u.role)) {
        navigate("/Dashboard");
      }
    }).catch(() => setAuthChecked(true));
    return () => { active = false; };
  }, [navigate]);

  // Cohort record
  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ["cohorts", "detail", cohort_id],
    queryFn: async () => {
      if (!cohort_id) return null;
      return base44.entities.CETrainingCohort.get(cohort_id);
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Membership roster for this cohort.
  const { data: cohortRoster = { memberships: [], users: [] } } = useQuery({
    queryKey: ["cohorts", "memberships", cohort_id],
    queryFn: async () => {
      if (!cohort_id) {
        return { memberships: [], users: [] };
      }

      const res = await base44.functions.invoke("getCohortMemberships", {
        cohort_id,
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unable to load cohort roster");
      }

      return {
        memberships: Array.isArray(res.data.memberships)
          ? res.data.memberships
          : [],
        users: Array.isArray(res.data.users)
          ? res.data.users
          : [],
      };
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const memberships = cohortRoster.memberships;
  const rosterUsers = cohortRoster.users;
  // User display information is returned with the secure cohort roster.
  const orgUsers = rosterUsers;

   const userById = useMemo(() => {
     const map = {};
     for (const u of orgUsers) map[u.id] = u;
     return map;
   }, [orgUsers]);

  const managers = useMemo(
    () => memberships.filter((m) => m.cohort_role === "manager"),
    [memberships]
  );
  const members = useMemo(
    () => memberships.filter((m) => m.cohort_role === "member"),
    [memberships]
  );

console.log("MEMBERSHIPS", memberships);
console.log("MEMBERS", members);
console.log("ORG USERS", orgUsers);
console.log("USER MAP", userById);
  
  const existingManagerUserIds = useMemo(() => managers.map((m) => m.user_id), [managers]);
  const existingMemberUserIds = useMemo(() => members.map((m) => m.user_id), [members]);

  // Determine if current user can add members: admin OR is active manager of this cohort
  const canAddMember = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "ce_instructor") return managers.some((m) => m.user_id === user.id);
    return managers.some((m) => m.user_id === user.id);
  }, [user, managers]);

  const handleAddManager = async (selectedUser) => {
    setAddingManager(true);
    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "add",
        cohort_id,
        user_id: selectedUser.id,
        cohort_role: "manager",
      });
      if (res.data?.ok) {
        toast.success("Manager added");
        queryClient.invalidateQueries({ queryKey: ["cohorts", "memberships", cohort_id] });
      } else {
        throw new Error(res.data?.error || "Unknown error");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to add manager");
    } finally {
      setAddingManager(false);
    }
  };

   const handleAddMember = async (selectedUser) => {
    setAddingMember(true);

    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "add",
        cohort_id,
        user_id: selectedUser.id,
        cohort_role: "member",
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unknown error");
      }

      toast.success("Student assigned to cohort");
      await queryClient.invalidateQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });

      return res.data;
    } catch (err) {
      console.error("Cohort student assignment failed:", err);
      toast.error(err?.message || "Failed to assign student");
      throw err;
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveManager = async (membership) => {
    if (managers.length === 1) {
      toast.error("Cannot remove the last active manager");
      return;
    }
    if (!window.confirm(`Remove ${orgUsers?.find(u => u.id === membership.user_id)?.full_name || membership.user_id} as manager?`)) {
      return;
    }
    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id: membership.id,
        cohort_role: "manager",
      });
      if (res.data?.ok) {
        toast.success("Manager removed");
        queryClient.invalidateQueries({ queryKey: ["cohorts", "memberships", cohort_id] });
      } else {
        throw new Error(res.data?.error || "Unknown error");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to remove manager");
    }
  };

  const handleRemoveMember = async (membership) => {
    if (!window.confirm(`Remove ${orgUsers?.find(u => u.id === membership.user_id)?.full_name || membership.user_id} as member?`)) {
      return;
    }
    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id: membership.id,
        cohort_role: "member",
      });
      if (res.data?.ok) {
        toast.success("Member removed");
        queryClient.invalidateQueries({ queryKey: ["cohorts", "memberships", cohort_id] });
      } else {
        throw new Error(res.data?.error || "Unknown error");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to remove member");
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!cohort_id) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-500">No cohort selected.</p>
      </div>
    );
  }
  if (loadingCohort) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!cohort) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-500">Cohort not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Add Manager Dialog */}
      <AddMemberDialog
        open={showAddManagerDialog}
        onOpenChange={setShowAddManagerDialog}
        title="Add Manager"
        cohortRole="manager"
        allowedRoles={["admin", "management", "employee", "ce_instructor"]}
        existingMemberUserIds={existingManagerUserIds}
        onSubmit={handleAddManager}
      />

          {/* Assign Registered Student Dialog */}
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        title="Assign Registered Student"
        cohortRole="member"
        allowedRoles={["ce_student"]}
        existingMemberUserIds={existingMemberUserIds}
        onSubmit={handleAddMember}
      />

      {/* 1. Back link */}
      <BackLink />

      {/* 2. Cohort Information card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{cohort.name}</h1>
              {cohort.code && <p className="text-xs text-slate-500">Code: {cohort.code}</p>}
            </div>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[cohort.status] || STATUS_STYLES.planned}>
            {cohort.status}
          </Badge>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoField label="Cohort Type" value={TYPE_LABELS[cohort.cohort_type] || cohort.cohort_type} />
          <InfoField label="Status" value={cohort.status} />
          <InfoField label="Course Name" value={cohort.course_name} />
          <InfoField label="Course Version" value={cohort.course_version} />
          <InfoField label="Start Date" value={cohort.start_date} />
          <InfoField label="End Date" value={cohort.end_date} />
          <InfoField label="Description" value={cohort.description} multiline />
          <InfoField label="Instructor Notes" value={cohort.instructor_notes} multiline />
        </dl>
      </section>

      {/* 3. Managers section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <UserCog className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Managers</h2>
          <span className="ml-auto text-xs text-slate-400">
            {managers.length} active
          </span>
          {user?.role === "admin" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddManagerDialog(true)}
              disabled={addingManager}
              className="ml-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>
        <div className="p-2">
          {managers.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4">No active managers.</p>
          ) : (
            <div className="divide-y divide-slate-50">
               {managers.map((m) => (
                 <MemberRow
                   key={m.id}
                   member={m}
                   user={userById[m.user_id]}
                   onRemove={handleRemoveManager}
                   canRemove={user?.role === "admin" && managers.length > 1}
                 />
               ))}
             </div>
          )}
        </div>
      </section>

      {/* 4. Active Students section */}
             <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
         <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
           <Users className="w-4 h-4 text-green-600" />
           <h2 className="text-sm font-semibold text-slate-900">Active Students</h2>
           <span className="ml-auto text-xs text-slate-400">
             {members.length} enrolled
           </span>
           {canAddMember && (
             <Button
               size="sm"
               variant="outline"
               onClick={() => setShowAddMemberDialog(true)}
               disabled={addingMember}
               className="ml-2"
             >
               <Plus className="w-3.5 h-3.5 mr-1" /> Assign Registered Student
             </Button>
           )}
        </div>
        <div className="p-2">
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4">No active students.</p>
          ) : (
            <div className="divide-y divide-slate-50">
               {members.map((m) => (
                 <MemberRow
                   key={m.id}
                   member={m}
                   user={userById[m.user_id]}
                   onRemove={handleRemoveMember}
                   canRemove={canAddMember}
                 />
               ))}
             </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/Cohorts"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to CE Cohorts
    </Link>
  );
}
