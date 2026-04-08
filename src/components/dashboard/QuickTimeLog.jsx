import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function QuickTimeLog({ clients, onTimeSaved }) {
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [entryTypeCode, setEntryTypeCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [requiresFieldCompletion, setRequiresFieldCompletion] = useState(false);

  // Load entry types on mount
  useEffect(() => {
    base44.entities.EntryType.filter({ is_active: true })
      .then(types => setEntryTypes(types))
      .catch(err => console.error('Failed to load entry types:', err));
  }, []);

  // Update selected entry type when code changes
  useEffect(() => {
    if (entryTypeCode) {
      const et = entryTypes.find(t => t.code === entryTypeCode);
      setSelectedEntryType(et || null);
      setRequiresFieldCompletion(et?.requires_field_answers || false);
    } else {
      setSelectedEntryType(null);
      setRequiresFieldCompletion(false);
    }
  }, [entryTypeCode, entryTypes]);

  const calculateDuration = () => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  // Calculate reporting period key (YYYY-MM for monthly)
  const getReportingPeriodKey = () => {
    return date.substring(0, 7); // YYYY-MM
  };

  const handleSave = async () => {
    if (!clientId || !startTime || !endTime || !entryTypeCode) {
      toast.error("Please fill in all required fields");
      return;
    }

    const duration = calculateDuration();
    if (duration <= 0) {
      toast.error("End time must be after start time");
      return;
    }

    // Check if entry is billable or reportable and requires field completion
    const isBillableOrReportable = selectedEntryType?.is_billable || selectedEntryType?.is_reportable;
    if (isBillableOrReportable && requiresFieldCompletion) {
      toast.error("This entry type requires structured report fields. Please use the full time entry form to complete required fields.");
      return;
    }

    setSaving(true);
    try {
      const actualClientId = clientId?.startsWith('self:') ? null : clientId;
      const reportingPeriodKey = getReportingPeriodKey();

      // Create time entry with full structured data
      const entry = await base44.entities.TimeEntry.create({
        client_id: actualClientId,
        entry_type_id: selectedEntryType?.id,
        entry_type_code: entryTypeCode,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        reporting_period_key: reportingPeriodKey,
        description: description || "Quick log entry",
        is_billable: selectedEntryType?.is_billable || false,
        is_reportable: selectedEntryType?.is_reportable || true,
        status: requiresFieldCompletion ? "draft" : "submitted",
        is_payroll_eligible: selectedEntryType?.is_payroll_eligible !== false
      });

      // Create empty field answers if required (allows staff to complete later)
      if (requiresFieldCompletion) {
        await base44.entities.ReportFieldAnswer.create({
          time_entry_id: entry.id,
          entry_type_id: selectedEntryType?.id,
          entry_type_code: entryTypeCode,
          answers: {},
          required_fields_complete: false,
          report_ready: false
        });
        toast.success("Entry saved as draft. Complete required fields to finalize.");
      } else {
        toast.success("Time logged");
      }

      setClientId("");
      setDate(new Date().toISOString().split("T")[0]);
      setStartTime("");
      setEndTime("");
      setDescription("");
      setEntryTypeCode("");

      if (onTimeSaved) onTimeSaved();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error("Failed to save time entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <div className="h-1 w-full bg-violet-50" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Plus className="w-4 h-4" />
          <span>Quick Log</span>
        </div>

        {/* Client */}
        <Select value={clientId} onValueChange={setClientId}>
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

        {/* Date */}
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border-slate-200 text-sm"
        />

        {/* Time */}
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

        {/* Description */}
        <Input
          placeholder="Description..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border-slate-200 text-sm"
        />

        {/* Entry Type - now required */}
        <Select value={entryTypeCode} onValueChange={setEntryTypeCode}>
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue placeholder="Select entry type..." />
          </SelectTrigger>
          <SelectContent>
            {entryTypes.map(et => (
              <SelectItem key={et.code} value={et.code}>
                {et.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Field completion warning */}
        {requiresFieldCompletion && (
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              This entry type requires structured reporting fields. Entry will be saved as draft—you'll complete fields afterward.
            </p>
          </div>
        )}

        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleSave}
          disabled={!clientId || !startTime || !endTime || !entryTypeCode || saving}
        >
          <Clock className="w-4 h-4 mr-2" /> {requiresFieldCompletion ? "Log (Draft)" : "Log Time"}
        </Button>
      </div>
    </Card>
  );
}