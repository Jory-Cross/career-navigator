import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users, Clock, FileText, Briefcase, Plus, AlertTriangle,
  Target, CheckCircle2, Calendar, ChevronRight, ArrowLeft,
  ClipboardList, TrendingUp, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const STAFF_ROLES = ["admin", "management", "employee"];

const NOTE_TYPE_CONFIG = {
  support: { label: "Support Note", color: "bg-blue-100 text-blue-700" },
  incident: { label: "Incident Log", color: "bg-red-100 text-red-700" },
  observation: { label: "Observation", color: "bg-slate-100 text-slate-700" },
  progress_update: { label: "Progress Update", color: "bg-green-100 text-green-700" },
};

const GOAL_STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  achieved: { label: "Achieved", color: "bg-green-100 text-green-700" },
  discontinued: { label: "Discontinued", color: "bg-amber-100 text-amber-700" },
};

// ─── Support Notes Tab ───────────────────────────────────────────────────────
function SupportNotesTab({ clientId, isStaff }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ note_type: "support", severity: "low", date: new Date().toISOString().split("T")[0], start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ["support-notes", clientId],
    queryFn: () => base44.entities.SupportNote.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const sortedNotes = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date));

  const save = async () => {
    if (!form.content || !form.date) { toast.error("Date and content are required"); return; }
    setSaving(true);
    try {
      // Create support note
      await base44.entities.SupportNote.create({ ...form, client_id: clientId });
      
      // Create time entry if both times are set
      if (form.start_time && form.end_time) {
        const [startH, startM] = form.start_time.split(":");
        const [endH, endM] = form.end_time.split(":");
        const startDate = new Date(`${form.date}T${form.start_time}`);
        const endDate = new Date(`${form.date}T${form.end_time}`);
        let durationMs = endDate - startDate;
        if (durationMs < 0) durationMs += 24 * 60 * 60 * 1000; // Handle overnight
        const durationMinutes = Math.round(durationMs / 60000);
        
        await base44.entities.TimeEntry.create({
          client_id: clientId,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
          duration_minutes: durationMinutes,
          description: form.title || form.content?.substring(0, 50),
          category: "admin",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["support-notes", clientId] });
      queryClient.invalidateQueries({ queryKey: ["work-schedule", clientId] });
      setShowAdd(false);
      setForm({ note_type: "support", severity: "low", date: new Date().toISOString().split("T")[0], start_time: "", end_time: "" });
      toast.success("Note saved and time logged");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {isStaff && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
          </Button>
        </div>
      )}

      {sortedNotes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No notes yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map(note => {
            const config = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.support;
            return (
              <Card key={note.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("text-xs", config.color)}>{config.label}</Badge>
                      {note.note_type === "incident" && note.severity && (
                        <Badge className={cn("text-xs",
                          note.severity === "high" ? "bg-red-200 text-red-800" :
                          note.severity === "medium" ? "bg-orange-100 text-orange-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {note.severity === "high" && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                          {note.severity} severity
                        </Badge>
                      )}
                      {note.follow_up_required && (
                        <Badge className="text-xs bg-amber-100 text-amber-700">⚡ Follow-up Required</Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {format(new Date(note.date), "MMM d, yyyy")}
                    </span>
                  </div>
                  {note.title && <p className="text-sm font-semibold text-slate-800 mb-1">{note.title}</p>}
                  <p className="text-sm text-slate-600 whitespace-pre-line">{note.content}</p>
                  {note.follow_up_notes && (
                    <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                      <span className="font-semibold">Follow-up: </span>{note.follow_up_notes}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">Logged by: {note.created_by}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Support Note</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Note Type</Label>
                <Select value={form.note_type} onValueChange={v => setForm(p => ({ ...p, note_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support Note</SelectItem>
                    <SelectItem value="incident">Incident Log</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="progress_update">Progress Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            {form.note_type === "incident" && (
              <div>
                <Label className="text-xs">Severity</Label>
                <Select value={form.severity || "low"} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Title (optional)</Label>
              <Input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Note Content *</Label>
              <Textarea rows={5} value={form.content || ""} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={form.start_time || ""} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">End Time</Label>
                <Input type="time" value={form.end_time || ""} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-slate-400">Time entry will be logged automatically if both times are set</p>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="followup"
                checked={!!form.follow_up_required}
                onChange={e => setForm(p => ({ ...p, follow_up_required: e.target.checked }))}
                className="w-4 h-4"
              />
              <Label htmlFor="followup" className="text-xs cursor-pointer">Follow-up action required</Label>
            </div>
            {form.follow_up_required && (
              <div>
                <Label className="text-xs">Follow-up Notes</Label>
                <Textarea rows={2} value={form.follow_up_notes || ""} onChange={e => setForm(p => ({ ...p, follow_up_notes: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Goals Tab ───────────────────────────────────────────────────────────────
function GoalsTab({ clientId, isStaff }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ category: "employment", status: "not_started", progress_percent: 0 });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", clientId],
    queryFn: () => base44.entities.Goal.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const openAdd = () => {
    setForm({ category: "employment", status: "not_started", progress_percent: 0 });
    setEditGoal(null);
    setShowAdd(true);
  };

  const openEdit = (goal) => {
    setForm({ ...goal });
    setEditGoal(goal);
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.title) { toast.error("Goal title is required"); return; }
    setSaving(true);
    try {
      if (editGoal) {
        await base44.entities.Goal.update(editGoal.id, form);
      } else {
        await base44.entities.Goal.create({ ...form, client_id: clientId });
      }
      queryClient.invalidateQueries({ queryKey: ["goals", clientId] });
      setShowAdd(false);
      toast.success(editGoal ? "Goal updated" : "Goal added");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const activeGoals = goals.filter(g => g.status !== "achieved" && g.status !== "discontinued");
  const completedGoals = goals.filter(g => g.status === "achieved");

  return (
    <div className="space-y-4">
      {isStaff && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Goal
          </Button>
        </div>
      )}

      {goals.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No goals set yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Goals</p>
              {activeGoals.map(goal => {
                const statusCfg = GOAL_STATUS_CONFIG[goal.status] || GOAL_STATUS_CONFIG.not_started;
                return (
                  <Card key={goal.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-slate-800">{goal.title}</p>
                            <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{goal.category?.replace(/_/g, " ")}</Badge>
                          </div>
                          {goal.description && <p className="text-xs text-slate-500 mb-2">{goal.description}</p>}
                        </div>
                        {isStaff && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(goal)}>
                            Edit
                          </Button>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Progress</span>
                          <span className="font-medium">{goal.progress_percent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full transition-all",
                              (goal.progress_percent || 0) >= 100 ? "bg-green-500" :
                              (goal.progress_percent || 0) >= 60 ? "bg-blue-500" :
                              (goal.progress_percent || 0) >= 30 ? "bg-amber-500" : "bg-slate-400"
                            )}
                            style={{ width: `${goal.progress_percent || 0}%` }}
                          />
                        </div>
                      </div>

                      {goal.target_date && (
                        <p className="text-xs text-slate-400">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Target: {format(new Date(goal.target_date), "MMMM d, yyyy")}
                        </p>
                      )}
                      {goal.progress_notes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800 whitespace-pre-line">
                          {goal.progress_notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Achieved Goals ({completedGoals.length})
              </p>
              {completedGoals.map(goal => (
                <Card key={goal.id} className="border-0 shadow-sm opacity-75">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 line-through">{goal.title}</p>
                      <p className="text-xs text-slate-400 capitalize">{goal.category?.replace(/_/g, " ")}</p>
                    </div>
                    <Badge className="text-xs bg-green-100 text-green-700">Achieved</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editGoal ? "Edit Goal" : "Add Goal"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Goal Title *</Label>
              <Input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category || "employment"} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employment">Employment</SelectItem>
                    <SelectItem value="daily_living">Daily Living</SelectItem>
                    <SelectItem value="social_skills">Social Skills</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="job_retention">Job Retention</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status || "not_started"} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="achieved">Achieved</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Target Date</Label>
                <Input type="date" value={form.target_date || ""} onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Progress % (0–100)</Label>
                <Input
                  type="number" min="0" max="100"
                  value={form.progress_percent ?? 0}
                  onChange={e => setForm(p => ({ ...p, progress_percent: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Progress Notes</Label>
              <Textarea rows={3} value={form.progress_notes || ""} onChange={e => setForm(p => ({ ...p, progress_notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Work Schedule Tab ────────────────────────────────────────────────────────
function WorkScheduleTab({ clientId }) {
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["work-schedule", clientId],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const sorted = [...timeEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalHours = Math.round(sorted.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10) / 10;
  const thisMonthEntries = sorted.filter(t => {
    const now = new Date();
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthHours = Math.round(thisMonthEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10) / 10;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><Clock className="w-4 h-4 text-blue-600" /></div>
            <div>
              <p className="text-xl font-bold text-slate-900">{thisMonthHours}h</p>
              <p className="text-xs text-slate-500">This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><TrendingUp className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totalHours}h</p>
              <p className="text-xs text-slate-500">Total Hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {sorted.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No work sessions logged yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Work Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sorted.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-1.5 bg-slate-100 rounded mt-0.5 shrink-0">
                      <Briefcase className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{entry.description || "Work session"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{entry.date ? format(new Date(entry.date), "EEE, MMM d, yyyy") : ""}</span>
                        {entry.start_time && <span className="text-xs text-slate-400">{entry.start_time} – {entry.end_time || "?"}</span>}
                        <Badge variant="outline" className="text-xs capitalize">{entry.category?.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-0 shrink-0 text-xs font-semibold">
                    {Math.round((entry.duration_minutes || 0) / 60 * 10) / 10}h
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Client Detail View ───────────────────────────────────────────────────────
function ClientDetail({ client, onBack, isStaff }) {
  const { data: goals = [] } = useQuery({
    queryKey: ["goals", client.id],
    queryFn: () => base44.entities.Goal.filter({ client_id: client.id }),
    enabled: !!client.id,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["support-notes", client.id],
    queryFn: () => base44.entities.SupportNote.filter({ client_id: client.id }),
    enabled: !!client.id,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["work-schedule", client.id],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: client.id }),
    enabled: !!client.id,
  });

  const activeGoals = goals.filter(g => g.status === "in_progress").length;
  const recentIncidents = notes.filter(n => n.note_type === "incident").length;
  const totalHours = Math.round(timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10) / 10;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{client.first_name} {client.last_name}</h1>
          <p className="text-sm text-slate-400">{client.email}</p>
        </div>
        <Badge className={cn("text-xs",
          client.status === "active" ? "bg-emerald-100 text-emerald-700" :
          client.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
        )}>
          {client.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Goals", value: activeGoals, icon: Target, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Support Notes", value: notes.length, icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Total Hours", value: `${totalHours}h`, icon: Clock, color: "text-green-600", bg: "bg-green-50" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg shrink-0", stat.bg)}>
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

      {/* Info Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {client.phone && <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium text-slate-800">{client.phone}</p></div>}
            {client.location && <div><p className="text-xs text-slate-400">Location</p><p className="font-medium text-slate-800">{client.location}</p></div>}
            {client.target_role && <div><p className="text-xs text-slate-400">Current Role</p><p className="font-medium text-slate-800">{client.target_role}</p></div>}
            {client.industry && <div><p className="text-xs text-slate-400">Industry</p><p className="font-medium text-slate-800">{client.industry}</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList className="bg-slate-100 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="notes">
            Support Notes {recentIncidents > 0 && <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{recentIncidents}</span>}
          </TabsTrigger>
          <TabsTrigger value="goals">Goals & Progress ({goals.length})</TabsTrigger>
          <TabsTrigger value="schedule">Work Schedule ({timeEntries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="notes" className="mt-4">
          <SupportNotesTab clientId={client.id} isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab clientId={client.id} isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <WorkScheduleTab clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────
export default function DspdPortal() {
  const [user, setUser] = useState(null);
  const [selfClient, setSelfClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        if (me.role === "dspd") {
          const all = await base44.entities.Client.list();
          const found = all.find(c => c.email === me.email);
          if (found) setSelfClient(found);
        }
      } catch {}
      finally { setLoading(false); }
    };
    init();
  }, []);

  const isStaff = STAFF_ROLES.includes(user?.role);

  const { data: dspdClients = [], refetch: refetchDspd } = useQuery({
    queryKey: ["dspd-clients"],
    queryFn: () => base44.entities.Client.filter({ client_type: "dspd" }),
    enabled: !!user && isStaff,
  });

  const deleteClient = async (e, clientId) => {
    e.stopPropagation();
    if (!confirm("Delete this client? This cannot be undone.")) return;
    await base44.entities.Client.delete(clientId);
    refetchDspd();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  // Self-view for dspd role clients
  if (user?.role === "dspd") {
    if (!selfClient) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-slate-600">Your client record was not found. Please contact your support specialist.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Support Portal</h1>
          <p className="text-sm text-slate-500 mt-1">DSPD Supported Employment Services</p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
              {selfClient.first_name[0]}{selfClient.last_name[0]}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{selfClient.first_name} {selfClient.last_name}</h2>
              <p className="text-sm text-slate-500">{selfClient.email}</p>
              {selfClient.target_role && <Badge variant="outline" className="text-xs mt-1">{selfClient.target_role}</Badge>}
            </div>
          </CardContent>
        </Card>
        <Tabs defaultValue="goals">
          <TabsList className="bg-slate-100 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="goals">My Goals</TabsTrigger>
            <TabsTrigger value="schedule">My Work Schedule</TabsTrigger>
            <TabsTrigger value="notes">My Support Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="goals" className="mt-4"><GoalsTab clientId={selfClient.id} isStaff={false} /></TabsContent>
          <TabsContent value="schedule" className="mt-4"><WorkScheduleTab clientId={selfClient.id} /></TabsContent>
          <TabsContent value="notes" className="mt-4"><SupportNotesTab clientId={selfClient.id} isStaff={false} /></TabsContent>
        </Tabs>
      </div>
    );
  }

  // Staff view
  if (!isStaff) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Access denied.</div>;
  }

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClient(null)} isStaff={true} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">DSPD Portal</h1>
        <p className="text-sm text-slate-500 mt-1">Supported Employment — {dspdClients.length} client{dspdClients.length !== 1 ? "s" : ""}</p>
      </div>

      {dspdClients.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No DSPD clients found</p>
          <p className="text-slate-400 text-sm mt-1">Add clients with client type "dspd" to see them here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dspdClients.map(client => (
            <Card
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {client.first_name?.[0]}{client.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{client.first_name} {client.last_name}</h3>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{client.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={cn("text-xs border-0",
                      client.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      client.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {client.status}
                    </Badge>
                    {client.target_role && (
                      <span className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Briefcase className="w-3 h-3 shrink-0" />{client.target_role}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteClient(e, client.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}