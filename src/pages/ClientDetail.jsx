import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ClientHeader from "@/components/client-detail/ClientHeader";
import JobApplicationsSection from "@/components/client-detail/JobApplicationsSection";
import TasksSection from "@/components/client-detail/TasksSection";
import ResumeSection from "@/components/client-detail/ResumeSection";
import TimeLogSection from "@/components/client-detail/TimeLogSection";
import OnboardingSection from "@/components/client-detail/OnboardingSection";
import InterviewPrepSection from "@/components/client-detail/InterviewPrepSection";
import DocumentsSection from "@/components/client-detail/DocumentsSection";
import ActivitySection from "@/components/client-detail/ActivitySection";
import EmailComposer from "@/components/EmailComposer";

export default function ClientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [showEmailComposer, setShowEmailComposer] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId, user?.role],
    queryFn: async () => {
      const allClients = await base44.entities.Client.list();
      const clientData = allClients.find(c => c.id === clientId);
      if (!clientData) return null;
      if (!user) return clientData;
      if (user.role === 'management') return clientData;
      if (user.role === 'employee' && clientData.created_by === user.email) return clientData;
      return null;
    },
    enabled: !!clientId && !!user
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications", clientId],
    queryFn: () => base44.entities.JobApplication.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list(),
    enabled: !!clientId
  });

  const tasks = allTasks.filter(t => t.client_ids?.includes(clientId));

  const { data: resumes = [] } = useQuery({
    queryKey: ["resumes", clientId],
    queryFn: () => base44.entities.Resume.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", clientId],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", clientId],
    queryFn: () => base44.entities.Activity.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    queryClient.invalidateQueries({ queryKey: ["applications", clientId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
    queryClient.invalidateQueries({ queryKey: ["resumes", clientId] });
    queryClient.invalidateQueries({ queryKey: ["timeEntries", clientId] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">Client not found</p>
        <Link to={createPageUrl("Clients")}><Button variant="outline">Back to Clients</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={createPageUrl("Clients")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <Button variant="outline" onClick={() => setShowEmailComposer(true)}>
          Send Email
        </Button>
      </div>

      <ClientHeader client={client} onUpdate={refresh} />

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          {user?.role !== 'client' && <TabsTrigger value="onboarding">Onboarding</TabsTrigger>}
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="interview">Interview Prep</TabsTrigger>
          {user?.role !== 'client' && <TabsTrigger value="documents">Documents</TabsTrigger>}
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="resumes">Resumes ({resumes.length})</TabsTrigger>
          {user?.role !== 'client' && <TabsTrigger value="time">Time ({timeEntries.length})</TabsTrigger>}
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="onboarding">
          <OnboardingSection client={client} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="applications">
          <JobApplicationsSection clientId={clientId} applications={applications} client={client} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="interview">
          <InterviewPrepSection client={client} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsSection clientId={clientId} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksSection clientId={clientId} tasks={tasks} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="resumes">
          <ResumeSection clientId={clientId} resumes={resumes} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="time">
          <TimeLogSection timeEntries={timeEntries} clientId={clientId} onRefresh={refresh} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivitySection clientId={clientId} />
        </TabsContent>
      </Tabs>

      <EmailComposer
        open={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        clientId={clientId}
        clientEmail={client.email}
        clientName={`${client.first_name} ${client.last_name}`}
      />
    </div>
  );
}