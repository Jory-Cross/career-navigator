import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Square, Clock, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function ActiveTimer({ clients, onTimeSaved }) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedClient, setSelectedClient] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("consultation");
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    if (!selectedClient) return;
    setIsRunning(true);
    startTimeRef.current = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const handleStop = async () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    const durationMinutes = Math.max(1, Math.round(seconds / 60));
    const endTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const date = new Date().toISOString().split("T")[0];

    await base44.entities.TimeEntry.create({
      client_id: selectedClient,
      date,
      duration_minutes: durationMinutes,
      description: description || "Session",
      category,
      start_time: startTimeRef.current,
      end_time: endTime
    });

    // Create calendar appointment
    const startDateTime = `${date}T${startTimeRef.current}`;
    const endDateTime = `${date}T${endTime}`;
    
    await base44.entities.Meeting.create({
      client_id: selectedClient,
      title: description || "Session",
      meeting_type: category,
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      status: "completed"
    });

    setSeconds(0);
    setDescription("");
    if (onTimeSaved) onTimeSaved();
  };

  const clientName = clients.find(c => c.id === selectedClient);

  return (
    <Card className={cn(
      "border-0 shadow-sm overflow-hidden transition-all duration-500",
      isRunning ? "ring-2 ring-emerald-400/50 shadow-emerald-100" : ""
    )}>
      <div className={cn(
        "h-1 w-full transition-colors duration-500",
        isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-100"
      )} />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Clock className="w-4 h-4" />
          <span>Time Tracker</span>
        </div>

        <div className="text-center">
          <p className={cn(
            "text-4xl font-mono font-bold tracking-wider transition-colors",
            isRunning ? "text-emerald-600" : "text-slate-300"
          )}>
            {formatTime(seconds)}
          </p>
          {isRunning && clientName && (
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
              <User className="w-3 h-3" />
              {clientName.first_name} {clientName.last_name}
            </p>
          )}
        </div>

        {!isRunning && (
          <div className="space-y-2.5">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
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
              placeholder="What are you working on?"
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
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          className={cn(
            "w-full transition-all duration-300",
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
          onClick={isRunning ? handleStop : handleStart}
          disabled={!isRunning && !selectedClient}
        >
          {isRunning ? (
            <><Square className="w-4 h-4 mr-2" /> Stop & Save</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Start Timer</>
          )}
        </Button>
      </div>
    </Card>
  );
}