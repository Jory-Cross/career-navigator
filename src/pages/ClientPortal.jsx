import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import InterviewPrepSection from "@/components/client-detail/InterviewPrepSection";
import TimeLogSection from "@/components/client-detail/TimeLogSection";
import JobSuggestionsSection from "@/components/client-portal/JobSuggestionsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  MapPin,
  Calendar,
  Target,
  Briefcase,
  CheckCircle2,
  Plus,
  Loader2,
  Upload,
  FileText,
  Download,
  Clock,
  Bell,
  Phone,
  StickyNote,
  Trash2,
  ExternalLink,
} from "lucide-react";
import ImportFromIndeedDialog from "@/components/client-portal/ImportFromIndeedDialog";
import AgentChatEmbed from "@/components/client-portal/AgentChatEmbed.jsx";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STAFF_ROLES = ["admin", "management", "employee"];
const CLIENT_VISIBLE_ACTIVITY_TYPES = [
  "application_created",
  "application_updated",
  "task_created",
  "task_updated",
  "assessment_completed",
  "job_search",
  "application_submitted",
  "interview_completed",
  "document_uploaded",
];

const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "final_round",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
];

const TASK_STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-600",
};

const APP_STATUS_COLORS = {
  saved: "bg-slate-100 text-slate-700",
  applied: "bg-blue-100 text-blue-700",
  phone_screen: "bg-cyan-100 text-cyan-700",
  interview: "bg-violet-100 text-violet-700",
  final_round: "bg-purple-100 text-purple-700",
  offer: "bg-emerald-100 text-emerald-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-amber-100 text-amber-700",
};

function getClientIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

function normalizeApplicationNotes(app) {
  if (Array.isArray(app?.note_entries)) {
    return app.note_entries;
  }

  if (app?.notes && typeof app.notes === "string") {
    return [
      {
        text: app.notes,
        created_at: app.updated_date || app.created_date || new Date().toISOString(),
      },
    ];
  }

  return [];
}

function formatDate(value, dateFormat = "MMM d, yyyy") {
  if (!value) return "";
  try {
    return format(new Date(value), dateFormat);
  } catch {
    return "";
  }
}

