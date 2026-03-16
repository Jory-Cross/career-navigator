import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckCircle2, AlertTriangle, Filter, X, Sparkles, Loader2, Users } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700"
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500"
};

const emptyForm = { title: "", description: "", status: "pending", priority: "medium", due_date: "", category: "follow_up", client_ids: [], checklist: [] };

export default function Tasks() {
  const [user, setUser] = useState(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [organizingNotes, setOrganizingNotes] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      if (!user) return all;
      if (user.role === "admin" || user.role === "management") return all;
      return all.filter(c => c.assigned_employee_id === user.id);
    },
    enabled: !!user
  });

  const clientIds = allClients.map(c => c.id);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_page", user?.id, clientIds.join(",")],
    queryFn: async () => {
      const all = await base44.entities.Task.list("-created_date");
      if (!user) return all;
      if (user.role === "admin" || user.role === "management") return all;
      // Employee: tasks linked to their clients OR created by them (self tasks)
      return all.filter(t =>
        t.created_by === user.email ||
        (t.client_ids && t.client_ids.some(id => clientIds.includes(id)))
      );
    },
    enabled: !!user && allClients.length >= 0
  });

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowNew(true);
  };

  const openEdit = (task) => {
    setForm({ ...task });
    setEditId(task.id);
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    if (editId) {
      await base44.entities.Task.update(editId, form);
      toast.success("Task updated");
    } else {
      await base44.entities.Task.create(form);
      toast.success("Task created");
    }
    setSaving(false);
    setShowNew(false);
    queryClient.invalidateQueries({ queryKey: ["tasks_page"] });
  };

  const toggleComplete = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await base44.entities.Task.update(task.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["tasks_page"] });
  };

  const toggleClient = (cId) => {
    const current = form.client_ids || [];
    u("client_ids", current.includes(cId) ? current.filter(id => id !== cId) : [...current, cId]);
  };

  const organizeNotes = async () => {
    if (!form.description?.trim()) { toast.error("Add notes first"); return; }
    setOrganizingNotes(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Organize these raw notes into clear, actionable bullet points. Be concise. Return only the organized notes.\n\n${form.description}`
    });
    u("description", result);
    setOrganizingNotes(false);
    toast.success("Notes organized!");
  };

  const addChecklistItem = () => u("checklist", [...(form.checklist || []), { text: "", completed: false }]);
  const updateChecklistItem = (i, text) => { const c = [...(form.checklist || [])]; c[i].text = text; u("checklist", c); };
  const removeChecklistItem = (i) => { const c = [...(form.checklist || [])]; c.splice(i, 1); u("checklist", c); };

  const getClientName = (id) => {
    const c = allClients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : null;
  };

  const getTaskClientNames = (task) => {
    if (!task.client_ids || task.client_ids.length === 0) return "Self / No client";
    const names = task.client_ids.map(getClientName).filter(Boolean);
    return names.length > 0 ? names.join(", ") : "—";
  };

  const filtered = tasks.filter(t => {
    if (clientFilter !== "all") {
      if (clientFilter === "self") {
        if (t.client_ids && t.client_ids.length > 0) return false;
      } else {
        if (!t.client_ids || !t.client_ids.includes(clientFilter)) return false;
      }
    }
    if (statusFilter === "active") return t.status === "pending" || t.status === "in_progress";
    if (statusFilter === "completed") return t.status === "completed";
    return true;
  });

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">{activeTasks.length} active task{activeTasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Task</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48 border-slate-200 text-sm"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="self">Self / No Client</SelectItem>
            {allClients.filter(c => !c.is_archived).map(c => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <Card className="border-0 shadow-sm">
        <div className="divide-y divide-slate-50">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No tasks found</div>
          ) : filtered.map(task => {
            const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== "completed";
            return (
              <div
                key={task.id}
                className="p-4 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => openEdit(task)}
              >
                <button
                  onClick={e => { e.stopPropagation(); toggleComplete(task); }}
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    task.status === "completed"
                      ? "bg-emerald-400 border-emerald-400"
                      : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50"
                  )}
                >
                  {task.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-slate-800", task.status === "completed" && "line-through text-slate-400")}>{task.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{getTaskClientNames(task)}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge className={cn("text-[10px] border-0", priorityColors[task.priority])}>{task.priority}</Badge>
                    <Badge className={cn("text-[10px] border-0", statusColors[task.status])}>{task.status?.replace(/_/g, " ")}</Badge>
                    {task.category && <Badge className="text-[10px] border-0 bg-purple-50 text-purple-700">{task.category?.replace(/_/g, " ")}</Badge>}
                    {task.due_date && (
                      <span className={cn("text-[10px] font-medium flex items-center gap-0.5", overdue ? "text-red-500" : "text-slate-400")}>
                        {overdue && <AlertTriangle className="w-3 h-3" />}
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}
                    {task.checklist?.length > 0 && (
                      <span className="text-[10px] text-slate-400">{task.checklist.filter(c => c.completed).length}/{task.checklist.length} ✓</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Task Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label className="text-xs text-slate-500">Title *</Label><Input value={form.title || ""} onChange={e => u("title", e.target.value)} /></div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500">Notes</Label>
                <Button type="button" size="sm" variant="ghost" onClick={organizeNotes} disabled={organizingNotes} className="h-6 text-xs text-purple-600 hover:bg-purple-50 px-2">
                  {organizingNotes ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />} AI Organize
                </Button>
              </div>
              <Textarea value={form.description || ""} onChange={e => u("description", e.target.value)} rows={3} placeholder="Add notes..." />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> Assign to Clients (optional)</Label>
              <div className="border border-slate-200 rounded-lg p-3 max-h-36 overflow-y-auto space-y-2">
                {allClients.filter(c => c.status === "active" && !c.is_archived).map(client => (
                  <div key={client.id} className="flex items-center gap-2">
                    <Checkbox id={`c-${client.id}`} checked={(form.client_ids || []).includes(client.id)} onCheckedChange={() => toggleClient(client.id)} />
                    <label htmlFor={`c-${client.id}`} className="text-sm text-slate-700 cursor-pointer">{client.first_name} {client.last_name}</label>
                  </div>
                ))}
              </div>
              {(form.client_ids || []).length === 0 && <p className="text-xs text-slate-400">No client selected — task will be for yourself</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Priority</Label>
                <Select value={form.priority || "medium"} onValueChange={v => u("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={form.status || "pending"} onValueChange={v => u("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select value={form.category || "follow_up"} onValueChange={v => u("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="resume">Resume</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                    <SelectItem value="interview_prep">Interview Prep</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs text-slate-500">Due Date</Label><Input type="date" value={form.due_date || ""} onChange={e => u("due_date", e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500">Checklist</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addChecklistItem} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              {(form.checklist || []).length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded-lg p-3">
                  {form.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input placeholder="Checklist item..." value={item.text} onChange={e => updateChecklistItem(idx, e.target.value)} className="text-sm" />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeChecklistItem(idx)} className="h-8 w-8 shrink-0"><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}