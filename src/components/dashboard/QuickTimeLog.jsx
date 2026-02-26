import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function QuickTimeLog({ clients, onTimeSaved }) {
  const [clientId, setClientId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("consultation");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientId || !minutes) return;
    setSaving(true);
    await base44.entities.TimeEntry.create({
      client_id: clientId,
      date: new Date().toISOString().split("T")[0],
      duration_minutes: parseInt(minutes),
      description: description || "Manual entry",
      category,
    });
    setClientId("");
    setMinutes("");
    setDescription("");
    setSaving(false);
    toast.success("Time logged");
    if (onTimeSaved) onTimeSaved();
  };

  return (
    <Card className="border-0 shadow-sm">
      <div className="h-1 w-full bg-violet-50" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Plus className="w-4 h-4" />
          <span>Quick Log</span>
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue placeholder="Select client..." />
          </SelectTrigger>
          <SelectContent>
            {clients.filter(c => c.status === "active" && !c.is_archived).map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Minutes"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            className="border-slate-200 text-sm w-24"
          />
          <Input
            placeholder="Description..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="border-slate-200 text-sm flex-1"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consultation">Consultation</SelectItem>
            <SelectItem value="resume_work">Resume Work</SelectItem>
            <SelectItem value="job_search">Job Search</SelectItem>
            <SelectItem value="interview_prep">Interview Prep</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleSave}
          disabled={!clientId || !minutes || saving}
        >
          <Clock className="w-4 h-4 mr-2" /> Log Time
        </Button>
      </div>
    </Card>
  );
}