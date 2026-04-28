import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from '@/lib/queryKeys';
import {
  getCurrentUser,
  getClientById,
  getClientByEmail,
  getApplications,
  getTasks,
  getClientVisibleDocuments,
  getAssessments,
  getInterviews,
  getTimeEntries,
  getActivities,
  getMeetings,
  getSharedRecommendations,
  createApplication,
  updateApplication,
  createTask,
  updateTask,
  deleteTask,
  uploadFile,
  createDocument,
  createActivity,
} from "@/lib/api/clientPortalApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STAFF_ROLES = ["admin", "management", "employee"];

function getClientIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function emptyApplicationForm() {
  return {
    company: "",
    position: "",
    status: "active",
    notes: "",
    running_notes: "",
  };
}

function emptyTaskForm() {
  return {
    title: "",
    description: "",
    notes: "",
    status: "open",
    due_date: "",
  };
}

export default function ClientPortal() {
  const queryClient = useQueryClient();

  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState("");

  const [activeTab, setActiveTab] = useState("applications");
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [showNewApp, setShowNewApp] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const [appForm, setAppForm] = useState(emptyApplicationForm());
  const [taskForm, setTaskForm] = useState(emptyTaskForm());

  const [isSavingApp, setIsSavingApp] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const clientIdFromUrl = useMemo(() => getClientIdFromUrl(), []);

  /**
   * Bootstrap user + client
   */
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setBootError("");

        const currentUser = await getCurrentUser();
        if (!isMounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setClient(null);
          return;
        }

        if (currentUser.role === "client") {
          const resolvedClient = await getClientByEmail(currentUser.email);
          if (!isMounted) return;
          setClient(resolvedClient || null);
          return;
        }

        if (STAFF_ROLES.includes(currentUser.role) && clientIdFromUrl) {
          const resolvedClient = await getClientById(clientIdFromUrl);
          if (!isMounted) return;
          setClient(resolvedClient || null);
          return;
        }

        setClient(null);
      } catch (error) {
        console.error("ClientPortal init failed:", error);
        if (!isMounted) return;
        setBootError("Failed to load portal.");
        setUser(null);
        setClient(null);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [clientIdFromUrl]);

  /**
   * Queries
   */
  const {
    data: applications = [],
    isLoading: applicationsLoading,
    error: applicationsError,
  } = useQuery({
    queryKey: queryKeys.applications(client?.id),
    queryFn: () => getApplications(client.id),
    enabled: !!client?.id && activeTab === "applications",
    staleTime: 60 * 1000,
  });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery({
    queryKey: queryKeys.tasks(client?.id),
    queryFn: () => getTasks(client.id),
    enabled: !!client?.id && activeTab === "tasks",
    staleTime: 60 * 1000,
  });

    const {
    data: documents = [],
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: queryKeys.documents(client?.id),
    queryFn: () => getClientVisibleDocuments(client.id),
    enabled: !!client?.id && activeTab === "documents",
    staleTime: 60 * 1000,
  });

  const {
    data: sharedRecommendations = [],
    isLoading: sharedRecommendationsLoading,
    error: sharedRecommendationsError,
  } = useQuery({
    queryKey: ["clientPortal", "sharedRecommendations", client?.id],
    queryFn: () => getSharedRecommendations(client.id),
    enabled: !!client?.id && activeTab === "recommendations",
    staleTime: 60 * 1000,
  });

  /**
   * Helpers
   */
  const invalidateApplications = useCallback(async () => {
    if (!client?.id) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.applications(client.id),
    });
  }, [client?.id, queryClient]);

  const invalidateTasks = useCallback(async () => {
    if (!client?.id) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tasks(client.id),
    });
  }, [client?.id, queryClient]);

  /**
   * Actions
   */
  const handleCreateApplication = useCallback(async () => {
    if (!client?.id || isSavingApp) return;

    try {
      setIsSavingApp(true);

      await createApplication({
        ...appForm,
        client_id: client.id,
      });

      await invalidateApplications();
      setShowNewApp(false);
      setAppForm(emptyApplicationForm());
    } catch (error) {
      console.error("Create application failed:", error);
      alert("Failed to create application.");
    } finally {
      setIsSavingApp(false);
    }
  }, [appForm, client?.id, invalidateApplications, isSavingApp]);

  const handleUpdateApplication = useCallback(
    async (id, payload) => {
      if (!id) return;

      try {
        setIsSavingApp(true);
        await updateApplication(id, payload);
        await invalidateApplications();
        setSelectedApp(null);
      } catch (error) {
        console.error("Update application failed:", error);
        alert("Failed to update application.");
      } finally {
        setIsSavingApp(false);
      }
    },
    [invalidateApplications]
  );

  const handleCreateTask = useCallback(async () => {
    if (!client?.id || isSavingTask) return;

    try {
      setIsSavingTask(true);

      await createTask({
        ...taskForm,
        client_ids: [client.id],
      });

      await invalidateTasks();
      setShowNewTask(false);
      setTaskForm(emptyTaskForm());
    } catch (error) {
      console.error("Create task failed:", error);
      alert("Failed to create task.");
    } finally {
      setIsSavingTask(false);
    }
  }, [client?.id, invalidateTasks, isSavingTask, taskForm]);

  const handleUpdateTask = useCallback(async () => {
    if (!selectedTask?.id || isSavingTask) return;

    try {
      setIsSavingTask(true);
      await updateTask(selectedTask.id, selectedTask);
      await invalidateTasks();
      setSelectedTask(null);
    } catch (error) {
      console.error("Update task failed:", error);
      alert("Failed to update task.");
    } finally {
      setIsSavingTask(false);
    }
  }, [invalidateTasks, isSavingTask, selectedTask]);

  const handleDeleteTask = useCallback(
    async (id) => {
      if (!id || isSavingTask) return;

      try {
        setIsSavingTask(true);
        await deleteTask(id);
        await invalidateTasks();
        setSelectedTask(null);
      } catch (error) {
        console.error("Delete task failed:", error);
        alert("Failed to delete task.");
      } finally {
        setIsSavingTask(false);
      }
    },
    [invalidateTasks, isSavingTask]
  );

  /**
   * Render guards
   */
  if (bootError) {
    return <div className="p-4 text-red-600">{bootError}</div>;
  }

  if (!user || !client) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Client Portal</h1>
        <p className="text-sm text-muted-foreground">
          {client.full_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client"}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
               <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Applications</h2>
            <Button onClick={() => setShowNewApp(true)}>Add Application</Button>
          </div>

          {applicationsLoading ? (
            <div>Loading applications...</div>
          ) : applicationsError ? (
            <div className="text-red-600">Failed to load applications.</div>
          ) : applications.length === 0 ? (
            <div className="text-sm text-muted-foreground">No applications yet.</div>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="w-full rounded border p-3 text-left hover:bg-muted"
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="font-medium">
                    {app.position || "Untitled Position"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {app.company || "Unknown Company"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Shared Recommendations</h2>
          </div>

          {sharedRecommendationsLoading ? (
            <div>Loading recommendations...</div>
          ) : sharedRecommendationsError ? (
            <div className="text-red-600">Failed to load recommendations.</div>
          ) : sharedRecommendations.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No recommendations have been shared yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sharedRecommendations.map((rec) => (
                <div key={rec.id} className="rounded border p-4">
                  <div className="font-medium">
                   {rec.job_title || rec.title || "Untitled Recommendation"}
                  </div>

                  {rec.employer ? (
                    <div className="text-sm text-muted-foreground">
                      {rec.employer}
                    </div>
                  ) : null}

                  {rec.location || rec.pay ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {[rec.location, rec.pay].filter(Boolean).join(" • ")}
                    </div>
                  ) : null}

                  {rec.fit_reason ? (
                    <div className="mt-3 rounded bg-muted p-3 text-sm">
                      <div className="font-medium">Why this may fit</div>
                      <div>{rec.fit_reason}</div>
                    </div>
                  ) : null}

                  {rec.support_strategy ? (
                    <div className="mt-3 rounded bg-muted p-3 text-sm">
                      <div className="font-medium">Support strategy</div>
                      <div>{rec.support_strategy}</div>
                    </div>
                  ) : null}

                  {rec.concerns ? (
  <div className="mt-3 rounded bg-muted p-3 text-sm">
    <div className="font-medium">Things to consider</div>
    <div>{rec.concerns}</div>
  </div>
) : null}

<div className="mt-4 flex gap-2">
  <Button
    size="sm"
    type="button"
    onClick={() => console.log("INTERESTED", rec)}
  >
    Interested
  </Button>

  <Button
    size="sm"
    type="button"
    variant="outline"
    onClick={() => console.log("NOT INTERESTED", rec)}
  >
    Not Interested
  </Button>
</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Tasks</h2>
            <Button onClick={() => setShowNewTask(true)}>Add Task</Button>
          </div>

          {tasksLoading ? (
            <div>Loading tasks...</div>
          ) : tasksError ? (
            <div className="text-red-600">Failed to load tasks.</div>
          ) : tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tasks yet.</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="w-full rounded border p-3 text-left hover:bg-muted"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="font-medium">{task.title || "Untitled Task"}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.status || "open"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Documents</h2>
          </div>

          {documentsLoading ? (
            <div>Loading documents...</div>
          ) : documentsError ? (
            <div className="text-red-600">Failed to load documents.</div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents yet.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
               <div key={doc.id} className="rounded border p-3">
  <div className="font-medium">{doc.title || "Untitled Document"}</div>

  {doc.source && (
    <div className="text-xs text-muted-foreground">
      {doc.source.replace("_", " ")}
    </div>
  )}
                  {doc.description ? (
                    <div className="text-sm text-muted-foreground">
                      {doc.description}
                    </div>
                  ) : null}
                  {doc.file_url ? (
                    <a
                      className="mt-2 inline-block text-sm underline"
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* CREATE APPLICATION */}
      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">New Application</h3>

            <Input
              placeholder="Company"
              value={appForm.company}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, company: e.target.value }))
              }
            />

            <Input
              placeholder="Position"
              value={appForm.position}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, position: e.target.value }))
              }
            />

            <Input
              placeholder="Status"
              value={appForm.status}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, status: e.target.value }))
              }
            />

            <Textarea
              placeholder="Notes"
              value={appForm.notes}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />

            <Textarea
              placeholder="Running notes"
              value={appForm.running_notes}
              onChange={(e) =>
                setAppForm((prev) => ({ ...prev, running_notes: e.target.value }))
              }
            />

            <div className="flex gap-2">
              <Button onClick={handleCreateApplication} disabled={isSavingApp}>
                {isSavingApp ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewApp(false)}
                disabled={isSavingApp}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE TASK */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">New Task</h3>

            <Input
              placeholder="Title"
              value={taskForm.title}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />

            <Textarea
              placeholder="Description"
              value={taskForm.description}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />

            <Textarea
              placeholder="Notes"
              value={taskForm.notes}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />

            <Input
              placeholder="Status"
              value={taskForm.status}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, status: e.target.value }))
              }
            />

            <Input
              type="date"
              value={taskForm.due_date}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))
              }
            />

            <div className="flex gap-2">
              <Button onClick={handleCreateTask} disabled={isSavingTask}>
                {isSavingTask ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewTask(false)}
                disabled={isSavingTask}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TASK DETAIL */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedTask && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Edit Task</h3>

              <Input
                value={selectedTask.title || ""}
                onChange={(e) =>
                  setSelectedTask((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedTask.description || ""}
                onChange={(e) =>
                  setSelectedTask((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedTask.notes || ""}
                onChange={(e) =>
                  setSelectedTask((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />

              <Input
                value={selectedTask.status || ""}
                onChange={(e) =>
                  setSelectedTask((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
              />

              <Input
                type="date"
                value={selectedTask.due_date || ""}
                onChange={(e) =>
                  setSelectedTask((prev) => ({
                    ...prev,
                    due_date: e.target.value,
                  }))
                }
              />

              <div className="flex gap-2">
                <Button onClick={handleUpdateTask} disabled={isSavingTask}>
                  {isSavingTask ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  disabled={isSavingTask}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* APPLICATION DETAIL */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedApp && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Edit Application</h3>

              <Input
                value={selectedApp.company || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
              />

              <Input
                value={selectedApp.position || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    position: e.target.value,
                  }))
                }
              />

              <Input
                value={selectedApp.status || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedApp.notes || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedApp.running_notes || ""}
                onChange={(e) =>
                  setSelectedApp((prev) => ({
                    ...prev,
                    running_notes: e.target.value,
                  }))
                }
              />

              <div className="flex gap-2">
                <Button
                  onClick={() => handleUpdateApplication(selectedApp.id, selectedApp)}
                  disabled={isSavingApp}
                >
                  {isSavingApp ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedApp(null)}
                  disabled={isSavingApp}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
