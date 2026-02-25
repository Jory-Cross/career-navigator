import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Target, Briefcase, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ClientPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'client' || !currentUser.assigned_client_id) {
        return;
      }

      const clientData = await base44.entities.Client.get(currentUser.assigned_client_id);
      setClient(clientData);
    } catch (error) {
      console.error("Failed to load client data", error);
    } finally {
      setLoading(false);
    }
  };

  const { data: applications = [] } = useQuery({
    queryKey: ['client-applications', client?.id],
    queryFn: () => base44.entities.JobApplication.filter({ client_id: client.id }),
    enabled: !!client
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['client-tasks', client?.id],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.list();
      return allTasks.filter(t => t.client_ids?.includes(client.id));
    },
    enabled: !!client
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['client-resumes', client?.id],
    queryFn: () => base44.entities.Resume.filter({ client_id: client.id }),
    enabled: !!client
  });

  const { data: interviewSessions = [] } = useQuery({
    queryKey: ['client-interviews', client?.id],
    queryFn: () => base44.entities.InterviewSession.filter({ client_id: client.id }),
    enabled: !!client
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  if (!user || user.role !== 'client' || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-600 mb-4">Access denied. Client portal access only.</p>
      </div>
    );
  }

  const statusColors = {
    saved: "bg-slate-100 text-slate-700",
    applied: "bg-blue-100 text-blue-700",
    phone_screen: "bg-cyan-100 text-cyan-700",
    interview: "bg-violet-100 text-violet-700",
    final_round: "bg-purple-100 text-purple-700",
    offer: "bg-emerald-100 text-emerald-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    withdrawn: "bg-amber-100 text-amber-700"
  };

  const taskStatusColors = {
    pending: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-slate-100 text-slate-600"
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {client.first_name}!</h1>
        <p className="text-sm text-slate-500 mt-1">Your career development portal</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {client.first_name[0]}{client.last_name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900">{client.first_name} {client.last_name}</h2>
              <p className="text-sm text-slate-600">{client.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge>{client.status}</Badge>
                {client.target_role && <Badge variant="outline">{client.target_role}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="interview">Interview Prep ({interviewSessions.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="resumes">Resumes ({resumes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">My Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No applications yet</div>
              ) : (
                <div className="space-y-3">
                  {applications.map(app => (
                    <div key={app.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-800">{app.position}</p>
                            <Badge className={cn("text-xs", statusColors[app.status])}>{app.status.replace(/_/g, ' ')}</Badge>
                            {app.ai_fit_score && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Target className="w-3 h-3" /> {app.ai_fit_score}% fit
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.company}</span>
                            {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>}
                            {app.applied_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(app.applied_date), "MMM d, yyyy")}</span>}
                          </div>
                          {app.next_step && <p className="text-xs text-violet-600 mt-2">Next: {app.next_step}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Interview Practice Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {interviewSessions.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No practice sessions yet</div>
              ) : (
                <div className="space-y-3">
                  {interviewSessions.map(session => (
                    <div key={session.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-slate-800">{session.target_role}</p>
                        <span className="text-xs text-slate-500">{format(new Date(session.session_date), "MMM d, yyyy")}</span>
                      </div>
                      {session.questions && (
                        <p className="text-xs text-slate-600">{session.questions.length} questions practiced</p>
                      )}
                      {session.overall_feedback && (
                        <p className="text-xs text-slate-600 mt-2 p-2 bg-white rounded">{session.overall_feedback}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">My Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No tasks yet</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                            <p className="text-sm font-medium text-slate-800">{task.title}</p>
                            <Badge className={cn("text-xs", taskStatusColors[task.status])}>{task.status.replace(/_/g, ' ')}</Badge>
                          </div>
                          {task.description && <p className="text-xs text-slate-600 mt-1">{task.description}</p>}
                          {task.due_date && (
                            <p className="text-xs text-slate-500 mt-2">Due: {format(new Date(task.due_date), "MMM d, yyyy")}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumes">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">My Resumes</CardTitle>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No resumes yet</div>
              ) : (
                <div className="space-y-3">
                  {resumes.map(resume => (
                    <div key={resume.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-slate-800">{resume.title}</p>
                        {resume.is_primary && <Badge className="text-xs bg-blue-100 text-blue-700">Primary</Badge>}
                      </div>
                      {resume.summary && <p className="text-xs text-slate-600 mt-1">{resume.summary}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {resume.experience && <span>{resume.experience.length} experiences</span>}
                        {resume.education && <span>{resume.education.length} education</span>}
                        {resume.skills && <span>{resume.skills.length} skills</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}