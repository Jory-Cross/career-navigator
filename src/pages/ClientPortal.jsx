import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from '@/lib/queryKeys';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getCurrentUser,
  getClientById,
  getClientByEmail,
  getApplications,
  getClientVisibleTasks,
  getClientVisibleDocuments,
  getSharedRecommendations,
  updateRecommendationClientResponse,
  createApplication,
  updateApplication,
  updateTask,

} from "@/lib/api/clientPortalApi";
import ClientPortalIntakeSection from "@/components/intake/ClientPortalIntakeSection";
import ClockInOut from "@/components/pre-ets/ClockInOut";
import { base44 } from "@/api/base44Client";

// General portal tab definitions with their feature keys
const GENERAL_TABS = [
  { value: "intake",           label: "Intake Forms",    featureKey: "client_portal_intake_forms" },
  { value: "applications",     label: "Applications",    featureKey: "client_portal_applications" },
  { value: "recommendations",  label: "Recommendations", featureKey: "client_portal_recommendations" },
  { value: "tasks",            label: "Tasks",           featureKey: "client_portal_tasks" },
  { value: "documents",        label: "Documents",       featureKey: "client_portal_documents" },
];

// Pre-ETS portal tab definitions with their feature keys
const PRE_ETS_TABS = [
  { value: "clock",             label: "Clock In/Out",          featureKey: "client_portal_clock_in_out" },
  { value: "program_checklist", label: "Program Checklist",     featureKey: "client_portal_program_checklist" },
  { value: "iep",               label: "IEP & Transition Plan", featureKey: "client_portal_iep_transition_plan" },
  { value: "skills",            label: "Skills Exploration",    featureKey: "client_portal_skills_exploration" },
  { value: "assessments",       label: "Assessments",           featureKey: "client_portal_assessments" },
  { value: "wble",              label: "WBLE Forms",            featureKey: "client_portal_wble_forms" },
  { value: "meetings",          label: "Meetings",              featureKey: "client_portal_meetings" },
];

// Verify key matching
console.log("[ClientPortal] PRE_ETS_TABS config:", PRE_ETS_TABS.map(t => ({ value: t.value, featureKey: t.featureKey })));

const STAFF_ROLES = ["admin", "management", "employee"];

function getClientIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "intake";
}

function emptyApplicationForm() {
  return {
    company: "",
    position: "",
    status: "active",
    notes: "",
    running_notes: "",
  };
}

