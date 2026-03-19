import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const catColors = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  job_coaching: "bg-orange-50 text-orange-700",
  life_skills: "bg-pink-50 text-pink-700",
  cbh: "bg-purple-50 text-purple-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600"
};

export default function TimeLogSection({ timeEntries, clientId, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    duration_minutes: "",
    description: "",
    category: "consultation",
    start_time: "",
    end_time: ""
  });
  const [saving, setSaving] = useState(false);

  const totalMinutes = timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  const sorted = [...timeEntries].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const handleAdd = () => {
    setEditingEntry(null);
    setForm({
      date: format(new Date(), "yyyy-MM-dd"),
      duration_minutes: "",
      description: "",
      category: "consultation",
      start_time: "",
      end_time: ""
    });
    setShowAdd(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      date: entry.date || format(new Date(), "yyyy-MM-dd"),
      duration_minutes: entry.duration_minutes?.toString() || "",
      description: entry.description || "",
      category: entry.category || "consultation",
      start_time: entry.start_time || "",
      end_time: entry.end_time || ""
    });
    setShowAdd(true);
  };

  const handleDelete = async (entryId) => {
    if (!confirm("Delete this time entry?")) return;
    try {
      await base44.entities.TimeEntry.delete(entryId);
      toast.success("Entry deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  const handleSave = async () => {
    if (!form.date) {
      toast.error("Date is required");
      return;
    }

    // Auto-calculate duration from start/end times if needed
    let duration = parseInt(form.duration_minutes) || 0;
    if (form.start_time && form.end_time && !form.duration_minutes) {
      const [startHour, startMin] = form.start_time.split(':').map(Number);
      const [endHour, endMin] = form.end_time.split(':').map(Number);
      duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    if (!duration || duration <= 0) {
      toast.error("Please enter duration or set start/end times");
      return;
    }

    // Duplicate check: same client, same date, and same start_time (if provided)
    const duplicate = timeEntries.find(te => {
      if (te.date !== form.date) return false;
      if (form.start_time && te.start_time) return te.start_time === form.start_time;
      // If no start_time, check if an entry already exists on the same date
      if (!form.start_time && !te.start_time) return true;
      return false;
    });

    if (duplicate) {
      toast.error(
        `A time entry for this client on ${form.date}${form.start_time ? ` at ${form.start_time}` : ""} already exists. Only one entry is allowed per time slot.`,
        { duration: 5000 }
      );
      return;
    }

    setSaving(true);
    try {
      if (editingEntry) {
        await base44.entities.TimeEntry.update(editingEntry.id, {
          date: form.date,
          duration_minutes: duration,
          description: form.description,
          category: form.category,
          start_time: form.start_time || undefined,
          end_time: form.end_time || undefined
        });
        toast.success("Time entry updated");
      } else {
        await base44.entities.TimeEntry.create({
          client_id: clientId,
          date: form.date,
          duration_minutes: duration,
          description: form.description,
          category: form.category,
          start_time: form.start_time || undefined,
          end_time: form.end_time || undefined
        });

        // Create a calendar entry for new entries only
        try {
          const startTime = form.start_time || "09:00";
          const startDateTime = new Date(`${form.date}T${startTime}`);
          const endDateTime = form.end_time
            ? new Date(`${form.date}T${form.end_time}`)
            : new Date(startDateTime.getTime() + duration * 60000);

          await base44.entities.Meeting.create({
            client_id: clientId,
            title: form.description || form.category.replace(/_/g, ' '),
            description: form.description,
            meeting_type: form.category,
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            status: 'completed',
            location: 'Time Entry'
          });
        } catch (meetingError) {
          console.error("Failed to create calendar entry:", meetingError);
        }
        toast.success("Time entry added");
      }
      setShowAdd(false);
      setEditingEntry(null);
      onRefresh();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error("Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Time Log</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <Clock className="w-4 h-4" />
              {totalHours}h total
            </div>
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      <div className="divide-y divide-slate-50">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No time logged yet</div>
        ) : sorted.map(entry => (
          <div key={entry.id} className="p-4 flex items-center gap-3 group">
            <div className="text-right shrink-0 w-14">
              <p className="text-sm font-semibold text-slate-800">{entry.duration_minutes}m</p>
              {entry.start_time && <p className="text-[10px] text-slate-400">{entry.start_time}</p>}
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 truncate">{entry.description || "Session"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={cn("text-[10px] border-0", catColors[entry.category])}>{entry.category?.replace(/_/g, " ")}</Badge>
                {entry.date && <span className="text-[10px] text-slate-400">{format(new Date(entry.date), "MMM d")}</span>}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(entry)}>
                <Pencil className="w-3 h-3 text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(entry.id)}>
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Dialog open={showAdd} onOpenChange={setShowAdd}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={e => u("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Duration (minutes)</Label>
              <Input type="number" value={form.duration_minutes} onChange={e => u("duration_minutes", e.target.value)} placeholder="60" />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={v => u("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="resume_work">Resume Work</SelectItem>
                <SelectItem value="job_search">Job Search</SelectItem>
                <SelectItem value="interview_prep">Interview Prep</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="job_coaching">Job Coaching</SelectItem>
                <SelectItem value="life_skills">Life Skills</SelectItem>
                <SelectItem value="cbh">CBH</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => u("description", e.target.value)} placeholder="What did you work on?" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Time (optional)</Label>
              <Input type="time" value={form.start_time} onChange={e => u("start_time", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End Time (optional)</Label>
              <Input type="time" value={form.end_time} onChange={e => u("end_time", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingEntry ? "Save Changes" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}