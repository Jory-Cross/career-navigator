import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  ClipboardList,
  Briefcase,
  Brain,
  MessageSquare,
  FileText,
  Folder,
  CheckSquare,
  Clock,
  Activity,
  Bot,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";

import { createPageUrl } from "@/utils";
import { queryKeys } from "@/lib/queryKeys";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";
import {
  getCurrentUser,
  getClientById,
  getApplications,
  getTasks,
  getArchivedTasks,
  getTimeEntries,
} from "@/lib/api/clientPortalApi";

import ClientHeader from "@/components/client-detail/ClientHeader";
import JobApplicationsSection from "@/components/client-detail/JobApplicationsSection";
import TasksSection from "@/components/client-detail/TasksSection";

import TimeLogDashboard from "@/components/client-detail/TimeLogDashboard";
import OnboardingSection from "@/components/client-detail/OnboardingSection";
import InterviewPrepSection from "@/components/client-detail/InterviewPrepSection";
import DocumentsSection from "@/components/client-detail/DocumentsSection";
import ActivitySection from "@/components/client-detail/ActivitySection";
import AssessmentSection from "@/components/client-detail/AssessmentSection";
import WBLEFormSection from "@/components/client-detail/WBLEFormSection";
import EmailComposer from "@/components/EmailComposer";
import AIAssistantPanel from "@/components/client-detail/AIAssistantPanel";
import AIJobSearchPanel from "@/components/client-detail/AIJobSearchPanel";
import { testOnetConnection } from "@/lib/onet/onetClient";
import VocationalProfileCard from "@/components/client-detail/VocationalProfileCard";
import IntakePacketPanel from "@/components/intake/IntakePacketPanel";

function getClientIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

function getDefaultTab(client, userRole) {
  const isDspd = client?.client_type === "dspd";
  const isEmployed = client?.client_type === "employed";

  if (isDspd) return "onboarding";
  if (isEmployed) return "client_details";
  if (userRole === "client") return "activity";
  return "applications";
}

function canAccessClient(client, user, clientId) {
  if (!client || !user) return false;
  if (user.role === "admin") return true;
  if (user.role === "management") return true;

  if (
    user.role === "employee" &&
    (client.assigned_employee_id === user.id || client.created_by === user.email)
  ) {
    return true;
  }

  if (user.role === "client" && client.id === clientId) {
    return true;
  }

  return false;
}

