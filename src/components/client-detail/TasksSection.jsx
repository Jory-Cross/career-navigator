import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckCircle2, Users, X, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function TasksSection({ clientId, tasks, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list()
  });

  const openNew = () => {
    setForm({ title: "", description: "", status: "pending", priority: "medium", due_date: "", category: "follow_up", client_ids: clientId ? [clientId] : [], checklist: [] });
    setEditId(null);
    setShowNew(true);
  };

  const openEdit = (task) => {
    setForm({ ...task });
    setEditId(task.id);
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!form.client_ids || form.client_ids.length === 0) {
      toast.error("Please select at least one client");
      return;
    }
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
    onRefresh();
  };

  const toggleComplete = async (task, e) => {
    e.stopPropagation();
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await base44.entities.Task.update(task.id, { status: newStatus });
    onRefresh();
  };

  const [organizingNotes, setOrganizingNotes] = useState(false);
  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const organizeNotes = async () => {
    const raw = form.description?.trim();
    if (!raw) { toast.error("Add some notes first"); return; }
    setOrganizingNotes(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a professional career coach assistant. Take the following raw notes and organize them into clear, actionable bullet points. Keep all the key information but make it concise and well-structured. Return only the organized notes, no extra commentary.\n\nRaw notes:\n${raw}`,
    });
    u("description", result);
    setOrganizingNotes(false);
    toast.success("Notes organized!");
  };

  const toggleClient = (cId) => {
    const current = form.client_ids || [];
    if (current.includes(cId)) {
      u("client_ids", current.filter(id => id !== cId));
    } else {
      u("client_ids", [...current, cId]);
    }
  };

  const addChecklistItem = () => {
    const current = form.checklist || [];
    u("checklist", [...current, { text: "", completed: false }]);
  };

  const updateChecklistItem = (index, text) => {
    const current = [...(form.checklist || [])];
    current[index].text = text;
    u("checklist", current);
  };

  const removeChecklistItem = (index) => {
    const current = [...(form.checklist || [])];
    current.splice(index, 1);
    u("checklist", current);
  };

  const pending = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
  const completed = tasks.filter(t => t.status === "completed");

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Tasks ({pending.length} active)</h3>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
        <div className="divide-y divide-slate-50">
          {pending.length === 0 && completed.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No tasks yet</div>
          ) : (
            <>
              {pending.map(task => (
                <div key={task.id} className="p-4 flex items-start gap-3 hover:bg-slate-25 cursor-pointer" onClick={() => openEdit(task)}>
                  <button onClick={(e) => toggleComplete(task, e)} className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-200 hover:border-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{task.title}</p>
                    {task.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={cn("text-[10px] border-0", priorityColors[task.priority])}>{task.priority}</Badge>
                      <Badge className={cn("text-[10px] border-0", statusColors[task.status])}>{task.status?.replace(/_/g, " ")}</Badge>
                      {task.due_date && <span className="text-[10px] text-slate-400">{format(new Date(task.due_date), "MMM d")}</span>}
                      {task.checklist?.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {task.checklist.filter(c => c.completed).length}/{task.checklist.length} ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {completed.length > 0 && (
                <div className="p-3 bg-slate-25">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 px-1">Completed ({completed.length})</p>
                  {completed.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center gap-2 px-1 py-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs text-slate-400 line-through truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1"><Label className="text-xs text-slate-500">Title *</Label><Input value={form.title || ""} onChange={e => u("title", e.target.value)} /></div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500">Description / Notes</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={organizeNotes}
                  disabled={organizingNotes}
                  className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2"
                >
                  {organizingNotes ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  AI Organize
                </Button>
              </div>
              <Textarea value={form.description || ""} onChange={e => u("description", e.target.value)} rows={3} placeholder="Jot down raw thoughts — AI can organize them for you..." />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Assign to Clients *
              </Label>
              <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {allClients.filter(c => c.status === "active" && !c.is_archived).map(client => (
                  <div key={client.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`client-${client.id}`}
                      checked={(form.client_ids || []).includes(client.id)}
                      onCheckedChange={() => toggleClient(client.id)}
                    />
                    <label htmlFor={`client-${client.id}`} className="text-sm text-slate-700 cursor-pointer">
                      {client.first_name} {client.last_name}
                    </label>
                  </div>
                ))}
              </div>
              {(form.client_ids || []).length > 0 && (
                <p className="text-xs text-slate-500">{form.client_ids.length} client(s) selected</p>
              )}
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
              <div className="space-y-1"><Label className="text-xs text-slate-500">Due Date</Label><Input type="date" value={form.due_date || ""} onChange={e => u("due_date", e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500">Todo Checklist</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addChecklistItem} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              {(form.checklist || []).length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded-lg p-3">
                  {form.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Checklist item..."
                        value={item.text}
                        onChange={(e) => updateChecklistItem(idx, e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeChecklistItem(idx)}
                        className="h-8 w-8 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}