import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GraduationCap, ClipboardList, Briefcase, CheckCircle2, Clock,
  Upload, FileText, Download, Loader2, Star, Target, BookOpen, Users, Sparkles, Brain, Trash2, ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";
import { toast } from "sonner";
import IEPPlanSection from "@/components/pre-ets/IEPPlanSection";
import SkillsExplorationTab from "@/components/pre-ets/SkillsExplorationTab";
import ClockInOut from "@/components/pre-ets/ClockInOut";
import WBLEFormSection from "@/components/client-detail/WBLEFormSection";

const CHECKLIST_ITEMS = [
  { key: "career_exploration", label: "Complete Career Exploration Assessment", category: "assessments" },
  { key: "job_shadowing", label: "Job Shadowing or Site Visit", category: "work_experience" },
  { key: "work_readiness", label: "Work Readiness Training Module", category: "training" },
  { key: "resume_created", label: "Create or Upload Resume", category: "documents" },
  { key: "self_advocacy", label: "Self-Advocacy Skills Workshop", category: "training" },
  { key: "wble_signed", label: "Sign WBLE Agreement", category: "work_experience" },
  { key: "counselor_meeting", label: "Initial Meeting with VR Counselor", category: "meetings" },
  { key: "goals_set", label: "Set Employment Goals", category: "planning" },
];

const STAFF_ROLES = ['admin', 'management', 'employee'];