export default function ClientPortal() {
  const queryClient = useQueryClient();
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState("");
  const [portalPermissions, setPortalPermissions] = useState(null); // null = not loaded yet
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewApp, setShowNewApp] = useState(false);
  const [appForm, setAppForm] = useState(emptyApplicationForm());
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [taskToComplete, setTaskToComplete] = useState(null);
  const clientIdFromUrl = useMemo(() => getClientIdFromUrl(), []);

  /**
   * Bootstrap user + client.
   * Security rules:
   * - client-role users: ONLY resolved by their own email. No fallback.
   * - staff-role users: resolved by explicit ?id= param only.
   * - Any self-registered user without a PendingRoleAssignment gets default role (not "client"),
   *   so they will never enter the client branch below.
   * - If no valid Client record maps to the authenticated user, access is denied.
   */
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setBootError("");

        const currentUser = await getCurrentUser();
        if (!isMounted) return;

        if (!currentUser) {
          // Not authenticated — redirect to login
          base44.auth.redirectToLogin(window.location.href);
          return;
        }

        setUser(currentUser);

        if (currentUser.role === "client") {
          // Strict access check: must have been invited with client_portal access level
          if (currentUser.access_level !== "client_portal") {
            setBootError("NO_CLIENT_MAPPING");
            setClient(null);
            return;
          }

          // Resolve client:
          // - If linked_client_id is set, use ONLY that. A null result means the client was deleted → deny access.
          // - Only fall back to email match when no linked_client_id exists (legacy / pre-invite flow).
          let resolvedClient = null;
          if (currentUser.linked_client_id) {
            resolvedClient = await getClientById(currentUser.linked_client_id);
            // linked_client_id is set but client is gone (deleted) → hard deny, no email fallback
            if (!resolvedClient) {
              setBootError("NO_CLIENT_MAPPING");
              setClient(null);
              return;
            }
          } else {
            resolvedClient = await getClientByEmail(currentUser.email);
          }
          if (!isMounted) return;

          if (!resolvedClient || !resolvedClient.id) {
            setBootError("NO_CLIENT_MAPPING");
            setClient(null);
            return;
          }

          // Validate org_id matches if present on both records
          if (
            resolvedClient.org_id &&
            currentUser.org_id &&
            resolvedClient.org_id !== currentUser.org_id
          ) {
            setBootError("NO_CLIENT_MAPPING");
            setClient(null);
            return;
          }

          setClient(resolvedClient);
          return;
        }

        if (STAFF_ROLES.includes(currentUser.role) && clientIdFromUrl) {
          const resolvedClient = await getClientById(clientIdFromUrl);
          if (!isMounted) return;
          setClient(resolvedClient || null);
          return;
        }

        // Any other role or missing params: deny
        setClient(null);
      } catch (error) {
        console.error("ClientPortal init failed:", error);
        if (!isMounted) return;
        setBootError("Failed to load portal.");
        setUser(null);
        setClient(null);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [clientIdFromUrl]);

  // Load portal tab permissions based on CLIENT TYPE, not logged-in user role
  // This ensures staff previewing a client portal sees exactly what the client sees
  useEffect(() => {
    if (!user || !client) return;
    
    const isStaff = STAFF_ROLES.includes(user.role);
    
    // Determine which role's permissions to fetch based on CLIENT TYPE
    // NOT based on logged-in user's role
    let permissionRole = "client"; // default
    if (client.client_type === "pre_ets" || client.client_type === "Pre-ETS") {
      permissionRole = "pre_ets";
    } else if (client.client_type === "dspd" || client.client_type === "DSPD") {
      permissionRole = "dspd";
    }

    console.log("[ClientPortal] Bootstrap:", {
      email: user.email,
      loggedInUserRole: user.role,
      isStaff,
      clientType: client.client_type,
      permissionRole,
      accessLevel: user.access_level
    });

    const allTabs = [...GENERAL_TABS, ...PRE_ETS_TABS];

    base44.entities.FeaturePermission.filter({ role: permissionRole })
      .then((rows) => {
        console.log(`[ClientPortal] Loaded ${rows.length} permission records for role "${permissionRole}":`, rows);
        const map = {};
        
        // STRICT DENY-BY-DEFAULT: Initialize all tabs as hidden (false)
        allTabs.forEach((tab) => {
          map[tab.featureKey] = false;
        });
        
        // Only enable tabs that have explicit visible === true records
        rows.forEach((record) => {
          if (record.visible === true) {
            map[record.feature_key] = true;
            console.log(`[ClientPortal] Enabled tab "${record.feature_key}" (visible: true)`);
          } else {
            console.log(`[ClientPortal] Tab "${record.feature_key}" hidden (visible: ${record.visible})`);
          }
        });
        
        // Log final state for debugging
        console.log("[ClientPortal] Final permissions map (deny-by-default):", map);
        const enabledCount = Object.values(map).filter(v => v === true).length;
        console.log(`[ClientPortal] Total enabled tabs: ${enabledCount}/${allTabs.length}`);
        setPortalPermissions(map);
      })
      .catch((error) => {
        console.error("[ClientPortal] Permission fetch failed:", error);
        // On error, default ALL tabs to hidden (strict deny)
        const map = {};
        allTabs.forEach((tab) => { map[tab.featureKey] = false; });
        setPortalPermissions(map);
      });
  }, [user, client]);

  /**
   * Queries
   */
  const {
    data: applications = [],
    isLoading: applicationsLoading,
    error: applicationsError,
  } = useQuery({
    queryKey: queryKeys.applications(client?.id),
    queryFn: () => getApplications(client.id),
    enabled: !!client?.id && activeTab === "applications",
    staleTime: 60 * 1000,
  });

 const {
  data: tasks = [],
  isLoading: tasksLoading,
  error: tasksError,
} = useQuery({
  queryKey: queryKeys.tasks(client?.id),
  queryFn: () => getClientVisibleTasks(client.id),
  enabled: !!client?.id,
  staleTime: 10 * 1000,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  refetchInterval: 10 * 1000,
});
  const isPreEtsClient = client?.client_type === "pre_ets" || client?.client_type === "Pre-ETS";

  // Compute which general tabs are allowed based on permissions
  // STRICT: only tabs with explicit portalPermissions[key] === true render
  const allowedGeneralTabs = useMemo(() => {
    if (!portalPermissions) return []; // not loaded yet → show nothing
    const allowed = GENERAL_TABS.filter((t) => portalPermissions[t.featureKey] === true).map((t) => t.value);
    console.log("[ClientPortal] Allowed general tabs:", allowed);
    return allowed;
  }, [portalPermissions]);

  // Compute which Pre-ETS tabs are allowed based on permissions
  // STRICT: only tabs with explicit portalPermissions[key] === true render
  const allowedPreEtsTabs = useMemo(() => {
    if (!portalPermissions) return []; // not loaded yet → show nothing
    const allowed = PRE_ETS_TABS.filter((t) => portalPermissions[t.featureKey] === true).map((t) => t.value);
    console.log("[ClientPortal] Allowed Pre-ETS tabs:", allowed);
    return allowed;
  }, [portalPermissions]);

  // If current tab is hidden, redirect to first allowed tab; if none exist, fall back to "intake"
  useEffect(() => {
    if (!portalPermissions) return;
    const allAllowed = [...allowedGeneralTabs, ...allowedPreEtsTabs];
    if (!allAllowed.includes(activeTab)) {
      const fallback = allowedGeneralTabs[0] || allAllowed[0] || "intake";
      setActiveTab(fallback);
      const params = new URLSearchParams(window.location.search);
      params.set("tab", fallback);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [portalPermissions, activeTab, allowedGeneralTabs, allowedPreEtsTabs]);

  const activeTaskCount = useMemo(() => {
  if (!Array.isArray(tasks)) return 0;

  return tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled"
  ).length;
}, [tasks]);
    const {
    data: documents = [],
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: queryKeys.documents(client?.id),
    queryFn: () => getClientVisibleDocuments(client.id),
    enabled: !!client?.id && activeTab === "documents",
    staleTime: 60 * 1000,
  });

  const {
  data: sharedRecommendations = [],
  isLoading: sharedRecommendationsLoading,
  error: sharedRecommendationsError,
} = useQuery({
  queryKey: ["clientPortal", "sharedRecommendations", client?.id],
  queryFn: () => getSharedRecommendations(client.id),
  enabled: !!client?.id,
  staleTime: 60 * 1000,
  refetchOnMount: "always",
});
const pendingRecommendationCount = useMemo(() => {
  if (!Array.isArray(sharedRecommendations)) return 0;

  return sharedRecommendations.filter(
    (rec) => !rec.client_response
  ).length;
}, [sharedRecommendations]);
  
  /**
   * Helpers
   */
  const invalidateApplications = useCallback(async () => {
    if (!client?.id) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.applications(client.id),
    });
  }, [client?.id, queryClient]);

  const invalidateTasks = useCallback(async () => {
    if (!client?.id) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tasks(client.id),
    });
  }, [client?.id, queryClient]);

  /**
   * Actions
   */
  const handleCreateApplication = useCallback(async () => {
    if (!client?.id || isSavingApp) return;

    try {
      setIsSavingApp(true);

      await createApplication({
        ...appForm,
        client_id: client.id,
      });

      await invalidateApplications();
      setShowNewApp(false);
      setAppForm(emptyApplicationForm());
    } catch (error) {
      console.error("Create application failed:", error);
      alert("Failed to create application.");
    } finally {
      setIsSavingApp(false);
    }
  }, [appForm, client?.id, invalidateApplications, isSavingApp]);

  const handleUpdateApplication = useCallback(
    async (id, payload) => {
      if (!id) return;

      try {
        setIsSavingApp(true);
        await updateApplication(id, payload);
        await invalidateApplications();
        setSelectedApp(null);
      } catch (error) {
        console.error("Update application failed:", error);
        alert("Failed to update application.");
      } finally {
        setIsSavingApp(false);
      }
    },
    [invalidateApplications]
  );

  const handleUpdateTask = useCallback(async () => {
    if (!selectedTask?.id || isSavingTask) return;

    try {
      setIsSavingTask(true);
      await updateTask(selectedTask.id, selectedTask);
      await invalidateTasks();
      setSelectedTask(null);
    } catch (error) {
      console.error("Update task failed:", error);
      alert("Failed to update task.");
    } finally {
      setIsSavingTask(false);
    }
  }, [invalidateTasks, isSavingTask, selectedTask]);

  const handleCompleteTask = useCallback(async () => {
  if (!taskToComplete?.id || isSavingTask) return;

  const now = new Date().toISOString();
  const cleanNote = completionNote?.trim() || "";

  try {
    setIsSavingTask(true);

    await updateTask(taskToComplete.id, {
      ...taskToComplete,
      client_notes: cleanNote,
      status: "completed",
      completed_at: now,
      client_completed_at: now,
    });

   await invalidateTasks();

// safely get next task AFTER refresh
const nextTasks = queryClient.getQueryData(
  queryKeys.tasks(client?.id)
) || [];

const remainingTasks = nextTasks.filter(
  (t) => t.id !== taskToComplete.id && t.status !== "completed"
);

if (remainingTasks.length > 0) {
  setSelectedTask(remainingTasks[0]);
} else {
  setSelectedTask(null);
}

setTaskToComplete(null);
setCompletionNote("");
  } catch (error) {
    console.error("Complete task failed:", error);
    alert("Failed to complete task.");
  } finally {
    setIsSavingTask(false);
  }
}, [
  completionNote,
  invalidateTasks,
  isSavingTask,
  taskToComplete,
]);

  /**
   * Render guards
   */
  if (bootError === "NO_CLIENT_MAPPING") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="text-lg font-semibold text-slate-800">Portal Access Not Found</h2>
          <p className="text-sm text-slate-500">
            No portal account was found for this login. Please contact your provider to request access.
          </p>
          <button
            onClick={() => base44.auth.logout()}
            className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (bootError) {
    return <div className="p-4 text-red-600">{bootError}</div>;
  }

  if (!user || !client || !portalPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  // Debug logs for permission resolution
  console.log("[ClientPortal] Permission resolution:", {
    permissionRole: isPreEtsClient ? "pre_ets" : "client",
    isPreEtsClient,
    portalPermissions,
    allowedGeneralTabs,
    allowedPreEtsTabs,
    activeTab
  });

  // If ALL tabs are hidden (both general and pre-ets), show empty state
  const allAllowedTabs = [...allowedGeneralTabs, ...allowedPreEtsTabs];
  if (portalPermissions && allAllowedTabs.length === 0) {
    console.log("[ClientPortal] No tabs enabled — showing empty state");
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="text-lg font-semibold text-slate-800">No Portal Features Enabled</h2>
          <p className="text-sm text-slate-500">
            Your administrator has not enabled any portal features at this time. Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Client Portal</h1>
        <p className="text-sm text-muted-foreground">
          {client.full_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client"}
        </p>
      </div>

{(activeTaskCount > 0 || pendingRecommendationCount > 0) && (
  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
    You have items that need your attention.
  </div>
)}
      
     <Tabs
  value={activeTab}
  onValueChange={(value) => {
    setActiveTab(value);

    const params = new URLSearchParams(window.location.search);
    params.set("tab", value);

    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`
    );
  }}
>
                       <TabsList>
          {allowedGeneralTabs.includes("intake") && (
            <TabsTrigger value="intake">Intake Forms</TabsTrigger>
          )}

          {allowedGeneralTabs.includes("applications") && (
            <TabsTrigger value="applications">Applications</TabsTrigger>
          )}

          {allowedGeneralTabs.includes("recommendations") && (
            <TabsTrigger value="recommendations">
              <div className="flex items-center gap-2">
                <span>Recommendations</span>
                {pendingRecommendationCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    {pendingRecommendationCount}
                  </span>
                )}
              </div>
            </TabsTrigger>
          )}

          {allowedGeneralTabs.includes("tasks") && (
            <TabsTrigger value="tasks">
              <div className="flex items-center gap-2">
                <span>Tasks</span>
                {activeTaskCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    {activeTaskCount}
                  </span>
                )}
              </div>
            </TabsTrigger>
          )}

          {allowedGeneralTabs.includes("documents") && (
            <TabsTrigger value="documents">Documents</TabsTrigger>
          )}

          {isPreEtsClient &&
            PRE_ETS_TABS.filter((t) => allowedPreEtsTabs.includes(t.value)).map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))
          }
        </TabsList>

        <TabsContent value="intake" className="space-y-4">
          <ClientPortalIntakeSection client={client} />
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Applications</h2>
            <Button onClick={() => setShowNewApp(true)}>Add Application</Button>
          </div>

          {applicationsLoading ? (
            <div>Loading applications...</div>
          ) : applicationsError ? (
            <div className="text-red-600">Failed to load applications.</div>
          ) : applications.length === 0 ? (
            <div className="text-sm text-muted-foreground">No applications yet.</div>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="w-full rounded border p-3 text-left hover:bg-muted"
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="font-medium">
                    {app.position || "Untitled Position"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {app.company || "Unknown Company"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Shared Recommendations</h2>
          </div>

          {sharedRecommendationsLoading ? (
            <div>Loading recommendations...</div>
          ) : sharedRecommendationsError ? (
            <div className="text-red-600">Failed to load recommendations.</div>
          ) : sharedRecommendations.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No recommendations have been shared yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sharedRecommendations.map((rec) => (
                <div key={rec.id} className="rounded border p-4">
                  <div className="font-medium">
                   {rec.job_title || rec.title || "Untitled Recommendation"}
                  </div>

                  {rec.employer ? (
                    <div className="text-sm text-muted-foreground">
                      {rec.employer}
                    </div>
                  ) : null}

                  {rec.location || rec.pay ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {[rec.location, rec.pay].filter(Boolean).join(" • ")}
                    </div>
                  ) : null}

                  {rec.fit_reason ? (
                    <div className="mt-3 rounded bg-muted p-3 text-sm">
                      <div className="font-medium">Why this may fit</div>
                      <div>{rec.fit_reason}</div>
                    </div>
                  ) : null}

                  {rec.support_strategy ? (
                    <div className="mt-3 rounded bg-muted p-3 text-sm">
                      <div className="font-medium">Support strategy</div>
                      <div>{rec.support_strategy}</div>
                    </div>
                  ) : null}

                  {rec.concerns ? (
  <div className="mt-3 rounded bg-muted p-3 text-sm">
    <div className="font-medium">Things to consider</div>
    <div>{rec.concerns}</div>
  </div>
) : null}

<div className="mt-4 flex gap-2">
  <Button
    size="sm"
    type="button"
    variant={rec.client_response === "interested" ? "default" : "outline"}
    onClick={async () => {
      const [batchId, index] = rec.id.split("-");
      await updateRecommendationClientResponse({
        batchId,
        index: Number(index),
        response: "interested",
      });
      await queryClient.invalidateQueries({
        queryKey: ["clientPortal", "sharedRecommendations", client?.id],
      });
    }}
  >
    Interested
  </Button>

  <Button
    size="sm"
    type="button"
    variant={rec.client_response === "not_interested" ? "destructive" : "outline"}
    onClick={async () => {
      const [batchId, index] = rec.id.split("-");
      await updateRecommendationClientResponse({
        batchId,
        index: Number(index),
        response: "not_interested",
      });
      await queryClient.invalidateQueries({
        queryKey: ["clientPortal", "sharedRecommendations", client?.id],
      });
    }}
  >
    Not Interested
  </Button>
</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Tasks</h2>
          </div>

          {tasksLoading ? (
            <div>Loading tasks...</div>
          ) : tasksError ? (
            <div className="text-red-600">Failed to load tasks.</div>
          ) : tasks.length === 0 ? (
  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
    🎉 All tasks complete — great job!
  </div>
) : (
            <div className="space-y-2">
              {tasks.map((task) => {
  const totalSteps = Array.isArray(task.checklist)
    ? task.checklist.length
    : 0;

  const completedSteps = Array.isArray(task.checklist)
    ? task.checklist.filter((s) => s.completed).length
    : 0;

  const percent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const isComplete = task.status === "completed";

  return (
    <button
      key={task.id}
      type="button"
      onClick={() => setSelectedTask(task)}
      className="w-full rounded-xl border p-4 text-left transition hover:shadow-sm"
    >
      {/* TITLE */}
      <div className="font-medium text-base">
        {task.title || "Untitled Task"}
      </div>

      {/* STATUS */}
      <div className="mt-1 text-xs text-muted-foreground">
        {isComplete ? "Completed" : `${completedSteps}/${totalSteps} steps`}
      </div>

      {/* PROGRESS BAR */}
      <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${
            isComplete ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* PERCENT / COMPLETE */}
      <div className="mt-2 text-xs font-medium">
        {isComplete ? (
          <span className="text-emerald-600">✔ Completed</span>
        ) : (
          <span>{percent}% complete</span>
        )}
      </div>

      {/* READY STATE */}
      {!isComplete &&
        totalSteps > 0 &&
        completedSteps === totalSteps && (
          <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800">
            Ready to complete
          </div>
        )}

      {/* CLIENT NOTE */}
      {task.client_notes && (
        <div className="mt-2 rounded-md border border-purple-200 bg-purple-50 p-2 text-xs text-purple-900">
          <div className="font-medium text-purple-700">Your Note</div>
          <div>{task.client_notes}</div>
        </div>
      )}
    </button>
  );
})}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Documents</h2>
          </div>

          {documentsLoading ? (
            <div>Loading documents...</div>
          ) : documentsError ? (
            <div className="text-red-600">Failed to load documents.</div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents yet.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
               <div key={doc.id} className="rounded border p-3">
  <div className="font-medium">{doc.title || "Untitled Document"}</div>

  {doc.source && (
    <div className="text-xs text-muted-foreground">
      {doc.source.replace("_", " ")}
    </div>
  )}
                  {doc.description ? (
                    <div className="text-sm text-muted-foreground">
                      {doc.description}
                    </div>
                  ) : null}
                  {doc.file_url ? (
                    <a
                      className="mt-2 inline-block text-sm underline"
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
       {isPreEtsClient && allowedPreEtsTabs.includes("clock") && (
  <TabsContent value="clock" className="space-y-4">
    <ClockInOut
      clientId={client.id}
      clientName={
        client.full_name ||
        [client.first_name, client.last_name]
          .filter(Boolean)
          .join(" ")
      }
    />
  </TabsContent>
)}

        {isPreEtsClient && allowedPreEtsTabs.includes("program_checklist") && (
          <TabsContent value="program_checklist" className="space-y-4">
            <div className="text-sm text-muted-foreground">Program Checklist — Coming Soon</div>
          </TabsContent>
        )}

        {isPreEtsClient && allowedPreEtsTabs.includes("iep") && (
          <TabsContent value="iep" className="space-y-4">
            <div className="text-sm text-muted-foreground">IEP & Transition Plan — Coming Soon</div>
          </TabsContent>
        )}

        {isPreEtsClient && allowedPreEtsTabs.includes("skills") && (
          <TabsContent value="skills" className="space-y-4">
            <div className="text-sm text-muted-foreground">Skills Exploration — Coming Soon</div>
          </TabsContent>
        )}

        {isPreEtsClient && allowedPreEtsTabs.includes("assessments") && (
          <TabsContent value="assessments" className="space-y-4">
            <div className="text-sm text-muted-foreground">Assessments — Coming Soon</div>
          </TabsContent>
        )}

        {isPreEtsClient && allowedPreEtsTabs.includes("wble") && (
          <TabsContent value="wble" className="space-y-4">
            <div className="text-sm text-muted-foreground">WBLE Forms — Coming Soon</div>
          </TabsContent>
        )}

        {isPreEtsClient && allowedPreEtsTabs.includes("meetings") && (
          <TabsContent value="meetings" className="space-y-4">
            <div className="text-sm text-muted-foreground">Meetings — Coming Soon</div>
          </TabsContent>
        )}
      </Tabs>

      {/* CREATE APPLICATION */}
      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">New Application</h3>

            <Input
              placeholder="Company"
              value={appForm.company}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, company: e.target.value }))
              }
            />

            <Input
              placeholder="Position"
              value={appForm.position}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, position: e.target.value }))
              }
            />

            <Input
              placeholder="Status"
              value={appForm.status}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, status: e.target.value }))
              }
            />

            <Textarea
              placeholder="Notes"
              value={appForm.notes}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />

            <Textarea
              placeholder="Running notes"
              value={appForm.running_notes}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, running_notes: e.target.value }))
              }
            />

            <div className="flex gap-2">
              <Button onClick={handleCreateApplication} disabled={isSavingApp}>
                {isSavingApp ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewApp(false)}
                disabled={isSavingApp}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TASK DETAIL */}
      <Dialog
  open={!!selectedTask}
  onOpenChange={(open) => {
    if (!open) {
      setSelectedTask(null);
    }
  }}
>
  <DialogContent
    className="max-h-[85vh] overflow-y-auto"
    onInteractOutside={(event) => {
      event.preventDefault();
    }}
  >
                  {selectedTask && (
  <div className="space-y-4">
    <h3 className="text-lg font-medium">Task</h3>

    {/* TITLE */}
    <div className="text-base font-semibold">
      {selectedTask.title || "Untitled Task"}
    </div>

    {/* DESCRIPTION */}
    {selectedTask.description ? (
      <div className="text-sm text-muted-foreground">
        {selectedTask.description}
      </div>
    ) : null}

    {/* CHECKLIST */}
    {Array.isArray(selectedTask.checklist) &&
      selectedTask.checklist.length > 0 && (
        <div className="space-y-2 rounded border p-3">
          <div className="text-sm font-medium">Checklist</div>

          <div className="space-y-2">
            {selectedTask.checklist.map((item, index) => (
              <label
                key={index}
                className="flex items-center gap-2 text-sm"
              >
                <input
  type="checkbox"
  checked={!!item.completed}
  onChange={async (e) => {
    const updated = [...selectedTask.checklist];
    updated[index] = {
      ...updated[index],
      completed: e.target.checked,
    };

    const completedCount = updated.filter((step) => step.completed).length;

    let nextStatus = "pending";

    if (completedCount > 0) {
      nextStatus = "in_progress";
    }

    const updatedTask = {
      ...selectedTask,
      checklist: updated,
      status: nextStatus,
    };

   setSelectedTask(updatedTask);

// auto trigger completion if all steps done
if (
  updatedTask.checklist.length > 0 &&
  updatedTask.checklist.every((step) => step.completed)
) {
  setTaskToComplete(updatedTask);
}

    try {
      setIsSavingTask(true);
      await updateTask(selectedTask.id, updatedTask);
      await invalidateTasks();
    } catch (error) {
      console.error("Auto-save failed:", error);
      alert("Failed to save progress.");
    } finally {
      setIsSavingTask(false);
    }
  }}
/>
<span>{item.text}</span>
</label>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            {
              selectedTask.checklist.filter(
                (step) => step.completed
              ).length
            }
            /{selectedTask.checklist.length} steps complete
          </div>
        </div>
      )}

    {/* READY TO COMPLETE */}
    {Array.isArray(selectedTask.checklist) &&
      selectedTask.checklist.length > 0 &&
      selectedTask.checklist.every((step) => step.completed) &&
      selectedTask.status !== "completed" && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800">
          Ready to complete — click Mark Complete
        </div>
      )}

    {/* CLIENT NOTE (IF EXISTS) */}
    {selectedTask.client_notes ? (
      <div className="rounded-md border border-purple-200 bg-purple-50 p-2 text-xs text-purple-900">
        <div className="font-medium text-purple-700">Your Note</div>
        <div>{selectedTask.client_notes}</div>
      </div>
    ) : null}

       {/* ACTION */}
    <div className="flex gap-2">
     
      <Button
        type="button"
        variant="outline"
        onClick={() => setTaskToComplete(selectedTask)}
        disabled={
          isSavingTask ||
          (
            Array.isArray(selectedTask.checklist) &&
            selectedTask.checklist.length > 0 &&
            selectedTask.checklist.some((step) => !step.completed)
          )
        }
      >
        Mark Complete
      </Button>
    </div>
  </div>
)}
    
        </DialogContent>
      </Dialog>

      {/* APPLICATION DETAIL */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedApp && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Edit Application</h3>

              <Input
                value={selectedApp.company || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
              />

              <Input
                value={selectedApp.position || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    position: e.target.value,
                  }))
                }
              />

              <Input
                value={selectedApp.status || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedApp.notes || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedApp.running_notes || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    running_notes: e.target.value,
                  }))
                }
              />

              <div className="flex gap-2">
                <Button
                  onClick={() => handleUpdateApplication(selectedApp.id, selectedApp)}
                  disabled={isSavingApp}
                >
                  {isSavingApp ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedApp(null)}
                  disabled={isSavingApp}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
            </Dialog>

      {/* COMPLETE TASK MODAL */}
      <Dialog
        open={!!taskToComplete}
        onOpenChange={(open) => {
          if (!open) {
            setTaskToComplete(null);
            setCompletionNote("");
          }
        }}
      >
        <DialogContent className="space-y-3">
          <h3 className="text-lg font-medium">Complete Task</h3>

          <Textarea
            placeholder="Add a note (optional)"
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
          />

          <div className="flex gap-2">
            <Button onClick={handleCompleteTask} disabled={isSavingTask}>
              {isSavingTask ? "Saving..." : "Complete Task"}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setTaskToComplete(null);
                setCompletionNote("");
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}