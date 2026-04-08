import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Clock, User, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import EntryTypePicker from "@/components/time-entry/EntryTypePicker";
import JobCoachingTimeEntryForm from "@/components/time-entry/JobCoachingTimeEntryForm";

export default function ActiveTimer({ clients, onTimeSaved }) {
   const [isRunning, setIsRunning] = useState(false);
   const [seconds, setSeconds] = useState(0);
   const [selectedClient, setSelectedClient] = useState("");
   const [description, setDescription] = useState("");
   const [selectedEntryType, setSelectedEntryType] = useState(null);
   const [saving, setSaving] = useState(false);
   const [showJobCoachingForm, setShowJobCoachingForm] = useState(false);
   const intervalRef = useRef(null);
   const startTimeRef = useRef(null);
   const startDateRef = useRef(null);

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

  // Route to Job Coaching form if selected
  useEffect(() => {
    if (selectedEntryType?.code === "job_coaching" && selectedClient) {
      setShowJobCoachingForm(true);
    }
  }, [selectedEntryType?.code, selectedClient]);

  const handleStart = () => {
     if (!selectedClient || !selectedEntryType) {
       toast.error("Please select a client and service type");
       return;
     }
     if (selectedEntryType?.code === "job_coaching") {
       setShowJobCoachingForm(true);
       return;
     }
     setIsRunning(true);
     startTimeRef.current = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
     startDateRef.current = new Date().toISOString().split("T")[0];
   };

  const handleStop = async () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    setSaving(true);

    try {
      const durationMinutes = Math.max(1, Math.round(seconds / 60));
      const endTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      const date = startDateRef.current || new Date().toISOString().split("T")[0];
      const actualClientId = selectedClient?.startsWith('self:') ? null : selectedClient;

      // DUAL-WRITE: Use standardized submission function
      await submitTimeEntryWithDualWrite({
        clientId: actualClientId,
        entryTypeId: selectedEntryType?.id,
        entryTypeCode: selectedEntryType?.code,
        date,
        startTime: startTimeRef.current,
        endTime: endTime,
        durationMinutes,
        location: null,
        description: description || selectedEntryType?.name || "Timer session",
        serviceAuthorizationId: null,
        fieldAnswers: {},
        asDraft: true // Save as draft since we may not have all required fields
      });

      toast.success("Time logged");
      setSeconds(0);
      setDescription("");
      setSelectedEntryType(null);
      setSelectedClient("");
      if (onTimeSaved) onTimeSaved();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error("Failed to log time");
    } finally {
      setSaving(false);
    }
  };

  const clientName = clients.find(c => c.id === selectedClient);

  if (showJobCoachingForm && selectedClient) {
    return (
      <Card className={cn("border-0 shadow-sm overflow-hidden")}>
        <div className="h-1 w-full bg-emerald-400" />
        <div className="p-5">
          <div className="mb-4">
            <button
              className="text-sm text-slate-500 hover:text-slate-700"
              onClick={() => {
                setShowJobCoachingForm(false);
                setSelectedEntryType(null);
              }}
            >
              ← Back
            </button>
          </div>
          <JobCoachingTimeEntryForm
            clientId={selectedClient}
            onSuccess={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
              setSelectedClient("");
              setDescription("");
              setSeconds(0);
              onTimeSaved();
            }}
            onCancel={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
            }}
          />
        </div>
      </Card>
    );
  }

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
                <SelectItem value="self:true">👤 Myself (no client)</SelectItem>
                {clients.filter(c => c.status === "active" && !c.is_archived).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Description (optional)..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border-slate-200 text-sm"
            />

            {/* Entry Type Picker - compact mode */}
            <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
              <label className="text-xs font-medium text-slate-700 block mb-1.5">Service Type *</label>
              <EntryTypePicker
                value={selectedEntryType?.id}
                onChange={setSelectedEntryType}
                mode="compact"
                showDescriptions={false}
                groupByProgram={false}
              />
            </div>
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
          disabled={(!isRunning && !selectedClient) || (!isRunning && !selectedEntryType) || saving}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : isRunning ? (
            <><Square className="w-4 h-4 mr-2" /> Stop & Save</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Start Timer</>
          )}
        </Button>
      </div>
    </Card>
  );
}