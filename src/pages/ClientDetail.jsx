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
  Archive,
  Star,
  CheckCircle2,
  Users,
  MapPin,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  getOnboardingSteps,
  getMeetings,
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
import IEPPlanSection from "@/components/pre-ets/IEPPlanSection";
import SkillsExplorationTab from "@/components/pre-ets/SkillsExplorationTab";
import EmailComposer from "@/components/EmailComposer";
import AIAssistantPanel from "@/components/client-detail/AIAssistantPanel";
import AIJobSearchPanel from "@/components/client-detail/AIJobSearchPanel";
import { testOnetConnection } from "@/lib/onet/onetClient";
import VocationalProfileCard from "@/components/client-detail/VocationalProfileCard";
import IntakePacketPanel from "@/components/intake/IntakePacketPanel";
import ArchiveClientDialog from "@/components/clients/ArchiveClientDialog";

function getClientIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

const PRE_ETS_CHECKLIST_ITEMS = [
  { key: "career_exploration", label: "Complete Career Exploration Assessment", category: "assessments" },
  { key: "job_shadowing", label: "Job Shadowing or Site Visit", category: "work_experience" },
  { key: "work_readiness", label: "Work Readiness Training Module", category: "training" },
  { key: "resume_created", label: "Create or Upload Resume", category: "documents" },
  { key: "self_advocacy", label: "Self-Advocacy Skills Workshop", category: "training" },
  { key: "wble_signed", label: "Sign WBLE Agreement", category: "work_experience" },
  { key: "counselor_meeting", label: "Initial Meeting with VR Counselor", category: "meetings" },
  { key: "goals_set", label: "Set Employment Goals", category: "planning" },
];

function getDefaultTab(client, userRole) {
  const isDspd = client?.client_type === "dspd";
  const isEmployed = client?.client_type === "employed";

  if (isDspd) return "client_details";
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
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

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
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: preEtsChecklistSteps = [] } = useQuery({
    queryKey: ["client-detail", "pre-ets-checklist", clientId],
    queryFn: () => getOnboardingSteps(clientId),
    enabled: !!clientId && client?.client_type === "pre_ets",
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: clientMeetings = [] } = useQuery({
    queryKey: ["client-detail", "meetings", clientId],
    queryFn: () => getMeetings(clientId),
    enabled: !!clientId && client?.client_type === "pre_ets",
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
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
    queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries(clientId), refetchType: "all" });
    queryClient.refetchQueries({ queryKey: queryKeys.timeEntries(clientId) });
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

          {!isClientUser && (user?.role === 'admin' || user?.role === 'management') && !client.is_archived && (
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(true)}
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
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
    {cd.onboarding && !isClientUser && !isEmployed && !isDspd && (
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

    {cd.intake_packet && !isClientUser && !isEmployed && !isDspd && (
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
      <>
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

               <button
          type="button"
          onClick={() => handleTabChange("program_checklist")}
          className={cn(
            "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
            activeTab === "program_checklist"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
              : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="text-sm font-semibold">Program Checklist</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("iep_transition")}
          className={cn(
            "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
            activeTab === "iep_transition"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
              : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm font-semibold">IEP & Transition</span>
          </div>
        </button>

               <button
          type="button"
          onClick={() => handleTabChange("skills_exploration")}
          className={cn(
            "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
            activeTab === "skills_exploration"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
              : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="text-sm font-semibold">Skills Exploration</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("meetings")}
          className={cn(
            "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
            activeTab === "meetings"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
              : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-semibold">Meetings</span>
          </div>
          <div className={cn("mt-1 text-xs", activeTab === "meetings" ? "text-slate-200" : "text-slate-500")}>
            {clientMeetings.length} items
          </div>
        </button>
      </>
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

    {cd.time && !isClientUser && (
      <button
        type="button"
        onClick={() => handleTabChange("time")}
        className={cn(
          "rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-lg hover:-translate-y-0.5 bg-white",
          activeTab === "time"
            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300"
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

  {cd.onboarding && !isClientUser && !isEmployed && !isDspd && (
    <TabsContent value="onboarding">
      <OnboardingSection client={client} onRefresh={refreshClient} />
    </TabsContent>
  )}

  {cd.intake_packet && !isClientUser && !isEmployed && !isDspd && (
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
          <>
                       <TabsContent value="wble_forms">
              <WBLEFormSection client={client} clientId={client.id} user={user} onRefresh={refreshClient} />
            </TabsContent>

            <TabsContent value="program_checklist">
              <Card className="border-0 shadow-sm">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-slate-800">
                      Pre-ETS Program Checklist
                    </h3>
                  </div>
                </div>

                <div className="p-5">
                  {preEtsChecklistSteps.length > 0 ? (
                    <div className="space-y-3">
                      {[...preEtsChecklistSteps]
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((step) => (
                          <div
                            key={step.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg p-3",
                              step.status === "completed"
                                ? "bg-green-50"
                                : "bg-slate-50"
                            )}
                          >
                            {step.status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                            ) : (
                              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
                            )}

                            <div className="flex-1">
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  step.status === "completed" && "text-slate-500"
                                )}
                              >
                                {step.step_name}
                              </p>

                              {step.notes && (
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {step.notes}
                                </p>
                              )}
                            </div>

                            {step.status === "completed" && step.completed_date && (
                              <span className="text-xs text-slate-400">
                                {format(new Date(step.completed_date), "MMM d")}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {PRE_ETS_CHECKLIST_ITEMS.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
                        >
                          <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />

                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700">
                              {item.label}
                            </p>
                          </div>

                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs capitalize text-slate-500">
                            {item.category.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}

                      <p className="mt-3 text-center text-xs text-slate-400">
                        Checklist steps will update as program items are completed.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="iep_transition">
              <IEPPlanSection clientId={client.id} isStaff={true} />
            </TabsContent>

            <TabsContent value="skills_exploration">
              <SkillsExplorationTab clientId={client.id} isStaff={true} client={client} />
            </TabsContent>
          </>
        )}

        {cd.documents && !isClientUser && (
          <TabsContent value="documents">
            <DocumentsSection clientId={client.id} refreshKey={documentsRefreshKey} />
          </TabsContent>
        )}

                {cd.tasks && !isClientUser && (
          <TabsContent value="tasks">
            <TasksSection clientId={client.id} tasks={tasks} onRefresh={refreshTasks} />
          </TabsContent>
        )}

                {cd.time && !isClientUser && (
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

      <ArchiveClientDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        client={client}
        onArchived={() => {
          setShowArchiveDialog(false);
          refreshClient();
        }}
      />

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
