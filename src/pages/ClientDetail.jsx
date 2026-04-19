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
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";

import { createPageUrl } from "@/utils";
import { queryKeys } from "@/lib/queryKeys";
import {
  getCurrentUser,
  getClientById,
  getApplications,
  getTasks,
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
import VocationalProfileCard from "@/components/client-detail/VocationalProfileCard";

function getClientIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

function getDefaultTab(client, userRole) {
  const isDspd = client?.client_type === "dspd";
  const isEmployed = client?.client_type === "employed";

  if (isDspd) return "onboarding";
  if (isEmployed) return "documents";
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
const [activeTab, setActiveTab] = useState(null);
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

  const shouldLoadApplications = !!clientId && activeTab === "applications";
  const shouldLoadTasks = !!clientId && activeTab === "tasks";
  const shouldLoadTime =
    !!clientId && (activeTab === "time" || activeTab === "job_supports");

  const { data: applications = [] } = useQuery({
    queryKey: queryKeys.applications(clientId),
    queryFn: () => getApplications(clientId),
    enabled: shouldLoadApplications,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks(clientId),
    queryFn: () => getTasks(clientId),
    enabled: shouldLoadTasks,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
          {client.client_type !== "employed" && (
            <Button variant="outline" onClick={() => window.open(portalUrl, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Client Portal
            </Button>
          )}

          {client.email && (
            <Button onClick={() => setShowEmailComposer(true)}>
              Send Email
            </Button>
          )}
        </div>
      </div>

     <ClientHeader client={client} onUpdate={refreshClient} />

      {!isDspd && !isEmployed && !isClientUser && (
        <VocationalProfileCard client={client} onRefresh={refreshClient} />
      )}

      <Tabs value={activeTab || ""} onValueChange={setActiveTab}>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    {!isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("onboarding")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "onboarding"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2">
  <ClipboardList className="h-4 w-4" />
  <span className="text-sm font-semibold">Onboarding</span>
</div>
      </button>
    )}

    {!isDspd && !isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("applications")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "applications"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
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

    {!isDspd && !isEmployed && !isClientUser && (
      <button
        type="button"
        onClick={() => setActiveTab("ai_job_search")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "ai_job_search"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2">
  <Brain className="h-4 w-4" />
  <span className="text-sm font-semibold">AI Job Search</span>
</div>
      </button>
    )}

    {!isDspd && !isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("interview_prep")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "interview_prep"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
       <div className="flex items-center gap-2">
  <MessageSquare className="h-4 w-4" />
  <span className="text-sm font-semibold">Interview Prep</span>
</div>
      </button>
    )}

    {!isDspd && !isEmployed && !isClientUser && (
      <button
        type="button"
        onClick={() => setActiveTab("assessments")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "assessments"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
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
        onClick={() => setActiveTab("wble_forms")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "wble_forms"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2">
  <FileText className="h-4 w-4" />
  <span className="text-sm font-semibold">WBLE Forms</span>
</div>
      </button>
    )}

    {!isClientUser && (
      <button
        type="button"
        onClick={() => setActiveTab("documents")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "documents"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2">
  <Folder className="h-4 w-4" />
  <span className="text-sm font-semibold">Documents</span>
</div>
      </button>
    )}

    {!isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("tasks")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "tasks"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
       <div className="flex items-center gap-2">
  <CheckSquare className="h-4 w-4" />
  <span className="text-sm font-semibold">Tasks</span>
</div>
        <div className={cn("mt-1 text-xs", activeTab === "tasks" ? "text-slate-200" : "text-slate-500")}>
          {tasks.length} items
        </div>
      </button>
    )}

    {!isClientUser && isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("job_supports")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "job_supports"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2">
  <Clock className="h-4 w-4" />
  <span className="text-sm font-semibold">Job Supports</span>
</div>
        <div className={cn("mt-1 text-xs", activeTab === "job_supports" ? "text-slate-200" : "text-slate-500")}>
          {timeEntries.length} entries
        </div>
      </button>
    )}

    {!isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("time")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "time"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
       <div className="flex items-center gap-2">
  <Clock className="h-4 w-4" />
  <span className="text-sm font-semibold">Time</span>
</div>
        <div className={cn("mt-1 text-xs", activeTab === "time" ? "text-slate-200" : "text-slate-500")}>
          {timeEntries.length} entries
        </div>
      </button>
    )}

    <button
      type="button"
      onClick={() => setActiveTab("activity")}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        activeTab === "activity"
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="text-sm font-semibold">Activity</div>
    </button>

    {!isClientUser && !isEmployed && (
      <button
        type="button"
        onClick={() => setActiveTab("assistant")}
        className={cn(
          "rounded-2xl border p-4 text-left transition",
          activeTab === "assistant"
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        )}
      >
        <div className="text-sm font-semibold">Assistant</div>
      </button>
    )}
  </div>

        {!isClientUser && !isEmployed && (
          <TabsContent value="onboarding">
            <OnboardingSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && (
          <TabsContent value="applications">
            <JobApplicationsSection
              client={client}
              applications={applications}
              onRefresh={refreshApplications}
            />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && !isClientUser && (
          <TabsContent value="ai_job_search">
            <AIJobSearchPanel client={client} />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && (
          <TabsContent value="interview_prep">
            <InterviewPrepSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && !isClientUser && (
          <TabsContent value="assessments">
            <AssessmentSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {client.client_type === "pre_ets" && !isClientUser && (
          <TabsContent value="wble_forms">
            <WBLEFormSection client={client} onRefresh={refreshClient} />
          </TabsContent>
        )}

        {!isClientUser && (
          <TabsContent value="documents">
           <DocumentsSection
  clientId={client.id}
  refreshKey={documentsRefreshKey}
/>
          </TabsContent>
        )}

        {!isEmployed && (
          <TabsContent value="tasks">
            <TasksSection
              client={client}
              tasks={tasks}
              onRefresh={refreshTasks}
            />
          </TabsContent>
        )}

        {!isClientUser && isEmployed && (
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

        {!isClientUser && !isEmployed && (
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

        <TabsContent value="activity">
          <ActivitySection clientId={client.id} />
        </TabsContent>

        {!isClientUser && !isEmployed && (
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
