import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import {
  createTask,
  updateTask,
  archiveTask,
  deleteTask,
  organizeTaskNotes,
} from "@/lib/api/clientPortalApi";

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function emptyTaskForm(clientId) {
  return {
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    due_date: "",
    category: "follow_up",
    client_ids: clientId ? [clientId] : [],
    checklist: [],
  };
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function TasksSection({ clientId, tasks = [], onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(() => emptyTaskForm(clientId));
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [organizingNotes, setOrganizingNotes] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const visibleTasks = useMemo(() => {
  return showArchived ? tasks : tasks.filter((t) => !t.is_archived);
}, [tasks, showArchived]);

const pending = useMemo(
  () => visibleTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled"),
  [visibleTasks]
);

  const completed = useMemo(
  () => visibleTasks.filter((t) => t.status === "completed"),
  [visibleTasks]
);

  const u = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const openNew = () => {
    setForm(emptyTaskForm(clientId));
    setEditId(null);
    setShowNew(true);
  };

  const openEdit = (task) => {
    setForm({
      id: task.id,
      title: task.title || "",
      description: task.description || "",
      status: task.status || "pending",
      priority: task.priority || "medium",
      due_date: task.due_date || "",
      category: task.category || "follow_up",
      client_ids: Array.isArray(task.client_ids) ? task.client_ids : [],
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      notes: task.notes || "",
    });
    setEditId(task.id);
    setShowNew(true);
  };

  const closeDialog = () => {
    if (saving || organizingNotes) return;
    setShowNew(false);
    setEditId(null);
    setForm(emptyTaskForm(clientId));
  };

    const handleSave = async () => {
    if (!form.title?.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!clientId) {
      toast.error("Client is required");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: form.title || "",
        description: form.description || "",
        notes: form.notes || "",
        status: form.status || "pending",
        priority: form.priority || "medium",
        due_date: form.due_date || null,
        category: form.category || "follow_up",
        client_ids: [clientId],
        checklist: Array.isArray(form.checklist) ? form.checklist : [],
      };

      if (editId) {
        await updateTask(editId, payload);
        toast.success("Task updated");
      } else {
        await createTask(payload);
        toast.success("Task created");
      }

      closeDialog();
      onRefresh?.();
    } catch (error) {
      console.error("Failed to save task:", error);
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (task, e) => {
    e.stopPropagation();

    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      await updateTask(task.id, {
        ...task,
        status: newStatus,
      });
      onRefresh?.();
    } catch (error) {
      console.error("Failed to update task status:", error);
      toast.error("Failed to update task");
    }
  };

  const organizeNotes = async () => {
    const raw = form.description?.trim();

    if (!raw) {
      toast.error("Add some notes first");
      return;
    }

    setOrganizingNotes(true);

    try {
      const result = await organizeTaskNotes(raw);
      u("description", result || raw);
      toast.success("Notes organized");
    } catch (error) {
      console.error("Failed to organize notes:", error);
      toast.error("Failed to organize notes");
    } finally {
      setOrganizingNotes(false);
    }
  };

  const addChecklistItem = () => {
    const current = Array.isArray(form.checklist) ? form.checklist : [];
    u("checklist", [...current, { text: "", completed: false }]);
  };

  const updateChecklistItem = (index, text) => {
    const current = [...(form.checklist || [])];
    current[index] = {
      ...(current[index] || { completed: false }),
      text,
    };
    u("checklist", current);
  };

  const removeChecklistItem = (index) => {
    const current = [...(form.checklist || [])];
    current.splice(index, 1);
    u("checklist", current);
  };

  const handleArchive = async () => {
    if (!editId) return;

    try {
      await archiveTask(editId);
      toast.success("Task archived");
      closeDialog();
      onRefresh?.();
    } catch (err) {
      console.error("Archive failed", err);
      toast.error("Failed to archive task");
    }
  };

  const handleDelete = async () => {
    if (!editId) return;

    if (!confirm("Delete this task permanently?")) return;

    try {
      await deleteTask(editId);
      toast.success("Task deleted");
      closeDialog();
      onRefresh?.();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete task");
    }
  };
  
   return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900">
            Tasks ({pending.length} active)
          </h3>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>

        <Button type="button" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {pending.length === 0 && completed.length === 0 ? (
        <Card className="border-slate-100 p-8 text-center text-sm text-slate-400">
          No tasks yet
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {pending.map((task) => (
              <Card
                key={task.id}
                className="cursor-pointer border-slate-100 p-4 transition-shadow hover:shadow-sm"
                onClick={() => openEdit(task)}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={(e) => toggleComplete(task, e)}
                    className="mt-0.5 shrink-0"
                  >
                    <CheckCircle2 className="h-5 w-5 text-slate-300 transition-colors hover:text-emerald-500" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {task.title}
                      </h4>

                      {task.priority ? (
                        <Badge
                          className={cn(
                            "border-0",
                            priorityColors[task.priority] || "bg-slate-100 text-slate-600"
                          )}
                        >
                          {task.priority}
                        </Badge>
                      ) : null}

                      {task.status ? (
                        <Badge
                          className={cn(
                            "border-0",
                            statusColors[task.status] || "bg-slate-100 text-slate-600"
                          )}
                        >
                          {task.status.replace(/_/g, " ")}
                        </Badge>
                      ) : null}

                      {task.client_completed_at && (
                        <Badge className="border-0 bg-purple-100 text-purple-700">
                          client completed
                        </Badge>
                      )}

                      {task.due_date && safeDate(task.due_date) ? (
                        <span className="text-xs text-slate-500">
                          {format(safeDate(task.due_date), "MMM d")}
                        </span>
                      ) : null}

                      {Array.isArray(task.checklist) && task.checklist.length > 0 ? (
                        <span className="text-xs text-slate-500">
                          {task.checklist.filter((c) => c.completed).length}/
                          {task.checklist.length} ✓
                        </span>
                      ) : null}
                    </div>

                    {task.description ? (
                      <p className="whitespace-pre-wrap text-sm text-slate-600">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold text-slate-500">
                Completed ({completed.length})
              </h4>

              <div className="space-y-2">
                {completed.slice(0, 5).map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer border-slate-100 p-3 opacity-70"
                    onClick={() => openEdit(task)}
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>{task.title}</span>

                      {task.client_completed_at && (
                        <span className="text-xs text-purple-600">
                          (client completed)
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
              <Dialog open={showNew} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title || ""}
                onChange={(e) => u("title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description / Notes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={organizeNotes}
                  disabled={organizingNotes}
                >
                  {organizingNotes ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                  )}
                  AI Organize
                </Button>
              </div>

              <Textarea
                value={form.description || ""}
                onChange={(e) => u("description", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Assigned Client</Label>
              <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                This task will be assigned to this client.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select
                  value={form.priority || "medium"}
                  onValueChange={(v) => u("priority", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status || "pending"}
                  onValueChange={(v) => u("status", v)}
                >
                  <SelectTrigger>
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
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {editId && (
                <>
                  <Button type="button" variant="outline" onClick={handleArchive}>
                    Archive
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
