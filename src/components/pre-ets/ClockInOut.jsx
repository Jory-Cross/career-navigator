import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Play, Square, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ClockInOut({ clientId, clientName }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isClockedIn && clockInTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - clockInTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const handleClockIn = () => {
    const now = new Date();
    setClockInTime(now);
    setIsClockedIn(true);
    setElapsedSeconds(0);
    toast.success(`Clocked in at ${format(now, "h:mm a")}`);
  };

  const handleClockOut = () => {
    setShowNotes(true);
  };

  const saveTimeEntry = async () => {
    if (!clockInTime || !isClockedIn) {
      toast.error("No active clock-in");
      return;
    }

    setSaving(true);
    try {
      const endTime = new Date();
      const durationMinutes = Math.round(elapsedSeconds / 60);

      if (durationMinutes < 1) {
        toast.error("Clock-in duration must be at least 1 minute");
        setSaving(false);
        return;
      }

      const startTimeStr = format(clockInTime, "HH:mm");
      const endTimeStr = format(endTime, "HH:mm");
      const dateStr = format(clockInTime, "yyyy-MM-dd");

      await base44.entities.TimeEntry.create({
        client_id: clientId,
        date: dateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        duration_minutes: durationMinutes,
        description: notes || "Work session",
        category: "work_readiness"
      });

      toast.success(`Time entry saved: ${durationMinutes} minutes`);
      
      // Reset
      setIsClockedIn(false);
      setClockInTime(null);
      setElapsedSeconds(0);
      setNotes("");
      setShowNotes(false);
    } catch (error) {
      toast.error("Failed to save time entry");
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Work Hours Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status */}
            <div className="p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Status</span>
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                  isClockedIn ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {isClockedIn ? "Clocked In" : "Clocked Out"}
                </span>
              </div>

              {/* Timer Display */}
              <div className="text-center py-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg mb-4">
                <div className="text-5xl font-bold font-mono text-slate-800 mb-2">
                  {formatTime(elapsedSeconds)}
                </div>
                {isClockedIn && clockInTime && (
                  <p className="text-xs text-slate-500">
                    Started at {format(clockInTime, "h:mm a")}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                {!isClockedIn ? (
                  <Button
                    onClick={handleClockIn}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" /> Clock In
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleClockOut}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <Square className="w-4 h-4 mr-2" /> Clock Out
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Info */}
            <p className="text-xs text-slate-500 text-center">
              {isClockedIn 
                ? "Your work time is being tracked"
                : "Clock in to start tracking your work hours"
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Clock Out Dialog */}
      <Dialog open={showNotes} onOpenChange={setShowNotes}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clock Out Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Duration</p>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round(elapsedSeconds / 60)} minutes
              </p>
            </div>

            <div>
              <Label className="text-xs">Work Description (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you work on? (e.g., Job application prep, Interview practice, Skill development)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotes(false)}
              disabled={saving}
            >
              Continue Clocking In
            </Button>
            <Button
              onClick={saveTimeEntry}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save & Clock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}