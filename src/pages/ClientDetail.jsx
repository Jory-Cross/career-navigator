import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import ClientHeader from "@/components/client-detail/ClientHeader";
import JobApplicationsSection from "@/components/client-detail/JobApplicationsSection";
import TasksSection from "@/components/client-detail/TasksSection";
import ResumeSection from "@/components/client-detail/ResumeSection";
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

const clientDetailApi = {
  async getCurrentUser() {
    return await base44.auth.me();
  },

  async getClientById(id) {
    try {
      return await base44.entities.Client.get(id);
    } catch (error) {
      const allClients = await base44.entities.Client.list();
      return allClients.find((c) => c.id === id) || null;
    }
  },

  async getApplications(clientId) {
    return await base44.entities.JobApplication.filter({ client_id: clientId });
  },

  async getTasks(clientId) {
    try {
      return await base44.entities.Task.filter({ client_ids: clientId });
    } catch (error) {
      const allTasks = await base44.entities.Task.list();
      return allTasks.filter((t) => t.client_ids?.includes(clientId));
    }
  },

  async getResumes(clientId) {
    return await base44.entities.Resume.filter({ client_id: clientId });
  },

  async getTimeEntries(clientId) {
    return await base44.entities.TimeEntry.filter({ client_id: clientId });
  },

  async getActivities(clientId) {
    return await base44.entities.Activity.filter({ client_id: clientId });
  },
};

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

  useEffect(() => {
    let cancelled = false;

    clientDetailApi
      .getCurrentUser()
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: client,
    isLoading,
  } = useQuery({
    queryKey: ["client", clientId, user?.role, user?.id, user?.email],
    queryFn: async () => {
      if (!clientId) return null;

      const clientData = await clientDetailApi.getClientById(clientId);
      if (!clientData) return null;
      if (!user) return null;

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
  const shouldLoadResumes = !!clientId && activeTab === "resumes";
  const shouldLoadTime = !!clientId && (activeTab === "time" || activeTab === "job_supports");
  const shouldLoadActivity = !!clientId && activeTab === "activity";

  const { data: applications = [] } = useQuery({
    queryKey: ["applications", clientId],
    queryFn: () => clientDetailApi.getApplications(clientId),
    enabled: shouldLoadApplications,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: () => clientDetailApi.getTasks(clientId),
    enabled: shouldLoadTasks,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ["resumes", clientId],
    queryFn: () => clientDetailApi.getResumes(clientId),
    enabled: shouldLoadResumes,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", clientId],
    queryFn: () => clientDetailApi.getTimeEntries(clientId),
    enabled: shouldLoadTime,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", clientId],
    queryFn: () => clientDetailApi.getActivities(clientId),
    enabled: shouldLoadActivity,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshClient = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  }, [queryClient, clientId]);

  const refreshApplications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["applications", clientId] });
  }, [queryClient, clientId]);

  const refreshTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
  }, [queryClient, clientId]);

  const refreshResumes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["resumes", clientId] });
  }, [queryClient, clientId]);

  const refreshTimeEntries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries", clientId] });
  }, [queryClient, clientId]);

  const refreshActivities = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["activities", clientId] });
  }, [queryClient, clientId]);

  const portalUrl = useMemo(() => `/ClientPortal?id=${clientId}`, [clientId]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="mb-4 text-lg font-semibold">Client not found</div>
        <Link to={createPageUrl("Clients")}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to={createPageUrl("Clients")}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>

        <div className="flex flex-wrap gap-2">
          {client.client_type !== "employed" && (
            <Button
              variant="outline"
              onClick={() => window.open(portalUrl, "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
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

      <ClientHeader client={client} onRefresh={refreshClient} />

      {!isDspd && !isEmployed && !isClientUser && (
        <VocationalProfileCard client={client} onRefresh={refreshClient} />
      )}

      <Tabs value={activeTab || defaultTab || "applications"} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-max flex-wrap">
            {!isClientUser && !isEmployed && (
              <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            )}

            {!isDspd && !isEmployed && (
              <TabsTrigger value="applications">
                Applications {activeTab === "applications" ? `(${applications.length})` : ""}
              </TabsTrigger>
            )}

            {!isDspd && !isEmployed && !isClientUser && (
              <TabsTrigger value="ai_jobs">AI Job Search</TabsTrigger>
            )}

            {!isDspd && !isEmployed && (
              <TabsTrigger value="interview_prep">Interview Prep</TabsTrigger>
            )}

            {!isDspd && !isEmployed && !isClientUser && (
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
            )}

            {client.client_type === "pre_ets" && !isClientUser && (
              <TabsTrigger value="wble_forms">WBLE Forms</TabsTrigger>
            )}

            {!isClientUser && <TabsTrigger value="documents">Documents</TabsTrigger>}

            {!isEmployed && (
              <TabsTrigger value="tasks">
                Tasks {activeTab === "tasks" ? `(${tasks.length})` : ""}
              </TabsTrigger>
            )}

            {!isDspd && !isEmployed && (
              <TabsTrigger value="resumes">
                Resumes {activeTab === "resumes" ? `(${resumes.length})` : ""}
              </TabsTrigger>
            )}

            {!isClientUser && isEmployed && (
              <TabsTrigger value="job_supports">
                Job Supports {activeTab === "job_supports" ? `(${timeEntries.length})` : ""}
              </TabsTrigger>
            )}

            {!isClientUser && !isEmployed && (
              <TabsTrigger value="time">
                Time {activeTab === "time" ? `(${timeEntries.length})` : ""}
              </TabsTrigger>
            )}

            <TabsTrigger value="activity">
              Activity {activeTab === "activity" ? `(${activities.length})` : ""}
            </TabsTrigger>

            {!isClientUser && !isEmployed && (
              <TabsTrigger value="assistant">Assistant</TabsTrigger>
            )}
          </TabsList>
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
          <TabsContent value="ai_jobs">
            <AIJobSearchPanel client={client} />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && (
          <TabsContent value="interview_prep">
            <InterviewPrepSection client={client} />
          </TabsContent>
        )}

        {!isDspd && !isEmployed && !isClientUser && (
          <TabsContent value="assessments">
            <AssessmentSection client={client} />
          </TabsContent>
        )}

        {client.client_type === "pre_ets" && !isClientUser && (
          <TabsContent value="wble_forms">
            <WBLEFormSection client={client} />
          </TabsContent>
        )}

        {!isClientUser && (
          <TabsContent value="documents">
            <DocumentsSection client={client} />
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

        {!isDspd && !isEmployed && (
          <TabsContent value="resumes">
            <ResumeSection
              client={client}
              resumes={resumes}
              onRefresh={refreshResumes}
            />
          </TabsContent>
        )}

        {!isClientUser && isEmployed && (
          <TabsContent value="job_supports">
            <TimeLogDashboard
              clientId={clientId}
              timeEntries={timeEntries}
              clients={[client]}
              onRefresh={refreshTimeEntries}
            />
          </TabsContent>
        )}

        {!isClientUser && !isEmployed && (
          <TabsContent value="time">
            <TimeLogDashboard
              clientId={clientId}
              timeEntries={timeEntries}
              clients={[client]}
              onRefresh={refreshTimeEntries}
            />
          </TabsContent>
        )}

        <TabsContent value="activity">
          <ActivitySection
            client={client}
            activities={activities}
            onRefresh={refreshActivities}
          />
        </TabsContent>

        {!isClientUser && !isEmployed && (
          <TabsContent value="assistant">
            <AIAssistantPanel
              client={client}
              activeTab={activeTab}
              onOpenAssistant={() => {}}
            />
          </TabsContent>
        )}
      </Tabs>

      {showEmailComposer && (
        <EmailComposer
          open={showEmailComposer}
          onOpenChange={setShowEmailComposer}
          clientId={clientId}
          clientEmail={client.email}
          clientName={`${client.first_name || ""} ${client.last_name || ""}`.trim()}
        />
      )}
    </div>
  );
}