export default function PreEtsPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const queryClient = useQueryClient();
  const { canView } = useFeaturePermissions(user);
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const urlParams = new URLSearchParams(window.location.search);
      const clientIdParam = urlParams.get("id");

      const allClients = await base44.entities.Client.list();

      if (currentUser.role === 'pre_ets') {
        const clientData = allClients.find(c => c.email === currentUser.email);
        if (clientData) setClient(clientData);
      } else if (STAFF_ROLES.includes(currentUser.role) && clientIdParam) {
        const clientData = allClients.find(c => c.id === clientIdParam);
        if (clientData && clientData.client_type === 'pre_ets') {
          setSelectedClientId(clientIdParam);
        }
      }
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  // For staff roles: fetch all pre_ets clients
  const { data: preEtsClients = [], refetch: refetchPreEts } = useQuery({
    queryKey: ['pre-ets-clients'],
    queryFn: () => base44.entities.Client.filter({ client_type: 'pre_ets' }),
    enabled: !!user && STAFF_ROLES.includes(user.role)
  });

  const deleteClient = async (e, clientId) => {
    e.stopPropagation();
    if (!confirm("Delete this client? This cannot be undone.")) return;
    await base44.entities.Client.delete(clientId);
    refetchPreEts();
  };

  // For staff: use selected client; for pre_ets user: use their own client
  const activeClient = STAFF_ROLES.includes(user?.role)
    ? preEtsClients.find(c => c.id === selectedClientId)
    : client;

  const { data: tasks = [] } = useQuery({
    queryKey: ['pre-ets-tasks', activeClient?.id],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.list();
      return allTasks.filter(t => t.client_ids?.includes(activeClient.id));
    },
    enabled: !!activeClient
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['pre-ets-assessments', activeClient?.id],
    queryFn: () => base44.entities.Assessment.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const { data: wbleForms = [] } = useQuery({
    queryKey: ['pre-ets-wble', activeClient?.id],
    queryFn: () => base44.entities.WBLEForm.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const { data: progressReports = [] } = useQuery({
    queryKey: ['training-progress-reports', activeClient?.id],
    queryFn: () => base44.entities.TrainingProgressReport.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['pre-ets-documents', activeClient?.id],
    queryFn: () => base44.entities.Document.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['pre-ets-meetings', activeClient?.id],
    queryFn: () => base44.entities.Meeting.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const { data: onboardingSteps = [] } = useQuery({
    queryKey: ['pre-ets-onboarding', activeClient?.id],
    queryFn: () => base44.entities.OnboardingStep.filter({ client_id: activeClient.id }),
    enabled: !!activeClient
  });

  const completeTask = async (taskId) => {
    try {
      await base44.entities.Task.update(taskId, { status: 'completed' });
      toast.success("Task marked complete!");
      queryClient.invalidateQueries({ queryKey: ['pre-ets-tasks'] });
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        client_id: activeClient.id,
        title: file.name,
        file_url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category: 'other'
      });
      toast.success("Document uploaded!");
      queryClient.invalidateQueries({ queryKey: ['pre-ets-documents'] });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  const isStaff = STAFF_ROLES.includes(user?.role);

  if (!user || (!isStaff && user.role !== 'pre_ets')) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-600">Access denied.</p>
      </div>
    );
  }

  // Staff view: show client selector if no client selected
  if (isStaff && !activeClient) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pre-ETS Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Select a Pre-ETS client to manage</p>
        </div>
        {preEtsClients.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No Pre-ETS clients found</p>
            <p className="text-slate-400 text-sm mt-1">Add clients with client type "pre_ets" to see them here.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {preEtsClients.map(c => (
              <Card
                key={c.id}
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClientId(c.id)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                    <Badge className={cn("mt-1 text-xs", c.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                      {c.status}
                    </Badge>
                  </div>
                  <button
                    onClick={(e) => deleteClient(e, c.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

    const canViewClock = canView("client_portal_clock_in_out");
  const canViewChecklist = canView("client_portal_program_checklist");
  const canViewIep = canView("client_portal_iep_transition_plan");
  const canViewSkills = canView("client_portal_skills_exploration");
  const canViewAssessments = canView("client_portal_assessments");
  const canViewWble = canView("client_portal_wble_forms");
  const canViewMeetings = canView("client_portal_meetings");
  const canViewDocuments = canView("client_portal_documents");

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedSteps = onboardingSteps.filter(s => s.status === 'completed').length;
  const totalSteps = onboardingSteps.length || CHECKLIST_ITEMS.length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const upcomingMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'completed');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {isStaff && (
            <button
              onClick={() => setSelectedClientId(null)}
              className="text-xs text-slate-500 hover:text-slate-700 mb-1 flex items-center gap-1"
            >
              ← Back to client list
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900">
            {isStaff ? `${activeClient.first_name} ${activeClient.last_name}` : `Welcome, ${activeClient.first_name}!`}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Pre-Employment Transition Services Portal</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1">Pre-ETS Student</Badge>
          {isStaff && (
            <Link to={`/ClientDetail?id=${activeClient.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" /> Edit Profile
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Profile + Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
                {activeClient.first_name[0]}{activeClient.last_name[0]}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">{activeClient.first_name} {activeClient.last_name}</h2>
                <p className="text-sm text-slate-500">{activeClient.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {activeClient.target_role && <Badge variant="outline" className="text-xs">{activeClient.target_role}</Badge>}
                  {activeClient.industry && <Badge variant="outline" className="text-xs">{activeClient.industry}</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Program Progress</p>
            <div className="text-3xl font-bold text-indigo-600 mb-1">{progressPct}%</div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{completedSteps} of {totalSteps} steps complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending Tasks", value: pendingTasks.length, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Assessments", value: assessments.length, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "WBLE Forms", value: wbleForms.length + progressReports.length, icon: Briefcase, color: "text-green-600", bg: "bg-green-50" },
          { label: "Upcoming Meetings", value: upcomingMeetings.length, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
            <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="tasks">My Tasks ({pendingTasks.length})</TabsTrigger>
          {canViewClock && <TabsTrigger value="clock">Clock In/Out</TabsTrigger>}
          {canViewChecklist && <TabsTrigger value="checklist">Program Checklist</TabsTrigger>}
          {canViewIep && <TabsTrigger value="iep">IEP & Transition Plan</TabsTrigger>}
          {canViewSkills && <TabsTrigger value="skills">Skills Exploration</TabsTrigger>}
          {canViewAssessments && <TabsTrigger value="assessments">Assessments ({assessments.length})</TabsTrigger>}
          {canViewWble && <TabsTrigger value="wble">WBLE Forms ({wbleForms.length + progressReports.length})</TabsTrigger>}
          {canViewMeetings && <TabsTrigger value="meetings">Meetings ({upcomingMeetings.length})</TabsTrigger>}
          {canViewDocuments && <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>}
        </TabsList>

              {/* Clock In/Out */}
        {canViewClock && (
          <TabsContent value="clock">
            <ClockInOut 
              clientId={activeClient?.id} 
              clientName={`${activeClient?.first_name} ${activeClient?.last_name}`}
            />
          </TabsContent>
        )}

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-600" /> My Assigned Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No tasks assigned yet</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className={cn(
                      "p-4 rounded-lg border",
                      task.status === 'completed' ? "bg-green-50 border-green-200" : "bg-white border-slate-200"
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {task.status === 'completed'
                              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                            }
                            <p className={cn("text-sm font-medium", task.status === 'completed' && "line-through text-slate-400")}>
                              {task.title}
                            </p>
                          </div>
                          {task.description && <p className="text-xs text-slate-500 ml-6">{task.description}</p>}
                          <div className="flex items-center gap-3 ml-6 mt-2">
                            {task.due_date && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Due {format(new Date(task.due_date), "MMM d")}
                              </span>
                            )}
                            <Badge className={cn("text-xs",
                              task.priority === 'urgent' ? "bg-red-100 text-red-700" :
                              task.priority === 'high' ? "bg-orange-100 text-orange-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        {task.status !== 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => completeTask(task.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

                {/* Program Checklist */}
        {canViewChecklist && (
          <TabsContent value="checklist">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-indigo-600" /> Pre-ETS Program Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                {onboardingSteps.length > 0 ? (
                  <div className="space-y-3">
                    {onboardingSteps.sort((a, b) => (a.order || 0) - (b.order || 0)).map(step => (
                      <div key={step.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-lg",
                        step.status === 'completed' ? "bg-green-50" : "bg-slate-50"
                      )}>
                        {step.status === 'completed'
                          ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                          : <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                        }
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", step.status === 'completed' && "text-slate-500")}>{step.step_name}</p>
                          {step.notes && <p className="text-xs text-slate-400 mt-0.5">{step.notes}</p>}
                        </div>
                        {step.status === 'completed' && step.completed_date && (
                          <span className="text-xs text-slate-400">{format(new Date(step.completed_date), "MMM d")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {CHECKLIST_ITEMS.map(item => (
                      <div key={item.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">{item.label}</p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">{item.category.replace(/_/g, ' ')}</Badge>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 mt-3 text-center">Your counselor will update these as you progress.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Assessments */}
        <TabsContent value="assessments">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" /> My Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessments.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400">No assessments completed yet</p>
                  <p className="text-xs text-slate-400 mt-1">Your counselor will assign assessments to complete</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assessments.map(a => (
                    <div key={a.id} className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 capitalize">{a.assessment_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Completed {format(new Date(a.created_date), "MMMM d, yyyy")}
                          </p>
                          {a.notes && <p className="text-xs text-slate-600 mt-2 bg-white rounded p-2">{a.notes}</p>}
                        </div>
                        {a.pdf_url && (
                          <a href={a.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">
                              <Download className="w-3.5 h-3.5 mr-1" /> PDF
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WBLE Forms */}
        <TabsContent value="wble">
          {isStaff ? (
            <WBLEFormSection clientId={activeClient?.id} client={activeClient} user={user} />
          ) : (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-green-600" /> Work-Based Learning Experience Forms
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wbleForms.length === 0 && progressReports.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-400">No WBLE agreements yet</p>
                    <p className="text-xs text-slate-400 mt-1">Your counselor will create your WBLE agreement</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wbleForms.map(form => (
                      <div key={form.id} className="p-4 bg-green-50 border border-green-100 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-slate-800">WBLE Agreement</p>
                              <Badge className={cn("text-xs",
                                form.status === 'completed' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {form.status}
                              </Badge>
                            </div>
                            {form.employer_name && <p className="text-xs text-slate-600">Employer: {form.employer_name}</p>}
                            <div className="flex gap-4 mt-1 text-xs text-slate-500">
                              {form.start_date && <span>Start: {format(new Date(form.start_date), "MMM d, yyyy")}</span>}
                              {form.end_date && <span>End: {format(new Date(form.end_date), "MMM d, yyyy")}</span>}
                            </div>
                            {form.trainee_wages && <p className="text-xs text-slate-600 mt-1">Wages: {form.trainee_wages}</p>}
                          </div>
                          {form.pdf_url && (
                            <a href={form.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline">
                                <Download className="w-3.5 h-3.5 mr-1" /> PDF
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {progressReports.map(report => (
                      <div key={report.id} className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Progress Report: {report.reporting_period_from && format(new Date(report.reporting_period_from), "MMM d")} – {report.reporting_period_to && format(new Date(report.reporting_period_to), "MMM d, yyyy")}
                            </p>
                            {report.supervisor_name && <p className="text-xs text-slate-500 mt-0.5">Supervisor: {report.supervisor_name}</p>}
                            <p className="text-xs text-slate-400 mt-0.5">Submitted: {format(new Date(report.created_date), "MMM d, yyyy")}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className="bg-green-100 text-green-700 text-xs">Submitted</Badge>
                            {report.pdf_url && (
                              <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost"><Download className="w-3.5 h-3.5" /></Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                    )}
                    </CardContent>
                    </Card>
                    )}
        </TabsContent>

        {/* Meetings */}
        <TabsContent value="meetings">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" /> Appointments & Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No meetings scheduled</div>
              ) : (
                <div className="space-y-3">
                  {meetings.map(meeting => (
                    <div key={meeting.id} className={cn(
                      "p-4 rounded-lg border",
                      meeting.status === 'cancelled' ? "bg-slate-50 border-slate-200 opacity-60" :
                      meeting.status === 'completed' ? "bg-slate-50 border-slate-200" :
                      "bg-violet-50 border-violet-200"
                    )}>
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                          <p className="text-xs text-slate-500 capitalize mt-0.5">{meeting.meeting_type?.replace(/_/g, ' ')}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>{format(new Date(meeting.start_datetime), "MMM d, yyyy")}</span>
                            <span>•</span>
                            <span>{format(new Date(meeting.start_datetime), "h:mm a")}</span>
                          </div>
                          {meeting.location && <p className="text-xs text-slate-500 mt-1">📍 {meeting.location}</p>}
                        </div>
                        <Badge className={cn("text-xs shrink-0",
                          meeting.status === 'confirmed' ? "bg-green-100 text-green-700" :
                          meeting.status === 'completed' ? "bg-slate-100 text-slate-600" :
                          meeting.status === 'cancelled' ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {meeting.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IEP Plan */}
        <TabsContent value="iep">
          <IEPPlanSection clientId={activeClient?.id} isStaff={isStaff} />
        </TabsContent>

        {/* Skills Exploration */}
        <TabsContent value="skills">
          <SkillsExplorationTab clientId={activeClient?.id} isStaff={isStaff} client={activeClient} />
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" /> My Documents
                </CardTitle>
                <label htmlFor="pre-ets-upload">
                  <Button size="sm" asChild>
                    <span className="cursor-pointer">
                      {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                      Upload Document
                    </span>
                  </Button>
                  <input id="pre-ets-upload" type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No documents uploaded yet</div>
              ) : (
                <div className="space-y-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                          <p className="text-xs text-slate-500">
                            {doc.category} • {format(new Date(doc.created_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost"><Download className="w-3.5 h-3.5" /></Button>
                      </a>
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
