import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import InterviewPrepSection from "@/components/client-detail/InterviewPrepSection";
import TimeLogSection from "@/components/client-detail/TimeLogSection";
import JobSuggestionsSection from "@/components/client-portal/JobSuggestionsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, MapPin, Calendar, Target, Briefcase, CheckCircle2, Plus, Loader2, Sparkles, Upload, FileText, Download, Clock, Bell, Phone, StickyNote, Trash2 } from "lucide-react";
import ImportFromIndeedDialog from "@/components/client-portal/ImportFromIndeedDialog";
import CareerAdvisorChat from "@/components/client-portal/CareerAdvisorChat";
import AgentChatEmbed from "@/components/client-portal/AgentChatEmbed.jsx";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ClientPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewApp, setShowNewApp] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showIndeedImport, setShowIndeedImport] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskNotes, setTaskNotes] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('resume');
  const [appForm, setAppForm] = useState({});
  const [newAppNote, setNewAppNote] = useState("");
  const [taskForm, setTaskForm] = useState({});
  const [practiceForm, setPracticeForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const urlParams = new URLSearchParams(window.location.search);
      const clientIdParam = urlParams.get("id");

      const allClients = await base44.entities.Client.list();

      if (currentUser.role === 'client') {
        // Client users see their own portal by email match
        const clientData = allClients.find(c => c.email === currentUser.email);
        if (clientData) setClient(clientData);
      } else if (['admin', 'management', 'employee'].includes(currentUser.role) && clientIdParam) {
        // Staff viewing a specific client's portal via ?id=
        const clientData = allClients.find(c => c.id === clientIdParam);
        if (clientData) {
          // Employees can only view their assigned clients
          if (currentUser.role === 'employee' && clientData.assigned_employee_id !== currentUser.id) {
            // No access
          } else {
            setClient(clientData);
          }
        }
      }
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

  const { data: documents = [] } = useQuery({
    queryKey: ['client-documents', client?.id],
    queryFn: () => base44.entities.Document.filter({ client_id: client.id }),
    enabled: !!client
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['client-meetings', client?.id],
    queryFn: () => base44.entities.Meeting.filter({ client_id: client.id }),
    enabled: !!client
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['client-time-entries', client?.id],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: client.id }),
    enabled: !!client
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['client-activities', client?.id],
    queryFn: () => base44.entities.Activity.filter({ client_id: client.id }),
    enabled: !!client
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  const staffRoles = ['admin', 'management', 'employee'];
  const isStaff = user && staffRoles.includes(user.role);

  if (!user || (!client && !loading)) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-600 mb-4">Access denied or client not found.</p>
      </div>
    );
  }

  if (!client) return null;

  // Redirect Pre-ETS and DSPD clients to their respective portals
  if (client.client_type === 'pre_ets' && user.role === 'pre_ets') {
    window.location.href = '/PreEtsPortal';
    return null;
  }
  if (client.client_type === 'dspd' && user.role === 'dspd') {
    window.location.href = '/DspdPortal';
    return null;
  }
  // For staff viewing Pre-ETS clients, redirect to PreEtsPortal with client ID
  if (isStaff && client.client_type === 'pre_ets') {
    window.location.href = `/PreEtsPortal?id=${client.id}`;
    return null;
  }
  if (isStaff && client.client_type === 'dspd') {
    window.location.href = `/DspdPortal?id=${client.id}`;
    return null;
  }

  const saveApplication = async () => {
    if (!appForm.company || !appForm.position) {
      toast.error("Company and position required");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.JobApplication.create({ ...appForm, client_id: client.id });
      toast.success("Application added");
      queryClient.invalidateQueries({ queryKey: ['client-applications'] });
      setShowNewApp(false);
      setAppForm({});
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async () => {
    if (!taskForm.title) {
      toast.error("Task title required");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Task.create({ ...taskForm, client_ids: [client.id] });
      toast.success("Task created");
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
      setShowNewTask(false);
      setTaskForm({});
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const completeTask = async (taskId) => {
    try {
      await base44.entities.Task.update(taskId, { status: 'completed' });
      toast.success("Task completed");
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setTaskNotes(task.notes || "");
    setTaskStatus(task.status);
  };

  const saveTaskDetail = async () => {
    if (!selectedTask) return;
    setSavingTask(true);
    try {
      await base44.entities.Task.update(selectedTask.id, { notes: taskNotes, status: taskStatus });
      toast.success("Task updated");
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
      setSelectedTask(null);
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSavingTask(false);
    }
  };

  const startPractice = async () => {
    if (!practiceForm.target_role) {
      toast.error("Target role required");
      return;
    }
    setPracticing(true);
    try {
      const prompt = `Generate 5 common interview questions for the role: ${practiceForm.target_role}${practiceForm.industry ? ` in ${practiceForm.industry}` : ''}.
      
Return as JSON array of objects with: question, category (behavioral/technical/situational)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });

      await base44.entities.InterviewSession.create({
        client_id: client.id,
        target_role: practiceForm.target_role,
        industry: practiceForm.industry || client.industry,
        questions: result.questions,
        session_date: new Date().toISOString().split('T')[0]
      });

      toast.success("Practice session created");
      queryClient.invalidateQueries({ queryKey: ['client-interviews'] });
      setShowPractice(false);
      setPracticeForm({});
    } catch (error) {
      toast.error("Failed to generate");
    } finally {
      setPracticing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.entities.Document.create({
        client_id: client.id,
        title: file.name,
        file_url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category: uploadCategory
      });

      await base44.entities.Activity.create({
        client_id: client.id,
        activity_type: 'document_uploaded',
        title: `${uploadCategory === 'resume' ? 'Resume' : 'Cover letter'} uploaded`,
        description: `Uploaded ${file.name}`
      });

      toast.success("File uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
      setShowUploadDoc(false);
    } catch (error) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const updateApplication = async (field, value) => {
    if (!selectedApp) return;
    setUpdatingApp(true);
    try {
      const updated = { ...selectedApp, [field]: value };
      await base44.entities.JobApplication.update(selectedApp.id, { [field]: value });
      setSelectedApp(updated);
      queryClient.invalidateQueries({ queryKey: ['client-applications'] });
      toast.success("Updated");
    } catch (error) {
      toast.error("Failed to update");
    } finally {
      setUpdatingApp(false);
    }
  };

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
        <TabsList className="bg-slate-100 p-1 flex-wrap h-auto">
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="interview">Interview ({interviewSessions.length})</TabsTrigger>
          <TabsTrigger value="coach">Career Coach</TabsTrigger>

          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({meetings.length + activities.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <JobSuggestionsSection 
            client={client} 
            onAddApplication={() => queryClient.invalidateQueries({ queryKey: ['client-applications'] })}
          />
          
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">My Applications</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowIndeedImport(true)}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/Indeed_logo.svg" alt="Indeed" className="h-3.5 mr-1" />
                    Import from Indeed
                  </Button>
                  <Button size="sm" onClick={() => setShowNewApp(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Application
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No applications yet</div>
              ) : (
                <div className="space-y-3">
                  {applications.map(app => (
                    <div
                      key={app.id}
                      className="p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                      onClick={() => setSelectedApp(app)}
                    >
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
                            {app.follow_up_date && <span className="flex items-center gap-1 text-amber-600"><Bell className="w-3 h-3" />Follow-up {format(new Date(app.follow_up_date), "MMM d")}</span>}
                          </div>
                          {app.next_step && <p className="text-xs text-violet-600 mt-2 font-medium">→ Next: {app.next_step}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {app.job_url && (
                            <a
                              href={app.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                            >
                              Job Post ↗
                            </a>
                          )}
                          <span className="text-xs text-slate-400">View →</span>
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
          <InterviewPrepSection client={client} />
          <div className="mt-6">
            <AgentChatEmbed agentKey="interview_prep_coach" title="Interview Coach" description="Practice interviews and get real-time coaching feedback" />
          </div>
        </TabsContent>

        <TabsContent value="coach">
          <AgentChatEmbed agentKey="career_coach" title="Career Coach" description="Your AI-powered career coaching assistant" />
        </TabsContent>

        <TabsContent value="activity">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">My Activity & Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 && activities.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No activity yet</div>
              ) : (
                <div className="space-y-3">
                  {/* Appointments */}
                  {meetings.map(meeting => (
                    <div key={`meeting-${meeting.id}`} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{meeting.meeting_type?.replace(/_/g, ' ')}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <span>{format(new Date(meeting.start_datetime), "MMM d, yyyy")}</span>
                            <span>•</span>
                            <span>{format(new Date(meeting.start_datetime), "h:mm a")}</span>
                          </div>
                          {meeting.location && <p className="text-xs text-slate-500 mt-1">📍 {meeting.location}</p>}
                          {meeting.description && <p className="text-xs text-slate-600 mt-2">{meeting.description}</p>}
                          <Badge className={cn("mt-2 text-xs", 
                            meeting.status === 'scheduled' ? "bg-blue-100 text-blue-700" :
                            meeting.status === 'confirmed' ? "bg-green-100 text-green-700" :
                            meeting.status === 'completed' ? "bg-slate-100 text-slate-600" :
                            meeting.status === 'cancelled' ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {meeting.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Activities */}
                  {activities.map(activity => (
                    <div key={`activity-${activity.id}`} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-slate-300 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                          {activity.description && <p className="text-xs text-slate-600 mt-1">{activity.description}</p>}
                          <p className="text-xs text-slate-400 mt-2">{format(new Date(activity.created_date), "MMM d, yyyy h:mm a")}</p>
                          <Badge className="mt-2 text-xs bg-slate-200 text-slate-700">
                            {activity.activity_type?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">My Tasks</CardTitle>
                <Button size="sm" onClick={() => setShowNewTask(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No tasks yet</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => openTaskDetail(task)}
                    >
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
                          {task.notes && <p className="text-xs text-violet-600 mt-1 italic truncate">Note: {task.notes}</p>}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">Edit →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">My Documents</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setUploadCategory('resume'); setShowUploadDoc(true); }}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Resume
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setUploadCategory('cover_letter'); setShowUploadDoc(true); }}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Cover Letter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No documents yet</div>
              ) : (
                <div className="space-y-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                              <Badge className={cn("text-xs", 
                                doc.category === 'resume' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                              )}>
                                {doc.category === 'cover_letter' ? 'Cover Letter' : doc.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                              {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • 
                              {format(new Date(doc.created_date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Application Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {selectedApp?.position}
            </DialogTitle>
            <p className="text-sm text-slate-500">{selectedApp?.company}</p>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4 py-2">
              {/* Status */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
                <Select value={selectedApp.status} onValueChange={val => updateApplication('status', val)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['saved','applied','phone_screen','interview','final_round','offer','accepted','rejected','withdrawn'].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Next Step */}
              {selectedApp.next_step && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <p className="text-xs font-semibold text-violet-700 mb-1">Next Step</p>
                  <p className="text-sm text-violet-800">{selectedApp.next_step}</p>
                  {selectedApp.next_step_date && (
                    <p className="text-xs text-violet-600 mt-1">Due: {format(new Date(selectedApp.next_step_date), "MMM d, yyyy")}</p>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedApp.location && (
                  <div>
                    <p className="text-xs text-slate-400">Location</p>
                    <p className="text-slate-700">{selectedApp.location}</p>
                  </div>
                )}
                {selectedApp.applied_date && (
                  <div>
                    <p className="text-xs text-slate-400">Applied</p>
                    <p className="text-slate-700">{format(new Date(selectedApp.applied_date), "MMM d, yyyy")}</p>
                  </div>
                )}
                {selectedApp.salary_range && (
                  <div>
                    <p className="text-xs text-slate-400">Salary Range</p>
                    <p className="text-slate-700">{selectedApp.salary_range}</p>
                  </div>
                )}
                {selectedApp.work_type && (
                  <div>
                    <p className="text-xs text-slate-400">Work Type</p>
                    <p className="text-slate-700 capitalize">{selectedApp.work_type}</p>
                  </div>
                )}
              </div>

              {/* Follow-up date */}
              {selectedApp.follow_up_date && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Follow-up Date</p>
                    <p className="text-sm text-amber-800">{format(new Date(selectedApp.follow_up_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}

              {/* Employer Contact */}
              {(selectedApp.contact_name || selectedApp.contact_email || selectedApp.contact_phone) && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Phone className="w-3 h-3" /> Employer Contact</p>
                  {selectedApp.contact_name && <p className="text-sm text-slate-700">{selectedApp.contact_name}{selectedApp.contact_title ? ` · ${selectedApp.contact_title}` : ""}</p>}
                  {selectedApp.contact_email && <p className="text-xs text-blue-600">{selectedApp.contact_email}</p>}
                  {selectedApp.contact_phone && <p className="text-xs text-slate-600">{selectedApp.contact_phone}</p>}
                </div>
              )}

              {/* Notes log */}
              {(selectedApp.note_entries?.length > 0 || selectedApp.notes) && (
                <div>
                  <p className="text-xs text-slate-400 mb-2 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedApp.note_entries?.map((entry, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-2 text-xs">
                        <p className="text-slate-700">{entry.text}</p>
                        <p className="text-slate-400 mt-0.5">{entry.created_at ? format(new Date(entry.created_at), "MMM d, h:mm a") : ""}</p>
                      </div>
                    ))}
                    {selectedApp.notes && !selectedApp.note_entries?.length && (
                      <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">{selectedApp.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Job URL */}
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Job Posting URL</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-8 text-sm"
                    placeholder="https://..."
                    defaultValue={selectedApp.job_url || ""}
                    onBlur={e => { if (e.target.value !== selectedApp.job_url) updateApplication('job_url', e.target.value); }}
                  />
                  {selectedApp.job_url && (
                    <a href={selectedApp.job_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                      Open ↗
                    </a>
                  )}
                </div>
              </div>

              {updatingApp && <p className="text-xs text-slate-400 text-center">Saving...</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Application Dialog */}
      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Job Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Company *</Label>
                <Input value={appForm.company || ""} onChange={e => setAppForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Position *</Label>
                <Input value={appForm.position || ""} onChange={e => setAppForm(p => ({ ...p, position: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Applied Date</Label>
                <Input type="date" value={appForm.applied_date || ""} onChange={e => setAppForm(p => ({ ...p, applied_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Bell className="w-3 h-3 text-amber-500" /> Follow-up Date</Label>
                <Input type="date" value={appForm.follow_up_date || ""} onChange={e => setAppForm(p => ({ ...p, follow_up_date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Job URL</Label>
                <Input value={appForm.job_url || ""} onChange={e => setAppForm(p => ({ ...p, job_url: e.target.value }))} />
              </div>
            </div>

            {/* Employer Contact */}
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Employer Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input value={appForm.contact_name || ""} onChange={e => setAppForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Contact Title</Label>
                  <Input value={appForm.contact_title || ""} onChange={e => setAppForm(p => ({ ...p, contact_title: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Contact Email</Label>
                  <Input type="email" value={appForm.contact_email || ""} onChange={e => setAppForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input type="tel" value={appForm.contact_phone || ""} onChange={e => setAppForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><StickyNote className="w-3.5 h-3.5" /> Notes</p>
              <div className="space-y-2 mb-2 max-h-36 overflow-y-auto">
                {(appForm.note_entries || []).length === 0 && <p className="text-xs text-slate-400 italic">No notes yet</p>}
                {(appForm.note_entries || []).map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                    <div className="flex-1">
                      <p className="text-slate-700">{entry.text}</p>
                      <p className="text-slate-400 mt-0.5">{entry.created_at ? format(new Date(entry.created_at), "MMM d, h:mm a") : ""}</p>
                    </div>
                    <button onClick={() => setAppForm(p => ({ ...p, note_entries: p.note_entries.filter((_, i) => i !== idx) }))} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={newAppNote} onChange={e => setNewAppNote(e.target.value)} rows={2} placeholder="Add a note..." className="text-sm flex-1" />
                <Button type="button" size="sm" variant="outline" className="self-end" onClick={() => {
                  if (!newAppNote.trim()) return;
                  setAppForm(p => ({ ...p, note_entries: [...(p.note_entries || []), { text: newAppNote.trim(), created_at: new Date().toISOString() }] }));
                  setNewAppNote("");
                }}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewApp(false)}>Cancel</Button>
            <Button onClick={saveApplication} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Task Title *</Label>
              <Input value={taskForm.title || ""} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={taskForm.description || ""} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={taskForm.due_date || ""} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancel</Button>
            <Button onClick={saveTask} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={showUploadDoc} onOpenChange={setShowUploadDoc}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {uploadCategory === 'resume' ? 'Resume' : 'Cover Letter'}</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-400">PDF, DOC, DOCX (max 10MB)</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </Label>
            {uploading && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDoc(false)} disabled={uploading}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              {selectedTask.description && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{selectedTask.description}</p>
              )}
              {selectedTask.due_date && (
                <p className="text-xs text-slate-500">Due: {format(new Date(selectedTask.due_date), "MMM d, yyyy")}</p>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={taskStatus} onValueChange={setTaskStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">My Notes</Label>
                <Textarea
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                  placeholder="Add your notes, updates, or questions here..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Cancel</Button>
            <Button onClick={saveTaskDetail} disabled={savingTask}>{savingTask ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportFromIndeedDialog
        open={showIndeedImport}
        onClose={() => setShowIndeedImport(false)}
        clientId={client?.id}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['client-applications'] })}
      />
    </div>
  );
}