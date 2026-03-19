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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("consultation");
  const [saving, setSaving] = useState(false);

  const calculateDuration = () => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  const handleSave = async () => {
    if (!clientId || !startTime || !endTime) return;
    const duration = calculateDuration();
    if (duration <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    
    await base44.entities.TimeEntry.create({
      client_id: clientId,
      date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: duration,
      description: description || "Manual entry",
      category,
    });

    // Create calendar appointment
    const startDateTime = `${date}T${startTime}`;
    const endDateTime = `${date}T${endTime}`;
    
    await base44.entities.Meeting.create({
      client_id: clientId,
      title: description || "Manual entry",
      meeting_type: category,
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      status: "completed"
    });

    setClientId("");
    setDate(new Date().toISOString().split("T")[0]);
    setStartTime("");
    setEndTime("");
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
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border-slate-200 text-sm"
        />
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="time"
              placeholder="Start time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="border-slate-200 text-sm flex-1"
            />
            <Input
              type="time"
              placeholder="End time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="border-slate-200 text-sm flex-1"
            />
          </div>
          {startTime && endTime && (
            <p className="text-xs text-slate-500">
              Duration: {calculateDuration()} minutes
            </p>
          )}
        </div>
        <Input
          placeholder="Description..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border-slate-200 text-sm"
        />
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
            <SelectItem value="job_coaching">Job Coaching</SelectItem>
            <SelectItem value="life_skills">Life Skills</SelectItem>
            <SelectItem value="cbh">CBH</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleSave}
          disabled={!clientId || !startTime || !endTime || saving}
        >
          <Clock className="w-4 h-4 mr-2" /> Log Time
        </Button>
      </div>
    </Card>
  );
}