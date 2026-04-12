import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  getClientById,
  getClientByEmail,
  getApplications,
  getTasks,
  getDocuments,
  getAssessments,
  getInterviews,
  getTimeEntries,
  getActivities,
  getMeetings,
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

export default function ClientPortal() {
  const queryClient = useQueryClient();

  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("applications");

  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [showNewApp, setShowNewApp] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const [appForm, setAppForm] = useState({});
  const [taskForm, setTaskForm] = useState({});

  const clientId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }, []);

  /**
   * 🔹 Load User + Client (detached from Base44)
   */
  useEffect(() => {
    const init = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (!currentUser) return;

      if (currentUser.role === "client") {
        const c = await getClientByEmail(currentUser.email);
        setClient(c);
      } else if (STAFF_ROLES.includes(currentUser.role) && clientId) {
        const c = await getClientById(clientId);
        setClient(c);
      }
    };

    init();
  }, [clientId]);

  /**
   * 🔹 Queries (lazy + optimized)
   */
  const { data: applications = [] } = useQuery({
    queryKey: ["applications", client?.id],
    queryFn: () => getApplications(client.id),
    enabled: !!client?.id && activeTab === "applications",
    staleTime: 60000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", client?.id],
    queryFn: () => getTasks(client.id),
    enabled: !!client?.id && activeTab === "tasks",
    staleTime: 60000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", client?.id],
    queryFn: () => getDocuments(client.id),
    enabled: !!client?.id && activeTab === "documents",
  });

  /**
   * 🔹 Actions
   */
  const handleCreateApplication = async () => {
    await createApplication({
      ...appForm,
      client_id: client.id,
    });

    await queryClient.invalidateQueries(["applications"]);
    setShowNewApp(false);
    setAppForm({});
  };

  const handleUpdateApplication = async (id, payload) => {
    await updateApplication(id, payload);
    await queryClient.invalidateQueries(["applications"]);
  };

  const handleCreateTask = async () => {
    await createTask({
      ...taskForm,
      client_ids: [client.id],
    });

    await queryClient.invalidateQueries(["tasks"]);
    setShowNewTask(false);
    setTaskForm({});
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    await updateTask(selectedTask.id, selectedTask);
    await queryClient.invalidateQueries(["tasks"]);
    setSelectedTask(null);
  };

  const handleDeleteTask = async (id) => {
    await deleteTask(id);
    await queryClient.invalidateQueries(["tasks"]);
    setSelectedTask(null);
  };

  /**
   * 🔹 Render Guards
   */
  if (!client || !user) {
    return <div className="p-6">Loading...</div>;
  }

  /**
   * 🔹 UI
   */
  return (
    <div className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* APPLICATIONS */}
        <TabsContent value="applications">
          <Button onClick={() => setShowNewApp(true)}>Add Application</Button>

          {applications.map((app) => (
            <div
              key={app.id}
              className="border p-3 rounded mt-3 cursor-pointer"
              onClick={() => setSelectedApp(app)}
            >
              {app.position} @ {app.company}
            </div>
          ))}
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks">
          <Button onClick={() => setShowNewTask(true)}>Add Task</Button>

          {tasks.map((task) => (
            <div
              key={task.id}
              className="border p-3 rounded mt-3 cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              {task.title}
            </div>
          ))}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          {documents.map((doc) => (
            <div key={doc.id}>{doc.title}</div>
          ))}
        </TabsContent>
      </Tabs>

      {/* CREATE APPLICATION */}
      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <Input
            placeholder="Company"
            value={appForm.company || ""}
            onChange={(e) =>
              setAppForm((p) => ({ ...p, company: e.target.value }))
            }
          />
          <Input
            placeholder="Position"
            value={appForm.position || ""}
            onChange={(e) =>
              setAppForm((p) => ({ ...p, position: e.target.value }))
            }
          />

          <Button onClick={handleCreateApplication}>Save</Button>
        </DialogContent>
      </Dialog>

      {/* CREATE TASK */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <Input
            placeholder="Title"
            value={taskForm.title || ""}
            onChange={(e) =>
              setTaskForm((p) => ({ ...p, title: e.target.value }))
            }
          />
          <Textarea
            placeholder="Notes"
            value={taskForm.description || ""}
            onChange={(e) =>
              setTaskForm((p) => ({ ...p, description: e.target.value }))
            }
          />

          <Button onClick={handleCreateTask}>Save</Button>
        </DialogContent>
      </Dialog>

      {/* TASK DETAIL */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedTask && (
            <>
              <Input
                value={selectedTask.title}
                onChange={(e) =>
                  setSelectedTask((p) => ({
                    ...p,
                    title: e.target.value,
                  }))
                }
              />

              <Textarea
                value={selectedTask.notes || ""}
                onChange={(e) =>
                  setSelectedTask((p) => ({
                    ...p,
                    notes: e.target.value,
                  }))
                }
              />

              <div className="flex gap-2">
                <Button onClick={handleUpdateTask}>Save</Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