export default function ClientDetail() {
  const clientId = useMemo(() => getClientIdFromUrl(), []);
  const queryClient = useQueryClient();

 const [showEmailComposer, setShowEmailComposer] = useState(false);

const [user, setUser] = useState(null);
const [openAssessmentType, setOpenAssessmentType] = useState(null);
const [activeTab, setActiveTab] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab");
});
  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab);

    const params = new URLSearchParams(window.location.search);
    params.set("id", clientId);
    params.set("tab", nextTab);

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`
    );
  }, [clientId]);
const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);

const handleDocumentsChanged = useCallback(() => {
  setDocumentsRefreshKey((prev) => prev + 1);
}, []);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((result) => {
        if (!cancelled) setUser(result || null);
      })
      .catch((error) => {
        console.error("Failed to load current user:", error);
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: client = null,
    isLoading: clientLoading,
  } = useQuery({
    queryKey: [...queryKeys.client(clientId), user?.role, user?.id, user?.email],
    queryFn: async () => {
      if (!clientId || !user) return null;

      const clientData = await getClientById(clientId);
      if (!clientData) return null;

      return canAccessClient(clientData, user, clientId) ? clientData : null;
    },
    enabled: !!clientId && !!user,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const defaultTab = useMemo(() => {
    return client ? getDefaultTab(client, user?.role) : null;
  }, [client, user?.role]);

  useEffect(() => {
    if (defaultTab && !activeTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, activeTab]);

  const isDspd = client?.client_type === "dspd";
  const isEmployed = client?.client_type === "employed";
  const isClientUser = user?.role === "client";

  // Feature-gating for client detail sections (admin always sees all)
  const { canView: cdCanView } = useFeaturePermissions(user);
  const cd = {
    details:       cdCanView("client_details"),
    onboarding:    cdCanView("client_onboarding"),
    intake_packet: cdCanView("client_intake_packet"),
    applications:  cdCanView("client_applications"),
    ai_job_search: cdCanView("client_ai_job_search"),
    interview_prep:cdCanView("client_interview_prep"),
    assessments:   cdCanView("client_assessments"),
    documents:     cdCanView("client_documents"),
    tasks:         cdCanView("client_tasks"),
    time:          cdCanView("client_time"),
    activity:      cdCanView("client_activity"),
    assistant:     cdCanView("client_assistant"),
    portal:        cdCanView("client_portal"),
    send_email:    cdCanView("client_send_email"),
    test_onet:     cdCanView("client_test_onet"),
    add_actions:   cdCanView("client_add_actions"),
  };

  const shouldLoadApplications = !!clientId && activeTab === "applications";
  const shouldLoadTime =
    !!clientId && (activeTab === "time" || activeTab === "job_supports");

  const { data: applications = [] } = useQuery({
  queryKey: queryKeys.applications(clientId),
  queryFn: () => getApplications(clientId),
  enabled: shouldLoadApplications,
  staleTime: 10 * 1000,
  refetchInterval: 10 * 1000,
  refetchOnWindowFocus: true,
});

   const { data: tasks = [] } = useQuery({
  queryKey: queryKeys.tasks(clientId),
  queryFn: async () => {
    const activeTasks = await getTasks(clientId);
    const archivedTasks = await getArchivedTasks(clientId);

    return [
      ...(Array.isArray(activeTasks) ? activeTasks : []),
      ...(Array.isArray(archivedTasks) ? archivedTasks : []),
    ];
  },
  enabled: !!clientId,
  staleTime: 10 * 1000,
  refetchInterval: 10 * 1000,
  refetchOnWindowFocus: true,
});

const currentTaskCount = tasks.filter(
  (task) =>
    !task.is_archived &&
    task.status !== "completed" &&
    task.status !== "cancelled"
).length;

  const { data: timeEntries = [] } = useQuery({
    queryKey: queryKeys.timeEntries(clientId),
    queryFn: () => getTimeEntries(clientId),
    enabled: shouldLoadTime,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshClient = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.client(clientId) });
  }, [queryClient, clientId]);

  const refreshApplications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.applications(clientId) });
  }, [queryClient, clientId]);

  const refreshTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(clientId) });
  }, [queryClient, clientId]);

  const refreshTimeEntries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries(clientId) });
  }, [queryClient, clientId]);

  const portalUrl = useMemo(() => `/ClientPortal?id=${clientId}`, [clientId]);

  if (clientLoading || !user) {
    return <div className="p-6">Loading...</div>;
  }

  if (!client) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-lg font-medium">Client not found</div>
        <Link to={createPageUrl("Clients")}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={createPageUrl("Clients")}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </Link>

        <div className="flex flex-wrap gap-2">
          {cd.portal && client.client_type !== "employed" && (
            <Button variant="outline" onClick={() => window.open(portalUrl, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Client Portal
            </Button>
          )}

          {cd.send_email && client.email && (
            <Button onClick={() => setShowEmailComposer(true)}>
              Send Email
            </Button>
          )}

          {cd.test_onet && (
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await testOnetConnection();
                if (ok) {
                  alert("O*NET connection successful");
                } else {
                  alert("O*NET connection failed. Check console.");
                }
              }}
            >
              Test O*NET
            </Button>
          )}
        </div>
      </div>
<ClientHeader client={client} showDetails={false} allowEdit={false} />

      

   <Tabs value={activeTab || ""} onValueChange={handleTabChange}>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
  {cd.details && !isClientUser && (
  <button
    type="button"
     onClick={() => handleTabChange("client_details")}
    className={cn(
      "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
      activeTab === "client_details"
        ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
    )}
  >
    <div className="flex items-center gap-2">
      <User className="h-4 w-4" />
      <span className="text-sm font-semibold">Client Details</span>
    </div>
  </button>
)}
    {cd.onboarding && !isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => handleTabChange("onboarding")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "onboarding"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          <span className="text-sm font-semibold">Onboarding</span>
        </div>
      </button>
    )}

    {cd.intake_packet && !isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => handleTabChange("intake_packet")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "intake_packet"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          <span className="text-sm font-semibold">Intake Packet</span>
        </div>
      </button>
    )}

    {cd.applications && !isDspd && !isEmployed && (
      <button
        type="button"
        onClick={() => handleTabChange("applications")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "applications"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          <span className="text-sm font-semibold">Applications</span>
        </div>
        <div className={cn("mt-1 text-xs", activeTab === "applications" ? "text-slate-200" : "text-slate-500")}>
          {applications.length} items
        </div>
      </button>
    )}

    {cd.ai_job_search && !isDspd && !isEmployed && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("ai_job_search")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "ai_job_search"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          <span className="text-sm font-semibold">AI Job Search</span>
        </div>
      </button>
    )}

    {cd.interview_prep && !isDspd && !isEmployed && (
      <button
        type="button"
        onClick={() => handleTabChange("interview_prep")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "interview_prep"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-semibold">Interview Prep</span>
        </div>
      </button>
    )}

    {cd.assessments && !isDspd && !isEmployed && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("assessments")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "assessments"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold">Assessments</span>
        </div>
      </button>
    )}

    {client.client_type === "pre_ets" && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("wble_forms")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "wble_forms"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold">WBLE Forms</span>
        </div>
      </button>
    )}

    {cd.documents && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("documents")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "documents"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4" />
          <span className="text-sm font-semibold">Documents</span>
        </div>
      </button>
    )}

   {cd.tasks && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("tasks")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "tasks"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          <span className="text-sm font-semibold">Tasks</span>
        </div>
        <div className={cn("mt-1 text-xs", activeTab === "tasks" ? "text-slate-200" : "text-slate-500")}>
          {currentTaskCount} items
        </div>
      </button>
    )}

    {cd.activity && (
      <button
        type="button"
        onClick={() => handleTabChange("activity")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "activity"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-semibold">Activity</span>
        </div>
      </button>
    )}

    {cd.assistant && !isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => handleTabChange("assistant")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "assistant"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
        )}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-semibold">Assistant</span>
        </div>
      </button>
    )}
  </div>
  
       <>
  {cd.details && !isClientUser && (
    <TabsContent value="client_details">
      <div className="space-y-6">
        <ClientHeader client={client} onUpdate={refreshClient} formOnly />
        {!isDspd && !isEmployed && !isClientUser && (
          <VocationalProfileCard client={client} onRefresh={refreshClient} />
        )}
      </div>
    </TabsContent>
  )}

  {cd.onboarding && !isClientUser && !isEmployed && (
    <TabsContent value="onboarding">
      <OnboardingSection client={client} onRefresh={refreshClient} />
    </TabsContent>
  )}

  {cd.intake_packet && !isClientUser && !isEmployed && (
    <TabsContent value="intake_packet">
      <IntakePacketPanel client={client} currentUser={user} />
    </TabsContent>
  )}
</>

        {cd.applications && !isDspd && !isEmployed && (
          <TabsContent value="applications">
            <JobApplicationsSection
              clientId={client.id}
              client={client}
              applications={applications}
              onRefresh={refreshApplications}
            />
          </TabsContent>
        )}

        {cd.ai_job_search && !isDspd && !isEmployed && !isClientUser && (
          <TabsContent value="ai_job_search">
            <AIJobSearchPanel
              client={client}
              onStartInterestProfiler={() => {
                setOpenAssessmentType("interest_profiler");
                handleTabChange("assessments");
              }}
            />
          </TabsContent>
        )}

        {cd.interview_prep && !isDspd && !isEmployed && (
          <TabsContent value="interview_prep">
            <InterviewPrepSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {cd.assessments && !isDspd && !isEmployed && !isClientUser && (
          <TabsContent value="assessments">
            <AssessmentSection
              client={client}
              onRefresh={refreshClient}
              openAssessmentType={openAssessmentType}
              onOpenAssessmentTypeHandled={() => setOpenAssessmentType(null)}
            />
          </TabsContent>
        )}

        {client.client_type === "pre_ets" && !isClientUser && (
          <TabsContent value="wble_forms">
            <WBLEFormSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {cd.tasks && !isClientUser && (
          <TabsContent value="documents">
            <DocumentsSection clientId={client.id} refreshKey={documentsRefreshKey} />
          </TabsContent>
        )}

        {cd.tasks && !isEmployed && (
          <TabsContent value="tasks">
            <TasksSection clientId={client.id} tasks={tasks} onRefresh={refreshTasks} />
          </TabsContent>
        )}

        {cd.time && !isClientUser && isEmployed && (
          <TabsContent value="job_supports">
            <TimeLogDashboard
              client={client}
              clientId={client.id}
              timeEntries={timeEntries}
              onRefresh={refreshTimeEntries}
              mode="job_supports"
            />
          </TabsContent>
        )}

        {cd.time && !isClientUser && !isEmployed && (
          <TabsContent value="time">
            <TimeLogDashboard
              client={client}
              clientId={client.id}
              timeEntries={timeEntries}
              onRefresh={refreshTimeEntries}
              mode="time"
            />
          </TabsContent>
        )}

        {cd.activity && (
          <TabsContent value="activity">
            <ActivitySection clientId={client.id} />
          </TabsContent>
        )}

        {cd.assistant && !isClientUser && !isEmployed && (
          <TabsContent value="assistant">
            <AIAssistantPanel client={client} />
          </TabsContent>
        )}
      </Tabs>

      {showEmailComposer && (
        <EmailComposer
          open={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
          clientId={client.id}
          clientEmail={client.email}
          clientName={
            client.full_name ||
            [client.first_name, client.last_name].filter(Boolean).join(" ")
          }
        />
      )}
    </div>
  );
}
