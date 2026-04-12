import React from "react";
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

export default function ClientDetail() {
  const clientId = React.useMemo(() => getClientIdFromUrl(), []);
  const queryClient = useQueryClient();

  const [showEmailComposer, setShowEmailComposer] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId, user?.role, user?.id],
    queryFn: async () => {
      if (!clientId) return null;

      let clientData = null;

      try {
        clientData = await base44.entities.Client.get(clientId);
      } catch (error) {
        const allClients = await base44.entities.Client.list();
        clientData = allClients.find((c) => c.id === clientId) || null;
      }

      if (!clientData) return null;
      if (!user) return clientData;
      if (user.role === "admin") return clientData;
      if (user.role === "management") return clientData;

      if (
        user.role === "employee" &&
        (clientData.assigned_employee_id === user.id ||
          clientData.created_by === user.email)
      ) {
        return clientData;
      }

      if (user.role === "client" && clientData.id === clientId) {
        return clientData;
      }

      return null;
    },
    enabled: !!clientId && !!user,
  });

  const defaultTab = React.useMemo(() => {
    return client ? getDefaultTab(client, user?.role) : null;
  }, [client, user?.role]);

  React.useEffect(() => {
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
  const shouldLoadTime =
    !!clientId && (activeTab === "time" || activeTab === "job_supports");
  const shouldLoadActivity = !!clientId && activeTab === "activity";

  const { data: applications = [] } = useQuery({
    queryKey: ["applications", clientId],
    queryFn: () => base44.entities.JobApplication.filter({ client_id: clientId }),
    enabled: shouldLoadApplications,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => {
      try {
        return await base44.entities.Task.filter({ client_ids: clientId });
      } catch (error) {
        const allTasks = await base44.entities.Task.list();
        return allTasks.filter((t) => t.client_ids?.includes(clientId));
      }
    },
    enabled: shouldLoadTasks,
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ["resumes", clientId],
    queryFn: () => base44.entities.Resume.filter({ client_id: clientId }),
    enabled: shouldLoadResumes,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", clientId],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: clientId }),
    enabled: shouldLoadTime,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", clientId],
    queryFn: () => base44.entities.Activity.filter({ client_id: clientId }),
    enabled: shouldLoadActivity,
  });

  const refreshClient = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  }, [queryClient, clientId]);

  const refreshApplications = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["applications", clientId] });
  }, [queryClient, clientId]);

  const refreshTasks = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
  }, [queryClient, clientId]);

  const refreshResumes = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["resumes", clientId] });
  }, [queryClient, clientId]);

  const refreshTimeEntries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries", clientId] });
  }, [queryClient, clientId]);

  const refreshActivities = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["activities", clientId] });
  }, [queryClient, clientId]);

  const portalUrl = React.useMemo(() => {
    return `/ClientPortal?id=${clientId}`;
  }, [clientId]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!client) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-lg font-semibold">Client not found</div>
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
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={createPageUrl("Clients")}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </Link>

        <div className="flex flex-wrap gap-2">
          {client.client_type !== "employed" && (
            <Button
              variant="outline"
              onClick={() => window.open(portalUrl, "_blank")}
            >
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Tabs
            value={activeTab || defaultTab || "applications"}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="flex flex-wrap h-auto">
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

              {!isClientUser && (
                <TabsTrigger value="documents">Documents</TabsTrigger>
              )}

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

              {!isClientUser && isEmployed &&
