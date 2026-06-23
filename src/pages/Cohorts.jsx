import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GraduationCap, Plus, Pencil, ArrowRight, Loader2, Search } from "lucide-react";
import { useCohorts } from "@/lib/cohort/useCohorts";
import CohortFormDialog from "@/components/cohorts/CohortFormDialog";

// Status color mapping
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

/**
 * Cohorts — Phase 6A list page.
 *
 * Permissions:
 *  - view list: admin + management (route is admin-gated on sidebar; the page
 *    additionally renders read-only for management)
 *  - create cohort: admin only ("New Cohort" button hidden otherwise)
 *  - edit cohort: admin only (Edit action hidden otherwise)
 *
 * For Phase 6A the "Open" action routes to /ClientDetail-style detail. The
 * detail page (CohortDetail.jsx) is intentionally NOT built in 6A, so opening
 * navigates to a placeholder route that will be implemented in Phase 6B.
 */
export default function Cohorts() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // Current user — needed for admin gating and org scoping.
  useEffect(() => {
    let active = true;
    base44.auth.me().then((u) => { if (active) setUser(u); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const {
    cohorts, memberships, orgId, loadingCohorts,
    createCohort, updateCohort, isCreating, isUpdating,
  addMember,
  } = useCohorts(user);

  // Fetch org users (via the existing getOrgUsers function) for the manager
  // auto-assignment on create — recommended so a new cohort immediately gets
  // a manager before any other member is added.
  const { data: orgUsers = [] } = useQuery({
    queryKey: ["orgUsers", "ceCohorts"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getOrgUsers", {});
      const payload = res.data || {};
      return Array.isArray(payload.users) ? payload.users : [];
    },
    enabled: !!user && user.role === "admin",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const memberByCohort = useMemo(() => {
    const map = {};
    for (const m of memberships) {
      if (!map[m.cohort_id]) map[m.cohort_id] = { managers: 0, members: 0 };
      if (m.cohort_role === "manager") map[m.cohort_id].managers += 1;
      else map[m.cohort_id].members += 1;
    }
    return map;
  }, [memberships]);

  const userIdToName = useMemo(() => {
    const map = {};
    for (const u of orgUsers) map[u.id] = u.full_name || u.email;
    return map;
  }, [orgUsers]);

  const managersByCohort = useMemo(() => {
    const map = {};
    for (const m of memberships) {
      if (m.cohort_role !== "manager") continue;
      if (!map[m.cohort_id]) map[m.cohort_id] = [];
      map[m.cohort_id].push(userIdToName[m.user_id] || "—");
    }
    return map;
  }, [memberships, userIdToName]);

  const filtered = useMemo(() => {
    return cohorts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.cohort_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${c.name || ""} ${c.code || ""} ${c.course_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cohorts, search, statusFilter, typeFilter]);

  // Admins gate
  const canManage = !!user && user.role === "admin";

  const handleCreate = async (payload) => {
    if (!orgId) {
      throw new Error("Missing org_id — cannot create cohort without an organization context.");
    }
    const created = await createCohort(payload);
    // Recommended: auto-add the creating admin as the first manager so the
    // cohort has at least one active manager (last-manager guard invariant).
    if (created?.id && user?.id) {
      try { await addMember({ cohort_id: created.id, user_id: user.id, cohort_role: "manager" }); } catch {}
    }
  };

  const handleUpdate = async ({ id, patch }) => {
    await updateCohort({ id, patch });
  };

  const openCohort = (cohort) => {
    // Phase 6A: detail page is not built yet. Navigate to the reserved route
    // with cohort_id so Phase 6B can pick it up without further routing changes.
    navigate(`/CohortDetail?cohort_id=${cohort.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            CE Training Cohorts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Customized Employment certification cohorts, managers, and members.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> New Cohort
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search name / code / course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-200 rounded-md px-2.5 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <select
          className="border border-slate-200 rounded-md px-2.5 py-2 text-sm bg-white"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="testing">Testing</option>
          <option value="training">Training</option>
          <option value="production">Production</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        {loadingCohorts ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading cohorts…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <GraduationCap className="w-8 h-8 mb-2" />
            <p className="text-sm">No cohorts match the current filters.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Course Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Managers</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const counts = memberByCohort[c.id] || { managers: 0, members: 0 };
                const managerNames = managersByCohort[c.id] || [];
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openCohort(c)}>
                    <TableCell className="font-medium text-slate-900">
                      {c.name}
                      {c.code && <span className="ml-2 text-xs text-slate-400">({c.code})</span>}
                    </TableCell>
                    <TableCell><span className="text-sm text-slate-600">{TYPE_LABELS[c.cohort_type] || c.cohort_type}</span></TableCell>
                    <TableCell className="text-sm text-slate-600">{c.course_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[c.status] || STATUS_STYLES.planned}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <span className="font-medium text-slate-800">{counts.managers}</span>
                      </span>
                      {managerNames.length > 0 && (
                        <span className="block text-xs text-slate-400 mt-0.5 truncate max-w-[180px]" title={managerNames.join(", ")}>
                          {managerNames.join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium text-slate-800">{counts.members}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-3">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center gap-1"
                          onClick={() => openCohort(c)}
                        >
                          Open <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            className="text-slate-600 hover:text-slate-900 text-sm inline-flex items-center gap-1"
                            onClick={() => { setEditing(c); setShowForm(true); }}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CohortFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        cohort={editing}
        onSubmit={editing ? handleUpdate : handleCreate}
        saving={isCreating || isUpdating}
      />
    </div>
  );
}