function EmptyState({ title, description, action }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-5 w-5 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function ClientPortal() {
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("applications");

  const [showNewApp, setShowNewApp] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedAppNewNote, setSelectedAppNewNote] = useState("");
  const [updatingApp, setUpdatingApp] = useState(false);

  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskNotes, setTaskNotes] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showIndeedImport, setShowIndeedImport] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("resume");
  const [uploading, setUploading] = useState(false);

  const [appForm, setAppForm] = useState({});
  const [newAppNote, setNewAppNote] = useState("");
  const [taskForm, setTaskForm] = useState({});
  const [saving, setSaving] = useState(false);

  const clientIdParam = useMemo(() => getClientIdFromUrl(), []);

  const loadClientData = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === "client") {
        const allClients = await base44.entities.Client.list();
        const ownClient = allClients.find((c) => c.email === currentUser.email) || null;
        setClient(ownClient);
        return;
      }

      if (STAFF_ROLES.includes(currentUser.role) && clientIdParam) {
        let clientData = null;

        try {
          clientData = await base44.entities.Client.get(clientIdParam);
        } catch (error) {
          const allClients = await base44.entities.Client.list();
          clientData = allClients.find((c) => c.id === clientIdParam) || null;
        }

        if (!clientData) {
          setClient(null);
          return;
        }

        if (
          currentUser.role === "employee" &&
          clientData.assigned_employee_id !== currentUser.id
        ) {
          setClient(null);
          return;
        }

        setClient(clientData);
        return;
      }

      setClient(null);
    } catch (error) {
      console.error("Failed to load client data", error);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientIdParam]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const isPortalPreview = isStaff && !!clientIdParam;
  const showInternalStaffContent = isStaff && !isPortalPreview;

  const shouldLoadApplications =
    !!client?.id && (activeTab === "applications" || !!selectedApp || showNewApp);

  const shouldLoadTasks =
    !!client?.id && (activeTab === "tasks" || !!selectedTask || showNewTask);

  const shouldLoadDocuments =
    !!client?.id && (activeTab === "documents" || showUploadDoc);

  const shouldLoadAssessments = !!client?.id && activeTab === "assessments";
  const shouldLoadInterviews = !!client?.id && activeTab === "interview";
  const shouldLoadTime = !!client?.id && activeTab === "time";
  const shouldLoadActivity = !!client?.id && activeTab === "activity";
  const shouldLoadMeetings = !!client?.id && activeTab === "activity";

  const queryDefaults = {
    enabled: !!client?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  };

  const { data: applications = [], isFetching: loadingApplications } = useQuery({
    queryKey: ["client-applications", client?.id],
    queryFn: () => base44.entities.JobApplication.filter({ client_id: client.id }),
    enabled: shouldLoadApplications,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tasks = [], isFetching: loadingTasks } = useQuery({
    queryKey: ["client-tasks", client?.id],
    queryFn: async () => {
      try {
        return await base44.entities.Task.filter({ client_ids: client.id });
      } catch (error) {
        const allTasks = await base44.entities.Task.list();
        return allTasks.filter((t) => t.client_ids?.includes(client.id));
      }
    },
    enabled: shouldLoadTasks,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: documents = [], isFetching: loadingDocuments } = useQuery({
    queryKey: ["client-documents", client?.id],
    queryFn: () => base44.entities.Document.filter({ client_id: client.id }),
    enabled: shouldLoadDocuments,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: assessments = [], isFetching: loadingAssessments } = useQuery({
    queryKey: ["client-assessments", client?.id],
    queryFn: () => base44.entities.Assessment.filter({ client_id: client.id }),
    enabled: shouldLoadAssessments,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: interviewSessions = [] } = useQuery({
    queryKey: ["client-interviews", client?.id],
    queryFn: () => base44.entities.InterviewSession.filter({ client_id: client.id }),
    enabled: shouldLoadInterviews,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["client-time-entries", client?.id],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: client.id }),
    enabled: shouldLoadTime,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: activities = [], isFetching: loadingActivities } = useQuery({
    queryKey: ["client-activities", client?.id],
    queryFn: () => base44.entities.Activity.filter({ client_id: client.id }),
    enabled: shouldLoadActivity,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["client-meetings", client?.id],
    queryFn: () => base44.entities.Meeting.filter({ client_id: client.id }),
    enabled: shouldLoadMeetings,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const clientVisibleActivities = useMemo(() => {
    if (showInternalStaffContent) return activities;

    return activities.filter((activity) =>
      CLIENT_VISIBLE_ACTIVITY_TYPES.includes(activity.activity_type)
    );
  }, [activities, showInternalStaffContent]);

  const clientVisibleMeetings = useMemo(() => {
    return showInternalStaffContent ? meetings : [];
  }, [meetings, showInternalStaffContent]);

  const invalidate = useCallback(
    async (queryKey) => {
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient]
  );

  const logActivity = useCallback(
    async (activity_type, title, description = "") => {
      if (!client?.id) return;

      try {
        await base44.entities.Activity.create({
          client_id: client.id,
          activity_type,
          title,
          description,
        });

        await invalidate(["client-activities"]);
      } catch (error) {
        // intentionally silent
      }
    },
    [client?.id, invalidate]
  );

  const saveApplication = useCallback(async () => {
    if (!appForm.company || !appForm.position) {
      toast.error("Company and position required");
      return;
    }

    if (!client?.id) return;

    setSaving(true);

    try {
      const noteEntries = Array.isArray(appForm.note_entries) ? appForm.note_entries : [];
      const flattenedNotes = noteEntries.map((entry) => entry.text).join("\n\n");

      await base44.entities.JobApplication.create({
        ...appForm,
        client_id: client.id,
        note_entries: noteEntries,
        notes: flattenedNotes,
      });

      await logActivity(
        "application_created",
        `Application added: ${appForm.position} at ${appForm.company}`
      );

      toast.success("Application added");
      await invalidate(["client-applications"]);

      setShowNewApp(false);
      setAppForm({});
      setNewAppNote("");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [appForm, client?.id, invalidate, logActivity]);

  const saveTask = useCallback(async () => {
    if (!taskForm.title) {
      toast.error("Task title required");
      return;
    }

    if (!client?.id) return;

    setSaving(true);

    try {
      await base44.entities.Task.create({
        ...taskForm,
        client_ids: [client.id],
      });

      await logActivity("task_created", `Task created: ${taskForm.title}`);
      toast.success("Task created");
      await invalidate(["client-tasks"]);

      setShowNewTask(false);
      setTaskForm({});
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [taskForm, client?.id, invalidate, logActivity]);

  const openTaskDetail = useCallback((task) => {
    setSelectedTask(task);
    setTaskNotes(task.notes || "");
    setTaskStatus(task.status || "pending");
  }, []);

  const saveTaskDetail = useCallback(async () => {
    if (!selectedTask) return;

    setSavingTask(true);

    try {
      await base44.entities.Task.update(selectedTask.id, {
        notes: taskNotes,
        status: taskStatus,
        title: selectedTask.title,
        description: selectedTask.description,
        due_date: selectedTask.due_date,
      });

      await logActivity(
        "task_updated",
        `Task updated: ${selectedTask.title}`,
        `Status: ${taskStatus}`
      );

      toast.success("Task updated");
      await invalidate(["client-tasks"]);
      setSelectedTask(null);
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSavingTask(false);
    }
  }, [selectedTask, taskNotes, taskStatus, invalidate, logActivity]);

  const deleteTask = useCallback(
    async (taskId, taskTitle) => {
      try {
        await base44.entities.Task.delete(taskId);
        await logActivity("task_updated", `Task deleted: ${taskTitle}`);
        toast.success("Task deleted");
        await invalidate(["client-tasks"]);
        setSelectedTask(null);
      } catch (error) {
        toast.error("Failed to delete");
      }
    },
    [invalidate, logActivity]
  );

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file || !client?.id) return;

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
          category: uploadCategory,
        });

        await base44.entities.Activity.create({
          client_id: client.id,
          activity_type: "document_uploaded",
          title: `${uploadCategory === "resume" ? "Resume" : "Cover letter"} uploaded`,
          description: `Uploaded ${file.name}`,
        });

        toast.success("File uploaded successfully");
        await invalidate(["client-documents"]);
        await invalidate(["client-activities"]);
        setShowUploadDoc(false);
      } catch (error) {
        toast.error(`Upload failed: ${error.message}`);
      } finally {
        setUploading(false);

        if (e.target) {
          e.target.value = "";
        }
      }
    },
    [client?.id, uploadCategory, invalidate]
  );

  const updateApplication = useCallback(
    async (field, value) => {
      if (!selectedApp) return;

      setUpdatingApp(true);

      try {
        const updated = { ...selectedApp, [field]: value };

        await base44.entities.JobApplication.update(selectedApp.id, {
          [field]: value,
        });

        setSelectedApp(updated);
        await invalidate(["client-applications"]);

        if (field === "status") {
          await logActivity(
            "application_updated",
            `Application status updated: ${selectedApp.position} at ${selectedApp.company}`,
            `New status: ${value}`
          );
        }

        toast.success("Updated");
      } catch (error) {
        toast.error("Failed to update");
      } finally {
        setUpdatingApp(false);
      }
    },
    [selectedApp, invalidate, logActivity]
  );

  const addApplicationNote = useCallback(async () => {
    if (!selectedApp || !selectedAppNewNote.trim()) return;

    const existingEntries = normalizeApplicationNotes(selectedApp);
    const nextEntries = [
      ...existingEntries,
      {
        text: selectedAppNewNote.trim(),
        created_at: new Date().toISOString(),
        created_by: user?.email || client?.email || "client",
      },
    ];

    const flattenedNotes = nextEntries.map((entry) => entry.text).join("\n\n");

    setUpdatingApp(true);

    try {
      await base44.entities.JobApplication.update(selectedApp.id, {
        note_entries: nextEntries,
        notes: flattenedNotes,
      });

      setSelectedApp((prev) =>
        prev
          ? {
              ...prev,
              note_entries: nextEntries,
              notes: flattenedNotes,
            }
          : prev
      );

      setSelectedAppNewNote("");
      await invalidate(["client-applications"]);

      await logActivity(
        "application_updated",
        `Application note added: ${selectedApp.position} at ${selectedApp.company}`
      );

      toast.success("Note added");
    } catch (error) {
      toast.error("Failed to add note");
    } finally {
      setUpdatingApp(false);
    }
  }, [
    selectedApp,
    selectedAppNewNote,
    user?.email,
    client?.email,
    invalidate,
    logActivity,
  ]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading...</div>;
  }

  if (!user || (!client && !loading)) {
    return <div className="p-6 text-sm text-slate-500">Access denied or client not found.</div>;
  }

  if (!client) return null;

  if (client.client_type === "pre_ets" && user.role === "pre_ets") {
    window.location.href = "/PreEtsPortal";
    return null;
  }

  if (client.client_type === "dspd" && user.role === "dspd") {
    window.location.href = "/DspdPortal";
    return null;
  }

  if (isStaff && client.client_type === "pre_ets") {
    window.location.href = `/PreEtsPortal?id=${client.id}`;
    return null;
  }

  if (isStaff && client.client_type === "dspd") {
    window.location.href = `/DspdPortal?id=${client.id}`;
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {client.client_type?.replace(/_/g, " ") || "client"}
                </Badge>
                {isPortalPreview ? (
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    Staff Portal Preview
                  </Badge>
                ) : null}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {client.first_name || client.last_name
                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                  : client.full_name || client.email || "Client Portal"}
              </h1>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                {client.email ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span>{client.email}</span>
                  </div>
                ) : null}

                {client.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{client.phone}</span>
                  </div>
                ) : null}

                {client.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{client.location}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowIndeedImport(true)}>
                Import from Indeed
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setUploadCategory("resume");
                  setShowUploadDoc(true);
                }}
              >
                Upload Resume
              </Button>
              <Button onClick={() => setShowNewApp(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Application
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-auto min-w-max gap-1 rounded-xl border bg-white p-1">
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="interview">Interview Prep</TabsTrigger>
              <TabsTrigger value="time">Time Log</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="jobs">Job Suggestions</TabsTrigger>
              <TabsTrigger value="assistant">Assistant</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>My Applications</CardTitle>
                <Button size="sm" onClick={() => setShowNewApp(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              </CardHeader>
              <CardContent>
                {loadingApplications ? (
                  <div className="py-8 text-sm text-slate-500">Loading applications...</div>
                ) : applications.length === 0 ? (
                  <EmptyState
                    title="No applications yet"
                    description="Track job applications, statuses, follow-up dates, and running notes here."
                    action={<Button onClick={() => setShowNewApp(true)}>Add Application</Button>}
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {applications.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setSelectedApp(app);
                          setSelectedAppNewNote("");
                        }}
                        className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{app.position}</p>
                            <p className="truncate text-sm text-slate-500">{app.company}</p>
                          </div>
                          <Badge
                            className={cn(
                              "capitalize",
                              APP_STATUS_COLORS[app.status] || "bg-slate-100 text-slate-700"
                            )}
                          >
                            {(app.status || "saved").replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          {app.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span className="truncate">{app.location}</span>
                            </div>
                          ) : null}

                          {app.applied_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>Applied {formatDate(app.applied_date)}</span>
                            </div>
                          ) : null}

                          {app.follow_up_date ? (
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-amber-500" />
                              <span>Follow-up {formatDate(app.follow_up_date)}</span>
                            </div>
                          ) : null}

                          {normalizeApplicationNotes(app).length > 0 ? (
                            <div className="flex items-center gap-2">
                              <StickyNote className="h-4 w-4 text-slate-400" />
                              <span>{normalizeApplicationNotes(app).length} running notes</span>
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>My Tasks</CardTitle>
                <Button size="sm" onClick={() => setShowNewTask(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTasks ? (
                  <div className="py-8 text-sm text-slate-500">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <EmptyState
                    title="No tasks yet"
                    description="Create reminders, follow-ups, and action items here."
                    action={<Button onClick={() => setShowNewTask(true)}>Create Task</Button>}
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openTaskDetail(task)}
                        className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <Badge
                            className={cn(
                              "capitalize",
                              TASK_STATUS_COLORS[task.status] || "bg-slate-100 text-slate-700"
                            )}
                          >
                            {(task.status || "pending").replace(/_/g, " ")}
                          </Badge>
                        </div>

                        {task.description ? (
                          <p className="mb-3 line-clamp-2 text-sm text-slate-600">
                            {task.description}
                          </p>
                        ) : null}

                        <div className="space-y-2 text-sm text-slate-600">
                          {task.due_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>Due {formatDate(task.due_date)}</span>
                            </div>
                          ) : null}

                          {task.notes ? (
                            <div className="flex items-center gap-2">
                              <StickyNote className="h-4 w-4 text-slate-400" />
                              <span className="truncate">Has notes</span>
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>My Documents</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUploadCategory("resume");
                      setShowUploadDoc(true);
                    }}
                  >
                    Upload Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUploadCategory("cover_letter");
                      setShowUploadDoc(true);
                    }}
                  >
                    Upload Cover Letter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDocuments ? (
                  <div className="py-8 text-sm text-slate-500">Loading documents...</div>
                ) : documents.length === 0 ? (
                  <EmptyState
                    title="No documents yet"
                    description="Upload resumes, cover letters, and supporting documents here."
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{doc.title}</p>
                            <p className="text-sm text-slate-500 capitalize">
                              {doc.category === "cover_letter"
                                ? "Cover Letter"
                                : doc.category || "Document"}
                            </p>
                          </div>

                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-slate-700"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          {doc.file_size ? (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-400" />
                              <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                            </div>
                          ) : null}

                          {doc.created_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{formatDate(doc.created_date)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assessments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Assessments</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAssessments ? (
                  <div className="py-8 text-sm text-slate-500">Loading assessments...</div>
                ) : assessments.length === 0 ? (
                  <EmptyState
                    title="No assessments on file yet"
                    description="Completed assessments will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {assessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900 capitalize">
                              {(assessment.assessment_type || "assessment").replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-slate-500">
                              Completed {formatDate(assessment.created_date)}
                            </p>
                          </div>

                          {assessment.pdf_url ? (
                            <a
                              href={assessment.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </a>
                          ) : null}
                        </div>

                        {assessment.notes ? (
                          <p className="mb-3 text-sm text-slate-600">{assessment.notes}</p>
                        ) : null}

                        {assessment.responses ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {Object.entries(assessment.responses)
                              .filter(([key, value]) => value && !key.startsWith("_"))
                              .map(([key, value]) => (
                                <div
                                  key={key}
                                  className="rounded-xl bg-slate-50 px-3 py-2 text-sm"
                                >
                                  <p className="text-slate-500">{key.replace(/_/g, " ")}</p>
                                  <p className="font-medium text-slate-800">{String(value)}</p>
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interview" className="space-y-4">
            <InterviewPrepSection client={client} interviewSessions={interviewSessions} />
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <TimeLogSection client={client} timeEntries={timeEntries} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingActivities ? (
                  <div className="py-8 text-sm text-slate-500">Loading activity...</div>
                ) : clientVisibleActivities.length === 0 && clientVisibleMeetings.length === 0 ? (
                  <EmptyState
                    title="No activity yet"
                    description="Recent portal activity, updates, and meetings will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {clientVisibleMeetings.map((meeting) => (
                      <div key={meeting.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Meeting</Badge>
                          {meeting.status ? (
                            <Badge className="bg-slate-100 text-slate-700">{meeting.status}</Badge>
                          ) : null}
                        </div>
                        <p className="font-medium text-slate-900">{meeting.title}</p>
                        <p className="mt-1 text-sm text-slate-500 capitalize">
                          {meeting.meeting_type?.replace(/_/g, " ") || "meeting"}
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          {meeting.start_datetime ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{formatDate(meeting.start_datetime, "MMM d, yyyy • h:mm a")}</span>
                            </div>
                          ) : null}
                          {meeting.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span>{meeting.location}</span>
                            </div>
                          ) : null}
                          {meeting.description ? <p>{meeting.description}</p> : null}
                        </div>
                      </div>
                    ))}

                    {clientVisibleActivities.map((activity) => (
                      <div key={activity.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {activity.activity_type?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-900">{activity.title}</p>
                        {activity.description ? (
                          <p className="mt-1 text-sm text-slate-600">{activity.description}</p>
                        ) : null}
                        <p className="mt-3 text-xs text-slate-400">
                          {formatDate(activity.created_date, "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <JobSuggestionsSection client={client} />
          </TabsContent>

          <TabsContent value="assistant" className="space-y-4">
            <AgentChatEmbed client={client} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={!!selectedApp}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApp(null);
            setSelectedAppNewNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedApp?.position}</DialogTitle>
            {selectedApp?.company ? (
              <p className="text-sm text-slate-500">{selectedApp.company}</p>
            ) : null}
          </DialogHeader>

          {selectedApp ? (
            <div className="space-y-5 py-2">
              <div>
                <Label className="mb-2 block text-xs text-slate-500">Status</Label>
                <Select
                  value={selectedApp.status || "saved"}
                  onValueChange={(val) => updateApplication("status", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {selectedApp.next_step ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Next Step</p>
                    <p className="text-sm font-medium text-slate-800">{selectedApp.next_step}</p>
                    {selectedApp.next_step_date ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Due: {formatDate(selectedApp.next_step_date)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {selectedApp.location ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-800">{selectedApp.location}</p>
                  </div>
                ) : null}

                {selectedApp.applied_date ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Applied</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedApp.applied_date)}
                    </p>
                  </div>
                ) : null}

                {selectedApp.salary_range ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Salary Range</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedApp.salary_range}
                    </p>
                  </div>
                ) : null}

                {selectedApp.work_type ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Work Type</p>
                    <p className="text-sm font-medium text-slate-800">{selectedApp.work_type}</p>
                  </div>
                ) : null}

                {selectedApp.follow_up_date ? (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Follow-up Date</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedApp.follow_up_date)}
                    </p>
                  </div>
                ) : null}
              </div>

              {selectedApp.contact_name ||
              selectedApp.contact_email ||
              selectedApp.contact_phone ? (
                <div className="rounded-xl border p-4">
                  <p className="mb-3 text-sm font-medium text-slate-800">Employer Contact</p>
                  <div className="space-y-2 text-sm text-slate-600">
                    {selectedApp.contact_name ? (
                      <p>
                        {selectedApp.contact_name}
                        {selectedApp.contact_title
                          ? ` · ${selectedApp.contact_title}`
                          : ""}
                      </p>
                    ) : null}
                    {selectedApp.contact_email ? <p>{selectedApp.contact_email}</p> : null}
                    {selectedApp.contact_phone ? <p>{selectedApp.contact_phone}</p> : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border p-4">
                <p className="mb-3 text-sm font-medium text-slate-800">Running Notes</p>

                <div className="mb-4 space-y-2 max-h-56 overflow-y-auto">
                  {normalizeApplicationNotes(selectedApp).length === 0 ? (
                    <p className="text-sm text-slate-400">No notes yet</p>
                  ) : (
                    normalizeApplicationNotes(selectedApp).map((entry, idx) => (
                      <div key={idx} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="text-slate-800">{entry.text}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {entry.created_at
                            ? formatDate(entry.created_at, "MMM d, h:mm a")
                            : ""}
                          {entry.created_by ? ` • ${entry.created_by}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    value={selectedAppNewNote}
                    onChange={(e) => setSelectedAppNewNote(e.target.value)}
                    rows={3}
                    placeholder="Add a note about your follow-up, contact attempt, interview prep, or any progress on this application..."
                    className="text-sm flex-1"
                  />
                  <Button
                    type="button"
                    className="self-end"
                    onClick={addApplicationNote}
                    disabled={updatingApp || !selectedAppNewNote.trim()}
                  >
                    {updatingApp ? "Saving..." : "Add Note"}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs text-slate-500">Job Posting URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 text-sm"
                    placeholder="https://..."
                    defaultValue={selectedApp.job_url || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (selectedApp.job_url || "")) {
                        updateApplication("job_url", e.target.value);
                      }
                    }}
                  />
                  {selectedApp.job_url ? (
                    <a
                      href={selectedApp.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap text-sm text-blue-600 hover:underline"
                    >
                      Open ↗
                    </a>
                  ) : null}
                </div>
              </div>

              {updatingApp ? (
                <p className="text-center text-xs text-slate-400">Saving...</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Job Application</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Company *</Label>
                <Input
                  value={appForm.company || ""}
                  onChange={(e) =>
                    setAppForm((prev) => ({ ...prev, company: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Position *</Label>
                <Input
                  value={appForm.position || ""}
                  onChange={(e) =>
                    setAppForm((prev) => ({ ...prev, position: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Applied Date</Label>
                <Input
                  type="date"
                  value={appForm.applied_date || ""}
                  onChange={(e) =>
                    setAppForm((prev) => ({ ...prev, applied_date: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Bell className="h-3 w-3 text-amber-500" />
                  Follow-up Date
                </Label>
                <Input
                  type="date"
                  value={appForm.follow_up_date || ""}
                  onChange={(e) =>
                    setAppForm((prev) => ({ ...prev, follow_up_date: e.target.value }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Job URL</Label>
                <Input
                  value={appForm.job_url || ""}
                  onChange={(e) =>
                    setAppForm((prev) => ({ ...prev, job_url: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Phone className="h-3.5 w-3.5" />
                Employer Contact
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input
                    value={appForm.contact_name || ""}
                    onChange={(e) =>
                      setAppForm((prev) => ({ ...prev, contact_name: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs">Contact Title</Label>
                  <Input
                    value={appForm.contact_title || ""}
                    onChange={(e) =>
                      setAppForm((prev) => ({ ...prev, contact_title: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs">Contact Email</Label>
                  <Input
                    type="email"
                    value={appForm.contact_email || ""}
                    onChange={(e) =>
                      setAppForm((prev) => ({ ...prev, contact_email: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs">Contact Phone</Label>
                  <Input
                    type="tel"
                    value={appForm.contact_phone || ""}
                    onChange={(e) =>
                      setAppForm((prev) => ({ ...prev, contact_phone: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <StickyNote className="h-3.5 w-3.5" />
                Notes
              </p>

              <div className="mb-2 max-h-36 space-y-2 overflow-y-auto">
                {(appForm.note_entries || []).length === 0 ? (
                  <p className="text-xs italic text-slate-400">No notes yet</p>
                ) : (
                  (appForm.note_entries || []).map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs"
                    >
                      <div className="flex-1">
                        <p className="text-slate-700">{entry.text}</p>
                        <p className="mt-0.5 text-slate-400">
                          {entry.created_at
                            ? formatDate(entry.created_at, "MMM d, h:mm a")
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAppForm((prev) => ({
                            ...prev,
                            note_entries: (prev.note_entries || []).filter(
                              (_, i) => i !== idx
                            ),
                          }))
                        }
                        className="text-slate-300 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={newAppNote}
                  onChange={(e) => setNewAppNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note..."
                  className="text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-end"
                  onClick={() => {
                    if (!newAppNote.trim()) return;

                    setAppForm((prev) => ({
                      ...prev,
                      note_entries: [
                        ...(prev.note_entries || []),
                        {
                          text: newAppNote.trim(),
                          created_at: new Date().toISOString(),
                        },
                      ],
                    }));

                    setNewAppNote("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewApp(false)}>
              Cancel
            </Button>
            <Button onClick={saveApplication} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Task Title *</Label>
              <Input
                value={taskForm.title || ""}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={taskForm.description || ""}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div>
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={taskForm.due_date || ""}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancel
            </Button>
            <Button onClick={saveTask} disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title || "Task"}</DialogTitle>
          </DialogHeader>

          {selectedTask ? (
            <div className="space-y-4 py-2">
              {selectedTask.description ? (
                <div>
                  <Label className="mb-1 block text-xs text-slate-500">Description</Label>
                  <p className="text-sm text-slate-700">{selectedTask.description}</p>
                </div>
              ) : null}

              <div>
                <Label className="mb-1 block text-xs text-slate-500">Status</Label>
                <Select value={taskStatus || "pending"} onValueChange={setTaskStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="in_progress">in progress</SelectItem>
                    <SelectItem value="completed">completed</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block text-xs text-slate-500">Notes</Label>
                <Textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  rows={5}
                  placeholder="Add task notes..."
                />
              </div>

              {selectedTask.due_date ? (
                <div className="text-sm text-slate-500">
                  Due: {formatDate(selectedTask.due_date)}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => deleteTask(selectedTask.id, selectedTask.title)}
              disabled={savingTask}
            >
              Delete
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>
                Cancel
              </Button>
              <Button onClick={saveTaskDetail} disabled={savingTask}>
                {savingTask ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDoc} onOpenChange={setShowUploadDoc}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Upload {uploadCategory === "resume" ? "Resume" : "Cover Letter"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-slate-400">
                <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="mb-1 text-sm text-slate-600">Click to upload or drag and drop</p>
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

            {uploading ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ImportFromIndeedDialog
        open={showIndeedImport}
        onOpenChange={setShowIndeedImport}
        client={client}
        onImported={async () => {
          await invalidate(["client-applications"]);
          toast.success("Applications imported");
        }}
      />
    </div>
  );
}
